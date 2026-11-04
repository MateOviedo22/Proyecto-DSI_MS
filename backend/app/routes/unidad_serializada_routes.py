
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.services.unidad_serializada_service import (
    obtener_unidad_serializada,
    listar_unidades_por_producto,
    listar_unidades_por_detalle_venta,
)


unidad_serializada_bp = Blueprint(
    "unidades_serializadas",
    __name__,
    url_prefix="/api/unidades-serializadas"
)


def serializar_unidad(unidad):
    return {
        "id": unidad.id,
        "producto_id": unidad.producto_id,
        "lote_id": unidad.lote_id,
        "detalle_venta_id": unidad.detalle_venta_id,
        "numero_serie": unidad.numero_serie,
        "estado": unidad.estado,
        "fecha_registro": (
            unidad.fecha_registro.isoformat()
            if unidad.fecha_registro else None
        ),
        "fecha_fin_garantia": (
            unidad.fecha_fin_garantia.isoformat()
            if unidad.fecha_fin_garantia else None
        ),
    }


@unidad_serializada_bp.route("/<int:unidad_id>", methods=["GET"])
@jwt_required()
def obtener(unidad_id):
    try:
        unidad = obtener_unidad_serializada(unidad_id)

        return jsonify(serializar_unidad(unidad)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@unidad_serializada_bp.route(
    "/producto/<int:producto_id>",
    methods=["GET"]
)
@jwt_required()
def listar_por_producto(producto_id):
    try:
        unidades = listar_unidades_por_producto(producto_id)

        return jsonify([
            serializar_unidad(unidad)
            for unidad in unidades
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@unidad_serializada_bp.route(
    "/detalle-venta/<int:detalle_venta_id>",
    methods=["GET"]
)
@jwt_required()
def listar_por_detalle_venta(detalle_venta_id):
    try:
        unidades = listar_unidades_por_detalle_venta(
            detalle_venta_id
        )

        return jsonify([
            serializar_unidad(unidad)
            for unidad in unidades
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
