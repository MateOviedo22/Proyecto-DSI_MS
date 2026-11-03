from decimal import Decimal

from sqlalchemy import select

from app.extensions import db
from app.models.compras import (
    Compra,
    RecepcionMercaderia,
    DetalleRecepcion,
)


def crear_recepcion(compra_id, usuario_id, costo_envio=0, observaciones=None):
    compra = db.session.get(Compra, compra_id)

    if not compra:
        raise ValueError("La compra no existe.")

    if compra.estado in {"BORRADOR", "CANCELADA", "RECIBIDA"}:
        raise ValueError("La compra no permite registrar una recepción.")

    if not compra.detalles:
        raise ValueError("La compra no contiene productos.")

    from app.models.personas import Usuario

    usuario = db.session.get(Usuario, usuario_id)

    if not usuario or not usuario.estado:
        raise ValueError("El usuario no existe o está inactivo.")

    try:
        costo_envio = Decimal(str(costo_envio))
    except Exception:
        raise ValueError("El costo de envío debe ser válido.")

    if not costo_envio.is_finite() or costo_envio < 0:
        raise ValueError("El costo de envío no puede ser negativo.")

    if costo_envio.as_tuple().exponent < -2:
        raise ValueError("El costo de envío admite máximo dos decimales.")

    recepcion = RecepcionMercaderia(
        compra_id=compra_id,
        usuario_id=usuario_id,
        costo_envio=costo_envio,
        estado="EN_REVISION",
        observaciones=observaciones.strip() if observaciones else None
    )

    try:
        db.session.add(recepcion)
        db.session.flush()

        for detalle in compra.detalles:
            db.session.add(
                DetalleRecepcion(
                    recepcion_id=recepcion.id,
                    detalle_compra_id=detalle.id,
                    cantidad_recibida=0,
                    cantidad_aceptada=0,
                    cantidad_rechazada=0,
                    resultado_revision="PENDIENTE"
                )
            )

        db.session.commit()
        return recepcion

    except Exception:
        db.session.rollback()
        raise


def obtener_recepcion(recepcion_id):
    return db.session.get(RecepcionMercaderia, recepcion_id)


def listar_recepciones():
    return db.session.scalars(
        select(RecepcionMercaderia)
        .order_by(RecepcionMercaderia.fecha_recepcion.desc())
    ).all()


def listar_recepciones_por_compra(compra_id):
    compra = db.session.get(Compra, compra_id)

    if not compra:
        raise ValueError("La compra no existe.")

    return db.session.scalars(
        select(RecepcionMercaderia)
        .where(RecepcionMercaderia.compra_id == compra_id)
        .order_by(RecepcionMercaderia.fecha_recepcion.desc())
    ).all()


def actualizar_observaciones_recepcion(recepcion_id, observaciones):
    recepcion = obtener_recepcion(recepcion_id)

    if not recepcion:
        raise ValueError("La recepción no existe.")

    if recepcion.estado != "EN_REVISION":
        raise ValueError("La recepción ya fue finalizada.")

    recepcion.observaciones = observaciones.strip() if observaciones else None
    db.session.commit()
    return recepcion