
from flask import Blueprint, jsonify, request

from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
)

from app.services.usuario_service import (
    verificar_credenciales,
    obtener_usuario,
)


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


def serializar_usuario(usuario):
    """Devuelve los datos necesarios del usuario autenticado."""

    nombre_completo = None

    if usuario.empleado and usuario.empleado.persona:
        nombre_completo = usuario.empleado.persona.nombre_completo

    return {
        "id": usuario.id,
        "username": usuario.username,
        "email": usuario.email,
        "rol_id": usuario.rol_id,
        "rol": usuario.rol.nombre if usuario.rol else None,
        "nombre_completo": nombre_completo,
        "activo": usuario.estado,
    }


@auth_bp.route("/login", methods=["POST"])
def login():
    """Autentica al usuario y genera un JWT."""

    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({
            "error": "Debe proporcionar usuario y contraseña."
        }), 400

    usuario = verificar_credenciales(username, password)

    if not usuario or not usuario.estado:
        return jsonify({
            "error": "Credenciales incorrectas o usuario inactivo."
        }), 401

    access_token = create_access_token(
        identity=str(usuario.id),
        additional_claims={
            "rol_id": usuario.rol_id
        }
    )

    return jsonify({
        "mensaje": "Autenticación exitosa.",
        "access_token": access_token,
        "token_type": "Bearer",
        "usuario": serializar_usuario(usuario)
    }), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def obtener_perfil():
    """Obtener los datos del usuario autenticado."""

    usuario_id = int(get_jwt_identity())
    usuario = obtener_usuario(usuario_id)

    if not usuario or not usuario.estado:
        return jsonify({
            "error": "El usuario no existe o está inactivo."
        }), 401

    return jsonify({
        "usuario": serializar_usuario(usuario)
    }), 200
