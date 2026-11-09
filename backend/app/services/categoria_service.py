from sqlalchemy import select

from app.extensions import db
from app.models.catalogo import Categoria


def crear_categoria(nombre: str, descripcion: str | None = None) -> Categoria:
    nombre = nombre.strip()

    if not nombre:
        raise ValueError("El nombre de la categoría es obligatorio.")

    categoria_existente = db.session.scalar(
        select(Categoria).where(Categoria.nombre.ilike(nombre))
    )

    if categoria_existente:
        raise ValueError("Ya existe una categoría con ese nombre.")

    categoria = Categoria(
        nombre=nombre,
        descripcion=descripcion.strip() if descripcion else None,
        estado=True,
    )

    db.session.add(categoria)
    db.session.commit()

    return categoria


def listar_categorias() -> list[Categoria]:
    return db.session.scalars(
        select(Categoria).order_by(Categoria.nombre)
    ).all()


def obtener_categoria(categoria_id: int) -> Categoria | None:
    return db.session.get(Categoria, categoria_id)


def buscar_categorias(nombre: str) -> list[Categoria]:
    nombre = nombre.strip()

    if not nombre:
        return []

    return db.session.scalars(
        select(Categoria)
        .where(Categoria.nombre.ilike(f"%{nombre}%"))
        .order_by(Categoria.nombre)
    ).all()


def actualizar_categoria(
    categoria_id: int,
    nombre: str | None = None,
    descripcion: str | None = None,
) -> Categoria:

    categoria = obtener_categoria(categoria_id)

    if categoria is None:
        raise ValueError("La categoría no existe.")

    if nombre is not None:
        nombre = nombre.strip()

        if not nombre:
            raise ValueError("El nombre de la categoría es obligatorio.")

        categoria_existente = db.session.scalar(
            select(Categoria).where(
                Categoria.nombre.ilike(nombre),
                Categoria.id != categoria_id,
            )
        )

        if categoria_existente:
            raise ValueError("Ya existe otra categoría con ese nombre.")

        categoria.nombre = nombre

    if descripcion is not None:
        categoria.descripcion = descripcion.strip() or None

    db.session.commit()

    return categoria


def desactivar_categoria(categoria_id: int) -> Categoria:
    categoria = obtener_categoria(categoria_id)

    if categoria is None:
        raise ValueError("La categoría no existe.")

    categoria.estado = False

    db.session.commit()

    return categoria

def activar_categoria(categoria_id: int) -> Categoria:
    categoria = obtener_categoria(categoria_id)

    if categoria is None:
        raise ValueError("La categoría no existe.")

    categoria.estado = True

    db.session.commit()

    return categoria