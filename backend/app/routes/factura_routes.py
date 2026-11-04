
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.factura_service import (
    emitir_factura,
    obtener_factura,
    obtener_factura_por_venta,
    obtener_factura_por_numero,
    listar_facturas,
    listar_facturas_por_estado,
    anular_factura,
)


factura_bp = Blueprint(
    "facturas",
    __name__,
    url_prefix="/api/facturas"
)


def serializar_factura(factura):
    return {
        "id": factura.id,
        "venta_id": factura.venta_id,
        "numero_factura": factura.numero_factura,
        "fecha_emision": (
            factura.fecha_emision.isoformat()
            if factura.fecha_emision else None
        ),
        "estado": factura.estado,
        "subtotal": str(factura.subtotal),
        "descuento_total": str(factura.descuento_total),
        "impuesto_total": str(factura.impuesto_total),
        "total_final": str(factura.total_final),
        "datos_emisor_snapshot": factura.datos_emisor_snapshot,
        "datos_cliente_snapshot": factura.datos_cliente_snapshot,
        "motivo_anulacion": factura.motivo_anulacion,
    }


@factura_bp.route("/", methods=["POST"])
@jwt_required()
def emitir():
    data = request.get_json(silent=True) or {}

    try:
        factura = emitir_factura(
            venta_id=data.get("venta_id"),
            datos_emisor_snapshot=data.get("datos_emisor_snapshot"),
        )

        return jsonify({
            "mensaje": "Factura emitida correctamente.",
            "factura": serializar_factura(factura),
        }), 201

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400


@factura_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    try:
        facturas = listar_facturas()

        return jsonify([
            serializar_factura(factura)
            for factura in facturas
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@factura_bp.route("/estado/<string:estado>", methods=["GET"])
@jwt_required()
def listar_por_estado(estado):
    try:
        facturas = listar_facturas_por_estado(estado)

        return jsonify([
            serializar_factura(factura)
            for factura in facturas
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@factura_bp.route("/venta/<int:venta_id>", methods=["GET"])
@jwt_required()
def obtener_por_venta(venta_id):
    try:
        factura = obtener_factura_por_venta(venta_id)

        if not factura:
            return jsonify({"error": "Factura no encontrada."}), 404

        return jsonify(serializar_factura(factura)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@factura_bp.route("/numero/<string:numero_factura>", methods=["GET"])
@jwt_required()
def obtener_por_numero(numero_factura):
    try:
        factura = obtener_factura_por_numero(numero_factura)

        if not factura:
            return jsonify({"error": "Factura no encontrada."}), 404

        return jsonify(serializar_factura(factura)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@factura_bp.route("/<int:factura_id>", methods=["GET"])
@jwt_required()
def obtener(factura_id):
    try:
        factura = obtener_factura(factura_id)

        if not factura:
            return jsonify({"error": "Factura no encontrada."}), 404

        return jsonify(serializar_factura(factura)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@factura_bp.route("/<int:factura_id>/anular", methods=["PATCH"])
@jwt_required()
def anular(factura_id):
    data = request.get_json(silent=True) or {}

    try:
        factura = anular_factura(
            factura_id=factura_id,
            motivo=data.get("motivo"),
        )

        return jsonify({
            "mensaje": "Factura anulada correctamente.",
            "factura": serializar_factura(factura),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
