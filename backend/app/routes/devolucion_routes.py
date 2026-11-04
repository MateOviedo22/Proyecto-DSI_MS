
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.devolucion_service import (
    crear_devolucion,
    obtener_devolucion,
    listar_devoluciones,
    listar_devoluciones_por_venta,
    listar_devoluciones_por_estado,
    actualizar_observaciones,
    cambiar_estado_devolucion,
)

from app.services.detalle_devolucion_service import (
    finalizar_devolucion,
)


devolucion_bp = Blueprint(
    "devoluciones",
    __name__,
    url_prefix="/api/devoluciones"
)


def serializar_devolucion(devolucion):
    return {
        "id": devolucion.id,
        "venta_id": devolucion.venta_id,
        "usuario_id": devolucion.usuario_id,
        "fecha_devolucion": (
            devolucion.fecha_devolucion.isoformat()
            if devolucion.fecha_devolucion else None
        ),
        "motivo": devolucion.motivo,
        "estado": devolucion.estado,
        "observaciones": devolucion.observaciones,
    }


@devolucion_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    data = request.get_json(silent=True) or {}

    try:
        usuario_id = int(get_jwt_identity())

        devolucion = crear_devolucion(
            venta_id=data.get("venta_id"),
            usuario_id=usuario_id,
            motivo=data.get("motivo"),
            observaciones=data.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Devolución registrada correctamente.",
            "devolucion": serializar_devolucion(devolucion),
        }), 201

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400


@devolucion_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    try:
        devoluciones = listar_devoluciones()

        return jsonify([
            serializar_devolucion(devolucion)
            for devolucion in devoluciones
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@devolucion_bp.route("/venta/<int:venta_id>", methods=["GET"])
@jwt_required()
def listar_por_venta(venta_id):
    try:
        devoluciones = listar_devoluciones_por_venta(venta_id)

        return jsonify([
            serializar_devolucion(devolucion)
            for devolucion in devoluciones
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@devolucion_bp.route("/estado/<string:estado>", methods=["GET"])
@jwt_required()
def listar_por_estado(estado):
    try:
        devoluciones = listar_devoluciones_por_estado(
            estado.strip().upper()
        )

        return jsonify([
            serializar_devolucion(devolucion)
            for devolucion in devoluciones
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@devolucion_bp.route("/<int:devolucion_id>", methods=["GET"])
@jwt_required()
def obtener(devolucion_id):
    try:
        devolucion = obtener_devolucion(devolucion_id)

        if not devolucion:
            return jsonify({
                "error": "La devolución no existe."
            }), 404

        return jsonify(serializar_devolucion(devolucion)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@devolucion_bp.route(
    "/<int:devolucion_id>/observaciones",
    methods=["PATCH"]
)
@jwt_required()
def modificar_observaciones(devolucion_id):
    data = request.get_json(silent=True) or {}

    try:
        devolucion = actualizar_observaciones(
            devolucion_id=devolucion_id,
            observaciones=data.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Observaciones actualizadas correctamente.",
            "devolucion": serializar_devolucion(devolucion),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@devolucion_bp.route(
    "/<int:devolucion_id>/estado",
    methods=["PATCH"]
)
@jwt_required()
def cambiar_estado(devolucion_id):
    data = request.get_json(silent=True) or {}

    try:
        devolucion = cambiar_estado_devolucion(
            devolucion_id=devolucion_id,
            nuevo_estado=data.get("estado", "").strip().upper(),
        )

        return jsonify({
            "mensaje": "Estado de devolución actualizado correctamente.",
            "devolucion": serializar_devolucion(devolucion),
        }), 200

    except (ValueError, AttributeError) as e:
        return jsonify({"error": str(e)}), 400


@devolucion_bp.route(
    "/<int:devolucion_id>/finalizar",
    methods=["PATCH"]
)
@jwt_required()
def finalizar(devolucion_id):
    try:
        usuario_id = int(get_jwt_identity())

        devolucion = finalizar_devolucion(
            devolucion_id=devolucion_id,
            usuario_id=usuario_id,
        )

        return jsonify({
            "mensaje": "Devolución finalizada correctamente.",
            "devolucion": serializar_devolucion(devolucion),
        }), 200

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400
