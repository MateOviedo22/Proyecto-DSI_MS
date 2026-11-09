from sqlalchemy import select, func

from app.extensions import db
from app.models.compras import (
    Compra,
    DetalleCompra,
    RecepcionMercaderia,
    DetalleRecepcion,
)


def obtener_detalle_recepcion(detalle_recepcion_id):
    return db.session.get(DetalleRecepcion, detalle_recepcion_id)


def listar_detalles_recepcion(recepcion_id):
    recepcion = db.session.get(RecepcionMercaderia, recepcion_id)

    if not recepcion:
        raise ValueError("La recepción no existe.")

    return db.session.scalars(
        select(DetalleRecepcion)
        .where(DetalleRecepcion.recepcion_id == recepcion_id)
        .order_by(DetalleRecepcion.id)
    ).all()


def registrar_revision(
    detalle_recepcion_id,
    cantidad_recibida,
    cantidad_aceptada,
    cantidad_rechazada,
    motivo_rechazo=None,
    observaciones=None
):
    detalle = obtener_detalle_recepcion(detalle_recepcion_id)

    if not detalle:
        raise ValueError("El detalle de recepción no existe.")

    recepcion = db.session.get(
        RecepcionMercaderia,
        detalle.recepcion_id
    )

    if recepcion.estado != "EN_REVISION":
        raise ValueError("La recepción ya fue finalizada.")

    if detalle.resultado_revision != "PENDIENTE":
        raise ValueError("Este detalle ya fue revisado.")

    cantidades = [
        cantidad_recibida,
        cantidad_aceptada,
        cantidad_rechazada
    ]

    if any(
        isinstance(c, bool) or not isinstance(c, int) or c < 0
        for c in cantidades
    ):
        raise ValueError("Las cantidades deben ser números enteros no negativos.")

    if cantidad_recibida != cantidad_aceptada + cantidad_rechazada:
        raise ValueError(
            "La cantidad recibida debe coincidir con la suma de aceptadas y rechazadas."
        )

    detalle_compra = db.session.get(
        DetalleCompra,
        detalle.detalle_compra_id
    )

    recibidas_anteriores = db.session.scalar(
        select(func.coalesce(func.sum(DetalleRecepcion.cantidad_recibida), 0))
        .join(
            RecepcionMercaderia,
            RecepcionMercaderia.id == DetalleRecepcion.recepcion_id
        )
        .where(
            DetalleRecepcion.detalle_compra_id == detalle.detalle_compra_id,
            RecepcionMercaderia.compra_id == recepcion.compra_id,
            DetalleRecepcion.id != detalle.id
        )
    )

    if recibidas_anteriores + cantidad_recibida > detalle_compra.cantidad_solicitada:
        raise ValueError("La cantidad recibida supera la cantidad solicitada.")

    if cantidad_rechazada > 0 and not (motivo_rechazo and motivo_rechazo.strip()):
        raise ValueError("Debe indicar el motivo del rechazo.")

    if cantidad_aceptada > 0 and cantidad_rechazada > 0:
        resultado = "PARCIAL"
    elif cantidad_aceptada > 0:
        resultado = "ACEPTADO"
    elif cantidad_rechazada > 0:
        resultado = "RECHAZADO"
    else:
        resultado = "SIN_RECEPCION"

    detalle.cantidad_recibida = cantidad_recibida
    detalle.cantidad_aceptada = cantidad_aceptada
    detalle.cantidad_rechazada = cantidad_rechazada
    detalle.resultado_revision = resultado
    detalle.motivo_rechazo = motivo_rechazo.strip() if motivo_rechazo else None
    detalle.observaciones = observaciones.strip() if observaciones else None

    try:
        db.session.commit()
        return detalle
    except Exception:
        db.session.rollback()
        raise