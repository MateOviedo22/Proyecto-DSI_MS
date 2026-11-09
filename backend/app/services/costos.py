"""Costos y precios centralizados en el servidor (RF 20 a 24, RNF 6, 8 y 9).

    C = C_adq + E / n          costo total unitario (adquisición + envío proporcional)
    P = redondeo[ C x (1 + m) ]  precio de venta con margen y política de redondeo

Un mismo producto produce el mismo costo y el mismo precio en la venta, en los
reportes y en la pantalla de compras, porque todos parten de estas funciones.
"""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select

from app.extensions import db
from app.models.compras import DetalleCompra, DetalleRecepcion, Lote

CENTAVOS = Decimal("0.01")
REDONDEOS_VALIDOS = (0, 1, 5, 10, 50)


def a_decimal(valor, campo="El valor"):
    try:
        numero = Decimal(str(valor))
    except Exception:
        raise ValueError(f"{campo} debe ser un número válido.")
    if not numero.is_finite():
        raise ValueError(f"{campo} debe ser un número válido.")
    return numero


def en_centavos(valor):
    return Decimal(valor).quantize(CENTAVOS, rounding=ROUND_HALF_UP)


def costo_total_unitario(costo_adquisicion, costo_envio_total, unidades):
    """C = C_adq + E / n"""
    unidades = int(unidades)
    if unidades <= 0:
        raise ValueError("El número de unidades debe ser mayor que cero.")
    envio_unitario = en_centavos(a_decimal(costo_envio_total, "El costo de envío") / unidades)
    return en_centavos(a_decimal(costo_adquisicion, "El costo de adquisición")) + envio_unitario, envio_unitario


def redondear_precio(valor, regla):
    """Aplica la política de redondeo: 0 = centavos, 1 = entero, 5/10/50 = múltiplos."""
    regla = int(regla or 0)
    if regla not in REDONDEOS_VALIDOS:
        raise ValueError("La regla de redondeo no es válida (use 0, 1, 5, 10 o 50).")
    valor = Decimal(valor)
    if regla == 0:
        return en_centavos(valor)
    if regla == 1:
        return en_centavos(valor.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return en_centavos((valor / regla).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * regla)


def precio_con_margen(costo_total, margen_porcentaje, regla=0):
    """P = redondeo[ C x (1 + m) ]"""
    margen = a_decimal(margen_porcentaje, "El margen") / Decimal(100)
    return redondear_precio(Decimal(costo_total) * (Decimal(1) + margen), regla)


def costos_actuales(producto_ids=None):
    """Costo unitario total del lote más reciente de cada producto: {producto_id: Decimal}."""
    consulta = (
        select(DetalleCompra.producto_id, Lote.costo_unitario_total)
        .join(DetalleRecepcion, DetalleRecepcion.detalle_compra_id == DetalleCompra.id)
        .join(Lote, Lote.detalle_recepcion_id == DetalleRecepcion.id)
        .order_by(Lote.id)
    )
    if producto_ids is not None:
        consulta = consulta.where(DetalleCompra.producto_id.in_(list(producto_ids)))
    costos = {}
    for producto_id, costo in db.session.execute(consulta):
        costos[producto_id] = Decimal(costo)  # el último lote sobrescribe a los anteriores
    return costos


def costo_unitario_actual(producto_id):
    return costos_actuales([producto_id]).get(producto_id)
