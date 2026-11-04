
from flask import Blueprint, jsonify, request

from app.services.usuario_service import (
    crear_usuario,
    listar_usuarios,
    obtener_usuario,
    buscar_usuario,
    cambiar_contrasena,
    actualizar_usuario,
    activar_usuario,
    desactivar_usuario,
)


usuario_bp = Blueprint(
    "usuarios",
    __name__,
    url_prefix="/api/usuarios"
)


def usuario_a_dict(usuario):
    return {
        "id": usuario.id,
        "username": usuario.username,
        "email": usuario.email,
        "rol_id": usuario.rol_id,
        "empleado_id": usuario.empleado_id,
        "estado": usuario.estado,
    }


@usuario_bp.route("", methods=["POST"])
def registrar_usuario():
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({"error": "Se requiere un objeto JSON válido."}), 400

    campos_permitidos = {
        "username",
        "password",
        "email",
        "rol_id",
        "empleado_id",
    }

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({"error": "Se enviaron campos no permitidos."}), 400

    username = datos.get("username")
    password = datos.get("password")
    rol_id = datos.get("rol_id")
    empleado_id = datos.get("empleado_id")
    email = datos.get("email")

    if not isinstance(username, str):
        return jsonify({"error": "El username debe ser texto."}), 400

    if not isinstance(password, str):
        return jsonify({"error": "La contraseña debe ser texto."}), 400

    if isinstance(rol_id, bool) or not isinstance(rol_id, int):
        return jsonify({"error": "El rol_id debe ser un entero."}), 400

    if empleado_id is not None and (
        isinstance(empleado_id, bool) or not isinstance(empleado_id, int)
    ):
        return jsonify({"error": "El empleado_id debe ser un entero."}), 400

    if email is not None and not isinstance(email, str):
        return jsonify({"error": "El email debe ser texto."}), 400

    try:
        usuario = crear_usuario(
            username=username,
            password=password,
            rol_id=rol_id,
            email=email,
            empleado_id=empleado_id,
        )

        return jsonify({
            "mensaje": "Usuario registrado correctamente.",
            "usuario": usuario_a_dict(usuario)
        }), 201

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@usuario_bp.route("", methods=["GET"])
def obtener_usuarios():
    username = request.args.get("username")

    if username:
        usuario = buscar_usuario(username)

        if usuario is None:
            return jsonify({"error": "Usuario no encontrado."}), 404

        return jsonify(usuario_a_dict(usuario)), 200

    usuarios = listar_usuarios()

    return jsonify([
        usuario_a_dict(usuario)
        for usuario in usuarios
    ]), 200


@usuario_bp.route("/<int:usuario_id>", methods=["GET"])
def consultar_usuario(usuario_id):
    usuario = obtener_usuario(usuario_id)

    if usuario is None:
        return jsonify({"error": "Usuario no encontrado."}), 404

    return jsonify(usuario_a_dict(usuario)), 200


@usuario_bp.route("/<int:usuario_id>", methods=["PATCH"])
def modificar_usuario(usuario_id):
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({"error": "Se requiere un objeto JSON válido."}), 400

    if not datos:
        return jsonify({"error": "Debe proporcionar al menos un campo."}), 400

    campos_permitidos = {
        "username",
        "email",
        "rol_id",
        "empleado_id",
    }

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({"error": "Se enviaron campos no permitidos."}), 400

    for campo in ("username", "email"):
        if campo in datos and datos[campo] is not None:
            if not isinstance(datos[campo], str):
                return jsonify({
                    "error": f"El campo {campo} debe ser texto."
                }), 400

    for campo in ("rol_id", "empleado_id"):
        if campo in datos and datos[campo] is not None:
            if isinstance(datos[campo], bool) or not isinstance(datos[campo], int):
                return jsonify({
                    "error": f"El campo {campo} debe ser un entero."
                }), 400

    try:
        usuario = actualizar_usuario(
            usuario_id,
            **datos
        )

        return jsonify({
            "mensaje": "Usuario actualizado correctamente.",
            "usuario": usuario_a_dict(usuario)
        }), 200

    except ValueError as error:
        mensaje = str(error)
        codigo = 404 if "no existe" in mensaje.lower() else 400

        return jsonify({"error": mensaje}), codigo


@usuario_bp.route("/<int:usuario_id>/contrasena", methods=["PATCH"])
def modificar_contrasena(usuario_id):
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({"error": "Se requiere un objeto JSON válido."}), 400

    if set(datos.keys()) != {"contrasena_actual", "nueva_contrasena"}:
        return jsonify({
            "error": "Debe proporcionar contrasena_actual y nueva_contrasena."
        }), 400

    if not all(
        isinstance(datos[campo], str)
        for campo in ("contrasena_actual", "nueva_contrasena")
    ):
        return jsonify({"error": "Las contraseñas deben ser texto."}), 400

    try:
        usuario = cambiar_contrasena(
            usuario_id,
            datos["contrasena_actual"],
            datos["nueva_contrasena"],
        )

        return jsonify({
            "mensaje": "Contraseña actualizada correctamente.",
            "usuario": usuario_a_dict(usuario)
        }), 200

    except ValueError as error:
        mensaje = str(error)
        codigo = 404 if "no existe" in mensaje.lower() else 400

        return jsonify({"error": mensaje}), codigo


@usuario_bp.route("/<int:usuario_id>/desactivar", methods=["PATCH"])
def desactivar(usuario_id):
    try:
        usuario = desactivar_usuario(usuario_id)

        return jsonify({
            "mensaje": "Usuario desactivado correctamente.",
            "usuario": usuario_a_dict(usuario)
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 404


@usuario_bp.route("/<int:usuario_id>/activar", methods=["PATCH"])
def activar(usuario_id):
    try:
        usuario = activar_usuario(usuario_id)

        return jsonify({
            "mensaje": "Usuario activado correctamente.",
            "usuario": usuario_a_dict(usuario)
        }), 200

    except ValueError as error:
        mensaje = str(error)
        codigo = 404 if "no existe" in mensaje.lower() else 400

        return jsonify({"error": mensaje}), codigo
