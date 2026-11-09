from datetime import timedelta

from flask import g, has_request_context
from sqlalchemy import case, select

from app.extensions import db
from app.models.ventas import UnidadSerializada


def obtener_unidades_disponibles(producto_id, cantidad):
    """Obtiene y bloquea unidades serializadas disponibles."""

    # Si el vendedor eligió números de serie concretos (los que tiene en la mano),
    # esas unidades van primero; el resto se asigna por orden de ingreso (FIFO).
    preferidas = []
    if has_request_context():
        preferidas = (getattr(g, "series_preferidas", None) or {}).get(producto_id, [])

    orden = [UnidadSerializada.id]
    if preferidas:
        orden.insert(0, case((UnidadSerializada.id.in_(preferidas), 0), else_=1))

    unidades = db.session.scalars(
        select(UnidadSerializada)
        .where(
            UnidadSerializada.producto_id == producto_id,
            UnidadSerializada.estado == "EN_STOCK",
            UnidadSerializada.detalle_venta_id.is_(None)
        )
        .order_by(*orden)
        .limit(cantidad)
        .with_for_update()
    ).all()

    if len(unidades) != cantidad:
        raise ValueError(
            f"No hay suficientes unidades serializadas disponibles "
            f"para el producto {producto_id}. "
            f"Se requieren {cantidad} y se encontraron {len(unidades)}."
        )

    return unidades


def asignar_unidades_a_venta(detalle_venta, unidades, fecha_venta):
    """
    Asocia las unidades serializadas al detalle de venta
    y establece el vencimiento de garantía.
    """

    dias_garantia = detalle_venta.dias_garantia

    for unidad in unidades:
        if unidad.estado != "EN_STOCK" or unidad.detalle_venta_id is not None:
            raise ValueError(
                f"La unidad serializada {unidad.numero_serie} "
                "ya no está disponible."
            )

        unidad.estado = "VENDIDA"
        unidad.detalle_venta_id = detalle_venta.id

        if dias_garantia is not None and dias_garantia > 0:
            unidad.fecha_fin_garantia = (
                fecha_venta + timedelta(days=dias_garantia)
            )
        else:
            unidad.fecha_fin_garantia = None

    db.session.flush()

    return unidades


def obtener_unidad_serializada(unidad_id):
    unidad = db.session.get(UnidadSerializada, unidad_id)

    if not unidad:
        raise ValueError("La unidad serializada no existe.")

    return unidad


def listar_unidades_por_producto(producto_id):
    return db.session.scalars(
        select(UnidadSerializada)
        .where(UnidadSerializada.producto_id == producto_id)
        .order_by(UnidadSerializada.id)
    ).all()


def listar_unidades_por_detalle_venta(detalle_venta_id):
    return db.session.scalars(
        select(UnidadSerializada)
        .where(UnidadSerializada.detalle_venta_id == detalle_venta_id)
        .order_by(UnidadSerializada.id)
    ).all()