
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.marca_service import (
    crear_marca,
    listar_marcas,
    obtener_marca,
    buscar_marcas,
    actualizar_marca,
    desactivar_marca,
    activar_marca,
)

marca_bp = Blueprint("marca", __name__, url_prefix="/api/marcas")


def serializar_marca(marca):
    return {
        "id": marca.id,
        "nombre": marca.nombre,
        "estado": marca.estado,
    }


# CREAR MARCA
@marca_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}
    nombre = datos.get("nombre")

    if not isinstance(nombre, str):
        return jsonify({"error": "El nombre de la marca es obligatorio."}), 400

    try:
        marca = crear_marca(nombre)

        return jsonify({
            "mensaje": "Marca creada correctamente.",
            "marca": serializar_marca(marca),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


# LISTAR Y BUSCAR MARCAS
@marca_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    termino = request.args.get("buscar")
    marcas = buscar_marcas(termino) if termino else listar_marcas()

    return jsonify([
        serializar_marca(marca) for marca in marcas
    ]), 200


# OBTENER MARCA POR ID
@marca_bp.route("/<int:marca_id>", methods=["GET"])
@jwt_required()
def obtener(marca_id):
    marca = obtener_marca(marca_id)

    if marca is None:
        return jsonify({"error": "La marca no existe."}), 404

    return jsonify(serializar_marca(marca)), 200


# ACTUALIZAR MARCA
@marca_bp.route("/<int:marca_id>", methods=["PATCH"])
@jwt_required()
def actualizar(marca_id):
    datos = request.get_json(silent=True) or {}

    if "nombre" not in datos:
        return jsonify({"error": "Debe proporcionar el nombre de la marca."}), 400

    if not isinstance(datos["nombre"], str):
        return jsonify({"error": "El nombre debe ser un texto."}), 400

    try:
        marca = actualizar_marca(
            marca_id=marca_id,
            nombre=datos["nombre"],
        )

        return jsonify({
            "mensaje": "Marca actualizada correctamente.",
            "marca": serializar_marca(marca),
        }), 200

    except ValueError as e:
        codigo = 404 if "no existe" in str(e).lower() else 400
        return jsonify({"error": str(e)}), codigo


# DESACTIVAR MARCA
@marca_bp.route("/<int:marca_id>/desactivar", methods=["PATCH"])
@jwt_required()
def desactivar(marca_id):
    try:
        marca = desactivar_marca(marca_id)

        return jsonify({
            "mensaje": "Marca desactivada correctamente.",
            "marca": serializar_marca(marca),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ACTIVAR MARCA
@marca_bp.route("/<int:marca_id>/activar", methods=["PATCH"])
@jwt_required()
def activar(marca_id):
    try:
        marca = activar_marca(marca_id)

        return jsonify({
            "mensaje": "Marca activada correctamente.",
            "marca": serializar_marca(marca),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404
