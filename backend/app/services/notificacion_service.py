from datetime import datetime, timezone

from sqlalchemy import select

from app.extensions import db
from app.models.inventario import Notificacion, Existencia
from app.models.personas import Usuario
from app.models.catalogo import Producto


PRIORIDADES = {"BAJA", "MEDIA", "ALTA", "CRITICA"}


def crear_notificacion(
    usuario_id,
    tipo,
    mensaje,
    producto_id=None,
    prioridad="MEDIA"
):
    usuario = db.session.get(Usuario, usuario_id)

    if not usuario or not usuario.estado:
        raise ValueError("El usuario no existe o está inactivo.")

    if producto_id is not None:
        producto = db.session.get(Producto, producto_id)

        if not producto:
            raise ValueError("El producto no existe.")

    if not tipo or not tipo.strip():
        raise ValueError("El tipo de notificación es obligatorio.")

    if not mensaje or not mensaje.strip():
        raise ValueError("El mensaje es obligatorio.")

    prioridad = prioridad.strip().upper()

    if prioridad not in PRIORIDADES:
        raise ValueError("La prioridad indicada no es válida.")

    notificacion = Notificacion(
        usuario_id=usuario_id,
        producto_id=producto_id,
        tipo=tipo.strip().upper(),
        prioridad=prioridad,
        mensaje=mensaje.strip()
    )

    try:
        db.session.add(notificacion)
        db.session.commit()
        return notificacion
    except Exception:
        db.session.rollback()
        raise


def listar_notificaciones_usuario(usuario_id):
    usuario = db.session.get(Usuario, usuario_id)

    if not usuario:
        raise ValueError("El usuario no existe.")

    return db.session.scalars(
        select(Notificacion)
        .where(Notificacion.usuario_id == usuario_id)
        .order_by(Notificacion.fecha_creacion.desc())
    ).all()


def listar_notificaciones_no_leidas(usuario_id):
    usuario = db.session.get(Usuario, usuario_id)

    if not usuario:
        raise ValueError("El usuario no existe.")

    return db.session.scalars(
        select(Notificacion)
        .where(
            Notificacion.usuario_id == usuario_id,
            Notificacion.fecha_lectura.is_(None)
        )
        .order_by(Notificacion.fecha_creacion.desc())
    ).all()


def contar_notificaciones_no_leidas(usuario_id):
    return len(listar_notificaciones_no_leidas(usuario_id))


def marcar_como_leida(notificacion_id, usuario_id):
    notificacion = db.session.get(Notificacion, notificacion_id)

    if not notificacion:
        raise ValueError("La notificación no existe.")

    if notificacion.usuario_id != usuario_id:
        raise ValueError("Esta notificación no pertenece al usuario indicado.")

    if notificacion.fecha_lectura is None:
        notificacion.fecha_lectura = datetime.now(timezone.utc)

        db.session.commit()

    return notificacion


def marcar_todas_como_leidas(usuario_id):
    notificaciones = listar_notificaciones_no_leidas(usuario_id)

    ahora = datetime.now(timezone.utc)

    for notificacion in notificaciones:
        notificacion.fecha_lectura = ahora

    db.session.commit()
    return len(notificaciones)


def eliminar_notificacion(notificacion_id, usuario_id):
    notificacion = db.session.get(Notificacion, notificacion_id)

    if not notificacion:
        raise ValueError("La notificación no existe.")

    if notificacion.usuario_id != usuario_id:
        raise ValueError("Esta notificación no pertenece al usuario indicado.")

    db.session.delete(notificacion)
    db.session.commit()
    return True


def generar_alerta_stock(usuario_id, producto_id):
    producto = db.session.get(Producto, producto_id)

    if not producto:
        raise ValueError("El producto no existe.")

    existencia = db.session.scalar(
        select(Existencia).where(
            Existencia.producto_id == producto_id
        )
    )

    if not existencia:
        raise ValueError("El producto no tiene registro de existencia.")

    if existencia.cantidad_actual == 0:
        return crear_notificacion(
            usuario_id=usuario_id,
            producto_id=producto_id,
            tipo="STOCK_AGOTADO",
            prioridad="CRITICA",
            mensaje=f"El producto {producto.nombre} se encuentra agotado."
        )

    if existencia.cantidad_actual <= existencia.umbral_minimo:
        return crear_notificacion(
            usuario_id=usuario_id,
            producto_id=producto_id,
            tipo="STOCK_BAJO",
            prioridad="ALTA",
            mensaje=(
                f"El producto {producto.nombre} tiene "
                f"{existencia.cantidad_actual} unidades disponibles."
            )
        )

    return None