from flask import jsonify
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


# Respuestas uniformes para los errores de autenticación: siempre 401 con JSON {error, codigo}.
@jwt.unauthorized_loader
def _sin_token(motivo):
    return jsonify({"error": "Debe iniciar sesión para continuar.", "codigo": "SIN_SESION"}), 401


@jwt.invalid_token_loader
def _token_invalido(motivo):
    return jsonify({"error": "Su sesión no es válida. Inicie sesión de nuevo.", "codigo": "TOKEN_INVALIDO"}), 401


@jwt.expired_token_loader
def _token_vencido(encabezado, datos):
    return jsonify({"error": "Su sesión expiró. Inicie sesión de nuevo.", "codigo": "SESION_EXPIRADA"}), 401
