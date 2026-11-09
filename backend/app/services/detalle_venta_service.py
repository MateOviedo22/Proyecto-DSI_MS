
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from sqlalchemy import select

from app.extensions import db
from app.models.ventas import Venta, DetalleVenta
from app.models.catalogo import Producto, PrecioProducto


CENTAVO = Decimal("0.01")
CUATRO_DECIMALES = Decimal("0.0001")


def convertir_decimal(valor, campo="importe", decimales=2):
    """Convierte y valida un valor numérico utilizando Decimal."""
    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(
            f"El campo {campo} debe ser un número válido."
        )

    if not numero.is_finite():
        raise ValueError(
            f"El campo {campo} debe ser un número válido."
        )

    if numero < 0:
        raise ValueError(
            f"El campo {campo} no puede ser negativo."
        )

    if numero.as_tuple().exponent < -decimales:
        raise ValueError(
            f"El campo {campo} admite máximo {decimales} decimales."
        )

    formato = CENTAVO if decimales == 2 else CUATRO_DECIMALES

    return numero.quantize(formato, rounding=ROUND_HALF_UP)


def validar_cantidad(cantidad):
    """Valida que la cantidad sea un entero positivo."""
    if (
        isinstance(cantidad, bool)
        or not isinstance(cantidad, int)
        or cantidad <= 0
    ):
        raise ValueError(
            "La cantidad debe ser un entero mayor que cero."
        )


def obtener_venta(venta_id):
    """Obtiene una venta por su identificador."""
    venta = db.session.get(Venta, venta_id)

    if not venta:
        raise ValueError("La venta indicada no existe.")

    return venta


def validar_venta_editable(venta_id):
    """
    Comprueba que la venta exista y esté en BORRADOR.
    Bloquea el registro para evitar modificaciones simultáneas.
    """
    venta = db.session.scalar(
        select(Venta)
        .where(Venta.id == venta_id)
        .with_for_update()
    )

    if not venta:
        raise ValueError("La venta indicada no existe.")

    if venta.estado != "BORRADOR":
        raise ValueError(
            "Solo se pueden modificar los detalles de una venta "
            "en BORRADOR."
        )

    return venta


def obtener_precio_actual(producto_id):
    """Obtiene el precio de venta vigente de un producto."""
    precio = db.session.scalar(
        select(PrecioProducto)
        .where(
            PrecioProducto.producto_id == producto_id,
            PrecioProducto.vigente_hasta.is_(None),
        )
    )

    if not precio:
        raise ValueError(
            "El producto no tiene un precio de venta vigente registrado."
        )

    return convertir_decimal(
        precio.precio_venta,
        "precio unitario",
    )


def calcular_importes(
    precio_unitario,
    cantidad,
    descuento,
    tasa_impuesto,
):
    """
    Calcula los importes de un detalle de venta.

    La tasa de impuesto se interpreta como porcentaje.
    Ejemplo: 15.0000 representa el 15 %.
    """
    validar_cantidad(cantidad)

    precio_unitario = convertir_decimal(
        precio_unitario,
        "precio unitario",
    )

    descuento = convertir_decimal(
        descuento,
        "descuento",
    )

    tasa_impuesto = convertir_decimal(
        tasa_impuesto,
        "tasa de impuesto",
        decimales=4,
    )

    if tasa_impuesto > Decimal("100"):
        raise ValueError(
            "La tasa de impuesto no puede superar el 100 %."
        )

    subtotal = (precio_unitario * cantidad).quantize(
        CENTAVO,
        rounding=ROUND_HALF_UP,
    )

    if descuento > subtotal:
        raise ValueError(
            "El descuento no puede superar el subtotal del producto."
        )

    base_imponible = subtotal - descuento

    monto_impuesto = (
        base_imponible * tasa_impuesto / Decimal("100")
    ).quantize(
        CENTAVO,
        rounding=ROUND_HALF_UP,
    )

    total_linea = (
        base_imponible + monto_impuesto
    ).quantize(
        CENTAVO,
        rounding=ROUND_HALF_UP,
    )

    return {
        "subtotal": subtotal,
        "descuento": descuento,
        "tasa_impuesto": tasa_impuesto,
        "monto_impuesto": monto_impuesto,
        "total_linea": total_linea,
    }


def agregar_detalle_venta(
    venta_id,
    producto_id,
    cantidad,
    descuento=0,
    tasa_impuesto=0,
    precio_unitario=None,
    dias_garantia=None,
):
    """
    Agrega un producto a una venta en BORRADOR.

    Si no se proporciona precio_unitario, utiliza el precio vigente
    del catálogo. Los datos del producto quedan guardados como snapshot.
    """
    try:
        validar_cantidad(cantidad)

        venta = validar_venta_editable(venta_id)

        producto = db.session.scalar(
            select(Producto)
            .where(Producto.id == producto_id)
            .with_for_update()
        )

        if not producto or not producto.estado:
            raise ValueError(
                "El producto no existe o está inactivo."
            )

        if precio_unitario is None:
            precio_unitario = obtener_precio_actual(producto_id)
        else:
            precio_unitario = convertir_decimal(
                precio_unitario,
                "precio unitario",
            )

        if dias_garantia is None:
            dias_garantia = producto.dias_garantia_default

        if dias_garantia is not None:
            if (
                isinstance(dias_garantia, bool)
                or not isinstance(dias_garantia, int)
                or dias_garantia < 0
            ):
                raise ValueError(
                    "Los días de garantía deben ser un entero "
                    "no negativo."
                )

        importes = calcular_importes(
            precio_unitario=precio_unitario,
            cantidad=cantidad,
            descuento=descuento,
            tasa_impuesto=tasa_impuesto,
        )

        detalle = DetalleVenta(
            venta_id=venta.id,
            producto_id=producto.id,
            sku_snapshot=producto.sku,
            producto_nombre_snapshot=producto.nombre,
            cantidad=cantidad,
            precio_unitario=precio_unitario,
            descuento=importes["descuento"],
            tasa_impuesto=importes["tasa_impuesto"],
            monto_impuesto=importes["monto_impuesto"],
            subtotal=importes["subtotal"],
            total_linea=importes["total_linea"],
            dias_garantia=dias_garantia,
        )

        db.session.add(detalle)
        db.session.flush()

        from app.services.venta_service import recalcular_totales_venta

        recalcular_totales_venta(venta.id)

        db.session.commit()
        return detalle

    except Exception:
        db.session.rollback()
        raise


def listar_detalles_venta(venta_id):
    """Lista los productos asociados a una venta."""
    obtener_venta(venta_id)

    return db.session.scalars(
        select(DetalleVenta)
        .where(DetalleVenta.venta_id == venta_id)
        .order_by(DetalleVenta.id)
    ).all()


def obtener_detalle_venta(detalle_id):
    """Obtiene un detalle específico."""
    detalle = db.session.get(DetalleVenta, detalle_id)

    if not detalle:
        raise ValueError("El detalle de venta no existe.")

    return detalle


def actualizar_detalle_venta(
    detalle_id,
    cantidad=None,
    descuento=None,
    tasa_impuesto=None,
    precio_unitario=None,
    dias_garantia=None,
    actualizar_garantia=False,
):
    """
    Actualiza un detalle de venta.

    Solo permite modificaciones mientras la venta esté en BORRADOR.

    actualizar_garantia=True permite establecer dias_garantia,
    incluso si su valor es None.
    """
    try:
        detalle = db.session.scalar(
            select(DetalleVenta)
            .where(DetalleVenta.id == detalle_id)
            .with_for_update()
        )

        if not detalle:
            raise ValueError("El detalle de venta no existe.")

        venta = validar_venta_editable(detalle.venta_id)

        nueva_cantidad = (
            detalle.cantidad if cantidad is None else cantidad
        )
        validar_cantidad(nueva_cantidad)

        nuevo_precio = (
            detalle.precio_unitario
            if precio_unitario is None
            else precio_unitario
        )

        nuevo_descuento = (
            detalle.descuento
            if descuento is None
            else descuento
        )

        nueva_tasa = (
            detalle.tasa_impuesto
            if tasa_impuesto is None
            else tasa_impuesto
        )

        importes = calcular_importes(
            precio_unitario=nuevo_precio,
            cantidad=nueva_cantidad,
            descuento=nuevo_descuento,
            tasa_impuesto=nueva_tasa,
        )

        if actualizar_garantia:
            if dias_garantia is not None:
                if (
                    isinstance(dias_garantia, bool)
                    or not isinstance(dias_garantia, int)
                    or dias_garantia < 0
                ):
                    raise ValueError(
                        "Los días de garantía deben ser un entero "
                        "no negativo."
                    )

            detalle.dias_garantia = dias_garantia

        detalle.cantidad = nueva_cantidad
        detalle.precio_unitario = convertir_decimal(
            nuevo_precio,
            "precio unitario",
        )
        detalle.descuento = importes["descuento"]
        detalle.tasa_impuesto = importes["tasa_impuesto"]
        detalle.subtotal = importes["subtotal"]
        detalle.monto_impuesto = importes["monto_impuesto"]
        detalle.total_linea = importes["total_linea"]

        from app.services.venta_service import recalcular_totales_venta

        recalcular_totales_venta(venta.id)

        db.session.commit()
        return detalle

    except Exception:
        db.session.rollback()
        raise


def eliminar_detalle_venta(detalle_id):
    """
    Elimina un producto de una venta en BORRADOR.
    No permite eliminar detalles de ventas completadas.
    """
    try:
        detalle = db.session.scalar(
            select(DetalleVenta)
            .where(DetalleVenta.id == detalle_id)
            .with_for_update()
        )

        if not detalle:
            raise ValueError("El detalle de venta no existe.")

        venta = validar_venta_editable(detalle.venta_id)

        db.session.delete(detalle)
        db.session.flush()

        from app.services.venta_service import recalcular_totales_venta

        recalcular_totales_venta(venta.id)

        db.session.commit()
        return True

    except Exception:
        db.session.rollback()
        raise
