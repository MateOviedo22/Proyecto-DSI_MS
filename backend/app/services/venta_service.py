
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from uuid import uuid4

from sqlalchemy import select

from app.extensions import db
from app.models.ventas import (
    Venta,
    Pedido,
    DetalleVenta,
    Cliente,
)
from app.models.catalogo import Producto
from app.models.personas import Usuario
from app.models.inventario import Existencia, MovimientoInventario

from app.services.movimiento_inventario_service import registrar_movimiento
from app.services.unidad_serializada_service import (
    obtener_unidades_disponibles,
    asignar_unidades_a_venta,
)


ESTADOS_VENTA = {
    "BORRADOR",
    "COMPLETADA",
    "ANULADA",
}

CANALES_VENTA = {
    "PISO",
    "ONLINE",
    "TELEFONO",
}

METODOS_PAGO = {
    "EFECTIVO",
    "TARJETA",
    "TRANSFERENCIA",
    "OTRO",
}


def convertir_importe(valor, campo="importe"):
    """Convierte un valor a Decimal y valida que sea un importe válido."""
    try:
        importe = Decimal(str(valor))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(
            f"El campo {campo} debe ser un importe válido."
        )

    if not importe.is_finite():
        raise ValueError(
            f"El campo {campo} debe ser un importe válido."
        )

    if importe < 0:
        raise ValueError(
            f"El campo {campo} no puede ser negativo."
        )

    if importe.as_tuple().exponent < -2:
        raise ValueError(
            f"El campo {campo} admite como máximo dos decimales."
        )

    return importe.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def generar_numero_venta():
    """Genera un identificador único para la venta."""
    fecha = datetime.now(timezone.utc).strftime("%Y%m%d")
    identificador = uuid4().hex[:8].upper()

    return f"V-{fecha}-{identificador}"


def obtener_venta(venta_id):
    """Obtiene una venta por su identificador."""
    venta = db.session.get(Venta, venta_id)

    if not venta:
        raise ValueError("La venta solicitada no existe.")

    return venta


def crear_venta(
    usuario_id,
    metodo_pago,
    cliente_id=None,
    pedido_id=None,
    canal="PISO",
):
    """Crea una venta en estado BORRADOR."""

    if not isinstance(metodo_pago, str):
        raise ValueError("El método de pago debe ser texto.")

    if not isinstance(canal, str):
        raise ValueError("El canal de venta debe ser texto.")

    metodo_pago = metodo_pago.strip().upper()
    canal = canal.strip().upper()

    if metodo_pago not in METODOS_PAGO:
        raise ValueError("El método de pago indicado no es válido.")

    if canal not in CANALES_VENTA:
        raise ValueError("El canal de venta indicado no es válido.")

    try:
        usuario = db.session.scalar(
            select(Usuario)
            .where(Usuario.id == usuario_id)
            .with_for_update()
        )

        if not usuario or not usuario.estado:
            raise ValueError(
                "El usuario no existe o está inactivo."
            )

        if cliente_id is not None:
            cliente = db.session.get(Cliente, cliente_id)

            if not cliente:
                raise ValueError("El cliente indicado no existe.")

        if pedido_id is not None:
            pedido = db.session.scalar(
                select(Pedido)
                .where(Pedido.id == pedido_id)
                .with_for_update()
            )

            if not pedido:
                raise ValueError("El pedido indicado no existe.")

            if pedido.estado not in {"PENDIENTE", "CONFIRMADO"}:
                raise ValueError(
                    "El pedido no está en un estado válido "
                    "para generar una venta."
                )

            if not pedido.detalles:
                raise ValueError(
                    "No se puede generar una venta de un pedido "
                    "sin productos."
                )

            if pedido.venta is not None:
                raise ValueError(
                    "Este pedido ya tiene una venta asociada."
                )

            if (
                cliente_id is not None
                and pedido.cliente_id != cliente_id
            ):
                raise ValueError(
                    "El cliente indicado no coincide con "
                    "el cliente del pedido."
                )

            if cliente_id is None:
                cliente_id = pedido.cliente_id

        venta = Venta(
            numero_venta=generar_numero_venta(),
            usuario_id=usuario_id,
            cliente_id=cliente_id,
            pedido_id=pedido_id,
            fecha_venta=datetime.now(timezone.utc),
            canal=canal,
            metodo_pago=metodo_pago,
            estado="BORRADOR",
            subtotal=Decimal("0.00"),
            descuento_total=Decimal("0.00"),
            impuesto_total=Decimal("0.00"),
            total=Decimal("0.00"),
        )

        db.session.add(venta)
        db.session.commit()

        return venta

    except Exception:
        db.session.rollback()
        raise


def listar_ventas():
    """Lista todas las ventas, de la más reciente a la más antigua."""
    return db.session.scalars(
        select(Venta).order_by(Venta.fecha_venta.desc())
    ).all()


def listar_ventas_por_estado(estado):
    """Lista las ventas según su estado."""
    if not isinstance(estado, str):
        raise ValueError("El estado debe ser texto.")

    estado = estado.strip().upper()

    if estado not in ESTADOS_VENTA:
        raise ValueError(
            "El estado de venta indicado no es válido."
        )

    return db.session.scalars(
        select(Venta)
        .where(Venta.estado == estado)
        .order_by(Venta.fecha_venta.desc())
    ).all()


def listar_ventas_por_cliente(cliente_id):
    """Lista las ventas asociadas a un cliente."""
    cliente = db.session.get(Cliente, cliente_id)

    if not cliente:
        raise ValueError("El cliente indicado no existe.")

    return db.session.scalars(
        select(Venta)
        .where(Venta.cliente_id == cliente_id)
        .order_by(Venta.fecha_venta.desc())
    ).all()


def recalcular_totales_venta(venta_id):
    """
    Recalcula los importes de una venta utilizando sus detalles.

    DetalleVenta.subtotal: importe antes del descuento.
    DetalleVenta.descuento: importe monetario descontado.
    DetalleVenta.monto_impuesto: importe monetario del impuesto.
    """
    venta = obtener_venta(venta_id)

    detalles = db.session.scalars(
        select(DetalleVenta)
        .where(DetalleVenta.venta_id == venta_id)
    ).all()

    subtotal = sum(
        (
            Decimal(str(detalle.subtotal))
            for detalle in detalles
        ),
        Decimal("0.00"),
    )

    descuentos = sum(
        (
            Decimal(str(detalle.descuento))
            for detalle in detalles
        ),
        Decimal("0.00"),
    )

    impuestos = sum(
        (
            Decimal(str(detalle.monto_impuesto))
            for detalle in detalles
        ),
        Decimal("0.00"),
    )

    total = subtotal - descuentos + impuestos

    venta.subtotal = subtotal.quantize(Decimal("0.01"))
    venta.descuento_total = descuentos.quantize(Decimal("0.01"))
    venta.impuesto_total = impuestos.quantize(Decimal("0.01"))
    venta.total = total.quantize(Decimal("0.01"))

    return venta


def confirmar_venta(venta_id):
    """
    Confirma una venta y registra las salidas de inventario.

    Los movimientos, las unidades serializadas y el cambio de estado
    se guardan en una sola transacción.
    """
    try:
        venta = db.session.scalar(
            select(Venta)
            .where(Venta.id == venta_id)
            .with_for_update()
        )

        if not venta:
            raise ValueError("La venta indicada no existe.")

        if venta.estado != "BORRADOR":
            raise ValueError(
                "Solamente se pueden confirmar ventas "
                "en estado BORRADOR."
            )

        usuario = db.session.get(Usuario, venta.usuario_id)

        if not usuario or not usuario.estado:
            raise ValueError(
                "El usuario responsable no existe o está inactivo."
            )

        detalles = db.session.scalars(
            select(DetalleVenta)
            .where(DetalleVenta.venta_id == venta_id)
            .order_by(DetalleVenta.id)
            .with_for_update()
        ).all()

        if not detalles:
            raise ValueError(
                "No se puede confirmar una venta sin productos."
            )

        # Verificar que los detalles tengan cantidades válidas.
        for detalle in detalles:
            if (
                isinstance(detalle.cantidad, bool)
                or not isinstance(detalle.cantidad, int)
                or detalle.cantidad <= 0
            ):
                raise ValueError(
                    f"El detalle {detalle.id} tiene una cantidad inválida."
                )

        # Comprobar que no existan salidas previamente registradas
        # para los detalles de esta venta.
        detalle_ids = [detalle.id for detalle in detalles]

        movimientos_existentes = db.session.scalars(
            select(MovimientoInventario)
            .where(
                MovimientoInventario.detalle_venta_id.in_(detalle_ids),
                MovimientoInventario.tipo_movimiento == "SALIDA",
            )
            .with_for_update()
        ).all()

        if movimientos_existentes:
            raise ValueError(
                "La venta contiene detalles con movimientos de salida "
                "ya registrados. No se puede confirmar nuevamente "
                "sin revisar el inventario."
            )

        # Recalcular los totales antes de confirmar.
        recalcular_totales_venta(venta_id)
        db.session.flush()

        if venta.total <= 0:
            raise ValueError(
                "El total de la venta debe ser mayor que cero."
            )

        # Agrupar cantidades por producto.
        cantidades_por_producto = {}

        for detalle in detalles:
            cantidades_por_producto[detalle.producto_id] = (
                cantidades_por_producto.get(
                    detalle.producto_id,
                    0,
                ) + detalle.cantidad
            )

        productos_por_id = {}
        unidades_por_producto = {}

        # Validar productos y existencias antes de registrar movimientos.
        for producto_id, cantidad_total in cantidades_por_producto.items():

            producto = db.session.scalar(
                select(Producto)
                .where(Producto.id == producto_id)
                .with_for_update()
            )

            if not producto or not producto.estado:
                raise ValueError(
                    f"El producto {producto_id} "
                    "no existe o está inactivo."
                )

            existencia = db.session.scalar(
                select(Existencia)
                .where(Existencia.producto_id == producto_id)
                .with_for_update()
            )

            cantidad_disponible = (
                existencia.cantidad_actual if existencia else 0
            )

            if cantidad_disponible < cantidad_total:
                raise ValueError(
                    f"Existencias insuficientes para {producto.nombre}. "
                    f"Disponibles: {cantidad_disponible}; "
                    f"solicitadas: {cantidad_total}."
                )

            productos_por_id[producto_id] = producto

            if producto.requiere_numero_serie:
                unidades_por_producto[producto_id] = (
                    obtener_unidades_disponibles(
                        producto_id,
                        cantidad_total,
                    )
                )

        # Distribuir las unidades serializadas entre los detalles.
        posiciones_unidades = {
            producto_id: 0
            for producto_id in unidades_por_producto
        }

        productos_validos = []

        for detalle in detalles:
            producto = productos_por_id[detalle.producto_id]
            unidades = []

            if producto.requiere_numero_serie:
                inicio = posiciones_unidades[producto.id]
                fin = inicio + detalle.cantidad

                unidades = unidades_por_producto[producto.id][inicio:fin]

                if len(unidades) != detalle.cantidad:
                    raise ValueError(
                        f"No hay suficientes unidades serializadas "
                        f"para el producto {producto.nombre}."
                    )

                posiciones_unidades[producto.id] = fin

            productos_validos.append({
                "detalle": detalle,
                "producto": producto,
                "unidades": unidades,
            })

        # Costo unitario vigente de cada producto: queda guardado en la salida
        # para que el reporte de costos y ganancias (RF 44) no cambie después.
        from app.services.costos import costos_actuales

        costos = costos_actuales(list(cantidades_por_producto))

        # Registrar las salidas de inventario sin confirmar
        # individualmente cada movimiento.
        for item in productos_validos:
            detalle = item["detalle"]
            producto = item["producto"]
            unidades = item["unidades"]

            registrar_movimiento(
                producto_id=producto.id,
                usuario_id=venta.usuario_id,
                tipo_movimiento="SALIDA",
                cantidad=detalle.cantidad,
                motivo=f"Salida por venta {venta.numero_venta}",
                detalle_venta_id=detalle.id,
                costo_unitario_aplicado=costos.get(producto.id),
                confirmar_transaccion=False,
            )

            if producto.requiere_numero_serie:
                asignar_unidades_a_venta(
                    detalle_venta=detalle,
                    unidades=unidades,
                    fecha_venta=venta.fecha_venta,
                )

        # Completar la venta después de registrar todas las salidas.
        venta.estado = "COMPLETADA"

        db.session.commit()
        return venta

    except Exception:
        db.session.rollback()
        raise


def anular_venta(venta_id, motivo):
    
    try:
        if not isinstance(motivo, str) or not motivo.strip():
            raise ValueError(
                "Debe indicar el motivo de anulación."
            )

        venta = db.session.scalar(
            select(Venta)
            .where(Venta.id == venta_id)
            .with_for_update()
        )

        if not venta:
            raise ValueError("La venta indicada no existe.")

        if venta.estado != "BORRADOR":
            raise ValueError(
                "Solamente se pueden anular ventas en estado BORRADOR. "
                "Las ventas completadas requieren un proceso de reversión."
            )

        venta.estado = "ANULADA"

        db.session.commit()
        return venta

    except Exception:
        db.session.rollback()
        raise
