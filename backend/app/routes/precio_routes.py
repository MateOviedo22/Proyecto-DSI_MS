
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.precio_service import (
    registrar_precio,
    modificar_precio,
    consultar_historial_precios,
    consultar_precio_actual,
)

precio_bp = Blueprint("precio", __name__, url_prefix="/api/precios")


def obtener_usuario_id_token():
    """Obtiene el ID del usuario autenticado desde el JWT."""
    identidad = get_jwt_identity()

    try:
        return int(identidad)
    except (TypeError, ValueError):
        raise ValueError("La identidad del token no contiene un ID de usuario válido.")


def serializar_precio(precio):
    return {
        "id": precio.id,
        "producto_id": precio.producto_id,
        "precio_venta": str(precio.precio_venta),
        "vigente_desde": (
            precio.vigente_desde.isoformat()
            if precio.vigente_desde else None
        ),
        "vigente_hasta": (
            precio.vigente_hasta.isoformat()
            if precio.vigente_hasta else None
        ),
        "usuario_id": precio.usuario_id,
        "motivo": precio.motivo,
    }


# REGISTRAR PRECIO INICIAL
@precio_bp.route("/producto/<int:producto_id>", methods=["POST"])
@jwt_required()
def registrar(producto_id):
    datos = request.get_json(silent=True) or {}

    if "precio_venta" not in datos:
        return jsonify({"error": "El precio de venta es obligatorio."}), 400

    motivo = datos.get("motivo")

    if motivo is not None and not isinstance(motivo, str):
        return jsonify({"error": "El motivo debe ser un texto."}), 400

    try:
        usuario_id = obtener_usuario_id_token()

        precio = registrar_precio(
            producto_id=producto_id,
            precio_venta=datos["precio_venta"],
            usuario_id=usuario_id,
            motivo=motivo,
        )

        return jsonify({
            "mensaje": "Precio registrado correctamente.",
            "precio": serializar_precio(precio),
        }), 201

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo


# MODIFICAR PRECIO VIGENTE
@precio_bp.route("/producto/<int:producto_id>", methods=["PATCH"])
@jwt_required()
def modificar(producto_id):
    datos = request.get_json(silent=True) or {}

    if "nuevo_precio" not in datos:
        return jsonify({"error": "El nuevo precio es obligatorio."}), 400

    motivo = datos.get("motivo")

    if motivo is not None and not isinstance(motivo, str):
        return jsonify({"error": "El motivo debe ser un texto."}), 400

    try:
        usuario_id = obtener_usuario_id_token()

        precio = modificar_precio(
            producto_id=producto_id,
            nuevo_precio=datos["nuevo_precio"],
            usuario_id=usuario_id,
            motivo=motivo,
        )

        return jsonify({
            "mensaje": "Precio actualizado correctamente.",
            "precio": serializar_precio(precio),
        }), 200

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo


# CONSULTAR PRECIO ACTUAL
@precio_bp.route("/producto/<int:producto_id>/actual", methods=["GET"])
@jwt_required()
def consultar_actual(producto_id):
    try:
        precio = consultar_precio_actual(producto_id)

        if precio is None:
            return jsonify({
                "mensaje": "El producto no tiene un precio vigente.",
                "precio": None,
            }), 200

        return jsonify(serializar_precio(precio)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# CONSULTAR HISTORIAL DE PRECIOS
@precio_bp.route("/producto/<int:producto_id>/historial", methods=["GET"])
@jwt_required()
def consultar_historial(producto_id):
    try:
        precios = consultar_historial_precios(producto_id)

        return jsonify([
            serializar_precio(precio) for precio in precios
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404
