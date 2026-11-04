
from datetime import datetime, timezone

from sqlalchemy import select

from app.extensions import db
from app.models.inventario import Notificacion, Existencia
from app.models.personas import Usuario
from app.models.catalogo import Producto


PRIORIDADES = {"BAJA", "MEDIA", "ALTA", "CRITICA"}


def _validar_usuario(usuario_id, exigir_activo=True):
    usuario = db.session.get(Usuario, usuario_id)

    if not usuario:
        raise ValueError("El usuario no existe.")

    if exigir_activo and not usuario.estado:
        raise ValueError("El usuario está inactivo.")

    return usuario


def _normalizar_texto(valor, campo):
    if not isinstance(valor, str) or not valor.strip():
        raise ValueError(f"{campo} es obligatorio.")

    return valor.strip()


def crear_notificacion(
    usuario_id,
    tipo,
    mensaje,
    producto_id=None,
    prioridad="MEDIA"
):
    _validar_usuario(usuario_id)

    tipo = _normalizar_texto(tipo, "El tipo de notificación")
    mensaje = _normalizar_texto(mensaje, "El mensaje")

    if not isinstance(prioridad, str):
        raise ValueError("La prioridad indicada no es válida.")

    prioridad = prioridad.strip().upper()

    if prioridad not in PRIORIDADES:
        raise ValueError("La prioridad indicada no es válida.")

    if producto_id is not None:
        producto = db.session.get(Producto, producto_id)

        if not producto:
            raise ValueError("El producto no existe.")

    notificacion = Notificacion(
        usuario_id=usuario_id,
        producto_id=producto_id,
        tipo=tipo.upper(),
        prioridad=prioridad,
        mensaje=mensaje
    )

    try:
        db.session.add(notificacion)
        db.session.commit()
        return notificacion

    except Exception:
        db.session.rollback()
        raise


def listar_notificaciones_usuario(usuario_id):
    _validar_usuario(usuario_id, exigir_activo=False)

    return db.session.scalars(
        select(Notificacion)
        .where(Notificacion.usuario_id == usuario_id)
        .order_by(Notificacion.fecha_creacion.desc())
    ).all()


def listar_notificaciones_no_leidas(usuario_id):
    _validar_usuario(usuario_id, exigir_activo=False)

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
        raise ValueError(
            "Esta notificación no pertenece al usuario indicado."
        )

    if notificacion.fecha_lectura is None:
        try:
            notificacion.fecha_lectura = datetime.now(timezone.utc)
            db.session.commit()

        except Exception:
            db.session.rollback()
            raise

    return notificacion


def marcar_todas_como_leidas(usuario_id):
    notificaciones = listar_notificaciones_no_leidas(usuario_id)

    if not notificaciones:
        return 0

    ahora = datetime.now(timezone.utc)

    try:
        for notificacion in notificaciones:
            notificacion.fecha_lectura = ahora

        db.session.commit()
        return len(notificaciones)

    except Exception:
        db.session.rollback()
        raise


def eliminar_notificacion(notificacion_id, usuario_id):
    notificacion = db.session.get(Notificacion, notificacion_id)

    if not notificacion:
        raise ValueError("La notificación no existe.")

    if notificacion.usuario_id != usuario_id:
        raise ValueError(
            "Esta notificación no pertenece al usuario indicado."
        )

    try:
        db.session.delete(notificacion)
        db.session.commit()
        return True

    except Exception:
        db.session.rollback()
        raise


def generar_alerta_stock(usuario_id, producto_id):
    _validar_usuario(usuario_id)

    producto = db.session.get(Producto, producto_id)

    if not producto:
        raise ValueError("El producto no existe.")

    existencia = db.session.scalar(
        select(Existencia).where(
            Existencia.producto_id == producto_id
        )
    )

    if not existencia:
        raise ValueError(
            "El producto no tiene registro de existencia."
        )

    cantidad = existencia.cantidad_actual
    umbral = existencia.umbral_minimo

    if cantidad == 0:
        tipo = "STOCK_AGOTADO"
        prioridad = "CRITICA"
        mensaje = (
            f"El producto {producto.nombre} se encuentra agotado."
        )

    elif cantidad <= umbral:
        tipo = "STOCK_BAJO"
        prioridad = "ALTA"
        mensaje = (
            f"El producto {producto.nombre} tiene "
            f"{cantidad} unidades disponibles."
        )

    else:
        return None

    # Evita duplicar alertas que todavía no han sido leídas.
    notificacion_existente = db.session.scalar(
        select(Notificacion)
        .where(
            Notificacion.usuario_id == usuario_id,
            Notificacion.producto_id == producto_id,
            Notificacion.tipo == tipo,
            Notificacion.fecha_lectura.is_(None)
        )
        .limit(1)
    )

    if notificacion_existente:
        return notificacion_existente

    return crear_notificacion(
        usuario_id=usuario_id,
        producto_id=producto_id,
        tipo=tipo,
        prioridad=prioridad,
        mensaje=mensaje
    )
