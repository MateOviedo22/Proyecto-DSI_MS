from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.recepcion_service import (
    crear_recepcion,
    obtener_recepcion,
    listar_recepciones,
    listar_recepciones_por_compra,
    actualizar_observaciones_recepcion,
)


recepcion_bp = Blueprint(
    "recepcion",
    __name__,
    url_prefix="/api/recepciones"
)


def obtener_usuario_id_token():
    identidad = get_jwt_identity()

    try:
        return int(identidad)
    except (TypeError, ValueError):
        raise ValueError("La identidad del token no contiene un ID de usuario válido.")


def serializar_recepcion(recepcion):
    return {
        "id": recepcion.id,
        "compra_id": recepcion.compra_id,
        "usuario_id": recepcion.usuario_id,
        "fecha_recepcion": (
            recepcion.fecha_recepcion.isoformat()
            if recepcion.fecha_recepcion else None
        ),
        "costo_envio": str(recepcion.costo_envio),
        "estado": recepcion.estado,
        "observaciones": recepcion.observaciones,
    }


@recepcion_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    compra_id = datos.get("compra_id")

    if isinstance(compra_id, bool) or not isinstance(compra_id, int):
        return jsonify({"error": "compra_id debe ser un número entero."}), 400

    try:
        usuario_id = obtener_usuario_id_token()

        recepcion = crear_recepcion(
            compra_id=compra_id,
            usuario_id=usuario_id,
            costo_envio=datos.get("costo_envio", 0),
            observaciones=datos.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Recepción registrada correctamente.",
            "recepcion": serializar_recepcion(recepcion),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@recepcion_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    recepciones = listar_recepciones()

    return jsonify({
        "recepciones": [serializar_recepcion(r) for r in recepciones]
    }), 200


@recepcion_bp.route("/<int:recepcion_id>", methods=["GET"])
@jwt_required()
def obtener(recepcion_id):
    recepcion = obtener_recepcion(recepcion_id)

    if not recepcion:
        return jsonify({"error": "La recepción no existe."}), 404

    return jsonify({"recepcion": serializar_recepcion(recepcion)}), 200


@recepcion_bp.route("/compra/<int:compra_id>", methods=["GET"])
@jwt_required()
def listar_por_compra(compra_id):
    try:
        recepciones = listar_recepciones_por_compra(compra_id)

        return jsonify({
            "recepciones": [serializar_recepcion(r) for r in recepciones]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@recepcion_bp.route("/<int:recepcion_id>/observaciones", methods=["PATCH"])
@jwt_required()
def modificar_observaciones(recepcion_id):
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
        recepcion = actualizar_observaciones_recepcion(
            recepcion_id,
            observaciones
        )

        return jsonify({
            "mensaje": "Observaciones actualizadas correctamente.",
            "recepcion": serializar_recepcion(recepcion),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400