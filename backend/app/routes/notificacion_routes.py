from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.notificacion_service import (
    crear_notificacion,
    listar_notificaciones_usuario,
    listar_notificaciones_no_leidas,
    contar_notificaciones_no_leidas,
    marcar_como_leida,
    marcar_todas_como_leidas,
    eliminar_notificacion,
    generar_alerta_stock,
)


notificacion_bp = Blueprint(
    "notificacion",
    __name__,
    url_prefix="/api/notificaciones"
)


def obtener_usuario_id_token():
    identidad = get_jwt_identity()

    try:
        return int(identidad)
    except (TypeError, ValueError):
        raise ValueError("La identidad del token no contiene un ID de usuario válido.")


def serializar_notificacion(notificacion):
    return {
        "id": notificacion.id,
        "usuario_id": notificacion.usuario_id,
        "producto_id": notificacion.producto_id,
        "tipo": notificacion.tipo,
        "prioridad": notificacion.prioridad,
        "mensaje": notificacion.mensaje,
        "fecha_creacion": (
            notificacion.fecha_creacion.isoformat()
            if notificacion.fecha_creacion else None
        ),
        "fecha_lectura": (
            notificacion.fecha_lectura.isoformat()
            if notificacion.fecha_lectura else None
        ),
        "leida": notificacion.fecha_lectura is not None,
    }


@notificacion_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    try:
        usuario_id = obtener_usuario_id_token()
        notificaciones = listar_notificaciones_usuario(usuario_id)

        return jsonify({
            "notificaciones": [
                serializar_notificacion(n) for n in notificaciones
            ]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@notificacion_bp.route("/no-leidas", methods=["GET"])
@jwt_required()
def listar_no_leidas():
    try:
        usuario_id = obtener_usuario_id_token()
        notificaciones = listar_notificaciones_no_leidas(usuario_id)

        return jsonify({
            "notificaciones": [
                serializar_notificacion(n) for n in notificaciones
            ]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@notificacion_bp.route("/no-leidas/contar", methods=["GET"])
@jwt_required()
def contar_no_leidas():
    try:
        usuario_id = obtener_usuario_id_token()
        cantidad = contar_notificaciones_no_leidas(usuario_id)

        return jsonify({"cantidad_no_leidas": cantidad}), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@notificacion_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    tipo = datos.get("tipo")
    mensaje = datos.get("mensaje")

    if not isinstance(tipo, str) or not tipo.strip():
        return jsonify({"error": "Debe proporcionar un tipo válido."}), 400

    if not isinstance(mensaje, str) or not mensaje.strip():
        return jsonify({"error": "Debe proporcionar un mensaje válido."}), 400

    producto_id = datos.get("producto_id")

    if producto_id is not None and (
        isinstance(producto_id, bool) or not isinstance(producto_id, int)
    ):
        return jsonify({
            "error": "producto_id debe ser un número entero o null."
        }), 400

    prioridad = datos.get("prioridad", "MEDIA")

    if not isinstance(prioridad, str):
        return jsonify({"error": "prioridad debe ser texto."}), 400

    try:
        usuario_id = obtener_usuario_id_token()

        notificacion = crear_notificacion(
            usuario_id=usuario_id,
            tipo=tipo,
            mensaje=mensaje,
            producto_id=producto_id,
            prioridad=prioridad,
        )

        return jsonify({
            "mensaje": "Notificación creada correctamente.",
            "notificacion": serializar_notificacion(notificacion),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@notificacion_bp.route("/<int:notificacion_id>/leer", methods=["PATCH"])
@jwt_required()
def marcar_leida(notificacion_id):
    try:
        usuario_id = obtener_usuario_id_token()

        notificacion = marcar_como_leida(
            notificacion_id,
            usuario_id,
        )

        return jsonify({
            "mensaje": "Notificación marcada como leída.",
            "notificacion": serializar_notificacion(notificacion),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@notificacion_bp.route("/leer-todas", methods=["PATCH"])
@jwt_required()
def marcar_todas_leidas():
    try:
        usuario_id = obtener_usuario_id_token()
        cantidad = marcar_todas_como_leidas(usuario_id)

        return jsonify({
            "mensaje": "Notificaciones marcadas como leídas.",
            "cantidad_actualizada": cantidad,
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@notificacion_bp.route("/<int:notificacion_id>", methods=["DELETE"])
@jwt_required()
def eliminar(notificacion_id):
    try:
        usuario_id = obtener_usuario_id_token()

        eliminar_notificacion(
            notificacion_id,
            usuario_id,
        )

        return jsonify({
            "mensaje": "Notificación eliminada correctamente."
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@notificacion_bp.route("/alerta-stock/<int:producto_id>", methods=["POST"])
@jwt_required()
def generar_alerta(producto_id):
    try:
        usuario_id = obtener_usuario_id_token()

        notificacion = generar_alerta_stock(
            usuario_id,
            producto_id,
        )

        if not notificacion:
            return jsonify({
                "mensaje": "El producto no requiere una alerta de stock."
            }), 200

        return jsonify({
            "mensaje": "Alerta de stock generada correctamente.",
            "notificacion": serializar_notificacion(notificacion),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400