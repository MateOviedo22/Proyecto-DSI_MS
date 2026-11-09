
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.detalle_venta_service import (
    agregar_detalle_venta,
    listar_detalles_venta,
    obtener_detalle_venta,
    actualizar_detalle_venta,
    eliminar_detalle_venta,
)


detalle_venta_bp = Blueprint(
    "detalles_venta",
    __name__,
    url_prefix="/api/detalles-venta"
)


def serializar_detalle(detalle):
    return {
        "id": detalle.id,
        "venta_id": detalle.venta_id,
        "producto_id": detalle.producto_id,
        "sku_snapshot": detalle.sku_snapshot,
        "producto_nombre_snapshot": detalle.producto_nombre_snapshot,
        "cantidad": detalle.cantidad,
        "precio_unitario": str(detalle.precio_unitario),
        "descuento": str(detalle.descuento),
        "tasa_impuesto": str(detalle.tasa_impuesto),
        "monto_impuesto": str(detalle.monto_impuesto),
        "subtotal": str(detalle.subtotal),
        "total_linea": str(detalle.total_linea),
        "dias_garantia": detalle.dias_garantia,
    }


@detalle_venta_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    data = request.get_json(silent=True) or {}

    try:
        detalle = agregar_detalle_venta(
            venta_id=data.get("venta_id"),
            producto_id=data.get("producto_id"),
            cantidad=data.get("cantidad"),
            descuento=data.get("descuento", 0),
            tasa_impuesto=data.get("tasa_impuesto", 0),
            precio_unitario=data.get("precio_unitario"),
            dias_garantia=data.get("dias_garantia"),
        )

        return jsonify({
            "mensaje": "Detalle de venta agregado correctamente.",
            "detalle": serializar_detalle(detalle),
        }), 201

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400


@detalle_venta_bp.route("/venta/<int:venta_id>", methods=["GET"])
@jwt_required()
def listar_por_venta(venta_id):
    try:
        detalles = listar_detalles_venta(venta_id)

        return jsonify([
            serializar_detalle(detalle)
            for detalle in detalles
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@detalle_venta_bp.route("/<int:detalle_id>", methods=["GET"])
@jwt_required()
def obtener(detalle_id):
    try:
        detalle = obtener_detalle_venta(detalle_id)

        if not detalle:
            return jsonify({
                "error": "Detalle de venta no encontrado."
            }), 404

        return jsonify(serializar_detalle(detalle)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@detalle_venta_bp.route("/<int:detalle_id>", methods=["PATCH"])
@jwt_required()
def actualizar(detalle_id):
    data = request.get_json(silent=True) or {}

    try:
        detalle = actualizar_detalle_venta(
            detalle_id=detalle_id,
            cantidad=data.get("cantidad"),
            descuento=data.get("descuento"),
            tasa_impuesto=data.get("tasa_impuesto"),
            precio_unitario=data.get("precio_unitario"),
            dias_garantia=data.get("dias_garantia"),
            actualizar_garantia="dias_garantia" in data,
        )

        return jsonify({
            "mensaje": "Detalle de venta actualizado correctamente.",
            "detalle": serializar_detalle(detalle),
        }), 200

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400


@detalle_venta_bp.route("/<int:detalle_id>", methods=["DELETE"])
@jwt_required()
def eliminar(detalle_id):
    try:
        eliminar_detalle_venta(detalle_id)

        return jsonify({
            "mensaje": "Detalle de venta eliminado correctamente."
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
