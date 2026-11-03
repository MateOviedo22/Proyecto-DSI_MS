from decimal import Decimal

from sqlalchemy import select

from app.extensions import db
from app.models.compras import (
    Lote,
    RecepcionMercaderia,
    DetalleRecepcion,
    DetalleCompra,
)


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


def finalizar_recepcion(recepcion_id):
    recepcion = db.session.get(RecepcionMercaderia, recepcion_id)

    if not recepcion:
        raise ValueError("La recepción no existe.")

    if recepcion.estado != "EN_REVISION":
        raise ValueError("La recepción ya fue finalizada.")

    if not recepcion.detalles:
        raise ValueError("La recepción no tiene detalles.")

    if any(d.resultado_revision == "PENDIENTE" for d in recepcion.detalles):
        raise ValueError("Debe revisar todos los productos antes de finalizar.")

    total_aceptado = sum(
        d.cantidad_aceptada for d in recepcion.detalles
    )

    try:
        for detalle_recepcion in recepcion.detalles:
            if detalle_recepcion.cantidad_aceptada <= 0:
                continue

            detalle_compra = db.session.get(
                DetalleCompra,
                detalle_recepcion.detalle_compra_id
            )

            if not detalle_compra:
                raise ValueError("No se encontró el detalle de compra asociado.")

            if detalle_recepcion.cantidad_aceptada > 0:
                costo_envio_unitario = (
                    recepcion.costo_envio / total_aceptado
                    if total_aceptado > 0
                    else Decimal("0.00")
                )

                costo_adquisicion = detalle_compra.costo_unitario
                costo_total = costo_adquisicion + costo_envio_unitario

                lote = Lote(
                    detalle_recepcion_id=detalle_recepcion.id,
                    cantidad_inicial=detalle_recepcion.cantidad_aceptada,
                    costo_unitario_adquisicion=costo_adquisicion,
                    costo_envio_unitario=costo_envio_unitario,
                    costo_unitario_total=costo_total
                )

                db.session.add(lote)

        recepcion.estado = "RECIBIDA"

        compra = db.session.get(Compra, recepcion.compra_id)

        # Determinar si se completó la recepción de todos los productos solicitados.
        from sqlalchemy import func

        detalles_compra = compra.detalles
        compra_completa = True
        hay_cantidad_recibida = False

        for detalle_compra in detalles_compra:
            total_recibido = db.session.scalar(
                select(func.coalesce(func.sum(DetalleRecepcion.cantidad_recibida), 0))
                .join(
                    RecepcionMercaderia,
                    RecepcionMercaderia.id == DetalleRecepcion.recepcion_id
                )
                .where(
                    DetalleRecepcion.detalle_compra_id == detalle_compra.id,
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