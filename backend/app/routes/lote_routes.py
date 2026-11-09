from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.lote_service import (
    obtener_lote,
    listar_lotes,
    listar_lotes_por_detalle_recepcion,
    finalizar_recepcion,
)


lote_bp = Blueprint("lote", __name__, url_prefix="/api/lotes")


def serializar_lote(lote):
    return {
        "id": lote.id,
        "detalle_recepcion_id": lote.detalle_recepcion_id,
        "cantidad_inicial": lote.cantidad_inicial,
        "costo_unitario_adquisicion": str(
            lote.costo_unitario_adquisicion
        ),
        "costo_envio_unitario": str(lote.costo_envio_unitario),
        "costo_unitario_total": str(lote.costo_unitario_total),
        "fecha_recepcion": (
            lote.fecha_recepcion.isoformat()
            if lote.fecha_recepcion else None
        ),
    }


@lote_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    lotes = listar_lotes()

    return jsonify({
        "lotes": [serializar_lote(lote) for lote in lotes]
    }), 200


@lote_bp.route("/<int:lote_id>", methods=["GET"])
@jwt_required()
def obtener(lote_id):
    lote = obtener_lote(lote_id)

    if not lote:
        return jsonify({"error": "El lote no existe."}), 404

    return jsonify({"lote": serializar_lote(lote)}), 200


@lote_bp.route(
    "/detalle-recepcion/<int:detalle_recepcion_id>",
    methods=["GET"]
)
@jwt_required()
def listar_por_detalle_recepcion(detalle_recepcion_id):
    lotes = listar_lotes_por_detalle_recepcion(
        detalle_recepcion_id
    )

    return jsonify({
        "lotes": [serializar_lote(lote) for lote in lotes]
    }), 200


@lote_bp.route(
    "/finalizar-recepcion/<int:recepcion_id>",
    methods=["POST"]
)
@jwt_required()
def finalizar(recepcion_id):
    try:
        usuario_id = int(get_jwt_identity())

        recepcion = finalizar_recepcion(
            recepcion_id=recepcion_id,
            usuario_id=usuario_id
        )

        return jsonify({
            "mensaje": "La recepción fue finalizada correctamente.",
            "recepcion_id": recepcion.id,
            "estado": recepcion.estado,
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400