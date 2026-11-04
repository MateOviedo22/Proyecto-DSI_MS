from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.categoria_service import (
    crear_categoria,
    listar_categorias,
    obtener_categoria,
    buscar_categorias,
    actualizar_categoria,
    activar_categoria,
    desactivar_categoria,
)

categoria_bp = Blueprint(
    "categorias",
    __name__,
    url_prefix="/api/categorias"
)


def categoria_a_dict(categoria):
    return {
        "id": categoria.id,
        "nombre": categoria.nombre,
        "descripcion": categoria.descripcion,
        "estado": categoria.estado
    }


@categoria_bp.route("", methods=["POST"])
@jwt_required()
def registrar_categoria():
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({"error": "Se requiere un objeto JSON válido."}), 400

    nombre = datos.get("nombre")
    descripcion = datos.get("descripcion")

    if not isinstance(nombre, str):
        return jsonify({"error": "El nombre debe ser un texto."}), 400

    if descripcion is not None and not isinstance(descripcion, str):
        return jsonify({"error": "La descripción debe ser un texto."}), 400

    try:
        categoria = crear_categoria(nombre, descripcion)
        return jsonify({
            "mensaje": "Categoría registrada correctamente.",
            "categoria": categoria_a_dict(categoria)
        }), 201

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@categoria_bp.route("", methods=["GET"])
@jwt_required()
def obtener_categorias():
    nombre = request.args.get("nombre")

    if nombre:
        categorias = buscar_categorias(nombre)
    else:
        categorias = listar_categorias()

    return jsonify([
        categoria_a_dict(categoria)
        for categoria in categorias
    ]), 200


@categoria_bp.route("/<int:categoria_id>", methods=["GET"])
@jwt_required()
def consultar_categoria(categoria_id):
    categoria = obtener_categoria(categoria_id)

    if categoria is None:
        return jsonify({"error": "Categoría no encontrada."}), 404

    return jsonify(categoria_a_dict(categoria)), 200


@categoria_bp.route("/<int:categoria_id>", methods=["PATCH"])
@jwt_required()
def modificar_categoria(categoria_id):
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({"error": "Se requiere un objeto JSON válido."}), 400

    if not datos:
        return jsonify({"error": "Debe proporcionar al menos un campo."}), 400

    campos_permitidos = {"nombre", "descripcion"}

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({"error": "Se enviaron campos no permitidos."}), 400

    nombre = datos.get("nombre")
    descripcion = datos.get("descripcion")

    if nombre is not None and not isinstance(nombre, str):
        return jsonify({"error": "El nombre debe ser un texto."}), 400

    if descripcion is not None and not isinstance(descripcion, str):
        return jsonify({"error": "La descripción debe ser un texto."}), 400

    try:
        categoria = actualizar_categoria(
            categoria_id,
            nombre=nombre,
            descripcion=descripcion,
        )

        return jsonify({
            "mensaje": "Categoría actualizada correctamente.",
            "categoria": categoria_a_dict(categoria)
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), (
            404 if "no existe" in str(error).lower() else 400
        )


@categoria_bp.route("/<int:categoria_id>/desactivar", methods=["PATCH"])
@jwt_required()
def desactivar(categoria_id):
    try:
        categoria = desactivar_categoria(categoria_id)

        return jsonify({
            "mensaje": "Categoría desactivada correctamente.",
            "categoria": categoria_a_dict(categoria)
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 404


@categoria_bp.route("/<int:categoria_id>/activar", methods=["PATCH"])
@jwt_required()
def activar(categoria_id):
    try:
        categoria = activar_categoria(categoria_id)

        return jsonify({
            "mensaje": "Categoría activada correctamente.",
            "categoria": categoria_a_dict(categoria)
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 404