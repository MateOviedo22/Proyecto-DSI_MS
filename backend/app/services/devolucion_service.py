
from sqlalchemy import select

from app.extensions import db
from app.models.ventas import Venta, Devolucion
from app.models.personas import Usuario


ESTADOS_DEVOLUCION = {
    "REGISTRADA",
    "EN_REVISION",
    "APROBADA",
    "RECHAZADA",
    "COMPLETADA",
}


TRANSICIONES_DEVOLUCION = {
    "REGISTRADA": {"EN_REVISION", "RECHAZADA"},
    "EN_REVISION": {"APROBADA", "RECHAZADA"},
    "APROBADA": {"COMPLETADA"},
    "RECHAZADA": set(),
    "COMPLETADA": set(),
}


def crear_devolucion(venta_id, usuario_id, motivo, observaciones=None):
    """Registra una solicitud de devolución para una venta completada."""
    try:
        if not motivo or not motivo.strip():
            raise ValueError("Debe indicar el motivo de la devolución.")

        venta = db.session.scalar(
            select(Venta)
            .where(Venta.id == venta_id)
            .with_for_update()
        )

        if not venta:
            raise ValueError("La venta indicada no existe.")

        if venta.estado != "COMPLETADA":
            raise ValueError(
                "Solo se pueden registrar devoluciones de ventas completadas."
            )

        usuario = db.session.get(Usuario, usuario_id)

        if not usuario or not usuario.estado:
            raise ValueError("El usuario no existe o está inactivo.")

        devolucion_abierta = db.session.scalar(
            select(Devolucion)
            .where(
                Devolucion.venta_id == venta_id,
                Devolucion.estado.in_(
                    ["REGISTRADA", "EN_REVISION", "APROBADA"]
                )
            )
            .limit(1)
        )

        if devolucion_abierta:
            raise ValueError(
                "La venta ya tiene una devolución pendiente de finalizar."
            )

        devolucion = Devolucion(
            venta_id=venta.id,
            usuario_id=usuario.id,
            motivo=motivo.strip(),
            estado="REGISTRADA",
            observaciones=observaciones,
        )

        db.session.add(devolucion)
        db.session.commit()

        return devolucion

    except Exception:
        db.session.rollback()
        raise


def obtener_devolucion(devolucion_id):
    return db.session.get(Devolucion, devolucion_id)


def listar_devoluciones():
    return db.session.scalars(
        select(Devolucion)
        .order_by(Devolucion.fecha_devolucion.desc())
    ).all()


def listar_devoluciones_por_venta(venta_id):
    return db.session.scalars(
        select(Devolucion)
        .where(Devolucion.venta_id == venta_id)
        .order_by(Devolucion.fecha_devolucion.desc())
    ).all()


def listar_devoluciones_por_estado(estado):
    if estado not in ESTADOS_DEVOLUCION:
        raise ValueError("El estado de devolución no es válido.")

    return db.session.scalars(
        select(Devolucion)
        .where(Devolucion.estado == estado)
        .order_by(Devolucion.fecha_devolucion.desc())
    ).all()


def actualizar_observaciones(devolucion_id, observaciones):
    try:
        devolucion = db.session.get(Devolucion, devolucion_id)

        if not devolucion:
            raise ValueError("La devolución indicada no existe.")

        if devolucion.estado in {"COMPLETADA", "RECHAZADA"}:
            raise ValueError(
                "No se pueden modificar devoluciones cerradas."
            )

        devolucion.observaciones = observaciones

        db.session.commit()
        return devolucion

    except Exception:
        db.session.rollback()
        raise


def cambiar_estado_devolucion(devolucion_id, nuevo_estado):
    """Cambia el estado general respetando las transiciones permitidas."""
    try:
        devolucion = db.session.scalar(
            select(Devolucion)
            .where(Devolucion.id == devolucion_id)
            .with_for_update()
        )

        if not devolucion:
            raise ValueError("La devolución indicada no existe.")

        if nuevo_estado not in ESTADOS_DEVOLUCION:
            raise ValueError("El estado indicado no es válido.")

        permitidos = TRANSICIONES_DEVOLUCION.get(
            devolucion.estado, set()
        )

        if nuevo_estado not in permitidos:
            raise ValueError(
                f"No se permite cambiar de {devolucion.estado} "
                f"a {nuevo_estado}."
            )

        devolucion.estado = nuevo_estado

        db.session.commit()
        return devolucion

    except Exception:
        db.session.rollback()
        raise
