
from sqlalchemy import select

from app.extensions import db
from app.models.catalogo import Producto, Categoria, Modelo


def crear_producto(
    sku: str,
    nombre: str,
    categoria_id: int,
    descripcion: str | None = None,
    especificaciones: str | None = None,
    modelo_id: int | None = None,
    requiere_numero_serie: bool = False,
    dias_garantia_default: int | None = None,
) -> Producto:

    sku = sku.strip()
    nombre = nombre.strip()

    if not sku:
        raise ValueError("El SKU es obligatorio.")

    if not nombre:
        raise ValueError("El nombre del producto es obligatorio.")

    existente = db.session.scalar(
        select(Producto).where(Producto.sku.ilike(sku))
    )

    if existente:
        raise ValueError("Ya existe un producto con ese SKU.")

    categoria = db.session.get(Categoria, categoria_id)

    if categoria is None or not categoria.estado:
        raise ValueError("La categoría no existe o está inactiva.")

    if modelo_id is not None:
        modelo = db.session.get(Modelo, modelo_id)

        if modelo is None or not modelo.estado:
            raise ValueError("El modelo no existe o está inactivo.")

        if not modelo.marca.estado:
            raise ValueError("La marca asociada al modelo está inactiva.")

    if dias_garantia_default is not None:
        if (
            isinstance(dias_garantia_default, bool)
            or not isinstance(dias_garantia_default, int)
            or dias_garantia_default < 0
        ):
            raise ValueError("Los días de garantía deben ser un entero no negativo.")

    if not isinstance(requiere_numero_serie, bool):
        raise ValueError("El indicador de número de serie debe ser verdadero o falso.")

    producto = Producto(
        sku=sku,
        nombre=nombre,
        categoria_id=categoria_id,
        descripcion=descripcion.strip() if descripcion else None,
        especificaciones=especificaciones.strip() if especificaciones else None,
        modelo_id=modelo_id,
        requiere_numero_serie=requiere_numero_serie,
        dias_garantia_default=dias_garantia_default,
        estado=True,
    )

    try:
        db.session.add(producto)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return producto


def listar_productos() -> list[Producto]:
    return db.session.scalars(
        select(Producto).order_by(Producto.nombre)
    ).all()


def obtener_producto(producto_id: int) -> Producto | None:
    return db.session.get(Producto, producto_id)


def buscar_productos(termino: str) -> list[Producto]:
    termino = termino.strip()

    if not termino:
        return []

    return db.session.scalars(
        select(Producto).where(
            Producto.nombre.ilike(f"%{termino}%")
            | Producto.sku.ilike(f"%{termino}%")
        ).order_by(Producto.nombre)
    ).all()


def listar_productos_por_categoria(categoria_id: int) -> list[Producto]:
    categoria = db.session.get(Categoria, categoria_id)

    if categoria is None:
        raise ValueError("La categoría no existe.")

    return db.session.scalars(
        select(Producto)
        .where(Producto.categoria_id == categoria_id)
        .order_by(Producto.nombre)
    ).all()


def actualizar_producto(
    producto_id: int,
    sku: str | None = None,
    nombre: str | None = None,
    categoria_id: int | None = None,
    descripcion: str | None = None,
    especificaciones: str | None = None,
    modelo_id: int | None = None,
    requiere_numero_serie: bool | None = None,
    dias_garantia_default: int | None = None,
) -> Producto:

    producto = obtener_producto(producto_id)

    if producto is None:
        raise ValueError("El producto no existe.")

    if sku is not None:
        sku = sku.strip()

        if not sku:
            raise ValueError("El SKU es obligatorio.")

        existente = db.session.scalar(
            select(Producto).where(
                Producto.sku.ilike(sku),
                Producto.id != producto_id
            )
        )

        if existente:
            raise ValueError("Ya existe otro producto con ese SKU.")

        producto.sku = sku

    if nombre is not None:
        nombre = nombre.strip()

        if not nombre:
            raise ValueError("El nombre del producto es obligatorio.")

        producto.nombre = nombre

    if categoria_id is not None:
        categoria = db.session.get(Categoria, categoria_id)

        if categoria is None or not categoria.estado:
            raise ValueError("La categoría no existe o está inactiva.")

        producto.categoria_id = categoria_id

    if modelo_id is not None:
        modelo = db.session.get(Modelo, modelo_id)

        if modelo is None or not modelo.estado:
            raise ValueError("El modelo no existe o está inactivo.")

        if not modelo.marca.estado:
            raise ValueError("La marca asociada al modelo está inactiva.")

        producto.modelo_id = modelo_id

    if descripcion is not None:
        producto.descripcion = descripcion.strip() or None

    if especificaciones is not None:
        producto.especificaciones = especificaciones.strip() or None

    if requiere_numero_serie is not None:
        if not isinstance(requiere_numero_serie, bool):
            raise ValueError("El indicador de número de serie debe ser verdadero o falso.")

        producto.requiere_numero_serie = requiere_numero_serie

    if dias_garantia_default is not None:
        if (
            isinstance(dias_garantia_default, bool)
            or not isinstance(dias_garantia_default, int)
            or dias_garantia_default < 0
        ):
            raise ValueError("Los días de garantía deben ser un entero no negativo.")

        producto.dias_garantia_default = dias_garantia_default

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return producto


def desactivar_producto(producto_id: int) -> Producto:
    producto = obtener_producto(producto_id)

    if producto is None:
        raise ValueError("El producto no existe.")

    producto.estado = False
    db.session.commit()

    return producto


def activar_producto(producto_id: int) -> Producto:
    producto = obtener_producto(producto_id)

    if producto is None:
        raise ValueError("El producto no existe.")

    categoria = producto.categoria

    if not categoria.estado:
        raise ValueError("No se puede activar un producto cuya categoría está inactiva.")

    if producto.modelo is not None:
        if not producto.modelo.estado or not producto.modelo.marca.estado:
            raise ValueError("No se puede activar un producto cuyo modelo o marca está inactivo.")

    producto.estado = True
    db.session.commit()

    return producto
