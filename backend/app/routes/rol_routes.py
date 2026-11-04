
from flask import Blueprint, jsonify, request

from app.services.rol_service import (
    crear_rol,
    listar_roles,
    obtener_rol,
    actualizar_rol,
    desactivar_rol,
    activar_rol,
)

rol_bp = Blueprint("rol", __name__, url_prefix="/api/roles")


def serializar_rol(rol):
    return {
        "id": rol.id,
        "nombre": rol.nombre,
        "descripcion": rol.descripcion,
        "estado": rol.estado,
    }


# CREAR ROL
@rol_bp.route("/", methods=["POST"])
def crear():
    datos = request.get_json(silent=True) or {}

    try:
        rol = crear_rol(
            nombre=datos.get("nombre", ""),
            descripcion=datos.get("descripcion"),
        )

        return jsonify({
            "mensaje": "Rol creado correctamente.",
            "rol": serializar_rol(rol),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


# LISTAR ROLES
@rol_bp.route("/", methods=["GET"])
def listar():
    roles = listar_roles()

    return jsonify([
        serializar_rol(rol) for rol in roles
    ]), 200


# OBTENER ROL POR ID
@rol_bp.route("/<int:rol_id>", methods=["GET"])
def obtener(rol_id):
    rol = obtener_rol(rol_id)

    if rol is None:
        return jsonify({"error": "El rol no existe."}), 404

    return jsonify(serializar_rol(rol)), 200


# ACTUALIZAR ROL
@rol_bp.route("/<int:rol_id>", methods=["PATCH"])
def actualizar(rol_id):
    datos = request.get_json(silent=True) or {}

    campos_permitidos = {"nombre", "descripcion"}
    campos_recibidos = set(datos.keys())

    if not campos_recibidos.issubset(campos_permitidos):
        return jsonify({
            "error": "Se recibieron campos no permitidos."
        }), 400

    try:
        rol = actualizar_rol(
            rol_id=rol_id,
            nombre=datos.get("nombre"),
            descripcion=datos.get("descripcion"),
        )

        return jsonify({
            "mensaje": "Rol actualizado correctamente.",
            "rol": serializar_rol(rol),
        }), 200

    except ValueError as e:
        codigo = 404 if "no existe" in str(e).lower() else 400
        return jsonify({"error": str(e)}), codigo


# DESACTIVAR ROL
@rol_bp.route("/<int:rol_id>/desactivar", methods=["PATCH"])
def desactivar(rol_id):
    try:
        rol = desactivar_rol(rol_id)

        return jsonify({
            "mensaje": "Rol desactivado correctamente.",
            "rol": serializar_rol(rol),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ACTIVAR ROL
@rol_bp.route("/<int:rol_id>/activar", methods=["PATCH"])
def activar(rol_id):
    try:
        rol = activar_rol(rol_id)

        return jsonify({
            "mensaje": "Rol activado correctamente.",
            "rol": serializar_rol(rol),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404
