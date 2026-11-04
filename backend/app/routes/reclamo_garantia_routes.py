
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.reclamo_garantia_service import (
    crear_reclamo_garantia,
    obtener_reclamo_garantia,
    listar_reclamos_garantia,
    listar_reclamos_por_unidad,
    listar_reclamos_por_estado,
    actualizar_resolucion,
    cambiar_estado_reclamo,
)


reclamo_garantia_bp = Blueprint(
    "reclamos_garantia",
    __name__,
    url_prefix="/api/reclamos-garantia"
)


def serializar_reclamo(reclamo):
    return {
        "id": reclamo.id,
        "unidad_serializada_id": reclamo.unidad_serializada_id,
        "fecha_apertura": (
            reclamo.fecha_apertura.isoformat()
            if reclamo.fecha_apertura else None
        ),
        "motivo": reclamo.motivo,
        "estado": reclamo.estado,
        "resolucion": reclamo.resolucion,
        "fecha_cierre": (
            reclamo.fecha_cierre.isoformat()
            if reclamo.fecha_cierre else None
        ),
    }


@reclamo_garantia_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    data = request.get_json(silent=True) or {}

    try:
        reclamo = crear_reclamo_garantia(
            unidad_serializada_id=data.get(
                "unidad_serializada_id"
            ),
            motivo=data.get("motivo"),
        )

        return jsonify({
            "mensaje": "Reclamo de garantía registrado correctamente.",
            "reclamo": serializar_reclamo(reclamo),
        }), 201

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400


@reclamo_garantia_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    try:
        reclamos = listar_reclamos_garantia()

        return jsonify([
            serializar_reclamo(reclamo)
            for reclamo in reclamos
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@reclamo_garantia_bp.route(
    "/unidad/<int:unidad_serializada_id>",
    methods=["GET"]
)
@jwt_required()
def listar_por_unidad(unidad_serializada_id):
    try:
        reclamos = listar_reclamos_por_unidad(
            unidad_serializada_id
        )

        return jsonify([
            serializar_reclamo(reclamo)
            for reclamo in reclamos
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@reclamo_garantia_bp.route(
    "/estado/<string:estado>",
    methods=["GET"]
)
@jwt_required()
def listar_por_estado(estado):
    try:
        reclamos = listar_reclamos_por_estado(
            estado.strip().upper()
        )

        return jsonify([
            serializar_reclamo(reclamo)
            for reclamo in reclamos
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@reclamo_garantia_bp.route(
    "/<int:reclamo_id>",
    methods=["GET"]
)
@jwt_required()
def obtener(reclamo_id):
    try:
        reclamo = obtener_reclamo_garantia(reclamo_id)

        if not reclamo:
            return jsonify({
                "error": "El reclamo de garantía no existe."
            }), 404

        return jsonify(serializar_reclamo(reclamo)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@reclamo_garantia_bp.route(
    "/<int:reclamo_id>/resolucion",
    methods=["PATCH"]
)
@jwt_required()
def registrar_resolucion(reclamo_id):
    data = request.get_json(silent=True) or {}

    try:
        reclamo = actualizar_resolucion(
            reclamo_id=reclamo_id,
            resolucion=data.get("resolucion"),
        )

        return jsonify({
            "mensaje": "Resolución registrada correctamente.",
            "reclamo": serializar_reclamo(reclamo),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@reclamo_garantia_bp.route(
    "/<int:reclamo_id>/estado",
    methods=["PATCH"]
)
@jwt_required()
def cambiar_estado(reclamo_id):
    data = request.get_json(silent=True) or {}

    try:
        reclamo = cambiar_estado_reclamo(
            reclamo_id=reclamo_id,
            nuevo_estado=data.get("estado", "").strip().upper(),
        )

        return jsonify({
            "mensaje": "Estado del reclamo actualizado correctamente.",
            "reclamo": serializar_reclamo(reclamo),
        }), 200

    except (ValueError, AttributeError) as e:
        return jsonify({"error": str(e)}), 400
