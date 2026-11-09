
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.producto_proveedor_service import (
    obtener_asociacion,
    crear_asociacion,
    listar_asociaciones,
    listar_proveedores_por_producto,
    listar_productos_por_proveedor,
    buscar_asociacion,
    actualizar_asociacion,
    establecer_proveedor_principal,
    desactivar_asociacion,
    activar_asociacion,
)

producto_proveedor_bp = Blueprint(
    "producto_proveedor",
    __name__,
    url_prefix="/api/producto-proveedores"
)


def serializar_asociacion(asociacion):
    return {
        "id": asociacion.id,
        "producto_id": asociacion.producto_id,
        "proveedor_id": asociacion.proveedor_id,
        "codigo_producto_proveedor": asociacion.codigo_producto_proveedor,
        "es_principal": asociacion.es_principal,
        "observaciones": asociacion.observaciones,
        "estado": asociacion.estado,
    }


# CREAR ASOCIACIÓN
@producto_proveedor_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    producto_id = datos.get("producto_id")
    proveedor_id = datos.get("proveedor_id")
    es_principal = datos.get("es_principal", False)

    for campo, valor in (
        ("producto_id", producto_id),
        ("proveedor_id", proveedor_id),
    ):
        if isinstance(valor, bool) or not isinstance(valor, int):
            return jsonify({
                "error": f"El campo {campo} debe ser un entero válido."
            }), 400

    if not isinstance(es_principal, bool):
        return jsonify({
            "error": "es_principal debe ser verdadero o falso."
        }), 400

    for campo in ("codigo_producto_proveedor", "observaciones"):
        if datos.get(campo) is not None and not isinstance(datos[campo], str):
            return jsonify({
                "error": f"El campo {campo} debe ser un texto."
            }), 400

    try:
        asociacion = crear_asociacion(
            producto_id=producto_id,
            proveedor_id=proveedor_id,
            codigo_producto_proveedor=datos.get("codigo_producto_proveedor"),
            es_principal=es_principal,
            observaciones=datos.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Asociación creada correctamente.",
            "asociacion": serializar_asociacion(asociacion),
        }), 201

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo


# LISTAR TODAS LAS ASOCIACIONES
@producto_proveedor_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    asociaciones = listar_asociaciones()

    return jsonify([
        serializar_asociacion(asociacion)
        for asociacion in asociaciones
    ]), 200


# OBTENER ASOCIACIÓN POR ID
@producto_proveedor_bp.route("/<int:asociacion_id>", methods=["GET"])
@jwt_required()
def obtener(asociacion_id):
    asociacion = obtener_asociacion(asociacion_id)

    if asociacion is None:
        return jsonify({"error": "La asociación no existe."}), 404

    return jsonify(serializar_asociacion(asociacion)), 200


# LISTAR PROVEEDORES DE UN PRODUCTO
@producto_proveedor_bp.route("/producto/<int:producto_id>", methods=["GET"])
@jwt_required()
def listar_por_producto(producto_id):
    try:
        asociaciones = listar_proveedores_por_producto(producto_id)

        return jsonify([
            serializar_asociacion(asociacion)
            for asociacion in asociaciones
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# LISTAR PRODUCTOS DE UN PROVEEDOR
@producto_proveedor_bp.route("/proveedor/<int:proveedor_id>", methods=["GET"])
@jwt_required()
def listar_por_proveedor(proveedor_id):
    try:
        asociaciones = listar_productos_por_proveedor(proveedor_id)

        return jsonify([
            serializar_asociacion(asociacion)
            for asociacion in asociaciones
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# BUSCAR ASOCIACIÓN POR PRODUCTO Y PROVEEDOR
@producto_proveedor_bp.route(
    "/buscar/<int:producto_id>/<int:proveedor_id>",
    methods=["GET"]
)
@jwt_required()
def buscar(producto_id, proveedor_id):
    asociacion = buscar_asociacion(producto_id, proveedor_id)

    if asociacion is None:
        return jsonify({"error": "La asociación no existe."}), 404

    return jsonify(serializar_asociacion(asociacion)), 200


# ACTUALIZAR ASOCIACIÓN
@producto_proveedor_bp.route("/<int:asociacion_id>", methods=["PATCH"])
@jwt_required()
def actualizar(asociacion_id):
    datos = request.get_json(silent=True) or {}

    campos_permitidos = {
        "codigo_producto_proveedor",
        "observaciones",
    }

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({
            "error": "Se recibieron campos no permitidos."
        }), 400

    for campo in campos_permitidos:
        if campo in datos and datos[campo] is not None:
            if not isinstance(datos[campo], str):
                return jsonify({
                    "error": f"El campo {campo} debe ser un texto."
                }), 400

    try:
        asociacion = actualizar_asociacion(
            asociacion_id=asociacion_id,
            codigo_producto_proveedor=datos.get("codigo_producto_proveedor"),
            observaciones=datos.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Asociación actualizada correctamente.",
            "asociacion": serializar_asociacion(asociacion),
        }), 200

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo


# ESTABLECER PROVEEDOR PRINCIPAL
@producto_proveedor_bp.route(
    "/<int:asociacion_id>/principal",
    methods=["PATCH"]
)
@jwt_required()
def establecer_principal(asociacion_id):
    try:
        asociacion = establecer_proveedor_principal(asociacion_id)

        return jsonify({
            "mensaje": "Proveedor principal establecido correctamente.",
            "asociacion": serializar_asociacion(asociacion),
        }), 200

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo


# DESACTIVAR ASOCIACIÓN
@producto_proveedor_bp.route(
    "/<int:asociacion_id>/desactivar",
    methods=["PATCH"]
)
@jwt_required()
def desactivar(asociacion_id):
    try:
        asociacion = desactivar_asociacion(asociacion_id)

        return jsonify({
            "mensaje": "Asociación desactivada correctamente.",
            "asociacion": serializar_asociacion(asociacion),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ACTIVAR ASOCIACIÓN
@producto_proveedor_bp.route(
    "/<int:asociacion_id>/activar",
    methods=["PATCH"]
)
@jwt_required()
def activar(asociacion_id):
    try:
        asociacion = activar_asociacion(asociacion_id)

        return jsonify({
            "mensaje": "Asociación activada correctamente.",
            "asociacion": serializar_asociacion(asociacion),
        }), 200

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo
