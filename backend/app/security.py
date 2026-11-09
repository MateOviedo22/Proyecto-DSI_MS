"""Control de acceso por rol aplicado de forma centralizada (RNF 12 a 15).

Antes de cada petición a ``/api/*`` (salvo el login) se verifica el JWT, se
confirma que el usuario siga activo y se comprueba que su rol esté autorizado
para el recurso y el método HTTP solicitados. Un rol sin permiso recibe **403**.

La matriz coincide con la que usa el frontend (src/utils/permisos.js); la
diferencia es que aquí se *impone*: ocultar un menú no protege la API.
"""

import re

from flask import g, jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from app.extensions import db
from app.models.personas import Usuario

ADMIN = "Administrador"
VENDEDOR = "Vendedor"
INVENTARIO = "Encargado de Inventario"

TODOS = frozenset({ADMIN, VENDEDOR, INVENTARIO})
ADMIN_INV = frozenset({ADMIN, INVENTARIO})
ADMIN_VEND = frozenset({ADMIN, VENDEDOR})
SOLO_ADMIN = frozenset({ADMIN})

# (prefijo, roles que pueden consultar [GET], roles que pueden modificar [POST/PUT/PATCH/DELETE]).
# Se evalúa de arriba hacia abajo: lo más específico primero.
POLITICA = (
    ("/api/usuarios", SOLO_ADMIN, SOLO_ADMIN),
    ("/api/roles", SOLO_ADMIN, SOLO_ADMIN),
    ("/api/personas", SOLO_ADMIN, SOLO_ADMIN),
    ("/api/empleados", SOLO_ADMIN, SOLO_ADMIN),
    ("/api/categorias", TODOS, ADMIN_INV),
    ("/api/marcas", TODOS, ADMIN_INV),
    ("/api/modelos", TODOS, ADMIN_INV),
    ("/api/productos", TODOS, ADMIN_INV),
    ("/api/precios", TODOS, ADMIN_INV),
    ("/api/existencias", TODOS, ADMIN_INV),
    ("/api/movimientos-inventario", ADMIN_INV, ADMIN_INV),
    ("/api/proveedores", ADMIN_INV, ADMIN_INV),
    ("/api/producto-proveedores", ADMIN_INV, ADMIN_INV),
    ("/api/compras", ADMIN_INV, ADMIN_INV),
    ("/api/detalles-compra", ADMIN_INV, ADMIN_INV),
    ("/api/recepciones", ADMIN_INV, ADMIN_INV),
    ("/api/lotes", ADMIN_INV, ADMIN_INV),
    ("/api/unidades-serializadas", TODOS, ADMIN_INV),
    ("/api/clientes", ADMIN_VEND, ADMIN_VEND),
    ("/api/pedidos", ADMIN_VEND, ADMIN_VEND),
    ("/api/detalles-pedido", ADMIN_VEND, ADMIN_VEND),
    ("/api/ventas", TODOS, ADMIN_VEND),
    ("/api/detalles-venta", TODOS, ADMIN_VEND),
    ("/api/facturas", TODOS, ADMIN_VEND),
    ("/api/devoluciones", TODOS, ADMIN_VEND),
    ("/api/detalles-devolucion", TODOS, ADMIN_VEND),
    ("/api/reclamos-garantia", TODOS, ADMIN_VEND),
    ("/api/notificaciones", TODOS, TODOS),
)

RUTAS_PUBLICAS = frozenset({"/api/auth/login"})
_CONTRASENA_PROPIA = re.compile(r"^/api/usuarios/(\d+)/contrasena/?$")
_LECTURA = frozenset({"GET", "HEAD"})


def _normalizar(roles):
    return {rol.strip().upper() for rol in roles}


def _regla(ruta):
    for prefijo, lectura, escritura in POLITICA:
        if ruta == prefijo or ruta.startswith(prefijo + "/"):
            return lectura, escritura
    return None


def instalar_politica_de_acceso(app):
    @app.before_request
    def _autorizar():
        ruta = request.path

        if request.method == "OPTIONS" or not ruta.startswith("/api/"):
            return None
        if ruta.rstrip("/") in RUTAS_PUBLICAS:
            return None

        # Valida firma y vigencia del JWT (errores -> 401, ver extensions.py).
        verify_jwt_in_request()

        usuario = db.session.get(Usuario, int(get_jwt_identity()))
        if usuario is None or not usuario.estado or usuario.rol is None or not usuario.rol.estado:
            return jsonify({"error": "Usuario inexistente o inactivo.", "codigo": "USUARIO_INACTIVO"}), 401

        g.usuario = usuario
        g.rol = usuario.rol.nombre
        rol = g.rol.strip().upper()

        # Cada usuario puede cambiar su propia contraseña (se exige la actual).
        propia = _CONTRASENA_PROPIA.match(ruta)
        if propia and int(propia.group(1)) == usuario.id:
            return None

        regla = _regla(ruta)
        if regla is None:
            return None  # ruta autenticada sin restricción de rol (p. ej. /api/auth/me)

        lectura, escritura = regla
        permitidos = lectura if request.method in _LECTURA else escritura
        if rol not in _normalizar(permitidos):
            return (
                jsonify({
                    "error": "No tiene permisos para realizar esta operación.",
                    "codigo": "SIN_PERMISO",
                    "rol": g.rol,
                }),
                403,
            )
        return None
