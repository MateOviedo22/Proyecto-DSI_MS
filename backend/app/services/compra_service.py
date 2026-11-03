from decimal import Decimal
from sqlalchemy import select

from app.extensions import db
from app.models.compras import Compra, Proveedor
from app.models.personas import Usuario


ESTADOS_COMPRA = {
    "BORRADOR",
    "ENVIADA",
    "PARCIALMENTE_RECIBIDA",
    "RECIBIDA",
    "CANCELADA"
}


def crear_compra(proveedor_id, usuario_id, numero_referencia=None, observaciones=None):
    proveedor = db.session.get(Proveedor, proveedor_id)
    usuario = db.session.get(Usuario, usuario_id)

    if not proveedor or not proveedor.estado:
        raise ValueError("El proveedor no existe o está inactivo.")

    if not usuario or not usuario.estado:
        raise ValueError("El usuario no existe o está inactivo.")

    if numero_referencia:
        numero_referencia = numero_referencia.strip() or None

    if numero_referencia:
        existente = db.session.scalar(
            select(Compra).where(
                Compra.numero_referencia == numero_referencia
            )
        )
        if existente:
            raise ValueError("Ya existe una compra con esa referencia.")

    compra = Compra(
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        numero_referencia=numero_referencia,
        estado="BORRADOR",
        subtotal=Decimal("0.00"),
        total=Decimal("0.00"),
        observaciones=observaciones.strip() if observaciones else None
    )

    try:
        db.session.add(compra)
        db.session.commit()
        return compra
    except Exception:
        db.session.rollback()
        raise


def listar_compras():
    return db.session.scalars(
        select(Compra).order_by(Compra.fecha_pedido.desc())
    ).all()


def obtener_compra(compra_id):
    return db.session.get(Compra, compra_id)


def listar_compras_por_proveedor(proveedor_id):
    proveedor = db.session.get(Proveedor, proveedor_id)

    if not proveedor:
        raise ValueError("El proveedor no existe.")

    return db.session.scalars(
        select(Compra)
        .where(Compra.proveedor_id == proveedor_id)
        .order_by(Compra.fecha_pedido.desc())
    ).all()


def cambiar_estado_compra(compra_id, nuevo_estado):
    compra = obtener_compra(compra_id)

    if not compra:
        raise ValueError("La compra no existe.")

    nuevo_estado = nuevo_estado.strip().upper()

    if nuevo_estado not in ESTADOS_COMPRA:
        raise ValueError("El estado indicado no es válido.")

    if compra.estado in {"RECIBIDA", "CANCELADA"}:
        raise ValueError("No se puede cambiar el estado de una compra finalizada o cancelada.")

    if nuevo_estado == "RECIBIDA":
        raise ValueError("El estado RECIBIDA debe establecerse mediante el proceso de recepción.")

    if nuevo_estado == "PARCIALMENTE_RECIBIDA":
        raise ValueError("Este estado se determina mediante el proceso de recepción.")

    compra.estado = nuevo_estado

    try:
        db.session.commit()
        return compra
    except Exception:
        db.session.rollback()
        raise


def actualizar_observaciones(compra_id, observaciones):
    compra = obtener_compra(compra_id)

    if not compra:
        raise ValueError("La compra no existe.")

    if compra.estado != "BORRADOR":
        raise ValueError("Solo se pueden editar observaciones de compras en borrador.")

    compra.observaciones = observaciones.strip() if observaciones else None
    db.session.commit()
    return compra


def recalcular_totales_compra(compra_id):
    compra = obtener_compra(compra_id)

    if not compra:
        raise ValueError("La compra no existe.")

    subtotal = sum(
        (detalle.subtotal for detalle in compra.detalles),
        Decimal("0.00")
    )

    compra.subtotal = subtotal
    compra.total = subtotal

    db.session.commit()
    return compra