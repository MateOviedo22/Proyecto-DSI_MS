
from sqlalchemy import select

from app.extensions import db
from app.models.catalogo import Marca


def crear_marca(nombre: str) -> Marca:
    nombre = nombre.strip()

    if not nombre:
        raise ValueError("El nombre de la marca es obligatorio.")

    existente = db.session.scalar(
        select(Marca).where(Marca.nombre.ilike(nombre))
    )

    if existente:
        raise ValueError("Ya existe una marca con ese nombre.")

    marca = Marca(
        nombre=nombre,
        estado=True
    )

    db.session.add(marca)
    db.session.commit()

    return marca


def listar_marcas() -> list[Marca]:
    return db.session.scalars(
        select(Marca).order_by(Marca.nombre)
    ).all()


def obtener_marca(marca_id: int) -> Marca | None:
    return db.session.get(Marca, marca_id)


def buscar_marcas(nombre: str) -> list[Marca]:
    nombre = nombre.strip()

    if not nombre:
        return []

    return db.session.scalars(
        select(Marca)
        .where(Marca.nombre.ilike(f"%{nombre}%"))
        .order_by(Marca.nombre)
    ).all()


def actualizar_marca(marca_id: int, nombre: str) -> Marca:
    marca = obtener_marca(marca_id)

    if marca is None:
        raise ValueError("La marca no existe.")

    nombre = nombre.strip()

    if not nombre:
        raise ValueError("El nombre de la marca es obligatorio.")

    existente = db.session.scalar(
        select(Marca).where(
            Marca.nombre.ilike(nombre),
            Marca.id != marca_id
        )
    )

    if existente:
        raise ValueError("Ya existe otra marca con ese nombre.")

    marca.nombre = nombre
    db.session.commit()

    return marca


def desactivar_marca(marca_id: int) -> Marca:
    marca = obtener_marca(marca_id)

    if marca is None:
        raise ValueError("La marca no existe.")

    marca.estado = False
    db.session.commit()

    return marca


def activar_marca(marca_id: int) -> Marca:
    marca = obtener_marca(marca_id)

    if marca is None:
        raise ValueError("La marca no existe.")

    marca.estado = True
    db.session.commit()

    return marca
