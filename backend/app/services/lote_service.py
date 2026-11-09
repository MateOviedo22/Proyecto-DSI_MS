from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select, func

from app.extensions import db
from app.models.compras import (
    Lote,
    RecepcionMercaderia,
    DetalleRecepcion,
    DetalleCompra,
    Compra,
)
from app.models.personas import Usuario
from app.models.inventario import MovimientoInventario
from app.services.movimiento_inventario_service import registrar_entrada


def obtener_lote(lote_id):
    return db.session.get(Lote, lote_id)


def listar_lotes():
    return db.session.scalars(
        select(Lote).order_by(Lote.fecha_recepcion.desc())
    ).all()


def listar_lotes_por_detalle_recepcion(detalle_recepcion_id):
    return db.session.scalars(
        select(Lote)
        .where(Lote.detalle_recepcion_id == detalle_recepcion_id)
    ).all()


def finalizar_recepcion(recepcion_id, usuario_id):
    # Bloquea la recepción para evitar que dos solicitudes
    # intenten finalizarla simultáneamente.
    recepcion = db.session.scalar(
        select(RecepcionMercaderia)
        .where(RecepcionMercaderia.id == recepcion_id)
        .with_for_update()
    )

    if not recepcion:
        raise ValueError("La recepción no existe.")

    if recepcion.estado != "EN_REVISION":
        raise ValueError("La recepción ya fue finalizada.")

    usuario = db.session.get(Usuario, usuario_id)

    if not usuario or not usuario.estado:
        raise ValueError("El usuario no existe o está inactivo.")

    if not recepcion.detalles:
        raise ValueError("La recepción no tiene detalles.")

    if any(
        detalle.resultado_revision == "PENDIENTE"
        for detalle in recepcion.detalles
    ):
        raise ValueError(
            "Debe revisar todos los productos antes de finalizar."
        )

    total_aceptado = sum(
        detalle.cantidad_aceptada
        for detalle in recepcion.detalles
    )

    try:
        for detalle_recepcion in recepcion.detalles:
            cantidad_aceptada = detalle_recepcion.cantidad_aceptada

            if cantidad_aceptada <= 0:
                continue

            detalle_compra = db.session.get(
                DetalleCompra,
                detalle_recepcion.detalle_compra_id
            )

            if not detalle_compra:
                raise ValueError(
                    "No se encontró el detalle de compra asociado."
                )

            # Evita crear otro lote si el detalle ya fue procesado.
            lote_existente = db.session.scalar(
                select(Lote.id).where(
                    Lote.detalle_recepcion_id == detalle_recepcion.id
                )
            )

            if lote_existente is not None:
                raise ValueError(
                    f"El detalle de recepción {detalle_recepcion.id} "
                    "ya tiene un lote registrado."
                )

            costo_envio_total = (
                recepcion.costo_envio
                if recepcion.costo_envio is not None
                else Decimal("0.00")
            )

            # C = C_adq + E / n. El envío unitario se redondea a centavos: sin esto,
            # un reparto como 100 / 6 = 16.6666... hace fallar el registro del movimiento
            # (el costo admite máximo dos decimales) y la recepción no se puede finalizar.
            costo_envio_unitario = (
                (costo_envio_total / Decimal(str(total_aceptado))).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                if total_aceptado > 0
                else Decimal("0.00")
            )

            costo_adquisicion = Decimal(
                str(detalle_compra.costo_unitario)
            )

            costo_total = (
                costo_adquisicion + costo_envio_unitario
            )

            lote = Lote(
                detalle_recepcion_id=detalle_recepcion.id,
                cantidad_inicial=cantidad_aceptada,
                costo_unitario_adquisicion=costo_adquisicion,
                costo_envio_unitario=costo_envio_unitario,
                costo_unitario_total=costo_total
            )

            db.session.add(lote)
            db.session.flush()

            # Registra la entrada y actualiza Existencia.
            # No confirma todavía: todo se confirma al final.
            registrar_entrada(
                producto_id=detalle_compra.producto_id,
                usuario_id=usuario_id,
                cantidad=cantidad_aceptada,
                lote_id=lote.id,
                detalle_recepcion_id=detalle_recepcion.id,
                costo_unitario_aplicado=costo_total,
                motivo=f"Entrada por recepción #{recepcion.id}",
                confirmar_transaccion=False
            )

        # La recepción se marca como recibida dentro de la misma
        # transacción que creó los lotes y movimientos.
        recepcion.estado = "RECIBIDA"
        db.session.flush()

        compra = db.session.get(Compra, recepcion.compra_id)

        if not compra:
            raise ValueError("No se encontró la compra asociada.")

        compra_completa = True
        hay_cantidad_recibida = False

        for detalle_compra in compra.detalles:
            total_recibido = db.session.scalar(
                select(
                    func.coalesce(
                        func.sum(DetalleRecepcion.cantidad_recibida),
                        0
                    )
                )
                .join(
                    RecepcionMercaderia,
                    RecepcionMercaderia.id
                    == DetalleRecepcion.recepcion_id
                )
                .where(
                    DetalleRecepcion.detalle_compra_id
                    == detalle_compra.id,
                    RecepcionMercaderia.compra_id == compra.id,
                    RecepcionMercaderia.estado == "RECIBIDA"
                )
            )

            if total_recibido > 0:
                hay_cantidad_recibida = True

            if total_recibido < detalle_compra.cantidad_solicitada:
                compra_completa = False

        if compra_completa:
            compra.estado = "RECIBIDA"
        elif hay_cantidad_recibida:
            compra.estado = "PARCIALMENTE_RECIBIDA"

        db.session.commit()
        return recepcion

    except Exception:
        db.session.rollback()
        raise