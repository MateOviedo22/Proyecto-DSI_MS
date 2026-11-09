
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.venta_service import (
    crear_venta,
    listar_ventas,
    obtener_venta,
    listar_ventas_por_estado,
    listar_ventas_por_cliente,
    confirmar_venta,
    anular_venta,
)


venta_bp = Blueprint("ventas", __name__, url_prefix="/api/ventas")


def serializar_venta(venta):
    return {
        "id": venta.id,
        "numero_venta": venta.numero_venta,
        "usuario_id": venta.usuario_id,
        "cliente_id": venta.cliente_id,
        "pedido_id": venta.pedido_id,
        "fecha_venta": (
            venta.fecha_venta.isoformat()
            if venta.fecha_venta else None
        ),
        "canal": venta.canal,
        "metodo_pago": venta.metodo_pago,
        "estado": venta.estado,
        "subtotal": str(venta.subtotal),
        "descuento_total": str(venta.descuento_total),
        "impuesto_total": str(venta.impuesto_total),
        "total": str(venta.total),
    }


@venta_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    data = request.get_json(silent=True) or {}

    try:
        usuario_id = int(get_jwt_identity())

        venta = crear_venta(
            usuario_id=usuario_id,
            metodo_pago=data.get("metodo_pago"),
            cliente_id=data.get("cliente_id"),
            pedido_id=data.get("pedido_id"),
            canal=data.get("canal", "PISO"),
        )

        return jsonify({
            "mensaje": "Venta creada correctamente.",
            "venta": serializar_venta(venta),
        }), 201

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400


@venta_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    try:
        ventas = listar_ventas()

        return jsonify([
            serializar_venta(venta)
            for venta in ventas
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@venta_bp.route("/estado/<string:estado>", methods=["GET"])
@jwt_required()
def listar_por_estado(estado):
    try:
        ventas = listar_ventas_por_estado(estado)

        return jsonify([
            serializar_venta(venta)
            for venta in ventas
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@venta_bp.route("/cliente/<int:cliente_id>", methods=["GET"])
@jwt_required()
def listar_por_cliente(cliente_id):
    try:
        ventas = listar_ventas_por_cliente(cliente_id)

        return jsonify([
            serializar_venta(venta)
            for venta in ventas
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@venta_bp.route("/<int:venta_id>", methods=["GET"])
@jwt_required()
def obtener(venta_id):
    try:
        venta = obtener_venta(venta_id)

        if not venta:
            return jsonify({"error": "Venta no encontrada."}), 404

        return jsonify(serializar_venta(venta)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@venta_bp.route("/<int:venta_id>/confirmar", methods=["PATCH"])
@jwt_required()
def confirmar(venta_id):
    try:
        venta = confirmar_venta(venta_id=venta_id)

        return jsonify({
            "mensaje": "Venta confirmada correctamente.",
            "venta": serializar_venta(venta),
        }), 200

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400


@venta_bp.route("/<int:venta_id>/anular", methods=["PATCH"])
@jwt_required()
def anular(venta_id):
    data = request.get_json(silent=True) or {}

    try:
        venta = anular_venta(
            venta_id=venta_id,
            motivo=data.get("motivo"),
        )

        return jsonify({
            "mensaje": "Venta anulada correctamente.",
            "venta": serializar_venta(venta),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
