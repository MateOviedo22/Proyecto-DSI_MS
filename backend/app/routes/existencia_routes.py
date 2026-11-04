from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.existencia_service import (
    obtener_existencia,
    crear_existencia,
    listar_existencias,
    consultar_stock,
    actualizar_niveles_stock,
    listar_stock_bajo,
    listar_stock_agotado,
)


existencia_bp = Blueprint(
    "existencia",
    __name__,
    url_prefix="/api/existencias"
)


def serializar_existencia(existencia):
    return {
        "producto_id": existencia.producto_id,
        "cantidad_actual": existencia.cantidad_actual,
        "umbral_minimo": existencia.umbral_minimo,
        "stock_respaldo": existencia.stock_respaldo,
    }


@existencia_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    producto_id = datos.get("producto_id")
    umbral_minimo = datos.get("umbral_minimo", 0)
    stock_respaldo = datos.get("stock_respaldo", 0)

    if isinstance(producto_id, bool) or not isinstance(producto_id, int):
        return jsonify({"error": "producto_id debe ser un número entero."}), 400

    try:
        existencia = crear_existencia(
            producto_id=producto_id,
            umbral_minimo=umbral_minimo,
            stock_respaldo=stock_respaldo,
        )

        return jsonify({
            "mensaje": "Registro de existencia creado correctamente.",
            "existencia": serializar_existencia(existencia),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@existencia_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    existencias = listar_existencias()

    return jsonify({
        "existencias": [
            serializar_existencia(e) for e in existencias
        ]
    }), 200


@existencia_bp.route("/<int:producto_id>", methods=["GET"])
@jwt_required()
def obtener(producto_id):
    existencia = obtener_existencia(producto_id)

    if not existencia:
        return jsonify({
            "error": "El producto no tiene un registro de existencia."
        }), 404

    return jsonify({"existencia": serializar_existencia(existencia)}), 200


@existencia_bp.route("/<int:producto_id>/stock", methods=["GET"])
@jwt_required()
def consultar(producto_id):
    try:
        cantidad = consultar_stock(producto_id)

        return jsonify({
            "producto_id": producto_id,
            "cantidad_actual": cantidad,
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@existencia_bp.route("/<int:producto_id>/niveles", methods=["PATCH"])
@jwt_required()
def actualizar_niveles(producto_id):
    datos = request.get_json(silent=True) or {}

    if "umbral_minimo" not in datos or "stock_respaldo" not in datos:
        return jsonify({
            "error": "Debe proporcionar umbral_minimo y stock_respaldo."
        }), 400

    try:
        existencia = actualizar_niveles_stock(
            producto_id=producto_id,
            umbral_minimo=datos["umbral_minimo"],
            stock_respaldo=datos["stock_respaldo"],
        )

        return jsonify({
            "mensaje": "Niveles de stock actualizados correctamente.",
            "existencia": serializar_existencia(existencia),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@existencia_bp.route("/stock-bajo", methods=["GET"])
@jwt_required()
def stock_bajo():
    existencias = listar_stock_bajo()

    return jsonify({
        "existencias": [
            serializar_existencia(e) for e in existencias
        ]
    }), 200


@existencia_bp.route("/stock-agotado", methods=["GET"])
@jwt_required()
def stock_agotado():
    existencias = listar_stock_agotado()

    return jsonify({
        "existencias": [
            serializar_existencia(e) for e in existencias
        ]
    }), 200