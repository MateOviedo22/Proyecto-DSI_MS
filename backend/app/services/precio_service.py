
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import select

from app.extensions import db
from app.models.catalogo import Producto, PrecioProducto
from app.models.personas import Usuario


def validar_precio(precio: Decimal | str | int) -> Decimal:
    try:
        precio = Decimal(str(precio))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("El precio debe ser un número válido.")

    if not precio.is_finite():
        raise ValueError("El precio debe ser un número finito.")

    if precio < 0:
        raise ValueError("El precio no puede ser negativo.")

    if precio.as_tuple().exponent < -2:
        raise ValueError("El precio admite como máximo dos decimales.")

    if precio > Decimal("9999999999.99"):
        raise ValueError("El precio supera el máximo permitido.")

    return precio


def obtener_precio_vigente(producto_id: int) -> PrecioProducto | None:
    return db.session.scalar(
        select(PrecioProducto).where(
            PrecioProducto.producto_id == producto_id,
            PrecioProducto.vigente_hasta.is_(None)
        )
    )


def registrar_precio(
    producto_id: int,
    precio_venta: Decimal | str | int,
    usuario_id: int,
    motivo: str | None = None,
) -> PrecioProducto:

    producto = db.session.get(Producto, producto_id)

    if producto is None:
        raise ValueError("El producto no existe.")

    if not producto.estado:
        raise ValueError("No se puede asignar un precio a un producto inactivo.")

    usuario = db.session.get(Usuario, usuario_id)

    if usuario is None:
        raise ValueError("El usuario indicado no existe.")

    precio = validar_precio(precio_venta)

    precio_actual = obtener_precio_vigente(producto_id)

    if precio_actual is not None:
        raise ValueError(
            "El producto ya tiene un precio vigente. Utilice modificar_precio()."
        )

    nuevo_precio = PrecioProducto(
        producto_id=producto_id,
        precio_venta=precio,
        vigente_desde=datetime.now(timezone.utc),
        vigente_hasta=None,
        usuario_id=usuario_id,
        motivo=motivo.strip() if motivo else None,
    )

    try:
        db.session.add(nuevo_precio)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return nuevo_precio


def modificar_precio(
    producto_id: int,
    nuevo_precio: Decimal | str | int,
    usuario_id: int,
    motivo: str | None = None,
) -> PrecioProducto:

    producto = db.session.get(Producto, producto_id)

    if producto is None:
        raise ValueError("El producto no existe.")

    if not producto.estado:
        raise ValueError("No se puede modificar el precio de un producto inactivo.")

    usuario = db.session.get(Usuario, usuario_id)

    if usuario is None:
        raise ValueError("El usuario indicado no existe.")

    precio = validar_precio(nuevo_precio)

    precio_actual = obtener_precio_vigente(producto_id)

    if precio_actual is None:
        raise ValueError("El producto todavía no tiene un precio vigente.")

    if precio_actual.precio_venta == precio:
        raise ValueError("El nuevo precio es igual al precio vigente.")

    ahora = datetime.now(timezone.utc)

    try:
        precio_actual.vigente_hasta = ahora

        nuevo_registro = PrecioProducto(
            producto_id=producto_id,
            precio_venta=precio,
            vigente_desde=ahora,
            vigente_hasta=None,
            usuario_id=usuario_id,
            motivo=motivo.strip() if motivo else None,
        )

        db.session.add(nuevo_registro)
        db.session.commit()

    except Exception:
        db.session.rollback()
        raise

    return nuevo_registro


def consultar_historial_precios(producto_id: int) -> list[PrecioProducto]:

    producto = db.session.get(Producto, producto_id)

    if producto is None:
        raise ValueError("El producto no existe.")

    return db.session.scalars(
        select(PrecioProducto)
        .where(PrecioProducto.producto_id == producto_id)
        .order_by(PrecioProducto.vigente_desde.desc())
    ).all()


def consultar_precio_actual(producto_id: int) -> PrecioProducto | None:

    producto = db.session.get(Producto, producto_id)

    if producto is None:
        raise ValueError("El producto no existe.")

    return obtener_precio_vigente(producto_id)
