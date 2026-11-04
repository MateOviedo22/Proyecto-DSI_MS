
from sqlalchemy import select, func

from app.extensions import db
from app.models.ventas import (
    Venta,
    Devolucion,
    DetalleVenta,
    DetalleDevolucion,
    UnidadSerializada,
)
from app.models.catalogo import Producto
from app.models.inventario import MovimientoInventario
from app.models.personas import Usuario
from app.services.movimiento_inventario_service import registrar_movimiento


ESTADOS_PRODUCTO = {
    "BUEN_ESTADO",
    "DANADO",
    "DEFECTUOSO",
    "INCOMPLETO",
}


def obtener_devolucion_para_editar(devolucion_id):
    devolucion = db.session.scalar(
        select(Devolucion)
        .where(Devolucion.id == devolucion_id)
        .with_for_update()
    )

    if not devolucion:
        raise ValueError("La devolución indicada no existe.")

    if devolucion.estado not in {"REGISTRADA", "EN_REVISION"}:
        raise ValueError(
            "La devolución no permite modificar sus detalles."
        )

    return devolucion


def obtener_cantidad_devuelta(detalle_venta_id):
    """Suma las cantidades registradas en devoluciones anteriores."""
    cantidad = db.session.scalar(
        select(func.coalesce(func.sum(DetalleDevolucion.cantidad), 0))
        .join(
            Devolucion,
            Devolucion.id == DetalleDevolucion.devolucion_id
        )
        .where(
            DetalleDevolucion.detalle_venta_id == detalle_venta_id,
            Devolucion.estado != "RECHAZADA",
        )
    )

    return int(cantidad or 0)


def agregar_detalle_devolucion(
    devolucion_id,
    detalle_venta_id,
    cantidad,
    unidad_serializada_id=None,
    observaciones=None,
):
    """
    Agrega un producto vendido a una devolución.

    No modifica las existencias ni registra movimientos.
    """
    try:
        if isinstance(cantidad, bool) or not isinstance(cantidad, int) or cantidad <= 0:
            raise ValueError("La cantidad debe ser un entero mayor que cero.")

        devolucion = obtener_devolucion_para_editar(devolucion_id)

        detalle_venta = db.session.scalar(
            select(DetalleVenta)
            .where(DetalleVenta.id == detalle_venta_id)
            .with_for_update()
        )

        if not detalle_venta:
            raise ValueError("El detalle de venta indicado no existe.")

        if detalle_venta.venta_id != devolucion.venta_id:
            raise ValueError(
                "El producto no pertenece a la venta de esta devolución."
            )

        producto = db.session.get(Producto, detalle_venta.producto_id)

        if not producto:
            raise ValueError("El producto asociado no existe.")

        cantidad_anterior = obtener_cantidad_devuelta(detalle_venta_id)

        if cantidad_anterior + cantidad > detalle_venta.cantidad:
            raise ValueError(
                f"La cantidad supera lo vendido. "
                f"Cantidad vendida: {detalle_venta.cantidad}; "
                f"ya devuelta: {cantidad_anterior}; "
                f"solicitada: {cantidad}."
            )

        if producto.requiere_numero_serie:
            if cantidad != 1:
                raise ValueError(
                    "Los productos serializados deben registrarse "
                    "individualmente."
                )

            if unidad_serializada_id is None:
                raise ValueError(
                    "Debe indicar el número de serie del producto."
                )

            unidad = db.session.scalar(
                select(UnidadSerializada)
                .where(
                    UnidadSerializada.id == unidad_serializada_id
                )
                .with_for_update()
            )

            if not unidad:
                raise ValueError("La unidad serializada no existe.")

            if unidad.producto_id != producto.id:
                raise ValueError(
                    "La unidad serializada no corresponde al producto."
                )

            if unidad.detalle_venta_id != detalle_venta.id:
                raise ValueError(
                    "La unidad serializada no pertenece a este detalle de venta."
                )

            if unidad.estado != "VENDIDA":
                raise ValueError(
                    "La unidad no se encuentra en estado VENDIDA."
                )

            if any(
                detalle.unidad_serializada_id == unidad.id
                for detalle in db.session.scalars(
                    select(DetalleDevolucion)
                    .join(Devolucion)
                    .where(
                        DetalleDevolucion.unidad_serializada_id == unidad.id,
                        Devolucion.estado != "RECHAZADA",
                    )
                ).all()
            ):
                raise ValueError(
                    "Esta unidad serializada ya está registrada en una devolución."
                )

        else:
            if unidad_serializada_id is not None:
                raise ValueError(
                    "No debe indicar una unidad serializada para este producto."
                )

        detalle = DetalleDevolucion(
            devolucion_id=devolucion.id,
            detalle_venta_id=detalle_venta.id,
            unidad_serializada_id=unidad_serializada_id,
            cantidad=cantidad,
            estado_producto="PENDIENTE",
            se_reintegra_inventario=False,
            observaciones=observaciones,
        )

        if devolucion.estado == "REGISTRADA":
            devolucion.estado = "EN_REVISION"

        db.session.add(detalle)
        db.session.commit()

        return detalle

    except Exception:
        db.session.rollback()
        raise


def obtener_detalle_devolucion(detalle_devolucion_id):
    return db.session.get(DetalleDevolucion, detalle_devolucion_id)


def listar_detalles_devolucion(devolucion_id):
    devolucion = db.session.get(Devolucion, devolucion_id)

    if not devolucion:
        raise ValueError("La devolución indicada no existe.")

    return db.session.scalars(
        select(DetalleDevolucion)
        .where(DetalleDevolucion.devolucion_id == devolucion_id)
        .order_by(DetalleDevolucion.id)
    ).all()


def inspeccionar_detalle_devolucion(
    detalle_devolucion_id,
    estado_producto,
    se_reintegra_inventario,
    observaciones=None,
):
    """
    Registra el resultado de la inspección.

    Todavía no genera movimientos de inventario.
    """
    try:
        if not isinstance(estado_producto, str):
            raise ValueError("El estado del producto debe ser texto.")

        estado_producto = estado_producto.strip().upper()

        if estado_producto not in ESTADOS_PRODUCTO:
            raise ValueError("El estado del producto no es válido.")

        if not isinstance(se_reintegra_inventario, bool):
            raise ValueError(
                "Debe indicar si el producto se reintegra al inventario."
            )

        detalle = db.session.scalar(
            select(DetalleDevolucion)
            .where(DetalleDevolucion.id == detalle_devolucion_id)
            .with_for_update()
        )

        if not detalle:
            raise ValueError("El detalle de devolución no existe.")

        devolucion = obtener_devolucion_para_editar(
            detalle.devolucion_id
        )

        if estado_producto == "BUEN_ESTADO" and not se_reintegra_inventario:
            # Se permite no reintegrar un producto en buen estado
            # si existe una decisión administrativa justificada.
            if not observaciones or not observaciones.strip():
                raise ValueError(
                    "Debe justificar por qué no se reintegra un producto "
                    "en buen estado."
                )

        if estado_producto != "BUEN_ESTADO" and se_reintegra_inventario:
            raise ValueError(
                "Un producto dañado, defectuoso o incompleto no puede "
                "reintegrarse directamente al inventario disponible."
            )

        detalle.estado_producto = estado_producto
        detalle.se_reintegra_inventario = se_reintegra_inventario

        if observaciones is not None:
            detalle.observaciones = observaciones

        db.session.commit()
        return detalle

    except Exception:
        db.session.rollback()
        raise


def finalizar_devolucion(devolucion_id, usuario_id):
    """
    Finaliza una devolución aprobada.

    Los productos autorizados generan movimientos ENTRADA.
    Todos los movimientos y cambios de estado se confirman juntos.
    """
    try:
        devolucion = db.session.scalar(
            select(Devolucion)
            .where(Devolucion.id == devolucion_id)
            .with_for_update()
        )

        if not devolucion:
            raise ValueError("La devolución indicada no existe.")

        if devolucion.estado != "APROBADA":
            raise ValueError(
                "Solo se pueden finalizar devoluciones aprobadas."
            )

        usuario = db.session.get(Usuario, usuario_id)

        if not usuario or not usuario.estado:
            raise ValueError("El usuario no existe o está inactivo.")

        detalles = db.session.scalars(
            select(DetalleDevolucion)
            .where(DetalleDevolucion.devolucion_id == devolucion_id)
            .order_by(DetalleDevolucion.id)
            .with_for_update()
        ).all()

        if not detalles:
            raise ValueError(
                "No se puede finalizar una devolución sin productos."
            )

        for detalle in detalles:
            if detalle.estado_producto == "PENDIENTE":
                raise ValueError(
                    "Todos los productos deben inspeccionarse antes de finalizar."
                )

            movimiento_existente = db.session.scalar(
                select(MovimientoInventario)
                .where(
                    MovimientoInventario.detalle_devolucion_id == detalle.id,
                    MovimientoInventario.tipo_movimiento == "ENTRADA",
                )
            )

            if movimiento_existente:
                raise ValueError(
                    f"El detalle {detalle.id} ya tiene un movimiento de entrada."
                )

            if detalle.se_reintegra_inventario:
                if detalle.estado_producto != "BUEN_ESTADO":
                    raise ValueError(
                        "Solo los productos en buen estado pueden reintegrarse."
                    )

                unidad = None

                if detalle.unidad_serializada_id is not None:
                    unidad = db.session.scalar(
                        select(UnidadSerializada)
                        .where(
                            UnidadSerializada.id == detalle.unidad_serializada_id
                        )
                        .with_for_update()
                    )

                    if not unidad or unidad.estado != "VENDIDA":
                        raise ValueError(
                            "La unidad serializada no está disponible para devolución."
                        )

                registrar_movimiento(
                    producto_id=detalle.detalle_venta.producto_id,
                    usuario_id=usuario_id,
                    tipo_movimiento="ENTRADA",
                    cantidad=detalle.cantidad,
                    lote_id=unidad.lote_id if unidad else None,
                    detalle_devolucion_id=detalle.id,
                    motivo=f"Reintegro por devolución #{devolucion.id}",
                    confirmar_transaccion=False,
                )

                if unidad:
                    unidad.estado = "EN_STOCK"
                    unidad.detalle_venta_id = None

            elif detalle.unidad_serializada_id is not None:
                unidad = db.session.scalar(
                    select(UnidadSerializada)
                    .where(
                        UnidadSerializada.id == detalle.unidad_serializada_id
                    )
                    .with_for_update()
                )

                if unidad:
                    unidad.estado = "DEVUELTA_NO_REINTEGRABLE"

        devolucion.estado = "COMPLETADA"

        db.session.commit()
        return devolucion

    except Exception:
        db.session.rollback()
        raise
