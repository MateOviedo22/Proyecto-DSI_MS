from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.ventas import Pedido, DetallePedido
from app.models.catalogo import Producto


def validar_cantidad(cantidad):
    if (
        isinstance(cantidad, bool)
        or not isinstance(cantidad, int)
        or cantidad <= 0
    ):
        raise ValueError("La cantidad debe ser un entero mayor que cero.")

    return cantidad


def validar_precio(precio):
    if precio is None:
        return None

    try:
        precio = Decimal(str(precio))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("El precio acordado no es válido.")

    if not precio.is_finite() or precio < 0:
        raise ValueError("El precio acordado no puede ser negativo.")

    if precio.as_tuple().exponent < -2:
        raise ValueError("El precio admite máximo dos decimales.")

    if precio > Decimal("9999999999.99"):
        raise ValueError("El precio supera el límite permitido.")

    return precio


def obtener_detalle_pedido(detalle_id):
    detalle = db.session.get(DetallePedido, detalle_id)

    if detalle is None:
        raise ValueError("El detalle del pedido no existe.")

    return detalle


def validar_pedido_editable(pedido_id):
    pedido = db.session.get(Pedido, pedido_id)

    if pedido is None:
        raise ValueError("El pedido no existe.")

    if pedido.estado not in {"PENDIENTE", "CONFIRMADO"}:
        raise ValueError(
            "No se pueden modificar los productos de este pedido."
        )

    if pedido.venta is not None:
        raise ValueError(
            "El pedido ya está asociado a una venta."
        )

    return pedido


def agregar_detalle_pedido(
    pedido_id,
    producto_id,
    cantidad,
    precio_unitario_acordado=None,
    observaciones=None,
):
    pedido = validar_pedido_editable(pedido_id)

    producto = db.session.get(Producto, producto_id)

    if producto is None or not producto.estado:
        raise ValueError("El producto no existe o está inactivo.")

    cantidad = validar_cantidad(cantidad)

    precio_unitario_acordado = validar_precio(
        precio_unitario_acordado
    )

    if observaciones is not None:
        observaciones = observaciones.strip() or None

    detalle = DetallePedido(
        pedido_id=pedido.id,
        producto_id=producto.id,
        cantidad=cantidad,
        precio_unitario_acordado=precio_unitario_acordado,
        observaciones=observaciones,
    )

    try:
        db.session.add(detalle)
        db.session.commit()
        db.session.refresh(detalle)

    except IntegrityError:
        db.session.rollback()
        raise ValueError("No se pudo agregar el producto al pedido.")

    return detalle


def listar_detalles_pedido(pedido_id):
    pedido = db.session.get(Pedido, pedido_id)

    if pedido is None:
        raise ValueError("El pedido no existe.")

    consulta = (
        select(DetallePedido)
        .where(DetallePedido.pedido_id == pedido_id)
        .order_by(DetallePedido.id)
    )

    return db.session.scalars(consulta).all()


def obtener_detalle_por_producto(pedido_id, producto_id):
    return db.session.scalar(
        select(DetallePedido).where(
            DetallePedido.pedido_id == pedido_id,
            DetallePedido.producto_id == producto_id,
        )
    )


def actualizar_detalle_pedido(
    detalle_id,
    cantidad=None,
    precio_unitario_acordado=None,
    observaciones=None,
):
    detalle = obtener_detalle_pedido(detalle_id)

    validar_pedido_editable(detalle.pedido_id)

    if cantidad is not None:
        detalle.cantidad = validar_cantidad(cantidad)

    if precio_unitario_acordado is not None:
        detalle.precio_unitario_acordado = validar_precio(
            precio_unitario_acordado
        )

    if observaciones is not None:
        detalle.observaciones = observaciones.strip() or None

    try:
        db.session.commit()
        db.session.refresh(detalle)

    except Exception:
        db.session.rollback()
        raise

    return detalle


def eliminar_detalle_pedido(detalle_id):
    detalle = obtener_detalle_pedido(detalle_id)

    validar_pedido_editable(detalle.pedido_id)

    try:
        db.session.delete(detalle)
        db.session.commit()

    except Exception:
        db.session.rollback()
        raise

    return True
