
from sqlalchemy import select

from app.extensions import db
from app.models.personas import Rol


def crear_rol(nombre: str, descripcion: str | None = None) -> Rol:
    nombre = nombre.strip()

    if not nombre:
        raise ValueError("El nombre del rol es obligatorio.")

    existente = db.session.scalar(
        select(Rol).where(Rol.nombre.ilike(nombre))
    )

    if existente:
        raise ValueError("Ya existe un rol con ese nombre.")

    rol = Rol(
        nombre=nombre,
        descripcion=descripcion.strip() if descripcion else None,
        estado=True,
    )

    db.session.add(rol)
    db.session.commit()

    return rol


def listar_roles() -> list[Rol]:
    return db.session.scalars(
        select(Rol).order_by(Rol.nombre)
    ).all()


def obtener_rol(rol_id: int) -> Rol | None:
    return db.session.get(Rol, rol_id)


def actualizar_rol(
    rol_id: int,
    nombre: str | None = None,
    descripcion: str | None = None,
) -> Rol:
    rol = obtener_rol(rol_id)

    if rol is None:
        raise ValueError("El rol no existe.")

    if nombre is not None:
        nombre = nombre.strip()

        if not nombre:
            raise ValueError("El nombre del rol es obligatorio.")

        existente = db.session.scalar(
            select(Rol).where(
                Rol.nombre.ilike(nombre),
                Rol.id != rol_id,
            )
        )

        if existente:
            raise ValueError("Ya existe otro rol con ese nombre.")

        rol.nombre = nombre

    if descripcion is not None:
        rol.descripcion = descripcion.strip() or None

    db.session.commit()
    return rol


def desactivar_rol(rol_id: int) -> Rol:
    rol = obtener_rol(rol_id)

    if rol is None:
        raise ValueError("El rol no existe.")

    rol.estado = False
    db.session.commit()

    return rol


def activar_rol(rol_id: int) -> Rol:
    rol = obtener_rol(rol_id)

    if rol is None:
        raise ValueError("El rol no existe.")

    rol.estado = True
    db.session.commit()

    return rol
