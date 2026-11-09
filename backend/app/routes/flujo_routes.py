"""Endpoints compuestos del flujo de negocio (ver services/flujo_service.py).

Códigos de estado que devuelve cada operación de escritura:

    201 Created      el recurso se creó (venta, recepción, devolución, producto...)
    200 OK           consulta o actualización
    400 Bad Request  datos inválidos
    401 / 403        sin sesión / rol sin permiso (lo resuelve security.py)
    404 Not Found    producto, venta, serie... inexistente
    409 Conflict     existencias insuficientes, número de serie duplicado,
                     garantía vencida, unidad ya vendida...
"""

from datetime import date, datetime, time, timezone
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.errors import ConflictoError, ErrorNegocio, responder_error
from app.extensions import db
from app.models.personas import Rol, Usuario
from app.services import costos
from app.services import flujo_service as flujo

flujo_bp = Blueprint("flujo", __name__)


def manejar(funcion):
    """Convierte los errores de negocio en la respuesta HTTP semántica correspondiente."""

    @wraps(funcion)
    def envoltura(*args, **kwargs):
        try:
            return funcion(*args, **kwargs)
        except IntegrityError:
            db.session.rollback()
            return responder_error(ConflictoError("El registro viola una restricción de unicidad.", codigo="DUPLICADO"))
        except ValueError as error:
            return responder_error(error)

    return envoltura


def _usuario_id():
    return int(get_jwt_identity())


def _json():
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict):
        raise ErrorNegocio("Se requiere un objeto JSON válido.")
    return datos


def _fecha(valor, fin_de_dia=False):
    if not valor:
        return None
    try:
        if len(valor) == 10:
            base = date.fromisoformat(valor)
            return datetime.combine(base, time.max if fin_de_dia else time.min, tzinfo=timezone.utc)
        parsed = datetime.fromisoformat(valor)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        raise ErrorNegocio("Las fechas deben tener el formato AAAA-MM-DD.")


# ----------------------------- Catálogo y precios -----------------------------
@flujo_bp.get("/api/productos/catalogo")
@manejar
def catalogo():
    return jsonify(flujo.construir_catalogo()), 200


@flujo_bp.post("/api/productos/completo")
@manejar
def producto_completo():
    return jsonify({"mensaje": "Producto registrado correctamente.",
                    "producto": flujo.crear_producto_completo(_usuario_id(), _json())}), 201


@flujo_bp.patch("/api/productos/<int:producto_id>/completo")
@manejar
def producto_editar(producto_id):
    return jsonify({"mensaje": "Producto actualizado correctamente.",
                    "producto": flujo.editar_producto_completo(_usuario_id(), producto_id, _json())}), 200


@flujo_bp.post("/api/precios/actualizar-masivo")
@manejar
def precios_masivo():
    resultado = flujo.actualizar_precios_masivo(_usuario_id(), _json())
    resultado["mensaje"] = "Precios actualizados." if resultado["aplicado"] else "Vista previa de precios."
    return jsonify(resultado), 200


@flujo_bp.post("/api/precios/calcular")
@manejar
def precios_calcular():
    """C = C_adq + E/n  y  P = redondeo[C x (1 + m)] calculados en el servidor."""
    datos = _json()
    total, envio_unitario = costos.costo_total_unitario(
        datos.get("costo_adquisicion", 0), datos.get("costo_envio_total", 0), datos.get("unidades", 1)
    )
    respuesta = {
        "costo_adquisicion": str(costos.en_centavos(costos.a_decimal(datos.get("costo_adquisicion", 0)))),
        "costo_envio_unitario": str(envio_unitario),
        "costo_unitario_total": str(total),
    }
    if datos.get("margen") not in (None, ""):
        precio = costos.precio_con_margen(total, datos["margen"], datos.get("redondeo", 0))
        respuesta["precio_sugerido"] = str(precio)
        respuesta["margen"] = str(datos["margen"])
    return jsonify(respuesta), 200


# ----------------------------- Compras y recepción -----------------------------
@flujo_bp.post("/api/compras/costo-proporcional")
@manejar
def compras_costo_proporcional():
    return jsonify(flujo.calcular_costo_proporcional(_json())), 200


@flujo_bp.post("/api/compras/completa")
@manejar
def compra_completa():
    return jsonify({"mensaje": "Orden de compra registrada.",
                    "compra": flujo.crear_compra_completa(_usuario_id(), _json())}), 201


@flujo_bp.get("/api/compras/detalladas")
@manejar
def compras_detalladas():
    return jsonify(flujo.listar_compras_detalladas()), 200


@flujo_bp.post("/api/recepciones/completa")
@manejar
def recepcion_completa():
    resultado = flujo.registrar_recepcion_completa(_usuario_id(), _json())
    resultado["mensaje"] = "Recepción registrada y existencias actualizadas."
    return jsonify(resultado), 201


# ----------------------------- Series y garantías -----------------------------
@flujo_bp.post("/api/unidades-serializadas/registro")
@manejar
def series_registro():
    datos = _json()
    from app.services.transaccion import transaccion_unica

    with transaccion_unica():
        unidades = flujo.registrar_series(datos.get("producto_id"), datos.get("numeros_serie"), datos.get("lote_id"))
        resultado = [{"id": u.id, "numero_serie": u.numero_serie, "estado": u.estado} for u in unidades]
    return jsonify({"mensaje": f"{len(resultado)} número(s) de serie registrado(s).", "unidades": resultado}), 201


@flujo_bp.get("/api/unidades-serializadas/buscar")
@manejar
def series_buscar():
    return jsonify(flujo.trazabilidad_por_serie(request.args.get("numero_serie"))), 200


@flujo_bp.get("/api/unidades-serializadas/disponibles")
@manejar
def series_disponibles():
    try:
        producto_id = int(request.args.get("producto_id", ""))
    except ValueError:
        raise ErrorNegocio("Debe indicar producto_id.")
    return jsonify(flujo.unidades_disponibles(producto_id)), 200


@flujo_bp.post("/api/reclamos-garantia/por-serie")
@manejar
def reclamo_por_serie():
    datos = _json()
    traza = flujo.registrar_reclamo_por_serie(datos.get("numero_serie"), datos.get("motivo"))
    traza["mensaje"] = "Reclamo de garantía registrado."
    return jsonify(traza), 201


@flujo_bp.get("/api/reclamos-garantia/detallados")
@manejar
def reclamos_detallados():
    return jsonify(flujo.listar_reclamos_detallados()), 200


# ----------------------------- Ventas y facturación -----------------------------
@flujo_bp.post("/api/ventas/completa")
@manejar
def venta_completa():
    comprobante = flujo.registrar_venta_completa(_usuario_id(), _json())
    comprobante["mensaje"] = "Venta registrada correctamente."
    return jsonify(comprobante), 201


@flujo_bp.get("/api/ventas/detalladas")
@manejar
def ventas_detalladas():
    return jsonify(flujo.listar_ventas_detalladas(
        desde=_fecha(request.args.get("desde")),
        hasta=_fecha(request.args.get("hasta"), fin_de_dia=True),
        canal=request.args.get("canal"),
        estado=request.args.get("estado", "COMPLETADA") or None,
    )), 200


@flujo_bp.get("/api/ventas/<int:venta_id>/comprobante")
@manejar
def venta_comprobante(venta_id):
    return jsonify(flujo.construir_comprobante(venta_id)), 200


# ----------------------------- Movimientos y series -----------------------------
@flujo_bp.get("/api/movimientos-inventario/detallados")
@manejar
def movimientos_detallados():
    return jsonify(flujo.listar_movimientos_detallados()), 200


@flujo_bp.get("/api/unidades-serializadas/listado")
@manejar
def series_listado():
    return jsonify(flujo.listar_unidades_detalladas()), 200


# ----------------------------- Devoluciones -----------------------------
@flujo_bp.post("/api/devoluciones/completa")
@manejar
def devolucion_completa():
    return jsonify({"mensaje": "Devolución registrada y existencias actualizadas.",
                    "devolucion": flujo.registrar_devolucion_completa(_usuario_id(), _json())}), 201


@flujo_bp.get("/api/devoluciones/detalladas")
@manejar
def devoluciones_detalladas():
    return jsonify(flujo.listar_devoluciones_detalladas()), 200


# ----------------------------- Usuarios -----------------------------
@flujo_bp.get("/api/usuarios/detallados")
@manejar
def usuarios_detallados():
    filas = db.session.execute(
        select(Usuario, Rol.nombre).join(Rol, Rol.id == Usuario.rol_id).order_by(Usuario.username)
    ).all()
    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "rol_id": u.rol_id,
            "rol": rol,
            "estado": u.estado,
            "nombre_completo": u.empleado.persona.nombre_completo if u.empleado and u.empleado.persona else u.username,
            "ultimo_login": u.ultimo_login.isoformat() if u.ultimo_login else None,
        }
        for u, rol in filas
    ]), 200


@flujo_bp.patch("/api/usuarios/<int:usuario_id>/restablecer-contrasena")
@manejar
def usuario_restablecer(usuario_id):
    flujo.restablecer_contrasena(usuario_id, _json().get("nueva_contrasena"))
    return jsonify({"mensaje": "Contraseña restablecida correctamente."}), 200
