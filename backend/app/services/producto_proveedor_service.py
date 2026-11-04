from sqlalchemy import select

from app.extensions import db
from app.models.catalogo import Producto, ProductoProveedor
from app.models.compras import Proveedor


def obtener_asociacion(asociacion_id):
    return db.session.get(ProductoProveedor, asociacion_id)


def crear_asociacion(
    producto_id,
    proveedor_id,
    codigo_producto_proveedor=None,
    es_principal=False,
    observaciones=None
):
    producto = db.session.get(Producto, producto_id)
    proveedor = db.session.get(Proveedor, proveedor_id)

    if not producto or not producto.estado:
        raise ValueError("El producto no existe o está inactivo.")

    if not proveedor or not proveedor.estado:
        raise ValueError("El proveedor no existe o está inactivo.")

    asociacion_existente = db.session.scalar(
        select(ProductoProveedor).where(
            ProductoProveedor.producto_id == producto_id,
            ProductoProveedor.proveedor_id == proveedor_id
        )
    )

    if asociacion_existente:
        raise ValueError("Este producto ya está asociado con ese proveedor.")

    try:
        # Si será principal, se quita esa condición a los demás proveedores.
        if es_principal:
            asociaciones = db.session.scalars(
                select(ProductoProveedor).where(
                    ProductoProveedor.producto_id == producto_id,
                    ProductoProveedor.es_principal.is_(True)
                )
            ).all()

            for asociacion in asociaciones:
                asociacion.es_principal = False

        asociacion = ProductoProveedor(
            producto_id=producto_id,
            proveedor_id=proveedor_id,
            codigo_producto_proveedor=(
                codigo_producto_proveedor.strip()
                if codigo_producto_proveedor else None
            ),
            es_principal=es_principal,
            observaciones=observaciones.strip() if observaciones else None,
            estado=True
        )

        db.session.add(asociacion)
        db.session.commit()
        return asociacion

    except Exception:
        db.session.rollback()
        raise


def listar_asociaciones():
    return db.session.scalars(
        select(ProductoProveedor).order_by(ProductoProveedor.id)
    ).all()


def listar_proveedores_por_producto(producto_id):
    producto = db.session.get(Producto, producto_id)

    if not producto:
        raise ValueError("El producto no existe.")

    return db.session.scalars(
        select(ProductoProveedor)
        .where(ProductoProveedor.producto_id == producto_id)
        .order_by(ProductoProveedor.es_principal.desc())
    ).all()


def listar_productos_por_proveedor(proveedor_id):
    proveedor = db.session.get(Proveedor, proveedor_id)

    if not proveedor:
        raise ValueError("El proveedor no existe.")

    return db.session.scalars(
        select(ProductoProveedor)
        .where(ProductoProveedor.proveedor_id == proveedor_id)
    ).all()


def buscar_asociacion(producto_id, proveedor_id):
    return db.session.scalar(
        select(ProductoProveedor).where(
            ProductoProveedor.producto_id == producto_id,
            ProductoProveedor.proveedor_id == proveedor_id
        )
    )


def actualizar_asociacion(
    asociacion_id,
    codigo_producto_proveedor=None,
    observaciones=None
):
    asociacion = obtener_asociacion(asociacion_id)

    if not asociacion:
        raise ValueError("La asociación no existe.")

    if not asociacion.estado:
        raise ValueError("No se puede actualizar una asociación inactiva.")

    if codigo_producto_proveedor is not None:
        asociacion.codigo_producto_proveedor = (
            codigo_producto_proveedor.strip() or None
        )

    if observaciones is not None:
        asociacion.observaciones = observaciones.strip() or None

    db.session.commit()
    return asociacion


def establecer_proveedor_principal(asociacion_id):
    asociacion = obtener_asociacion(asociacion_id)

    if not asociacion:
        raise ValueError("La asociación no existe.")

    if not asociacion.estado:
        raise ValueError("No se puede establecer como principal una asociación inactiva.")

    try:
        asociaciones = db.session.scalars(
            select(ProductoProveedor).where(
                ProductoProveedor.producto_id == asociacion.producto_id,
                ProductoProveedor.es_principal.is_(True)
            )
        ).all()

        for otra_asociacion in asociaciones:
            otra_asociacion.es_principal = False

        asociacion.es_principal = True

        db.session.commit()
        return asociacion

    except Exception:
        db.session.rollback()
        raise


def desactivar_asociacion(asociacion_id):
    asociacion = obtener_asociacion(asociacion_id)

    if not asociacion:
        raise ValueError("La asociación no existe.")

    asociacion.estado = False
    asociacion.es_principal = False

    db.session.commit()
    return asociacion


def activar_asociacion(asociacion_id):
    asociacion = obtener_asociacion(asociacion_id)

    if not asociacion:
        raise ValueError("La asociación no existe.")

    producto = db.session.get(Producto, asociacion.producto_id)
    proveedor = db.session.get(Proveedor, asociacion.proveedor_id)

    if not producto or not producto.estado:
        raise ValueError("No se puede activar: el producto está inactivo.")

    if not proveedor or not proveedor.estado:
        raise ValueError("No se puede activar: el proveedor está inactivo.")

    asociacion.estado = True
    db.session.commit()
    return asociacion