
from datetime import datetime, timezone

from sqlalchemy import select

from app.extensions import db
from app.models.ventas import (
    ReclamoGarantia,
    UnidadSerializada,
)


ESTADOS_RECLAMO = {
    "ABIERTO",
    "EN_REVISION",
    "APROBADO",
    "RECHAZADO",
    "RESUELTO",
    "CERRADO",
}


TRANSICIONES_RECLAMO = {
    "ABIERTO": {"EN_REVISION", "RECHAZADO"},
    "EN_REVISION": {"APROBADO", "RECHAZADO"},
    "APROBADO": {"RESUELTO"},
    "RECHAZADO": {"CERRADO"},
    "RESUELTO": {"CERRADO"},
    "CERRADO": set(),
}


def crear_reclamo_garantia(unidad_serializada_id, motivo):
    """
    Registra un reclamo de garantía asociado a una unidad serializada.
    La unidad debe haber sido vendida y tener una garantía vigente.
    """
    try:
        if not motivo or not motivo.strip():
            raise ValueError("Debe indicar el motivo del reclamo.")

        unidad = db.session.scalar(
            select(UnidadSerializada)
            .where(UnidadSerializada.id == unidad_serializada_id)
            .with_for_update()
        )

        if not unidad:
            raise ValueError("La unidad serializada no existe.")

        if unidad.estado not in {"VENDIDA", "DEVUELTA_NO_REINTEGRABLE"}:
            raise ValueError(
                "La unidad no tiene un estado válido para registrar un reclamo."
            )

        if unidad.fecha_fin_garantia is None:
            raise ValueError(
                "La unidad no tiene una garantía registrada."
            )

        fecha_actual = datetime.now(timezone.utc)

        if unidad.fecha_fin_garantia < fecha_actual:
            raise ValueError("La garantía de esta unidad ha vencido.")

        reclamo_abierto = db.session.scalar(
            select(ReclamoGarantia)
            .where(
                ReclamoGarantia.unidad_serializada_id == unidad.id,
                ReclamoGarantia.estado != "CERRADO",
            )
            .limit(1)
        )

        if reclamo_abierto:
            raise ValueError(
                "Esta unidad ya tiene un reclamo de garantía pendiente."
            )

        reclamo = ReclamoGarantia(
            unidad_serializada_id=unidad.id,
            motivo=motivo.strip(),
            estado="ABIERTO",
        )

        db.session.add(reclamo)
        db.session.commit()

        return reclamo

    except Exception:
        db.session.rollback()
        raise


def obtener_reclamo_garantia(reclamo_id):
    return db.session.get(ReclamoGarantia, reclamo_id)


def listar_reclamos_garantia():
    return db.session.scalars(
        select(ReclamoGarantia)
        .order_by(ReclamoGarantia.fecha_apertura.desc())
    ).all()


def listar_reclamos_por_unidad(unidad_serializada_id):
    unidad = db.session.get(UnidadSerializada, unidad_serializada_id)

    if not unidad:
        raise ValueError("La unidad serializada no existe.")

    return db.session.scalars(
        select(ReclamoGarantia)
        .where(
            ReclamoGarantia.unidad_serializada_id == unidad_serializada_id
        )
        .order_by(ReclamoGarantia.fecha_apertura.desc())
    ).all()


def listar_reclamos_por_estado(estado):
    if estado not in ESTADOS_RECLAMO:
        raise ValueError("El estado del reclamo no es válido.")

    return db.session.scalars(
        select(ReclamoGarantia)
        .where(ReclamoGarantia.estado == estado)
        .order_by(ReclamoGarantia.fecha_apertura.desc())
    ).all()


def actualizar_resolucion(reclamo_id, resolucion):
    """Registra la resolución de un reclamo aprobado."""
    try:
        reclamo = db.session.scalar(
            select(ReclamoGarantia)
            .where(ReclamoGarantia.id == reclamo_id)
            .with_for_update()
        )

        if not reclamo:
            raise ValueError("El reclamo indicado no existe.")

        if reclamo.estado != "APROBADO":
            raise ValueError(
                "Solo se puede registrar una resolución para reclamos aprobados."
            )

        if not resolucion or not resolucion.strip():
            raise ValueError("Debe proporcionar la resolución del reclamo.")

        reclamo.resolucion = resolucion.strip()

        db.session.commit()
        return reclamo

    except Exception:
        db.session.rollback()
        raise


def cambiar_estado_reclamo(reclamo_id, nuevo_estado):
    """Actualiza el estado respetando las transiciones permitidas."""
    try:
        if nuevo_estado not in ESTADOS_RECLAMO:
            raise ValueError("El estado indicado no es válido.")

        reclamo = db.session.scalar(
            select(ReclamoGarantia)
            .where(ReclamoGarantia.id == reclamo_id)
            .with_for_update()
        )

        if not reclamo:
            raise ValueError("El reclamo indicado no existe.")

        permitidos = TRANSICIONES_RECLAMO.get(
            reclamo.estado, set()
        )

        if nuevo_estado not in permitidos:
            raise ValueError(
                f"No se permite cambiar de {reclamo.estado} "
                f"a {nuevo_estado}."
            )

        if nuevo_estado == "RESUELTO" and not reclamo.resolucion:
            raise ValueError(
                "Debe registrar la resolución antes de marcar el reclamo como resuelto."
            )

        if nuevo_estado == "CERRADO":
            reclamo.fecha_cierre = datetime.now(timezone.utc)

        reclamo.estado = nuevo_estado

        db.session.commit()
        return reclamo

    except Exception:
        db.session.rollback()
        raise
