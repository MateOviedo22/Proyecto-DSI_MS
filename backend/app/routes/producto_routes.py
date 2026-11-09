
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.producto_service import (
    crear_producto,
    listar_productos,
    obtener_producto,
    buscar_productos,
    listar_productos_por_categoria,
    actualizar_producto,
    desactivar_producto,
    activar_producto,
)

producto_bp = Blueprint("producto", __name__, url_prefix="/api/productos")


def serializar_producto(producto):
    return {
        "id": producto.id,
        "sku": producto.sku,
        "nombre": producto.nombre,
        "categoria_id": producto.categoria_id,
        "modelo_id": producto.modelo_id,
        "descripcion": producto.descripcion,
        "especificaciones": producto.especificaciones,
        "requiere_numero_serie": producto.requiere_numero_serie,
        "dias_garantia_default": producto.dias_garantia_default,
        "estado": producto.estado,
    }


# CREAR PRODUCTO
@producto_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    sku = datos.get("sku")
    nombre = datos.get("nombre")
    categoria_id = datos.get("categoria_id")

    if not isinstance(sku, str) or not isinstance(nombre, str):
        return jsonify({
            "error": "El SKU y el nombre del producto son obligatorios."
        }), 400

    if isinstance(categoria_id, bool) or not isinstance(categoria_id, int):
        return jsonify({
            "error": "Debe proporcionar un ID de categoría válido."
        }), 400

    for campo in ("descripcion", "especificaciones"):
        if datos.get(campo) is not None and not isinstance(datos[campo], str):
            return jsonify({
                "error": f"El campo {campo} debe ser un texto."
            }), 400

    modelo_id = datos.get("modelo_id")

    if modelo_id is not None and (
        isinstance(modelo_id, bool) or not isinstance(modelo_id, int)
    ):
        return jsonify({"error": "El ID del modelo debe ser un entero."}), 400

    requiere_numero_serie = datos.get("requiere_numero_serie", False)

    if not isinstance(requiere_numero_serie, bool):
        return jsonify({
            "error": "requiere_numero_serie debe ser verdadero o falso."
        }), 400

    dias_garantia = datos.get("dias_garantia_default")

    if dias_garantia is not None and (
        isinstance(dias_garantia, bool)
        or not isinstance(dias_garantia, int)
    ):
        return jsonify({
            "error": "Los días de garantía deben ser un número entero."
        }), 400

    try:
        producto = crear_producto(
            sku=sku,
            nombre=nombre,
            categoria_id=categoria_id,
            descripcion=datos.get("descripcion"),
            especificaciones=datos.get("especificaciones"),
            modelo_id=modelo_id,
            requiere_numero_serie=requiere_numero_serie,
            dias_garantia_default=dias_garantia,
        )

        return jsonify({
            "mensaje": "Producto creado correctamente.",
            "producto": serializar_producto(producto),
        }), 201

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo


# LISTAR Y BUSCAR PRODUCTOS
@producto_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    termino = request.args.get("buscar")
    productos = buscar_productos(termino) if termino else listar_productos()

    return jsonify([
        serializar_producto(producto) for producto in productos
    ]), 200


# LISTAR PRODUCTOS POR CATEGORÍA
@producto_bp.route("/categoria/<int:categoria_id>", methods=["GET"])
@jwt_required()
def listar_por_categoria(categoria_id):
    try:
        productos = listar_productos_por_categoria(categoria_id)

        return jsonify([
            serializar_producto(producto) for producto in productos
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# OBTENER PRODUCTO POR ID
@producto_bp.route("/<int:producto_id>", methods=["GET"])
@jwt_required()
def obtener(producto_id):
    producto = obtener_producto(producto_id)

    if producto is None:
        return jsonify({"error": "El producto no existe."}), 404

    return jsonify(serializar_producto(producto)), 200


# ACTUALIZAR PRODUCTO
@producto_bp.route("/<int:producto_id>", methods=["PATCH"])
@jwt_required()
def actualizar(producto_id):
    datos = request.get_json(silent=True) or {}

    campos_permitidos = {
        "sku",
        "nombre",
        "categoria_id",
        "descripcion",
        "especificaciones",
        "modelo_id",
        "requiere_numero_serie",
        "dias_garantia_default",
    }

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({"error": "Se recibieron campos no permitidos."}), 400

    for campo in ("sku", "nombre", "descripcion", "especificaciones"):
        if campo in datos and datos[campo] is not None:
            if not isinstance(datos[campo], str):
                return jsonify({
                    "error": f"El campo {campo} debe ser un texto."
                }), 400

    for campo in ("categoria_id", "modelo_id", "dias_garantia_default"):
        valor = datos.get(campo)

        if valor is not None and (
            isinstance(valor, bool) or not isinstance(valor, int)
        ):
            return jsonify({
                "error": f"El campo {campo} debe ser un entero."
            }), 400

    if (
        "requiere_numero_serie" in datos
        and datos["requiere_numero_serie"] is not None
        and not isinstance(datos["requiere_numero_serie"], bool)
    ):
        return jsonify({
            "error": "requiere_numero_serie debe ser verdadero o falso."
        }), 400

    try:
        producto = actualizar_producto(
            producto_id=producto_id,
            sku=datos.get("sku"),
            nombre=datos.get("nombre"),
            categoria_id=datos.get("categoria_id"),
            descripcion=datos.get("descripcion"),
            especificaciones=datos.get("especificaciones"),
            modelo_id=datos.get("modelo_id"),
            requiere_numero_serie=datos.get("requiere_numero_serie"),
            dias_garantia_default=datos.get("dias_garantia_default"),
        )

        return jsonify({
            "mensaje": "Producto actualizado correctamente.",
            "producto": serializar_producto(producto),
        }), 200

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo


# DESACTIVAR PRODUCTO
@producto_bp.route("/<int:producto_id>/desactivar", methods=["PATCH"])
@jwt_required()
def desactivar(producto_id):
    try:
        producto = desactivar_producto(producto_id)

        return jsonify({
            "mensaje": "Producto desactivado correctamente.",
            "producto": serializar_producto(producto),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ACTIVAR PRODUCTO
@producto_bp.route("/<int:producto_id>/activar", methods=["PATCH"])
@jwt_required()
def activar(producto_id):
    try:
        producto = activar_producto(producto_id)

        return jsonify({
            "mensaje": "Producto activado correctamente.",
            "producto": serializar_producto(producto),
        }), 200

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo
