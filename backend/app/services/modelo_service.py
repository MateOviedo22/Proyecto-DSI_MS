
from sqlalchemy import select

from app.extensions import db
from app.models.catalogo import Marca, Modelo


def crear_modelo(
    marca_id: int,
    nombre: str,
    descripcion: str | None = None
) -> Modelo:

    nombre = nombre.strip()

    if not nombre:
        raise ValueError("El nombre del modelo es obligatorio.")

    marca = db.session.get(Marca, marca_id)

    if marca is None:
        raise ValueError("La marca indicada no existe.")

    if not marca.estado:
        raise ValueError("No se pueden registrar modelos en una marca inactiva.")

    existente = db.session.scalar(
        select(Modelo).where(
            Modelo.marca_id == marca_id,
            Modelo.nombre.ilike(nombre)
        )
    )

    if existente:
        raise ValueError("Esta marca ya tiene un modelo con ese nombre.")

    modelo = Modelo(
        marca_id=marca_id,
        nombre=nombre,
        descripcion=descripcion.strip() if descripcion else None,
        estado=True
    )

    db.session.add(modelo)
    db.session.commit()

    return modelo


def listar_modelos() -> list[Modelo]:
    return db.session.scalars(
        select(Modelo)
        .order_by(Modelo.nombre)
    ).all()


def obtener_modelo(modelo_id: int) -> Modelo | None:
    return db.session.get(Modelo, modelo_id)


def buscar_modelos(nombre: str) -> list[Modelo]:
    nombre = nombre.strip()

    if not nombre:
        return []

    return db.session.scalars(
        select(Modelo)
        .where(Modelo.nombre.ilike(f"%{nombre}%"))
        .order_by(Modelo.nombre)
    ).all()


def listar_modelos_por_marca(marca_id: int) -> list[Modelo]:
    marca = db.session.get(Marca, marca_id)

    if marca is None:
        raise ValueError("La marca no existe.")

    return db.session.scalars(
        select(Modelo)
        .where(Modelo.marca_id == marca_id)
        .order_by(Modelo.nombre)
    ).all()


def actualizar_modelo(
    modelo_id: int,
    nombre: str | None = None,
    descripcion: str | None = None
) -> Modelo:

    modelo = obtener_modelo(modelo_id)

    if modelo is None:
        raise ValueError("El modelo no existe.")

    if nombre is not None:
        nombre = nombre.strip()

        if not nombre:
            raise ValueError("El nombre del modelo es obligatorio.")

        existente = db.session.scalar(
            select(Modelo).where(
                Modelo.marca_id == modelo.marca_id,
                Modelo.nombre.ilike(nombre),
                Modelo.id != modelo_id
            )
        )

        if existente:
            raise ValueError("Esta marca ya tiene un modelo con ese nombre.")

        modelo.nombre = nombre

    if descripcion is not None:
        modelo.descripcion = descripcion.strip() or None

    db.session.commit()

    return modelo


def desactivar_modelo(modelo_id: int) -> Modelo:
    modelo = obtener_modelo(modelo_id)

    if modelo is None:
        raise ValueError("El modelo no existe.")

    modelo.estado = False
    db.session.commit()

    return modelo


def activar_modelo(modelo_id: int) -> Modelo:
    modelo = obtener_modelo(modelo_id)

    if modelo is None:
        raise ValueError("El modelo no existe.")

    if not modelo.marca.estado:
        raise ValueError("No se puede activar un modelo cuya marca está inactiva.")

    modelo.estado = True
    db.session.commit()

    return modelo
