
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.ventas import Cliente, Pedido
from app.models.personas import Usuario


ESTADOS_PEDIDO = {
    "PENDIENTE",
    "CONFIRMADO",
    "EN_PREPARACION",
    "LISTO",
    "ENTREGADO",
    "CANCELADO",
}

CANALES_PEDIDO = {
    "ONLINE",
    "PRESENCIAL",
    "TELEFONO",
}


def convertir_importe(valor, campo):
    try:
        importe = Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"El campo {campo} debe ser un importe válido.")

    if not importe.is_finite() or importe < 0:
        raise ValueError(f"El campo {campo} no puede ser negativo.")

    if importe.as_tuple().exponent < -2:
        raise ValueError(f"El campo {campo} admite máximo dos decimales.")

    if importe > Decimal("9999999999.99"):
        raise ValueError(f"El campo {campo} supera el límite permitido.")

    return importe


def obtener_pedido(pedido_id):
    pedido = db.session.get(Pedido, pedido_id)

    if pedido is None:
        raise ValueError("El pedido solicitado no existe.")

    return pedido


def crear_pedido(
    cliente_id,
    usuario_id=None,
    canal="ONLINE",
    direccion_entrega=None,
    costo_delivery=0,
    observaciones=None,
):
    cliente = db.session.get(Cliente, cliente_id)

    if cliente is None:
        raise ValueError("El cliente no existe.")

    if usuario_id is not None:
        usuario = db.session.get(Usuario, usuario_id)

        if usuario is None or not usuario.estado:
            raise ValueError("El usuario no existe o está inactivo.")

    canal = canal.strip().upper()

    if canal not in CANALES_PEDIDO:
        raise ValueError("El canal del pedido no es válido.")

    costo_delivery = convertir_importe(
        costo_delivery, "costo de delivery"
    )

    if direccion_entrega is not None:
        direccion_entrega = direccion_entrega.strip() or None

        if direccion_entrega and len(direccion_entrega) > 255:
            raise ValueError(
                "La dirección de entrega no puede superar 255 caracteres."
            )

    if observaciones is not None:
        observaciones = observaciones.strip() or None

    pedido = Pedido(
        cliente_id=cliente_id,
        usuario_id=usuario_id,
        canal=canal,
        estado="PENDIENTE",
        direccion_entrega=direccion_entrega,
        costo_delivery=costo_delivery,
        observaciones=observaciones,
    )

    try:
        db.session.add(pedido)
        db.session.commit()
        db.session.refresh(pedido)

    except IntegrityError:
        db.session.rollback()
        raise ValueError("No se pudo registrar el pedido.")

    return pedido


def listar_pedidos():
    consulta = select(Pedido).order_by(Pedido.fecha_creacion.desc())

    return db.session.scalars(consulta).all()


def listar_pedidos_por_cliente(cliente_id):
    cliente = db.session.get(Cliente, cliente_id)

    if cliente is None:
        raise ValueError("El cliente no existe.")

    consulta = (
        select(Pedido)
        .where(Pedido.cliente_id == cliente_id)
        .order_by(Pedido.fecha_creacion.desc())
    )

    return db.session.scalars(consulta).all()


def listar_pedidos_por_estado(estado):
    estado = estado.strip().upper()

    if estado not in ESTADOS_PEDIDO:
        raise ValueError("El estado del pedido no es válido.")

    consulta = (
        select(Pedido)
        .where(Pedido.estado == estado)
        .order_by(Pedido.fecha_creacion.desc())
    )

    return db.session.scalars(consulta).all()


def cambiar_estado_pedido(pedido_id, nuevo_estado):
    pedido = obtener_pedido(pedido_id)

    nuevo_estado = nuevo_estado.strip().upper()

    if nuevo_estado not in ESTADOS_PEDIDO:
        raise ValueError("El estado solicitado no es válido.")

    if pedido.estado in {"ENTREGADO", "CANCELADO"}:
        raise ValueError(
            "No se puede modificar un pedido entregado o cancelado."
        )

    if pedido.venta is not None:
        raise ValueError(
            "El pedido ya está asociado a una venta."
        )

    if nuevo_estado == "ENTREGADO":
        raise ValueError(
            "La entrega debe gestionarse mediante el proceso de venta."
        )

    pedido.estado = nuevo_estado

    try:
        db.session.commit()
        db.session.refresh(pedido)

    except Exception:
        db.session.rollback()
        raise

    return pedido


def actualizar_datos_entrega(
    pedido_id,
    direccion_entrega=None,
    costo_delivery=None,
    observaciones=None,
):
    pedido = obtener_pedido(pedido_id)

    if pedido.estado in {"ENTREGADO", "CANCELADO"}:
        raise ValueError(
            "No se puede modificar un pedido finalizado."
        )

    if pedido.venta is not None:
        raise ValueError(
            "No se puede modificar un pedido asociado a una venta."
        )

    if direccion_entrega is not None:
        direccion_entrega = direccion_entrega.strip() or None

        if direccion_entrega and len(direccion_entrega) > 255:
            raise ValueError(
                "La dirección de entrega no puede superar 255 caracteres."
            )

        pedido.direccion_entrega = direccion_entrega

    if costo_delivery is not None:
        pedido.costo_delivery = convertir_importe(
            costo_delivery, "costo de delivery"
        )

    if observaciones is not None:
        pedido.observaciones = observaciones.strip() or None

    try:
        db.session.commit()
        db.session.refresh(pedido)

    except Exception:
        db.session.rollback()
        raise

    return pedido


def cancelar_pedido(pedido_id):
    return cambiar_estado_pedido(pedido_id, "CANCELADO")
