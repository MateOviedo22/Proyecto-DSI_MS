from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.compra_service import (
    crear_compra,
    listar_compras,
    obtener_compra,
    listar_compras_por_proveedor,
    cambiar_estado_compra,
    actualizar_observaciones,
)


compra_bp = Blueprint("compra", __name__, url_prefix="/api/compras")


def obtener_usuario_id_token():
    identidad = get_jwt_identity()

    try:
        return int(identidad)
    except (TypeError, ValueError):
        raise ValueError("La identidad del token no contiene un ID de usuario válido.")


def serializar_compra(compra):
    return {
        "id": compra.id,
        "proveedor_id": compra.proveedor_id,
        "usuario_id": compra.usuario_id,
        "numero_referencia": compra.numero_referencia,
        "fecha_pedido": (
            compra.fecha_pedido.isoformat()
            if compra.fecha_pedido else None
        ),
        "estado": compra.estado,
        "subtotal": str(compra.subtotal),
        "total": str(compra.total),
        "observaciones": compra.observaciones,
    }


@compra_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    proveedor_id = datos.get("proveedor_id")

    if isinstance(proveedor_id, bool) or not isinstance(proveedor_id, int):
        return jsonify({"error": "proveedor_id debe ser un número entero."}), 400

    try:
        usuario_id = obtener_usuario_id_token()

        compra = crear_compra(
            proveedor_id=proveedor_id,
            usuario_id=usuario_id,
            numero_referencia=datos.get("numero_referencia"),
            observaciones=datos.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Compra creada correctamente.",
            "compra": serializar_compra(compra),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@compra_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    try:
        compras = listar_compras()

        return jsonify({
            "compras": [serializar_compra(c) for c in compras]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@compra_bp.route("/<int:compra_id>", methods=["GET"])
@jwt_required()
def obtener(compra_id):
    compra = obtener_compra(compra_id)

    if not compra:
        return jsonify({"error": "La compra no existe."}), 404

    return jsonify({"compra": serializar_compra(compra)}), 200


@compra_bp.route("/proveedor/<int:proveedor_id>", methods=["GET"])
@jwt_required()
def listar_por_proveedor(proveedor_id):
    try:
        compras = listar_compras_por_proveedor(proveedor_id)

        return jsonify({
            "compras": [serializar_compra(c) for c in compras]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@compra_bp.route("/<int:compra_id>/estado", methods=["PATCH"])
@jwt_required()
def cambiar_estado(compra_id):
    datos = request.get_json(silent=True) or {}
    nuevo_estado = datos.get("nuevo_estado")

    if not isinstance(nuevo_estado, str) or not nuevo_estado.strip():
        return jsonify({
            "error": "Debe proporcionar un nuevo_estado válido."
        }), 400

    try:
        compra = cambiar_estado_compra(compra_id, nuevo_estado)

        return jsonify({
            "mensaje": "Estado de la compra actualizado correctamente.",
            "compra": serializar_compra(compra),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@compra_bp.route("/<int:compra_id>/observaciones", methods=["PATCH"])
@jwt_required()
def modificar_observaciones(compra_id):
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict) or "observaciones" not in datos:
        return jsonify({
            "error": "Debe proporcionar el campo observaciones."
        }), 400

    observaciones = datos["observaciones"]

    if observaciones is not None and not isinstance(observaciones, str):
        return jsonify({
            "error": "observaciones debe ser texto o null."
        }), 400

    try:
        compra = actualizar_observaciones(compra_id, observaciones)

        return jsonify({
            "mensaje": "Observaciones actualizadas correctamente.",
            "compra": serializar_compra(compra),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400