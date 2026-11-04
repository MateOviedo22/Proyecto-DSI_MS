from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.detalle_compra_service import (
    agregar_detalle_compra,
    listar_detalles_compra,
    obtener_detalle_compra,
    eliminar_detalle_compra,
)


detalle_compra_bp = Blueprint(
    "detalle_compra",
    __name__,
    url_prefix="/api/detalles-compra"
)


def serializar_detalle(detalle):
    return {
        "id": detalle.id,
        "compra_id": detalle.compra_id,
        "producto_id": detalle.producto_id,
        "cantidad_solicitada": detalle.cantidad_solicitada,
        "costo_unitario": str(detalle.costo_unitario),
        "descuento": str(detalle.descuento),
        "subtotal": str(detalle.subtotal),
        "observaciones": detalle.observaciones,
    }


@detalle_compra_bp.route("/", methods=["POST"])
@jwt_required()
def agregar():
    datos = request.get_json(silent=True) or {}

    compra_id = datos.get("compra_id")
    producto_id = datos.get("producto_id")
    cantidad = datos.get("cantidad_solicitada")
    costo_unitario = datos.get("costo_unitario")

    if isinstance(compra_id, bool) or not isinstance(compra_id, int):
        return jsonify({"error": "compra_id debe ser un número entero."}), 400

    if isinstance(producto_id, bool) or not isinstance(producto_id, int):
        return jsonify({"error": "producto_id debe ser un número entero."}), 400

    if isinstance(cantidad, bool) or not isinstance(cantidad, int):
        return jsonify({
            "error": "cantidad_solicitada debe ser un número entero."
        }), 400

    if costo_unitario is None:
        return jsonify({"error": "Debe proporcionar costo_unitario."}), 400

    try:
        detalle = agregar_detalle_compra(
            compra_id=compra_id,
            producto_id=producto_id,
            cantidad_solicitada=cantidad,
            costo_unitario=costo_unitario,
            descuento=datos.get("descuento", 0),
            observaciones=datos.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Detalle agregado correctamente a la compra.",
            "detalle": serializar_detalle(detalle),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@detalle_compra_bp.route("/compra/<int:compra_id>", methods=["GET"])
@jwt_required()
def listar_por_compra(compra_id):
    try:
        detalles = listar_detalles_compra(compra_id)

        return jsonify({
            "detalles": [serializar_detalle(d) for d in detalles]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@detalle_compra_bp.route("/<int:detalle_id>", methods=["GET"])
@jwt_required()
def obtener(detalle_id):
    detalle = obtener_detalle_compra(detalle_id)

    if not detalle:
        return jsonify({"error": "El detalle de compra no existe."}), 404

    return jsonify({"detalle": serializar_detalle(detalle)}), 200


@detalle_compra_bp.route("/<int:detalle_id>", methods=["DELETE"])
@jwt_required()
def eliminar(detalle_id):
    try:
        eliminado = eliminar_detalle_compra(detalle_id)

        if eliminado:
            return jsonify({
                "mensaje": "Detalle de compra eliminado correctamente."
            }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400