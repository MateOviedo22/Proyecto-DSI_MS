from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.movimiento_inventario_service import (
    ajustar_existencia,
    listar_movimientos,
    listar_movimientos_por_producto,
    obtener_movimiento,
)


movimiento_bp = Blueprint(
    "movimiento_inventario",
    __name__,
    url_prefix="/api/movimientos-inventario"
)


def obtener_usuario_id_token():
    identidad = get_jwt_identity()

    try:
        return int(identidad)
    except (TypeError, ValueError):
        raise ValueError("La identidad del token no contiene un ID de usuario válido.")


def serializar_movimiento(movimiento):
    return {
        "id": movimiento.id,
        "producto_id": movimiento.producto_id,
        "usuario_id": movimiento.usuario_id,
        "lote_id": movimiento.lote_id,
        "detalle_recepcion_id": movimiento.detalle_recepcion_id,
        "detalle_venta_id": movimiento.detalle_venta_id,
        "detalle_devolucion_id": movimiento.detalle_devolucion_id,
        "tipo_movimiento": movimiento.tipo_movimiento,
        "cantidad": movimiento.cantidad,
        "motivo": movimiento.motivo,
        "costo_unitario_aplicado": (
            str(movimiento.costo_unitario_aplicado)
            if movimiento.costo_unitario_aplicado is not None else None
        ),
        "fecha_movimiento": (
            movimiento.fecha_movimiento.isoformat()
            if movimiento.fecha_movimiento else None
        ),
    }


@movimiento_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    movimientos = listar_movimientos()

    return jsonify({
        "movimientos": [
            serializar_movimiento(m) for m in movimientos
        ]
    }), 200


@movimiento_bp.route("/<int:movimiento_id>", methods=["GET"])
@jwt_required()
def obtener(movimiento_id):
    movimiento = obtener_movimiento(movimiento_id)

    if not movimiento:
        return jsonify({"error": "El movimiento no existe."}), 404

    return jsonify({
        "movimiento": serializar_movimiento(movimiento)
    }), 200


@movimiento_bp.route("/producto/<int:producto_id>", methods=["GET"])
@jwt_required()
def listar_por_producto(producto_id):
    try:
        movimientos = listar_movimientos_por_producto(producto_id)

        return jsonify({
            "movimientos": [
                serializar_movimiento(m) for m in movimientos
            ]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@movimiento_bp.route("/ajustes", methods=["POST"])
@jwt_required()
def ajustar():
    datos = request.get_json(silent=True) or {}

    producto_id = datos.get("producto_id")
    cantidad = datos.get("cantidad")
    tipo_ajuste = datos.get("tipo_ajuste")
    motivo = datos.get("motivo")

    if isinstance(producto_id, bool) or not isinstance(producto_id, int):
        return jsonify({"error": "producto_id debe ser un número entero."}), 400

    if isinstance(cantidad, bool) or not isinstance(cantidad, int):
        return jsonify({"error": "cantidad debe ser un número entero."}), 400

    if not isinstance(tipo_ajuste, str):
        return jsonify({"error": "tipo_ajuste debe ser texto."}), 400

    if not isinstance(motivo, str) or not motivo.strip():
        return jsonify({"error": "Debe proporcionar el motivo del ajuste."}), 400

    try:
        usuario_id = obtener_usuario_id_token()

        movimiento = ajustar_existencia(
            producto_id=producto_id,
            usuario_id=usuario_id,
            cantidad=cantidad,
            tipo_ajuste=tipo_ajuste,
            motivo=motivo,
        )

        return jsonify({
            "mensaje": "Ajuste de inventario registrado correctamente.",
            "movimiento": serializar_movimiento(movimiento),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400