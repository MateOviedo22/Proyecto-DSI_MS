from sqlalchemy import select

from app.extensions import db
from app.models.inventario import Existencia
from app.models.catalogo import Producto


def obtener_existencia(producto_id):
    return db.session.scalar(
        select(Existencia).where(
            Existencia.producto_id == producto_id
        )
    )


def crear_existencia(producto_id, umbral_minimo=0, stock_respaldo=0):
    producto = db.session.get(Producto, producto_id)

    if not producto:
        raise ValueError("El producto no existe.")

    if obtener_existencia(producto_id):
        raise ValueError("El producto ya tiene un registro de existencia.")

    validar_niveles(umbral_minimo, stock_respaldo)

    existencia = Existencia(
        producto_id=producto_id,
        cantidad_actual=0,
        umbral_minimo=umbral_minimo,
        stock_respaldo=stock_respaldo
    )

    try:
        db.session.add(existencia)
        db.session.commit()
        return existencia
    except Exception:
        db.session.rollback()
        raise


def validar_niveles(umbral_minimo, stock_respaldo):
    for nombre, valor in [
        ("Umbral mínimo", umbral_minimo),
        ("Stock de respaldo", stock_respaldo)
    ]:
        if isinstance(valor, bool) or not isinstance(valor, int) or valor < 0:
            raise ValueError(f"{nombre} debe ser un entero no negativo.")


def listar_existencias():
    return db.session.scalars(
        select(Existencia).order_by(Existencia.producto_id)
    ).all()


def consultar_stock(producto_id):
    existencia = obtener_existencia(producto_id)

    if not existencia:
        raise ValueError("El producto todavía no tiene un registro de existencia.")

    return existencia.cantidad_actual


def actualizar_niveles_stock(producto_id, umbral_minimo, stock_respaldo):
    existencia = obtener_existencia(producto_id)

    if not existencia:
        raise ValueError("El producto no tiene un registro de existencia.")

    validar_niveles(umbral_minimo, stock_respaldo)

    existencia.umbral_minimo = umbral_minimo
    existencia.stock_respaldo = stock_respaldo

    try:
        db.session.commit()
        return existencia
    except Exception:
        db.session.rollback()
        raise


def listar_stock_bajo():
    return db.session.scalars(
        select(Existencia)
        .where(Existencia.cantidad_actual <= Existencia.umbral_minimo)
        .order_by(Existencia.cantidad_actual)
    ).all()


def listar_stock_agotado():
    return db.session.scalars(
        select(Existencia)
        .where(Existencia.cantidad_actual == 0)
        .order_by(Existencia.producto_id)
    ).all()