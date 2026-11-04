
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.proveedor_services import (
    crear_proveedor,
    listar_proveedores,
    obtener_proveedor,
    buscar_proveedores,
    actualizar_proveedor,
    desactivar_proveedor,
    activar_proveedor,
)

proveedor_bp = Blueprint(
    "proveedor",
    __name__,
    url_prefix="/api/proveedores"
)


def serializar_proveedor(proveedor):
    return {
        "id": proveedor.id,
        "nombre": proveedor.nombre,
        "contacto_nombre": proveedor.contacto_nombre,
        "telefono": proveedor.telefono,
        "email": proveedor.email,
        "direccion": proveedor.direccion,
        "estado": proveedor.estado,
    }


# CREAR PROVEEDOR
@proveedor_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    nombre = datos.get("nombre")

    if not isinstance(nombre, str):
        return jsonify({"error": "El nombre del proveedor es obligatorio."}), 400

    campos_texto = (
        "contacto_nombre",
        "telefono",
        "email",
        "direccion",
    )

    for campo in campos_texto:
        if datos.get(campo) is not None and not isinstance(datos[campo], str):
            return jsonify({
                "error": f"El campo {campo} debe ser un texto."
            }), 400

    try:
        proveedor = crear_proveedor(
            nombre=nombre,
            contacto_nombre=datos.get("contacto_nombre"),
            telefono=datos.get("telefono"),
            email=datos.get("email"),
            direccion=datos.get("direccion"),
        )

        return jsonify({
            "mensaje": "Proveedor creado correctamente.",
            "proveedor": serializar_proveedor(proveedor),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


# LISTAR Y BUSCAR PROVEEDORES
@proveedor_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    termino = request.args.get("buscar")

    proveedores = (
        buscar_proveedores(termino)
        if termino
        else listar_proveedores()
    )

    return jsonify([
        serializar_proveedor(proveedor)
        for proveedor in proveedores
    ]), 200


# OBTENER PROVEEDOR POR ID
@proveedor_bp.route("/<int:proveedor_id>", methods=["GET"])
@jwt_required()
def obtener(proveedor_id):
    proveedor = obtener_proveedor(proveedor_id)

    if proveedor is None:
        return jsonify({"error": "El proveedor no existe."}), 404

    return jsonify(serializar_proveedor(proveedor)), 200


# ACTUALIZAR PROVEEDOR
@proveedor_bp.route("/<int:proveedor_id>", methods=["PATCH"])
@jwt_required()
def actualizar(proveedor_id):
    datos = request.get_json(silent=True) or {}

    campos_permitidos = {
        "nombre",
        "contacto_nombre",
        "telefono",
        "email",
        "direccion",
    }

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({
            "error": "Se recibieron campos no permitidos."
        }), 400

    for campo in campos_permitidos:
        if campo in datos and datos[campo] is not None:
            if not isinstance(datos[campo], str):
                return jsonify({
                    "error": f"El campo {campo} debe ser un texto."
                }), 400

    try:
        proveedor = actualizar_proveedor(
            proveedor_id=proveedor_id,
            nombre=datos.get("nombre"),
            contacto_nombre=datos.get("contacto_nombre"),
            telefono=datos.get("telefono"),
            email=datos.get("email"),
            direccion=datos.get("direccion"),
        )

        return jsonify({
            "mensaje": "Proveedor actualizado correctamente.",
            "proveedor": serializar_proveedor(proveedor),
        }), 200

    except ValueError as e:
        codigo = 404 if "no existe" in str(e).lower() else 400
        return jsonify({"error": str(e)}), codigo


# DESACTIVAR PROVEEDOR
@proveedor_bp.route(
    "/<int:proveedor_id>/desactivar",
    methods=["PATCH"]
)
@jwt_required()
def desactivar(proveedor_id):
    try:
        proveedor = desactivar_proveedor(proveedor_id)

        return jsonify({
            "mensaje": "Proveedor desactivado correctamente.",
            "proveedor": serializar_proveedor(proveedor),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ACTIVAR PROVEEDOR
@proveedor_bp.route(
    "/<int:proveedor_id>/activar",
    methods=["PATCH"]
)
@jwt_required()
def activar(proveedor_id):
    try:
        proveedor = activar_proveedor(proveedor_id)

        return jsonify({
            "mensaje": "Proveedor activado correctamente.",
            "proveedor": serializar_proveedor(proveedor),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404
