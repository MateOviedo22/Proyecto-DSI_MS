
from sqlalchemy import select

from app.extensions import db
from app.models.compras import Proveedor


def crear_proveedor(
    nombre: str,
    contacto_nombre: str | None = None,
    telefono: str | None = None,
    email: str | None = None,
    direccion: str | None = None,
) -> Proveedor:

    nombre = nombre.strip()

    if not nombre:
        raise ValueError("El nombre del proveedor es obligatorio.")

    proveedor = Proveedor(
        nombre=nombre,
        contacto_nombre=contacto_nombre.strip() if contacto_nombre else None,
        telefono=telefono.strip() if telefono else None,
        email=email.strip().lower() if email else None,
        direccion=direccion.strip() if direccion else None,
        estado=True,
    )

    db.session.add(proveedor)
    db.session.commit()

    return proveedor


def listar_proveedores() -> list[Proveedor]:
    return db.session.scalars(
        select(Proveedor).order_by(Proveedor.nombre)
    ).all()


def obtener_proveedor(proveedor_id: int) -> Proveedor | None:
    return db.session.get(Proveedor, proveedor_id)


def buscar_proveedores(nombre: str) -> list[Proveedor]:
    nombre = nombre.strip()

    if not nombre:
        return []

    return db.session.scalars(
        select(Proveedor)
        .where(Proveedor.nombre.ilike(f"%{nombre}%"))
        .order_by(Proveedor.nombre)
    ).all()


def actualizar_proveedor(
    proveedor_id: int,
    nombre: str | None = None,
    contacto_nombre: str | None = None,
    telefono: str | None = None,
    email: str | None = None,
    direccion: str | None = None,
) -> Proveedor:

    proveedor = obtener_proveedor(proveedor_id)

    if proveedor is None:
        raise ValueError("El proveedor no existe.")

    if nombre is not None:
        nombre = nombre.strip()

        if not nombre:
            raise ValueError("El nombre del proveedor es obligatorio.")

        proveedor.nombre = nombre

    if contacto_nombre is not None:
        proveedor.contacto_nombre = contacto_nombre.strip() or None

    if telefono is not None:
        proveedor.telefono = telefono.strip() or None

    if email is not None:
        proveedor.email = email.strip().lower() or None

    if direccion is not None:
        proveedor.direccion = direccion.strip() or None

    db.session.commit()
    return proveedor


def desactivar_proveedor(proveedor_id: int) -> Proveedor:
    proveedor = obtener_proveedor(proveedor_id)

    if proveedor is None:
        raise ValueError("El proveedor no existe.")

    proveedor.estado = False
    db.session.commit()

    return proveedor


def activar_proveedor(proveedor_id: int) -> Proveedor:
    proveedor = obtener_proveedor(proveedor_id)

    if proveedor is None:
        raise ValueError("El proveedor no existe.")

    proveedor.estado = True
    db.session.commit()

    return proveedor
