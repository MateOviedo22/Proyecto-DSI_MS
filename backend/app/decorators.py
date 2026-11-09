
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from app.services.usuario_service import obtener_usuario
from app.services.rol_service import obtener_rol


def roles_requeridos(*roles_permitidos):
    """
    Permite acceder únicamente a usuarios cuyos roles
    estén incluidos en roles_permitidos.

    Ejemplo:
    @roles_requeridos("Administrador", "Vendedor")
    """

    roles_permitidos = {
        rol.strip().upper()
        for rol in roles_permitidos
    }

    def decorador(funcion):
        @wraps(funcion)
        def funcion_protegida(*args, **kwargs):

            usuario_id = int(get_jwt_identity())
            usuario = obtener_usuario(usuario_id)

            if not usuario or not usuario.estado:
                return jsonify({
                    "error": "Usuario inexistente o inactivo."
                }), 401

            rol = obtener_rol(usuario.rol_id)

            if not rol:
                return jsonify({
                    "error": "El usuario no tiene un rol válido."
                }), 403

            nombre_rol = rol.nombre.strip().upper()

            if nombre_rol not in roles_permitidos:
                return jsonify({
                    "error": "No tiene permisos para realizar esta operación."
                }), 403

            return funcion(*args, **kwargs)

        return funcion_protegida

    return decorador
