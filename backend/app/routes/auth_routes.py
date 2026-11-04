
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
        "usuario": {
            "id": usuario.id,
            "username": usuario.username,
            "rol_id": usuario.rol_id
        }
    }), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def obtener_perfil():
    """Obtiene los datos del usuario autenticado."""

    usuario_id = int(get_jwt_identity())
    usuario = obtener_usuario(usuario_id)

    if not usuario or not usuario.estado:
        return jsonify({
            "error": "El usuario no existe o está inactivo."
        }), 401

    return jsonify({
        "usuario": {
            "id": usuario.id,
            "username": usuario.username,
            "rol_id": usuario.rol_id
        }
    }), 200
