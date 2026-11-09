from decimal import Decimal, InvalidOperation

from sqlalchemy import select

from app.extensions import db
from app.models.inventario import Existencia, MovimientoInventario
from app.models.catalogo import Producto
from app.models.personas import Usuario
from app.models.compras import Lote


TIPOS_MOVIMIENTO = {
    "ENTRADA",
    "SALIDA",
    "AJUSTE_ENTRADA",
    "AJUSTE_SALIDA"
}


def validar_cantidad(cantidad):
    if (
        isinstance(cantidad, bool)
        or not isinstance(cantidad, int)
        or cantidad <= 0
    ):
        raise ValueError(
            "La cantidad debe ser un entero mayor que cero."
        )


def validar_costo(costo):
    if costo is None:
        return None

    try:
        costo = Decimal(str(costo))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("El costo unitario debe ser válido.")

    if not costo.is_finite() or costo < 0:
        raise ValueError("El costo unitario no puede ser negativo.")

    if costo.as_tuple().exponent < -2:
        raise ValueError(
            "El costo unitario admite máximo dos decimales."
        )

    return costo


def validar_movimiento_no_duplicado(
    tipo_movimiento,
    detalle_recepcion_id=None,
    detalle_venta_id=None,
    detalle_devolucion_id=None
):
    relaciones = [
        detalle_recepcion_id,
        detalle_venta_id,
        detalle_devolucion_id
    ]

    if sum(valor is not None for valor in relaciones) > 1:
        raise ValueError(
            "Un movimiento solo puede estar vinculado a un "
            "proceso de origen."
        )

    if detalle_recepcion_id is not None:
        condicion = (
            MovimientoInventario.detalle_recepcion_id
            == detalle_recepcion_id
        )

    elif detalle_venta_id is not None:
        condicion = (
            MovimientoInventario.detalle_venta_id
            == detalle_venta_id
        )

    elif detalle_devolucion_id is not None:
        condicion = (
            MovimientoInventario.detalle_devolucion_id
            == detalle_devolucion_id
        )

    else:
        return

    movimiento_existente = db.session.scalar(
        select(MovimientoInventario.id)
        .where(
            condicion,
            MovimientoInventario.tipo_movimiento == tipo_movimiento
        )
    )

    if movimiento_existente is not None:
        raise ValueError(
            "Ya existe un movimiento de este tipo vinculado "
            "al proceso indicado."
        )


def registrar_movimiento(
    producto_id,
    usuario_id,
    tipo_movimiento,
    cantidad,
    motivo=None,
    lote_id=None,
    detalle_recepcion_id=None,
    detalle_venta_id=None,
    detalle_devolucion_id=None,
    costo_unitario_aplicado=None,
    confirmar_transaccion=True
):
    if not isinstance(tipo_movimiento, str):
        raise ValueError("El tipo de movimiento debe ser texto.")

    tipo_movimiento = tipo_movimiento.strip().upper()

    if tipo_movimiento not in TIPOS_MOVIMIENTO:
        raise ValueError("El tipo de movimiento no es válido.")

    validar_cantidad(cantidad)
    costo = validar_costo(costo_unitario_aplicado)

    producto = db.session.get(Producto, producto_id)
    usuario = db.session.get(Usuario, usuario_id)

    if not producto or not producto.estado:
        raise ValueError("El producto no existe o está inactivo.")

    if not usuario or not usuario.estado:
        raise ValueError("El usuario no existe o está inactivo.")

    if lote_id is not None:
        lote = db.session.get(Lote, lote_id)

        if not lote:
            raise ValueError("El lote indicado no existe.")

        producto_del_lote = (
            lote.detalle_recepcion
            .detalle_compra
            .producto_id
        )

        if producto_del_lote != producto_id:
            raise ValueError(
                "El lote no pertenece al producto indicado."
            )

    try:
        existencia = db.session.scalar(
            select(Existencia)
            .where(Existencia.producto_id == producto_id)
            .with_for_update()
        )

        if existencia is None:
            existencia = Existencia(
                producto_id=producto_id,
                cantidad_actual=0,
                umbral_minimo=0,
                stock_respaldo=0
            )
            db.session.add(existencia)
            db.session.flush()

        # Evita registrar dos veces el mismo movimiento
        # para un mismo detalle de recepción, venta o devolución.
        validar_movimiento_no_duplicado(
            tipo_movimiento=tipo_movimiento,
            detalle_recepcion_id=detalle_recepcion_id,
            detalle_venta_id=detalle_venta_id,
            detalle_devolucion_id=detalle_devolucion_id
        )

        if tipo_movimiento in {"ENTRADA", "AJUSTE_ENTRADA"}:
            existencia.cantidad_actual += cantidad

        else:
            if existencia.cantidad_actual < cantidad:
                raise ValueError(
                    f"Existencias insuficientes para el producto "
                    f"{producto.nombre}. Disponibles: "
                    f"{existencia.cantidad_actual}; solicitadas: "
                    f"{cantidad}."
                )

            existencia.cantidad_actual -= cantidad

        movimiento = MovimientoInventario(
            producto_id=producto_id,
            usuario_id=usuario_id,
            lote_id=lote_id,
            detalle_recepcion_id=detalle_recepcion_id,
            detalle_venta_id=detalle_venta_id,
            detalle_devolucion_id=detalle_devolucion_id,
            tipo_movimiento=tipo_movimiento,
            cantidad=cantidad,
            motivo=motivo.strip() if motivo else None,
            costo_unitario_aplicado=costo
        )

        db.session.add(movimiento)
        db.session.flush()

        if confirmar_transaccion:
            db.session.commit()

        return movimiento

    except Exception:
        if confirmar_transaccion:
            db.session.rollback()
        raise


def registrar_entrada(
    producto_id,
    usuario_id,
    cantidad,
    lote_id=None,
    detalle_recepcion_id=None,
    costo_unitario_aplicado=None,
    motivo=None,
    confirmar_transaccion=True
):
    return registrar_movimiento(
        producto_id=producto_id,
        usuario_id=usuario_id,
        tipo_movimiento="ENTRADA",
        cantidad=cantidad,
        lote_id=lote_id,
        detalle_recepcion_id=detalle_recepcion_id,
        costo_unitario_aplicado=costo_unitario_aplicado,
        motivo=motivo,
        confirmar_transaccion=confirmar_transaccion
    )


def registrar_salida(
    producto_id,
    usuario_id,
    cantidad,
    detalle_venta_id=None,
    costo_unitario_aplicado=None,
    motivo=None,
    confirmar_transaccion=True
):
    return registrar_movimiento(
        producto_id=producto_id,
        usuario_id=usuario_id,
        tipo_movimiento="SALIDA",
        cantidad=cantidad,
        detalle_venta_id=detalle_venta_id,
        costo_unitario_aplicado=costo_unitario_aplicado,
        motivo=motivo,
        confirmar_transaccion=confirmar_transaccion
    )


def ajustar_existencia(
    producto_id,
    usuario_id,
    cantidad,
    tipo_ajuste,
    motivo
):
    if not motivo or not motivo.strip():
        raise ValueError("Debe indicar el motivo del ajuste.")

    tipo_ajuste = tipo_ajuste.strip().upper()

    if tipo_ajuste not in {"AJUSTE_ENTRADA", "AJUSTE_SALIDA"}:
        raise ValueError(
            "El ajuste debe ser AJUSTE_ENTRADA o AJUSTE_SALIDA."
        )

    return registrar_movimiento(
        producto_id=producto_id,
        usuario_id=usuario_id,
        tipo_movimiento=tipo_ajuste,
        cantidad=cantidad,
        motivo=motivo
    )


def listar_movimientos():
    return db.session.scalars(
        select(MovimientoInventario)
        .order_by(MovimientoInventario.fecha_movimiento.desc())
    ).all()


def listar_movimientos_por_producto(producto_id):
    producto = db.session.get(Producto, producto_id)

    if not producto:
        raise ValueError("El producto no existe.")

    return db.session.scalars(
        select(MovimientoInventario)
        .where(MovimientoInventario.producto_id == producto_id)
        .order_by(MovimientoInventario.fecha_movimiento.desc())
    ).all()


def obtener_movimiento(movimiento_id):
    return db.session.get(MovimientoInventario, movimiento_id)