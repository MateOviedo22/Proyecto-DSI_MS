
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.detalle_devolucion_service import (
    agregar_detalle_devolucion,
    obtener_detalle_devolucion,
    listar_detalles_devolucion,
    inspeccionar_detalle_devolucion,
)


detalle_devolucion_bp = Blueprint(
    "detalles_devolucion",
    __name__,
    url_prefix="/api/detalles-devolucion"
)


def serializar_detalle(detalle):
    return {
        "id": detalle.id,
        "devolucion_id": detalle.devolucion_id,
        "detalle_venta_id": detalle.detalle_venta_id,
        "unidad_serializada_id": detalle.unidad_serializada_id,
        "cantidad": detalle.cantidad,
        "estado_producto": detalle.estado_producto,
        "se_reintegra_inventario": detalle.se_reintegra_inventario,
        "observaciones": detalle.observaciones,
    }


@detalle_devolucion_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    data = request.get_json(silent=True) or {}

    try:
        detalle = agregar_detalle_devolucion(
            devolucion_id=data.get("devolucion_id"),
            detalle_venta_id=data.get("detalle_venta_id"),
            cantidad=data.get("cantidad"),
            unidad_serializada_id=data.get("unidad_serializada_id"),
            observaciones=data.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Producto agregado a la devolución correctamente.",
            "detalle": serializar_detalle(detalle),
        }), 201

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400


@detalle_devolucion_bp.route(
    "/devolucion/<int:devolucion_id>",
    methods=["GET"]
)
@jwt_required()
def listar_por_devolucion(devolucion_id):
    try:
        detalles = listar_detalles_devolucion(devolucion_id)

        return jsonify([
            serializar_detalle(detalle)
            for detalle in detalles
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@detalle_devolucion_bp.route(
    "/<int:detalle_devolucion_id>",
    methods=["GET"]
)
@jwt_required()
def obtener(detalle_devolucion_id):
    try:
        detalle = obtener_detalle_devolucion(
            detalle_devolucion_id
        )

        if not detalle:
            return jsonify({
                "error": "El detalle de devolución no existe."
            }), 404

        return jsonify(serializar_detalle(detalle)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@detalle_devolucion_bp.route(
    "/<int:detalle_devolucion_id>/inspeccionar",
    methods=["PATCH"]
)
@jwt_required()
def inspeccionar(detalle_devolucion_id):
    data = request.get_json(silent=True) or {}

    try:
        detalle = inspeccionar_detalle_devolucion(
            detalle_devolucion_id=detalle_devolucion_id,
            estado_producto=data.get("estado_producto"),
            se_reintegra_inventario=data.get(
                "se_reintegra_inventario"
            ),
            observaciones=data.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Inspección registrada correctamente.",
            "detalle": serializar_detalle(detalle),
        }), 200

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400
