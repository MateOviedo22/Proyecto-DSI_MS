
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.pedido_service import (
    crear_pedido,
    obtener_pedido,
    listar_pedidos,
    listar_pedidos_por_cliente,
    listar_pedidos_por_estado,
    cambiar_estado_pedido,
    actualizar_datos_entrega,
    cancelar_pedido,
)


pedido_bp = Blueprint(
    "pedido",
    __name__,
    url_prefix="/api/pedidos"
)


def serializar_pedido(pedido):
    return {
        "id": pedido.id,
        "cliente_id": pedido.cliente_id,
        "usuario_id": pedido.usuario_id,
        "canal": pedido.canal,
        "estado": pedido.estado,
        "fecha_creacion": (
            pedido.fecha_creacion.isoformat()
            if pedido.fecha_creacion else None
        ),
        "direccion_entrega": pedido.direccion_entrega,
        "costo_delivery": str(pedido.costo_delivery),
        "observaciones": pedido.observaciones,
    }


@pedido_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    try:
        usuario_id = int(get_jwt_identity())

        pedido = crear_pedido(
            cliente_id=datos.get("cliente_id"),
            usuario_id=usuario_id,
            canal=datos.get("canal", "ONLINE"),
            direccion_entrega=datos.get("direccion_entrega"),
            costo_delivery=datos.get("costo_delivery", 0),
            observaciones=datos.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Pedido registrado correctamente.",
            "pedido": serializar_pedido(pedido),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@pedido_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    cliente_id = request.args.get("cliente_id", type=int)
    estado = request.args.get("estado")

    try:
        if cliente_id is not None:
            pedidos = listar_pedidos_por_cliente(cliente_id)

            if estado:
                pedidos = [
                    pedido for pedido in pedidos
                    if pedido.estado == estado.strip().upper()
                ]

        elif estado:
            pedidos = listar_pedidos_por_estado(estado)

        else:
            pedidos = listar_pedidos()

        return jsonify({
            "pedidos": [
                serializar_pedido(pedido)
                for pedido in pedidos
            ]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@pedido_bp.route("/<int:pedido_id>", methods=["GET"])
@jwt_required()
def obtener(pedido_id):
    try:
        pedido = obtener_pedido(pedido_id)

        return jsonify({
            "pedido": serializar_pedido(pedido)
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@pedido_bp.route("/<int:pedido_id>/estado", methods=["PATCH"])
@jwt_required()
def cambiar_estado(pedido_id):
    datos = request.get_json(silent=True) or {}

    try:
        pedido = cambiar_estado_pedido(
            pedido_id=pedido_id,
            nuevo_estado=datos.get("nuevo_estado"),
        )

        return jsonify({
            "mensaje": "Estado del pedido actualizado correctamente.",
            "pedido": serializar_pedido(pedido),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@pedido_bp.route(
    "/<int:pedido_id>/entrega",
    methods=["PATCH"]
)
@jwt_required()
def actualizar_entrega(pedido_id):
    datos = request.get_json(silent=True) or {}

    try:
        pedido = actualizar_datos_entrega(
            pedido_id=pedido_id,
            direccion_entrega=datos.get("direccion_entrega"),
            costo_delivery=datos.get("costo_delivery"),
            observaciones=datos.get("observaciones"),
        )

        return jsonify({
            "mensaje": "Datos de entrega actualizados correctamente.",
            "pedido": serializar_pedido(pedido),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@pedido_bp.route(
    "/<int:pedido_id>/cancelar",
    methods=["PATCH"]
)
@jwt_required()
def cancelar(pedido_id):
    try:
        pedido = cancelar_pedido(pedido_id)

        return jsonify({
            "mensaje": "Pedido cancelado correctamente.",
            "pedido": serializar_pedido(pedido),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
