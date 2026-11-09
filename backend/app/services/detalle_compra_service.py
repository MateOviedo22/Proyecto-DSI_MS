from decimal import Decimal, InvalidOperation

from sqlalchemy import select

from app.extensions import db
from app.models.compras import Compra, DetalleCompra
from app.models.catalogo import Producto


def convertir_importe(valor, campo):
    try:
        importe = Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"{campo} debe ser un importe válido.")

    if not importe.is_finite() or importe < 0:
        raise ValueError(f"{campo} no puede ser negativo.")

    if importe.as_tuple().exponent < -2:
        raise ValueError(f"{campo} admite máximo dos decimales.")

    return importe


def agregar_detalle_compra(
    compra_id,
    producto_id,
    cantidad_solicitada,
    costo_unitario,
    descuento=0,
    observaciones=None
):
    compra = db.session.get(Compra, compra_id)
    producto = db.session.get(Producto, producto_id)

    if not compra:
        raise ValueError("La compra no existe.")

    if compra.estado != "BORRADOR":
        raise ValueError("Solo se pueden agregar productos a compras en borrador.")

    if not producto or not producto.estado:
        raise ValueError("El producto no existe o está inactivo.")

    if isinstance(cantidad_solicitada, bool) or not isinstance(cantidad_solicitada, int):
        raise ValueError("La cantidad solicitada debe ser un número entero.")

    if cantidad_solicitada <= 0:
        raise ValueError("La cantidad solicitada debe ser mayor que cero.")

    costo = convertir_importe(costo_unitario, "El costo unitario")
    descuento = convertir_importe(descuento, "El descuento")

    importe_bruto = costo * cantidad_solicitada

    if descuento > importe_bruto:
        raise ValueError("El descuento no puede superar el importe bruto.")

    subtotal = importe_bruto - descuento

    detalle = DetalleCompra(
        compra_id=compra_id,
        producto_id=producto_id,
        cantidad_solicitada=cantidad_solicitada,
        costo_unitario=costo,
        descuento=descuento,
        subtotal=subtotal,
        observaciones=observaciones.strip() if observaciones else None
    )

    try:
        db.session.add(detalle)
        compra.subtotal += subtotal
        compra.total = compra.subtotal
        db.session.commit()
        return detalle
    except Exception:
        db.session.rollback()
        raise


def listar_detalles_compra(compra_id):
    compra = db.session.get(Compra, compra_id)

    if not compra:
        raise ValueError("La compra no existe.")

    return db.session.scalars(
        select(DetalleCompra)
        .where(DetalleCompra.compra_id == compra_id)
        .order_by(DetalleCompra.id)
    ).all()


def obtener_detalle_compra(detalle_id):
    return db.session.get(DetalleCompra, detalle_id)


def eliminar_detalle_compra(detalle_id):
    detalle = obtener_detalle_compra(detalle_id)

    if not detalle:
        raise ValueError("El detalle de compra no existe.")

    compra = db.session.get(Compra, detalle.compra_id)

    if compra.estado != "BORRADOR":
        raise ValueError("Solo se pueden eliminar detalles de compras en borrador.")

    compra.subtotal -= detalle.subtotal
    compra.total = compra.subtotal

    try:
        db.session.delete(detalle)
        db.session.commit()
        return True
    except Exception:
        db.session.rollback()
        raise