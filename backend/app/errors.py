"""Errores de negocio y su traducción a códigos HTTP semánticos.

Los servicios existentes lanzan ``ValueError`` con mensajes en español. Aquí se
traducen a la respuesta HTTP que corresponde (Capítulo II, "Flujo transaccional"):

    400 Bad Request   datos inválidos (cantidades, formatos, campos faltantes)
    401 Unauthorized  sin sesión, token vencido o alterado
    403 Forbidden     el rol no autoriza la operación
    404 Not Found     el recurso no existe
    409 Conflict      el estado actual lo impide: existencias insuficientes,
                      duplicados, garantía vencida, unidad ya vendida...
"""

import re

from flask import jsonify


class ErrorNegocio(ValueError):
    """Error de regla de negocio con código HTTP y código de aplicación propios."""

    estado = 400
    codigo = "SOLICITUD_INVALIDA"

    def __init__(self, mensaje, *, estado=None, codigo=None, **detalle):
        super().__init__(mensaje)
        if estado is not None:
            self.estado = estado
        if codigo is not None:
            self.codigo = codigo
        self.detalle = detalle


class RecursoNoEncontrado(ErrorNegocio):
    estado = 404
    codigo = "NO_ENCONTRADO"


class ConflictoError(ErrorNegocio):
    estado = 409
    codigo = "CONFLICTO"


class ExistenciasInsuficientes(ConflictoError):
    codigo = "EXISTENCIAS_INSUFICIENTES"

    def __init__(self, producto_id, nombre, disponibles, solicitadas):
        super().__init__(
            f"Existencias insuficientes para {nombre}. "
            f"Disponibles: {disponibles}; solicitadas: {solicitadas}.",
            producto_id=producto_id,
            producto=nombre,
            disponibles=disponibles,
            solicitadas=solicitadas,
        )


# Mensajes de los servicios que indican un conflicto de estado (409).
_CONFLICTO = re.compile(
    r"insuficient|ya existe|ya est[aá] |ya tiene|ya fue|ya no est[aá]|no est[aá] disponible|"
    r"vencid|no hay suficientes|no permite|solamente se pueden|solo se pueden|"
    r"ya est[aá] registrad|pendiente de|ya fue registrad|no se encuentra en estado|no est[aá] en (?:un )?estado|"
    r"no tiene un estado v[aá]lido|ya tiene un reclamo|no pertenece a este detalle de venta",
    re.IGNORECASE,
)
_NO_EXISTE = re.compile(r"no existe|no encontrad|no existen", re.IGNORECASE)

_CODIGOS = (
    (re.compile(r"existencias insuficientes", re.I), "EXISTENCIAS_INSUFICIENTES"),
    (re.compile(r"garant[ií]a.*vencid", re.I), "GARANTIA_VENCIDA"),
    (re.compile(r"unidades serializadas", re.I), "SERIES_NO_DISPONIBLES"),
    (re.compile(r"ya existe|ya est[aá] registrad", re.I), "DUPLICADO"),
)


def clasificar(error):
    """Devuelve (estado_http, codigo) para una excepción de negocio."""
    if isinstance(error, ErrorNegocio):
        return error.estado, error.codigo

    mensaje = str(error)
    if _NO_EXISTE.search(mensaje):
        return 404, "NO_ENCONTRADO"
    if _CONFLICTO.search(mensaje):
        for patron, codigo in _CODIGOS:
            if patron.search(mensaje):
                return 409, codigo
        return 409, "CONFLICTO"
    return 400, "SOLICITUD_INVALIDA"


def responder_error(error):
    """Convierte una excepción de negocio en la respuesta JSON estándar de la API."""
    estado, codigo = clasificar(error)
    cuerpo = {"error": str(error), "codigo": codigo}
    cuerpo.update(getattr(error, "detalle", {}) or {})
    return jsonify(cuerpo), estado


def registrar_manejadores(app):
    """Respuestas JSON uniformes para todos los errores de la API."""

    @app.errorhandler(ErrorNegocio)
    def _negocio(error):
        return responder_error(error)

    @app.errorhandler(404)
    def _no_encontrado(_):
        return jsonify({"error": "El recurso solicitado no existe.", "codigo": "NO_ENCONTRADO"}), 404

    @app.errorhandler(405)
    def _metodo(_):
        return jsonify({"error": "Método no permitido para este recurso.", "codigo": "METODO_NO_PERMITIDO"}), 405

    @app.errorhandler(500)
    def _interno(error):
        app.logger.exception("Error interno: %s", error)
        return jsonify({"error": "Error interno del servidor.", "codigo": "ERROR_INTERNO"}), 500
