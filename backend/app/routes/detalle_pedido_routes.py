
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.detalle_pedido_service import (
    agregar_detalle_pedido,
    listar_detalles_pedido,
    obtener_detalle_pedido,
    obtener_detalle_por_producto,
    actualizar_detalle_pedido,
    eliminar_detalle_pedido,
)


detalle_pedido_bp = Blueprint(
    "detalle_pedido",
    __name__,
    url_prefix="/api/detalles-pedido"
)


def serializar_detalle(detalle):
    return {
        "id": detalle.id,
        "pedido_id": detalle.pedido_id,
        "producto_id": detalle.producto_id,
        "cantidad": detalle.cantidad,
        "precio_unitario_acordado": (
            str(detalle.precio_unitario_acordado)
            if detalle.precio_unitario_acordado is not None
            else None
        ),
        "observaciones": detalle.observaciones,
    }


@detalle_pedido_bp.route("/", methods=["POST"])
@jwt_required()
def agregar():
    datos = request.get_json(silent=True) or {}

    try:
        detalle = agregar_detalle_pedido(
            pedido_id=datos.get("pedido_id"),
            producto_id=datos.get("producto_id"),
            cantidad=datos.get("cantidad"),
            precio_unitario_acordado=datos.get(
                "precio_unitario_acordado"
            ),
            observaciones=datos.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Producto agregado al pedido correctamente.",
            "detalle": serializar_detalle(detalle),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@detalle_pedido_bp.route(
    "/pedido/<int:pedido_id>",
    methods=["GET"]
)
@jwt_required()
def listar_por_pedido(pedido_id):
    try:
        detalles = listar_detalles_pedido(pedido_id)

        return jsonify({
            "detalles": [
                serializar_detalle(detalle)
                for detalle in detalles
            ]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@detalle_pedido_bp.route(
    "/<int:detalle_id>",
    methods=["GET"]
)
@jwt_required()
def obtener(detalle_id):
    try:
        detalle = obtener_detalle_pedido(detalle_id)

        return jsonify({
            "detalle": serializar_detalle(detalle)
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@detalle_pedido_bp.route(
    "/pedido/<int:pedido_id>/producto/<int:producto_id>",
    methods=["GET"]
)
@jwt_required()
def obtener_por_producto(pedido_id, producto_id):
    detalle = obtener_detalle_por_producto(
        pedido_id,
        producto_id
    )

    if detalle is None:
        return jsonify({
            "error": "El producto no está registrado en este pedido."
        }), 404

    return jsonify({
        "detalle": serializar_detalle(detalle)
    }), 200


@detalle_pedido_bp.route(
    "/<int:detalle_id>",
    methods=["PATCH"]
)
@jwt_required()
def actualizar(detalle_id):
    datos = request.get_json(silent=True) or {}

    try:
        detalle = actualizar_detalle_pedido(
            detalle_id=detalle_id,
            cantidad=datos.get("cantidad"),
            precio_unitario_acordado=datos.get(
                "precio_unitario_acordado"
            ),
            observaciones=datos.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Detalle del pedido actualizado correctamente.",
            "detalle": serializar_detalle(detalle),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@detalle_pedido_bp.route(
    "/<int:detalle_id>",
    methods=["DELETE"]
)
@jwt_required()
def eliminar(detalle_id):
    try:
        eliminar_detalle_pedido(detalle_id)

        return jsonify({
            "mensaje": "Producto eliminado del pedido correctamente."
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
