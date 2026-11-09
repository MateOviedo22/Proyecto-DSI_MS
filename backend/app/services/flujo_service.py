"""Servicios compuestos: cada función completa un proceso de negocio de punta a punta
en UNA transacción (ver ``transaccion_unica``) reutilizando los servicios existentes.

    registrar_venta_completa        venta + detalles + salida de inventario + series + factura
    registrar_recepcion_completa    recepción + revisión + lote con costo proporcional + series
    registrar_devolucion_completa   devolución + inspección + reingreso a inventario
    crear_producto_completo         producto + precio + existencia + proveedor + stock inicial
    ...más consultas enriquecidas (catálogo, ventas, compras, trazabilidad por número de serie).
"""

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from flask import g
from sqlalchemy import func, select

from app.errors import (
    ConflictoError,
    ErrorNegocio,
    ExistenciasInsuficientes,
    RecursoNoEncontrado,
)
from app.extensions import db
from app.models.catalogo import Categoria, PrecioProducto, Producto, ProductoProveedor
from app.models.compras import Compra, DetalleCompra, DetalleRecepcion, Lote, Proveedor, RecepcionMercaderia
from app.models.inventario import Existencia, MovimientoInventario
from app.models.personas import Usuario
from app.models.ventas import (
    DetalleDevolucion,
    DetalleVenta,
    Devolucion,
    ReclamoGarantia,
    UnidadSerializada,
    Venta,
)
from app.services import costos
from app.services.categoria_service import crear_categoria
from app.services.cliente_service import crear_cliente, obtener_cliente_por_identificacion
from app.services.compra_service import cambiar_estado_compra, crear_compra
from app.services.detalle_compra_service import agregar_detalle_compra
from app.services.detalle_devolucion_service import (
    agregar_detalle_devolucion,
    finalizar_devolucion,
    inspeccionar_detalle_devolucion,
)
from app.services.detalle_recepcion_service import registrar_revision
from app.services.detalle_venta_service import agregar_detalle_venta
from app.services.devolucion_service import cambiar_estado_devolucion, crear_devolucion
from app.services.existencia_service import actualizar_niveles_stock, crear_existencia
from app.services.factura_service import emitir_factura
from app.services.lote_service import finalizar_recepcion, listar_lotes_por_detalle_recepcion
from app.services.movimiento_inventario_service import registrar_movimiento
from app.services.notificacion_service import generar_alerta_stock
from app.services.precio_service import modificar_precio, registrar_precio
from app.services.producto_proveedor_service import (
    buscar_asociacion,
    crear_asociacion,
    establecer_proveedor_principal,
)
from app.services.producto_service import actualizar_producto, crear_producto
from app.services.recepcion_service import crear_recepcion
from app.services.transaccion import transaccion_unica
from app.services.unidad_serializada_service import listar_unidades_por_detalle_venta
from app.services.venta_service import confirmar_venta, crear_venta


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
def _utc(valor):
    if valor is None:
        return None
    return valor if valor.tzinfo else valor.replace(tzinfo=timezone.utc)


def _iso(valor):
    return _utc(valor).isoformat() if valor else None


def _txt(valor):
    return None if valor is None else str(valor)


def _entero(valor, campo, minimo=1):
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise ErrorNegocio(f"{campo} debe ser un número entero.")
    if valor < minimo:
        raise ErrorNegocio(f"{campo} debe ser {'mayor que cero' if minimo == 1 else f'al menos {minimo}'}.")
    return valor


def _lista(valor, campo):
    if not isinstance(valor, list) or not valor:
        raise ErrorNegocio(f"{campo} debe ser una lista con al menos un elemento.")
    return valor


def _objeto(valor):
    if not isinstance(valor, dict):
        raise ErrorNegocio("Se requiere un objeto JSON válido.")
    return valor


def _estado_alerta(cantidad, umbral):
    if cantidad == 0:
        return "AGOTADO"
    if umbral and cantidad <= umbral:
        return "STOCK_BAJO"
    return None


# ---------------------------------------------------------------------------
# Catálogo (producto + categoría + precio vigente + existencias + costo)
# ---------------------------------------------------------------------------
def construir_catalogo(producto_ids=None):
    consulta = (
        select(Producto, Categoria.nombre)
        .join(Categoria, Categoria.id == Producto.categoria_id)
        .order_by(Producto.nombre)
    )
    if producto_ids is not None:
        consulta = consulta.where(Producto.id.in_(list(producto_ids)))
    filas = db.session.execute(consulta).all()
    ids = [producto.id for producto, _ in filas]
    if not ids:
        return []

    precios = dict(
        db.session.execute(
            select(PrecioProducto.producto_id, PrecioProducto.precio_venta).where(
                PrecioProducto.producto_id.in_(ids), PrecioProducto.vigente_hasta.is_(None)
            )
        ).all()
    )
    existencias = {
        e.producto_id: e
        for e in db.session.scalars(select(Existencia).where(Existencia.producto_id.in_(ids)))
    }
    costo_por_producto = costos.costos_actuales(ids)
    proveedores = defaultdict(list)
    for asociacion, nombre in db.session.execute(
        select(ProductoProveedor, Proveedor.nombre)
        .join(Proveedor, Proveedor.id == ProductoProveedor.proveedor_id)
        .where(ProductoProveedor.producto_id.in_(ids), ProductoProveedor.estado.is_(True))
        .order_by(ProductoProveedor.es_principal.desc(), ProductoProveedor.id)
    ):
        proveedores[asociacion.producto_id].append(
            {"proveedor_id": asociacion.proveedor_id, "nombre": nombre, "es_principal": asociacion.es_principal}
        )
    series = dict(
        db.session.execute(
            select(UnidadSerializada.producto_id, func.count())
            .where(UnidadSerializada.producto_id.in_(ids), UnidadSerializada.estado == "EN_STOCK")
            .group_by(UnidadSerializada.producto_id)
        ).all()
    )

    catalogo = []
    for producto, categoria in filas:
        existencia = existencias.get(producto.id)
        cantidad = existencia.cantidad_actual if existencia else 0
        umbral = existencia.umbral_minimo if existencia else 0
        principal = proveedores[producto.id][0] if proveedores[producto.id] else None
        catalogo.append({
            "id": producto.id,
            "sku": producto.sku,
            "nombre": producto.nombre,
            "descripcion": producto.descripcion,
            "especificaciones": producto.especificaciones,
            "categoria_id": producto.categoria_id,
            "categoria": categoria,
            "modelo_id": producto.modelo_id,
            "requiere_numero_serie": producto.requiere_numero_serie,
            "dias_garantia_default": producto.dias_garantia_default,
            "estado": producto.estado,
            "precio_venta": _txt(precios.get(producto.id)),
            "costo_unitario_total": _txt(costo_por_producto.get(producto.id)),
            "existencia": {
                "cantidad_actual": cantidad,
                "umbral_minimo": umbral,
                "stock_respaldo": existencia.stock_respaldo if existencia else 0,
                "alerta": _estado_alerta(cantidad, umbral),
            },
            "unidades_serializadas_disponibles": series.get(producto.id, 0),
            "proveedor_id": principal["proveedor_id"] if principal else None,
            "proveedor": principal["nombre"] if principal else None,
            "proveedores": proveedores[producto.id],
        })
    return catalogo


def _resolver_categoria(datos):
    categoria_id = datos.get("categoria_id")
    if categoria_id is not None:
        return _entero(categoria_id, "La categoría")
    nombre = (datos.get("categoria") or "").strip()
    if not nombre:
        raise ErrorNegocio("Debe indicar la categoría del producto.")
    existente = db.session.scalar(select(Categoria).where(func.lower(Categoria.nombre) == nombre.lower()))
    if existente:
        if not existente.estado:
            raise ConflictoError(f"La categoría {existente.nombre} está inactiva.")
        return existente.id
    return crear_categoria(nombre).id


def crear_producto_completo(usuario_id, datos):
    datos = _objeto(datos)
    precio = costos.a_decimal(datos.get("precio_venta"), "El precio de venta")
    if precio < 0:
        raise ErrorNegocio("El precio de venta no puede ser negativo.")
    umbral = _entero(datos.get("umbral_minimo", 0), "El stock mínimo", 0)
    respaldo = _entero(datos.get("stock_respaldo", 0), "El nivel de respaldo", 0)
    cantidad_inicial = _entero(datos.get("cantidad_inicial", 0), "La cantidad inicial", 0)

    with transaccion_unica():
        categoria_id = _resolver_categoria(datos)
        producto = crear_producto(
            sku=datos.get("sku") or "",
            nombre=datos.get("nombre") or "",
            categoria_id=categoria_id,
            descripcion=datos.get("descripcion"),
            especificaciones=datos.get("especificaciones"),
            modelo_id=datos.get("modelo_id"),
            requiere_numero_serie=bool(datos.get("requiere_numero_serie", False)),
            dias_garantia_default=datos.get("dias_garantia_default"),
        )
        registrar_precio(producto.id, precio, usuario_id, "Precio inicial")
        crear_existencia(producto.id, umbral, respaldo)
        if datos.get("proveedor_id"):
            crear_asociacion(producto.id, _entero(datos["proveedor_id"], "El proveedor"), es_principal=True)
        if cantidad_inicial > 0:
            registrar_movimiento(
                producto_id=producto.id,
                usuario_id=usuario_id,
                tipo_movimiento="AJUSTE_ENTRADA",
                cantidad=cantidad_inicial,
                motivo="Existencia inicial al registrar el producto",
            )
    return construir_catalogo([producto.id])[0]


def editar_producto_completo(usuario_id, producto_id, datos):
    datos = _objeto(datos)
    with transaccion_unica():
        producto = db.session.get(Producto, producto_id)
        if producto is None:
            raise RecursoNoEncontrado("El producto no existe.")

        cambios = {}
        for campo in ("sku", "nombre", "descripcion", "especificaciones", "modelo_id", "dias_garantia_default"):
            if campo in datos:
                cambios[campo] = datos[campo]
        if "requiere_numero_serie" in datos:
            cambios["requiere_numero_serie"] = bool(datos["requiere_numero_serie"])
        if "categoria_id" in datos or "categoria" in datos:
            cambios["categoria_id"] = _resolver_categoria(datos)
        if cambios:
            actualizar_producto(producto_id, **cambios)

        if "precio_venta" in datos:
            nuevo = costos.a_decimal(datos["precio_venta"], "El precio de venta")
            vigente = db.session.scalar(
                select(PrecioProducto.precio_venta).where(
                    PrecioProducto.producto_id == producto_id, PrecioProducto.vigente_hasta.is_(None)
                )
            )
            if vigente is None:
                registrar_precio(producto_id, nuevo, usuario_id, "Precio inicial")
            elif Decimal(vigente) != costos.en_centavos(nuevo):
                modificar_precio(producto_id, nuevo, usuario_id, datos.get("motivo_precio") or "Actualización de precio")

        if "umbral_minimo" in datos or "stock_respaldo" in datos:
            existencia = db.session.scalar(select(Existencia).where(Existencia.producto_id == producto_id))
            if existencia is None:
                crear_existencia(producto_id, _entero(datos.get("umbral_minimo", 0), "El stock mínimo", 0),
                                 _entero(datos.get("stock_respaldo", 0), "El nivel de respaldo", 0))
            else:
                actualizar_niveles_stock(
                    producto_id,
                    _entero(datos.get("umbral_minimo", existencia.umbral_minimo), "El stock mínimo", 0),
                    _entero(datos.get("stock_respaldo", existencia.stock_respaldo), "El nivel de respaldo", 0),
                )

        if datos.get("proveedor_id"):
            proveedor_id = _entero(datos["proveedor_id"], "El proveedor")
            asociacion = buscar_asociacion(producto_id, proveedor_id)
            if asociacion is None:
                asociacion = crear_asociacion(producto_id, proveedor_id, es_principal=True)
            elif not asociacion.es_principal:
                establecer_proveedor_principal(asociacion.id)
    return construir_catalogo([producto_id])[0]


def actualizar_precios_masivo(usuario_id, datos):
    """Cambia precios por porcentaje o por margen sobre el costo, con redondeo (RF 22, 23).

    ``aplicar: false`` devuelve solo la vista previa sin modificar nada.
    """
    datos = _objeto(datos)
    modo = datos.get("modo")
    if modo not in ("porcentaje", "margen"):
        raise ErrorNegocio("El modo debe ser 'porcentaje' o 'margen'.")
    valor = costos.a_decimal(datos.get("valor"), "El valor")
    if valor <= 0:
        raise ErrorNegocio("El valor debe ser mayor que cero.")
    direccion = datos.get("direccion", "subir")
    if direccion not in ("subir", "bajar"):
        raise ErrorNegocio("La dirección debe ser 'subir' o 'bajar'.")
    regla = datos.get("redondeo", 0)

    consulta = select(Producto.id).where(Producto.estado.is_(True))
    if datos.get("producto_ids"):
        consulta = consulta.where(Producto.id.in_(_lista(datos["producto_ids"], "producto_ids")))
    elif datos.get("categoria_id"):
        consulta = consulta.where(Producto.categoria_id == _entero(datos["categoria_id"], "La categoría"))
    elif not datos.get("todos"):
        raise ErrorNegocio("Indique producto_ids, categoria_id o todos=true.")
    ids = list(db.session.scalars(consulta))
    if not ids:
        raise ErrorNegocio("No hay productos para actualizar con ese alcance.")

    catalogo = construir_catalogo(ids)
    propuesta, sin_costo = [], []
    for producto in catalogo:
        actual = Decimal(producto["precio_venta"]) if producto["precio_venta"] is not None else None
        costo = Decimal(producto["costo_unitario_total"]) if producto["costo_unitario_total"] is not None else None
        if modo == "porcentaje":
            if actual is None:
                continue
            factor = Decimal(1) + (valor if direccion == "subir" else -valor) / Decimal(100)
            nuevo = costos.redondear_precio(actual * factor, regla)
        else:
            if costo is None:
                sin_costo.append(producto["nombre"])
                continue
            nuevo = costos.precio_con_margen(costo, valor, regla)
        nuevo = max(nuevo, Decimal("1"))
        propuesta.append({
            "producto_id": producto["id"],
            "nombre": producto["nombre"],
            "precio_anterior": _txt(actual),
            "precio_nuevo": _txt(nuevo),
            "costo_unitario_total": _txt(costo),
            "margen_resultante": _txt(costos.en_centavos((nuevo - costo) / costo * 100)) if costo else None,
        })
    if modo == "margen" and sin_costo:
        raise ErrorNegocio(
            "No se puede fijar el margen porque faltan costos de: " + ", ".join(sin_costo[:5])
            + ("…" if len(sin_costo) > 5 else "") + ". Registre primero una recepción de compra."
        )

    aplicar = datos.get("aplicar", True)
    if aplicar:
        motivo = datos.get("motivo") or (
            f"{'+' if direccion == 'subir' else '-'}{valor}%" if modo == "porcentaje" else f"Margen {valor}%"
        )
        with transaccion_unica():
            for fila in propuesta:
                if fila["precio_anterior"] is None:
                    registrar_precio(fila["producto_id"], fila["precio_nuevo"], usuario_id, motivo)
                elif Decimal(fila["precio_anterior"]) != Decimal(fila["precio_nuevo"]):
                    modificar_precio(fila["producto_id"], fila["precio_nuevo"], usuario_id, motivo)
    return {"aplicado": bool(aplicar), "cambios": propuesta}


# ---------------------------------------------------------------------------
# Números de serie y garantía (RF 27 a 29, 36 a 38)
# ---------------------------------------------------------------------------
def registrar_series(producto_id, numeros_serie, lote_id=None):
    """Registra cámaras (u otros productos serializados) en inventario como EN_STOCK."""
    lista = [str(n).strip() for n in _lista(numeros_serie, "numeros_serie") if str(n).strip()]
    if not lista:
        raise ErrorNegocio("Debe indicar al menos un número de serie.")
    repetidos = {n for n in lista if [x.lower() for x in lista].count(n.lower()) > 1}
    if repetidos:
        raise ConflictoError(f"Hay números de serie repetidos en la lista: {', '.join(sorted(repetidos))}.", codigo="DUPLICADO")

    producto = db.session.get(Producto, producto_id)
    if producto is None or not producto.estado:
        raise RecursoNoEncontrado("El producto no existe o está inactivo.")
    if not producto.requiere_numero_serie:
        raise ErrorNegocio(f"El producto {producto.nombre} no requiere número de serie.")

    if lote_id is not None:
        lote = db.session.get(Lote, lote_id)
        if lote is None:
            raise RecursoNoEncontrado("El lote indicado no existe.")
        if lote.detalle_recepcion.detalle_compra.producto_id != producto_id:
            raise ErrorNegocio("El lote no pertenece al producto indicado.")

    existentes = db.session.scalars(
        select(UnidadSerializada.numero_serie).where(
            func.lower(UnidadSerializada.numero_serie).in_([n.lower() for n in lista])
        )
    ).all()
    if existentes:
        raise ConflictoError(
            f"Ya existe un registro con el número de serie: {', '.join(existentes)}.", codigo="DUPLICADO"
        )

    unidades = [
        UnidadSerializada(producto_id=producto_id, lote_id=lote_id, numero_serie=n, estado="EN_STOCK")
        for n in lista
    ]
    db.session.add_all(unidades)
    db.session.flush()
    return unidades


def _unidad_por_numero(numero_serie):
    numero = (numero_serie or "").strip()
    if not numero:
        raise ErrorNegocio("Debe indicar el número de serie.")
    unidad = db.session.scalar(
        select(UnidadSerializada).where(func.lower(UnidadSerializada.numero_serie) == numero.lower())
    )
    if unidad is None:
        raise RecursoNoEncontrado(f"El número de serie {numero} no existe en el inventario.")
    return unidad


def trazabilidad_por_serie(numero_serie):
    """Localiza la unidad por su número de serie y calcula el estado de la garantía (15 días)."""
    unidad = _unidad_por_numero(numero_serie)
    producto = db.session.get(Producto, unidad.producto_id)

    lote = None
    if unidad.lote_id:
        lote_obj = db.session.get(Lote, unidad.lote_id)
        lote = {
            "id": lote_obj.id,
            "fecha_recepcion": _iso(lote_obj.fecha_recepcion),
            "costo_unitario_total": _txt(lote_obj.costo_unitario_total),
        }

    venta_info = factura_info = cliente_info = None
    garantia = {"estado": "NO_VENDIDA", "mensaje": "La unidad está en inventario y todavía no se ha vendido."}

    if unidad.detalle_venta_id:
        detalle = db.session.get(DetalleVenta, unidad.detalle_venta_id)
        venta = detalle.venta
        venta_info = {
            "id": venta.id,
            "numero_venta": venta.numero_venta,
            "fecha_venta": _iso(venta.fecha_venta),
            "canal": venta.canal,
            "precio_unitario": _txt(detalle.precio_unitario),
        }
        if venta.factura:
            factura_info = {"id": venta.factura.id, "numero_factura": venta.factura.numero_factura}
        if venta.cliente:
            cliente_info = {"id": venta.cliente.id, "nombre": venta.cliente.nombre}

        ahora = datetime.now(timezone.utc)
        inicio = _utc(venta.fecha_venta)
        fin = _utc(unidad.fecha_fin_garantia)
        dias_garantia = detalle.dias_garantia
        transcurridos = max(0, (ahora - inicio).days)
        if fin is None:
            garantia = {
                "estado": "SIN_GARANTIA",
                "dias_garantia": dias_garantia,
                "dias_transcurridos": transcurridos,
                "mensaje": "Esta unidad se vendió sin garantía registrada.",
            }
        else:
            vigente = ahora <= fin
            restantes = max(0, math.ceil((fin - ahora).total_seconds() / 86400)) if vigente else 0
            garantia = {
                "estado": "VIGENTE" if vigente else "VENCIDA",
                "dias_garantia": dias_garantia,
                "fecha_inicio": _iso(inicio),
                "fecha_fin": _iso(fin),
                "dias_transcurridos": transcurridos,
                "dias_restantes": restantes,
                "mensaje": (
                    f"Dentro de garantía: {transcurridos} día(s) desde la venta, quedan {restantes}."
                    if vigente
                    else f"Fuera del período de garantía de {dias_garantia} día(s): pasaron {transcurridos}."
                ),
            }

    reclamos = db.session.scalars(
        select(ReclamoGarantia).where(ReclamoGarantia.unidad_serializada_id == unidad.id)
        .order_by(ReclamoGarantia.fecha_apertura.desc())
    ).all()
    return {
        "unidad": {
            "id": unidad.id,
            "numero_serie": unidad.numero_serie,
            "estado": unidad.estado,
            "fecha_registro": _iso(unidad.fecha_registro),
        },
        "producto": {"id": producto.id, "sku": producto.sku, "nombre": producto.nombre},
        "lote": lote,
        "venta": venta_info,
        "factura": factura_info,
        "cliente": cliente_info,
        "garantia": garantia,
        "reclamos": [
            {
                "id": r.id, "motivo": r.motivo, "estado": r.estado, "resolucion": r.resolucion,
                "fecha_apertura": _iso(r.fecha_apertura), "fecha_cierre": _iso(r.fecha_cierre),
            }
            for r in reclamos
        ],
    }


def unidades_disponibles(producto_id):
    return [
        {"id": u.id, "numero_serie": u.numero_serie, "lote_id": u.lote_id}
        for u in db.session.scalars(
            select(UnidadSerializada)
            .where(UnidadSerializada.producto_id == producto_id, UnidadSerializada.estado == "EN_STOCK")
            .order_by(UnidadSerializada.id)
        )
    ]


def registrar_reclamo_por_serie(numero_serie, motivo):
    """Registra el reclamo de garantía localizando la venta por el número de serie."""
    from app.services.reclamo_garantia_service import crear_reclamo_garantia

    with transaccion_unica():
        unidad = _unidad_por_numero(numero_serie)
        if unidad.detalle_venta_id is None:
            raise ConflictoError(
                "Ese número de serie no figura en ninguna venta: no se puede registrar la garantía.",
                codigo="NO_VENDIDA",
            )
        reclamo = crear_reclamo_garantia(unidad.id, motivo or "")
    traza = trazabilidad_por_serie(numero_serie)
    traza["reclamo"] = {"id": reclamo.id, "estado": reclamo.estado, "motivo": reclamo.motivo,
                        "fecha_apertura": _iso(reclamo.fecha_apertura)}
    return traza


def listar_reclamos_detallados():
    filas = db.session.execute(
        select(ReclamoGarantia, UnidadSerializada, Producto.nombre)
        .join(UnidadSerializada, UnidadSerializada.id == ReclamoGarantia.unidad_serializada_id)
        .join(Producto, Producto.id == UnidadSerializada.producto_id)
        .order_by(ReclamoGarantia.fecha_apertura.desc())
    ).all()
    resultado = []
    for reclamo, unidad, producto in filas:
        numero_venta = numero_factura = cliente = None
        dentro_de_plazo = None
        if unidad.detalle_venta_id:
            venta = db.session.get(DetalleVenta, unidad.detalle_venta_id).venta
            numero_venta = venta.numero_venta
            numero_factura = venta.factura.numero_factura if venta.factura else None
            cliente = venta.cliente.nombre if venta.cliente else None
            fin = _utc(unidad.fecha_fin_garantia)
            dentro_de_plazo = bool(fin and _utc(reclamo.fecha_apertura) <= fin)
        resultado.append({
            "id": reclamo.id, "numero_serie": unidad.numero_serie, "producto": producto,
            "numero_venta": numero_venta, "numero_factura": numero_factura, "cliente": cliente,
            "motivo": reclamo.motivo, "estado": reclamo.estado, "resolucion": reclamo.resolucion,
            "fecha_apertura": _iso(reclamo.fecha_apertura), "fecha_cierre": _iso(reclamo.fecha_cierre),
            "dentro_de_plazo": dentro_de_plazo,
        })
    return resultado


# ---------------------------------------------------------------------------
# Ventas y facturación (RF 30 a 35)
# ---------------------------------------------------------------------------
def _resolver_cliente(datos):
    if datos.get("cliente_id") is not None:
        return _entero(datos["cliente_id"], "El cliente")
    cliente = datos.get("cliente")
    if not isinstance(cliente, dict):
        return None
    nombre = (cliente.get("nombre") or "").strip()
    if not nombre or nombre.lower() == "consumidor final":
        return None
    fiscal = (cliente.get("identificacion_fiscal") or "").strip() or None
    if fiscal:
        existente = obtener_cliente_por_identificacion(fiscal)
        if existente:
            return existente.id
    return crear_cliente(
        nombre,
        identificacion_fiscal=fiscal,
        telefono=cliente.get("telefono"),
        email=cliente.get("email"),
        direccion=cliente.get("direccion"),
    ).id


def _verificar_existencias(items):
    """Comprueba (con bloqueo de fila) que alcance el stock; si no, 409 con el producto."""
    pedidas = defaultdict(int)
    for item in items:
        pedidas[item["producto_id"]] += item["cantidad"]
    for producto_id, solicitadas in sorted(pedidas.items()):
        producto = db.session.get(Producto, producto_id)
        if producto is None or not producto.estado:
            raise RecursoNoEncontrado(f"El producto {producto_id} no existe o está inactivo.")
        existencia = db.session.scalar(
            select(Existencia).where(Existencia.producto_id == producto_id).with_for_update()
        )
        disponibles = existencia.cantidad_actual if existencia else 0
        if disponibles < solicitadas:
            raise ExistenciasInsuficientes(producto_id, producto.nombre, disponibles, solicitadas)
        if producto.requiere_numero_serie:
            libres = db.session.scalar(
                select(func.count()).select_from(UnidadSerializada).where(
                    UnidadSerializada.producto_id == producto_id, UnidadSerializada.estado == "EN_STOCK"
                )
            )
            if libres < solicitadas:
                raise ConflictoError(
                    f"No hay suficientes unidades serializadas disponibles de {producto.nombre}. "
                    f"Registradas en stock: {libres}; solicitadas: {solicitadas}.",
                    codigo="SERIES_NO_DISPONIBLES", producto_id=producto_id, producto=producto.nombre,
                    disponibles=libres, solicitadas=solicitadas,
                )


def _series_elegidas(items):
    """Traduce los números de serie elegidos a ids de unidad y valida que estén en stock."""
    elegidas = defaultdict(list)
    for item in items:
        numeros = item.get("numeros_serie") or []
        if not numeros:
            continue
        if len(numeros) > item["cantidad"]:
            raise ErrorNegocio("Se indicaron más números de serie que unidades en la línea.")
        for numero in numeros:
            unidad = _unidad_por_numero(numero)
            if unidad.producto_id != item["producto_id"]:
                raise ErrorNegocio(f"El número de serie {unidad.numero_serie} no corresponde al producto indicado.")
            if unidad.estado != "EN_STOCK" or unidad.detalle_venta_id is not None:
                raise ConflictoError(
                    f"La unidad {unidad.numero_serie} ya no está disponible.", codigo="SERIES_NO_DISPONIBLES"
                )
            if unidad.id in elegidas[item["producto_id"]]:
                raise ErrorNegocio(f"El número de serie {unidad.numero_serie} está repetido en la venta.")
            elegidas[item["producto_id"]].append(unidad.id)
    return dict(elegidas)


def _normalizar_items_venta(datos):
    items = []
    for crudo in _lista(datos.get("items"), "items"):
        crudo = _objeto(crudo)
        item = {
            "producto_id": _entero(crudo.get("producto_id"), "El producto"),
            "cantidad": _entero(crudo.get("cantidad"), "La cantidad"),
            "descuento": crudo.get("descuento", 0),
            "tasa_impuesto": crudo.get("tasa_impuesto", 0),
            "numeros_serie": crudo.get("numeros_serie") or [],
        }
        items.append(item)
    return items


def registrar_venta_completa(usuario_id, datos):
    """Venta atómica: crea la venta, agrega los detalles, descuenta existencias, asigna
    números de serie, inicia la garantía y emite la factura en una sola transacción."""
    from flask import current_app

    datos = _objeto(datos)
    items = _normalizar_items_venta(datos)
    emisor = datos.get("emisor")
    if not isinstance(emisor, dict) or not emisor:
        emisor = dict(current_app.config["EMISOR_FACTURA"])

    with transaccion_unica():
        _verificar_existencias(items)
        g.series_preferidas = _series_elegidas(items)
        try:
            cliente_id = _resolver_cliente(datos)
            venta = crear_venta(
                usuario_id=usuario_id,
                metodo_pago=datos.get("metodo_pago"),
                cliente_id=cliente_id,
                canal=datos.get("canal", "PISO"),
            )
            for item in items:
                agregar_detalle_venta(
                    venta.id, item["producto_id"], item["cantidad"],
                    descuento=item["descuento"], tasa_impuesto=item["tasa_impuesto"],
                )
            confirmar_venta(venta.id)
            emitir_factura(venta.id, emisor)
            for producto_id in {i["producto_id"] for i in items}:
                generar_alerta_stock(usuario_id, producto_id)  # alerta automática de stock bajo/agotado
        finally:
            g.series_preferidas = {}
        venta_id = venta.id
    return construir_comprobante(venta_id)


def construir_comprobante(venta_id):
    venta = db.session.get(Venta, venta_id)
    if venta is None:
        raise RecursoNoEncontrado("La venta no existe.")
    factura = venta.factura
    items, ids = [], []
    for detalle in sorted(venta.detalles, key=lambda d: d.id):
        unidades = listar_unidades_por_detalle_venta(detalle.id)
        ids.append(detalle.producto_id)
        items.append({
            "detalle_id": detalle.id,
            "producto_id": detalle.producto_id,
            "sku": detalle.sku_snapshot,
            "nombre": detalle.producto_nombre_snapshot,
            "cantidad": detalle.cantidad,
            "precio_unitario": _txt(detalle.precio_unitario),
            "descuento": _txt(detalle.descuento),
            "subtotal": _txt(detalle.subtotal),
            "total_linea": _txt(detalle.total_linea),
            "dias_garantia": detalle.dias_garantia,
            "numeros_serie": [u.numero_serie for u in unidades],
            "fecha_fin_garantia": _iso(unidades[0].fecha_fin_garantia) if unidades else None,
        })
    existencias = []
    for existencia in db.session.scalars(select(Existencia).where(Existencia.producto_id.in_(ids))):
        producto = db.session.get(Producto, existencia.producto_id)
        existencias.append({
            "producto_id": existencia.producto_id,
            "nombre": producto.nombre,
            "cantidad_actual": existencia.cantidad_actual,
            "umbral_minimo": existencia.umbral_minimo,
            "alerta": _estado_alerta(existencia.cantidad_actual, existencia.umbral_minimo),
        })
    return {
        "venta": {
            "id": venta.id,
            "numero_venta": venta.numero_venta,
            "fecha_venta": _iso(venta.fecha_venta),
            "canal": venta.canal,
            "metodo_pago": venta.metodo_pago,
            "estado": venta.estado,
            "subtotal": _txt(venta.subtotal),
            "descuento_total": _txt(venta.descuento_total),
            "impuesto_total": _txt(venta.impuesto_total),
            "total": _txt(venta.total),
        },
        "factura": {
            "id": factura.id,
            "numero_factura": factura.numero_factura,
            "fecha_emision": _iso(factura.fecha_emision),
            "estado": factura.estado,
            "total_final": _txt(factura.total_final),
        } if factura else None,
        "emisor": factura.datos_emisor_snapshot if factura else None,
        "cliente": {"id": venta.cliente.id, "nombre": venta.cliente.nombre,
                    "identificacion_fiscal": venta.cliente.identificacion_fiscal} if venta.cliente else None,
        "vendedor": {"id": venta.usuario.id, "username": venta.usuario.username},
        "items": items,
        "existencias": existencias,
    }


def listar_ventas_detalladas(desde=None, hasta=None, canal=None, estado="COMPLETADA"):
    """Ventas con sus líneas, costo aplicado, devoluciones y series (para historial y reportes)."""
    consulta = select(Venta).order_by(Venta.fecha_venta.desc())
    if estado:
        consulta = consulta.where(Venta.estado == estado)
    if canal:
        consulta = consulta.where(Venta.canal == canal.upper())
    if desde:
        consulta = consulta.where(Venta.fecha_venta >= desde)
    if hasta:
        consulta = consulta.where(Venta.fecha_venta <= hasta)
    ventas = db.session.scalars(consulta).all()

    ids_detalle = [d.id for v in ventas for d in v.detalles]
    costo_de, devuelto_de = {}, {}
    series_de = defaultdict(list)
    series_devueltas = defaultdict(list)
    if ids_detalle:
        costo_de = {
            detalle_id: costo
            for detalle_id, costo in db.session.execute(
                select(MovimientoInventario.detalle_venta_id, MovimientoInventario.costo_unitario_aplicado)
                .where(MovimientoInventario.detalle_venta_id.in_(ids_detalle),
                       MovimientoInventario.tipo_movimiento == "SALIDA")
            )
        }
        devuelto_de = dict(
            db.session.execute(
                select(DetalleDevolucion.detalle_venta_id, func.sum(DetalleDevolucion.cantidad))
                .join(Devolucion, Devolucion.id == DetalleDevolucion.devolucion_id)
                .where(Devolucion.estado == "COMPLETADA", DetalleDevolucion.detalle_venta_id.in_(ids_detalle))
                .group_by(DetalleDevolucion.detalle_venta_id)
            ).all()
        )
        for unidad in db.session.scalars(
            select(UnidadSerializada).where(UnidadSerializada.detalle_venta_id.in_(ids_detalle))
        ):
            series_de[unidad.detalle_venta_id].append(unidad.numero_serie)
        # Una unidad devuelta y reintegrada queda libre (sin detalle de venta); su rastro
        # permanece en la devolución.
        for detalle_id, numero in db.session.execute(
            select(DetalleDevolucion.detalle_venta_id, UnidadSerializada.numero_serie)
            .join(UnidadSerializada, UnidadSerializada.id == DetalleDevolucion.unidad_serializada_id)
            .join(Devolucion, Devolucion.id == DetalleDevolucion.devolucion_id)
            .where(Devolucion.estado == "COMPLETADA", DetalleDevolucion.detalle_venta_id.in_(ids_detalle))
        ):
            series_devueltas[detalle_id].append(numero)

    categorias = dict(
        db.session.execute(
            select(Producto.id, Categoria.nombre).join(Categoria, Categoria.id == Producto.categoria_id)
        ).all()
    )
    resultado = []
    for venta in ventas:
        resultado.append({
            "id": venta.id,
            "numero_venta": venta.numero_venta,
            "numero_factura": venta.factura.numero_factura if venta.factura else None,
            "fecha_venta": _iso(venta.fecha_venta),
            "canal": venta.canal,
            "metodo_pago": venta.metodo_pago,
            "estado": venta.estado,
            "cliente": venta.cliente.nombre if venta.cliente else None,
            "vendedor": venta.usuario.username,
            "total": _txt(venta.total),
            "items": [
                {
                    "detalle_id": d.id,
                    "producto_id": d.producto_id,
                    "sku": d.sku_snapshot,
                    "nombre": d.producto_nombre_snapshot,
                    "categoria": categorias.get(d.producto_id, "Sin categoría"),
                    "cantidad": d.cantidad,
                    "precio_unitario": _txt(d.precio_unitario),
                    "total_linea": _txt(d.total_linea),
                    "costo_unitario": _txt(costo_de.get(d.id)),
                    "cantidad_devuelta": int(devuelto_de.get(d.id, 0)),
                    "numeros_serie": sorted(series_de.get(d.id, [])),
                    "numeros_serie_devueltos": sorted(series_devueltas.get(d.id, [])),
                    "dias_garantia": d.dias_garantia,
                }
                for d in sorted(venta.detalles, key=lambda x: x.id)
            ],
        })
    return resultado


# ---------------------------------------------------------------------------
# Compras y recepción con costo proporcional del envío (RF 12 a 25)
# ---------------------------------------------------------------------------
def calcular_costo_proporcional(datos):
    """Vista previa del costo unitario total: C = C_adq + E / n (n = unidades de la recepción)."""
    datos = _objeto(datos)
    envio = costos.a_decimal(datos.get("costo_envio", 0), "El costo de envío")
    if envio < 0:
        raise ErrorNegocio("El costo de envío no puede ser negativo.")
    lineas = _lista(datos.get("lineas"), "lineas")
    total_unidades = sum(_entero(linea.get("cantidad"), "La cantidad", 0) for linea in lineas)
    if total_unidades <= 0:
        raise ErrorNegocio("Debe haber al menos una unidad para repartir el envío.")
    resultado = []
    for linea in lineas:
        cantidad = _entero(linea.get("cantidad"), "La cantidad", 0)
        total, envio_unitario = costos.costo_total_unitario(linea.get("costo_unitario"), envio, total_unidades)
        resultado.append({
            "id": linea.get("id"),
            "cantidad": cantidad,
            "costo_unitario": _txt(costos.en_centavos(costos.a_decimal(linea.get("costo_unitario"), "El costo"))),
            "costo_envio_unitario": _txt(envio_unitario),
            "costo_unitario_total": _txt(total),
            "subtotal_con_envio": _txt(costos.en_centavos(total * cantidad)),
        })
    return {"unidades_totales": total_unidades, "costo_envio": _txt(envio), "lineas": resultado}


def crear_compra_completa(usuario_id, datos):
    datos = _objeto(datos)
    items = _lista(datos.get("items"), "items")
    with transaccion_unica():
        compra = crear_compra(
            proveedor_id=_entero(datos.get("proveedor_id"), "El proveedor"),
            usuario_id=usuario_id,
            numero_referencia=datos.get("numero_referencia"),
            observaciones=datos.get("observaciones"),
        )
        for item in items:
            agregar_detalle_compra(
                compra.id,
                _entero(item.get("producto_id"), "El producto"),
                _entero(item.get("cantidad"), "La cantidad"),
                item.get("costo_unitario"),
                descuento=item.get("descuento", 0),
                observaciones=item.get("observaciones"),
            )
        cambiar_estado_compra(compra.id, "ENVIADA")
        compra_id = compra.id
    return [c for c in listar_compras_detalladas() if c["id"] == compra_id][0]


def registrar_recepcion_completa(usuario_id, datos):
    """Recepción atómica: compara lo solicitado contra lo recibido, registra rechazos y
    faltantes, crea el lote con el costo proporcional del envío, suma al inventario solo
    lo aceptado y registra los números de serie de las cámaras."""
    datos = _objeto(datos)
    compra_id = _entero(datos.get("compra_id"), "La compra")
    items = {}
    for crudo in _lista(datos.get("items"), "items"):
        crudo = _objeto(crudo)
        items[_entero(crudo.get("detalle_compra_id"), "El detalle de compra")] = crudo

    with transaccion_unica():
        recepcion = crear_recepcion(
            compra_id, usuario_id,
            costo_envio=datos.get("costo_envio", 0),
            observaciones=datos.get("observaciones"),
        )
        for detalle in sorted(recepcion.detalles, key=lambda d: d.id):
            crudo = items.get(detalle.detalle_compra_id, {})
            recibida = _entero(crudo.get("cantidad_recibida", 0), "La cantidad recibida", 0)
            rechazada = _entero(crudo.get("cantidad_rechazada", 0), "La cantidad rechazada", 0)
            registrar_revision(
                detalle.id,
                cantidad_recibida=recibida,
                cantidad_aceptada=recibida - rechazada,
                cantidad_rechazada=rechazada,
                motivo_rechazo=crudo.get("motivo_rechazo"),
                observaciones=crudo.get("observaciones"),
            )
        desconocidos = set(items) - {d.detalle_compra_id for d in recepcion.detalles}
        if desconocidos:
            raise ErrorNegocio("Hay líneas que no pertenecen a la compra indicada.")

        finalizar_recepcion(recepcion.id, usuario_id)

        for detalle in recepcion.detalles:
            aceptada = detalle.cantidad_aceptada
            producto = db.session.get(Producto, detalle.detalle_compra.producto_id)
            numeros = [str(n).strip() for n in (items.get(detalle.detalle_compra_id, {}).get("numeros_serie") or []) if str(n).strip()]
            if aceptada <= 0:
                continue
            if producto.requiere_numero_serie:
                if len(numeros) != aceptada:
                    raise ErrorNegocio(
                        f"{producto.nombre} requiere número de serie: se aceptaron {aceptada} unidad(es) "
                        f"y se registraron {len(numeros)}."
                    )
                lote = listar_lotes_por_detalle_recepcion(detalle.id)[0]
                registrar_series(producto.id, numeros, lote.id)
            elif numeros:
                raise ErrorNegocio(f"El producto {producto.nombre} no requiere número de serie.")
        recepcion_id = recepcion.id

    recepcion = db.session.get(RecepcionMercaderia, recepcion_id)
    lineas = []
    for detalle in sorted(recepcion.detalles, key=lambda d: d.id):
        lotes = listar_lotes_por_detalle_recepcion(detalle.id)
        lote = lotes[0] if lotes else None
        solicitada = detalle.detalle_compra.cantidad_solicitada
        recibida_total = db.session.scalar(
            select(func.coalesce(func.sum(DetalleRecepcion.cantidad_recibida), 0))
            .join(RecepcionMercaderia, RecepcionMercaderia.id == DetalleRecepcion.recepcion_id)
            .where(DetalleRecepcion.detalle_compra_id == detalle.detalle_compra_id,
                   RecepcionMercaderia.estado == "RECIBIDA")
        )
        lineas.append({
            "detalle_compra_id": detalle.detalle_compra_id,
            "producto_id": detalle.detalle_compra.producto_id,
            "producto": detalle.detalle_compra.producto.nombre,
            "cantidad_solicitada": solicitada,
            "cantidad_recibida": detalle.cantidad_recibida,
            "cantidad_aceptada": detalle.cantidad_aceptada,
            "cantidad_rechazada": detalle.cantidad_rechazada,
            "faltante_acumulado": max(0, solicitada - int(recibida_total)),
            "resultado": detalle.resultado_revision,
            "motivo_rechazo": detalle.motivo_rechazo,
            "lote": {
                "id": lote.id,
                "cantidad_inicial": lote.cantidad_inicial,
                "costo_unitario_adquisicion": _txt(lote.costo_unitario_adquisicion),
                "costo_envio_unitario": _txt(lote.costo_envio_unitario),
                "costo_unitario_total": _txt(lote.costo_unitario_total),
            } if lote else None,
        })
    compra = db.session.get(Compra, compra_id)
    return {
        "recepcion": {
            "id": recepcion.id, "estado": recepcion.estado, "costo_envio": _txt(recepcion.costo_envio),
            "fecha_recepcion": _iso(recepcion.fecha_recepcion), "observaciones": recepcion.observaciones,
        },
        "compra": {"id": compra.id, "estado": compra.estado},
        "lineas": lineas,
    }


def listar_compras_detalladas():
    compras = db.session.scalars(select(Compra).order_by(Compra.fecha_pedido.desc())).all()
    if not compras:
        return []
    ids_detalle = [d.id for c in compras for d in c.detalles]
    acumulado = {}
    if ids_detalle:
        acumulado = {
            fila.detalle_compra_id: fila
            for fila in db.session.execute(
                select(
                    DetalleRecepcion.detalle_compra_id,
                    func.coalesce(func.sum(DetalleRecepcion.cantidad_recibida), 0).label("recibida"),
                    func.coalesce(func.sum(DetalleRecepcion.cantidad_aceptada), 0).label("aceptada"),
                    func.coalesce(func.sum(DetalleRecepcion.cantidad_rechazada), 0).label("rechazada"),
                )
                .join(RecepcionMercaderia, RecepcionMercaderia.id == DetalleRecepcion.recepcion_id)
                .where(RecepcionMercaderia.estado == "RECIBIDA", DetalleRecepcion.detalle_compra_id.in_(ids_detalle))
                .group_by(DetalleRecepcion.detalle_compra_id)
            )
        }
    resultado = []
    for compra in compras:
        lineas = []
        for detalle in sorted(compra.detalles, key=lambda d: d.id):
            fila = acumulado.get(detalle.id)
            recibida = int(fila.recibida) if fila else 0
            lotes = db.session.scalars(
                select(Lote).join(DetalleRecepcion, DetalleRecepcion.id == Lote.detalle_recepcion_id)
                .where(DetalleRecepcion.detalle_compra_id == detalle.id).order_by(Lote.id)
            ).all()
            lineas.append({
                "id": detalle.id,
                "producto_id": detalle.producto_id,
                "producto": detalle.producto.nombre,
                "requiere_numero_serie": detalle.producto.requiere_numero_serie,
                "cantidad_solicitada": detalle.cantidad_solicitada,
                "cantidad_recibida": recibida,
                "cantidad_aceptada": int(fila.aceptada) if fila else 0,
                "cantidad_rechazada": int(fila.rechazada) if fila else 0,
                "faltante": max(0, detalle.cantidad_solicitada - recibida),
                "costo_unitario": _txt(detalle.costo_unitario),
                "subtotal": _txt(detalle.subtotal),
                "lotes": [{"id": l.id, "costo_unitario_total": _txt(l.costo_unitario_total),
                           "costo_envio_unitario": _txt(l.costo_envio_unitario),
                           "cantidad_inicial": l.cantidad_inicial} for l in lotes],
            })
        recepciones = [
            {"id": r.id, "estado": r.estado, "fecha_recepcion": _iso(r.fecha_recepcion),
             "costo_envio": _txt(r.costo_envio), "observaciones": r.observaciones}
            for r in sorted(compra.recepciones, key=lambda x: x.id)
        ]
        resultado.append({
            "id": compra.id,
            "proveedor_id": compra.proveedor_id,
            "proveedor": compra.proveedor.nombre,
            "numero_referencia": compra.numero_referencia,
            "fecha_pedido": _iso(compra.fecha_pedido),
            "estado": compra.estado,
            "total": _txt(compra.total),
            "observaciones": compra.observaciones,
            "items": lineas,
            "recepciones": recepciones,
        })
    return resultado


# ---------------------------------------------------------------------------
# Devoluciones (RF 54, 55)
# ---------------------------------------------------------------------------
def registrar_devolucion_completa(usuario_id, datos):
    """Registra, inspecciona, aprueba y finaliza la devolución; reintegra al inventario lo
    que vuelve en buen estado. Todo en una transacción."""
    datos = _objeto(datos)
    items = _lista(datos.get("items"), "items")
    with transaccion_unica():
        devolucion = crear_devolucion(
            _entero(datos.get("venta_id"), "La venta"), usuario_id, datos.get("motivo") or "", datos.get("observaciones")
        )
        for crudo in items:
            crudo = _objeto(crudo)
            detalle_venta = db.session.get(DetalleVenta, _entero(crudo.get("detalle_venta_id"), "El detalle de venta"))
            if detalle_venta is None:
                raise RecursoNoEncontrado("El detalle de venta indicado no existe.")
            cantidad = _entero(crudo.get("cantidad"), "La cantidad")
            estado_producto = (crudo.get("estado_producto") or "BUEN_ESTADO").upper()
            reintegra = crudo.get("se_reintegra_inventario", estado_producto == "BUEN_ESTADO")
            producto = db.session.get(Producto, detalle_venta.producto_id)

            if producto.requiere_numero_serie:
                numeros = crudo.get("numeros_serie") or []
                if len(numeros) != cantidad:
                    raise ErrorNegocio(f"Indique el número de serie de cada unidad devuelta de {producto.nombre}.")
                partes = [(_unidad_por_numero(n).id, 1) for n in numeros]
            else:
                partes = [(None, cantidad)]

            for unidad_id, cant in partes:
                detalle = agregar_detalle_devolucion(
                    devolucion.id, detalle_venta.id, cant, unidad_id, crudo.get("observaciones")
                )
                inspeccionar_detalle_devolucion(detalle.id, estado_producto, bool(reintegra), crudo.get("observaciones"))
        cambiar_estado_devolucion(devolucion.id, "APROBADA")
        finalizar_devolucion(devolucion.id, usuario_id)
        devolucion_id = devolucion.id
    return [d for d in listar_devoluciones_detalladas() if d["id"] == devolucion_id][0]


def listar_devoluciones_detalladas():
    devoluciones = db.session.scalars(select(Devolucion).order_by(Devolucion.fecha_devolucion.desc())).all()
    resultado = []
    for devolucion in devoluciones:
        items = []
        for d in sorted(devolucion.detalles, key=lambda x: x.id):
            venta_det = d.detalle_venta
            items.append({
                "id": d.id,
                "detalle_venta_id": d.detalle_venta_id,
                "producto_id": venta_det.producto_id,
                "producto": venta_det.producto_nombre_snapshot,
                "cantidad": d.cantidad,
                "precio_unitario": _txt(venta_det.precio_unitario),
                "estado_producto": d.estado_producto,
                "se_reintegra_inventario": d.se_reintegra_inventario,
                "numero_serie": d.unidad_serializada.numero_serie if d.unidad_serializada else None,
            })
        resultado.append({
            "id": devolucion.id,
            "venta_id": devolucion.venta_id,
            "numero_venta": devolucion.venta.numero_venta,
            "numero_factura": devolucion.venta.factura.numero_factura if devolucion.venta.factura else None,
            "fecha_devolucion": _iso(devolucion.fecha_devolucion),
            "motivo": devolucion.motivo,
            "estado": devolucion.estado,
            "usuario": devolucion.usuario.username,
            "items": items,
        })
    return resultado


# ---------------------------------------------------------------------------
# Movimientos de inventario y listado de series (consultas enriquecidas)
# ---------------------------------------------------------------------------
def listar_movimientos_detallados(limite=1000):
    filas = db.session.execute(
        select(MovimientoInventario, Producto.nombre, Usuario.username)
        .join(Producto, Producto.id == MovimientoInventario.producto_id)
        .join(Usuario, Usuario.id == MovimientoInventario.usuario_id)
        .order_by(MovimientoInventario.fecha_movimiento.desc(), MovimientoInventario.id.desc())
        .limit(limite)
    ).all()
    return [
        {
            "id": m.id,
            "producto_id": m.producto_id,
            "producto": nombre,
            "tipo_movimiento": m.tipo_movimiento,
            "cantidad": m.cantidad,
            "motivo": m.motivo,
            "fecha_movimiento": _iso(m.fecha_movimiento),
            "usuario": username,
            "origen": (
                "RECEPCION" if m.detalle_recepcion_id else
                "VENTA" if m.detalle_venta_id else
                "DEVOLUCION" if m.detalle_devolucion_id else None
            ),
            "costo_unitario_aplicado": _txt(m.costo_unitario_aplicado),
        }
        for m, nombre, username in filas
    ]


def listar_unidades_detalladas():
    filas = db.session.execute(
        select(UnidadSerializada, Venta.id, Venta.numero_venta, Venta.fecha_venta)
        .outerjoin(DetalleVenta, DetalleVenta.id == UnidadSerializada.detalle_venta_id)
        .outerjoin(Venta, Venta.id == DetalleVenta.venta_id)
        .order_by(UnidadSerializada.id)
    ).all()
    return [
        {
            "id": u.id,
            "numero_serie": u.numero_serie,
            "producto_id": u.producto_id,
            "estado": u.estado,
            "lote_id": u.lote_id,
            "fecha_registro": _iso(u.fecha_registro),
            "venta_id": venta_id,
            "numero_venta": numero_venta,
            "fecha_venta": _iso(fecha_venta),
        }
        for u, venta_id, numero_venta, fecha_venta in filas
    ]


# ---------------------------------------------------------------------------
# Usuarios
# ---------------------------------------------------------------------------
def restablecer_contrasena(usuario_id, nueva_contrasena):
    from werkzeug.security import generate_password_hash

    usuario = db.session.get(Usuario, usuario_id)
    if usuario is None:
        raise RecursoNoEncontrado("El usuario no existe.")
    if not isinstance(nueva_contrasena, str) or len(nueva_contrasena) < 8:
        raise ErrorNegocio("La nueva contraseña debe tener al menos 8 caracteres.")
    usuario.password_hash = generate_password_hash(nueva_contrasena)
    db.session.commit()
    return usuario
