
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.modelo_service import (
    crear_modelo,
    listar_modelos,
    obtener_modelo,
    buscar_modelos,
    listar_modelos_por_marca,
    actualizar_modelo,
    desactivar_modelo,
    activar_modelo,
)

modelo_bp = Blueprint("modelo", __name__, url_prefix="/api/modelos")


def serializar_modelo(modelo):
    return {
        "id": modelo.id,
        "marca_id": modelo.marca_id,
        "nombre": modelo.nombre,
        "descripcion": modelo.descripcion,
        "estado": modelo.estado,
    }


# CREAR MODELO
@modelo_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    marca_id = datos.get("marca_id")
    nombre = datos.get("nombre")
    descripcion = datos.get("descripcion")

    if isinstance(marca_id, bool) or not isinstance(marca_id, int):
        return jsonify({"error": "Debe proporcionar un ID de marca válido."}), 400

    if not isinstance(nombre, str):
        return jsonify({"error": "El nombre del modelo es obligatorio."}), 400

    if descripcion is not None and not isinstance(descripcion, str):
        return jsonify({"error": "La descripción debe ser un texto."}), 400

    try:
        modelo = crear_modelo(
            marca_id=marca_id,
            nombre=nombre,
            descripcion=descripcion,
        )

        return jsonify({
            "mensaje": "Modelo creado correctamente.",
            "modelo": serializar_modelo(modelo),
        }), 201

    except ValueError as e:
        codigo = 404 if "no existe" in str(e).lower() else 400
        return jsonify({"error": str(e)}), codigo


# LISTAR Y BUSCAR MODELOS
@modelo_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    termino = request.args.get("buscar")
    modelos = buscar_modelos(termino) if termino else listar_modelos()

    return jsonify([
        serializar_modelo(modelo) for modelo in modelos
    ]), 200


# LISTAR MODELOS POR MARCA
@modelo_bp.route("/marca/<int:marca_id>", methods=["GET"])
@jwt_required()
def listar_por_marca(marca_id):
    try:
        modelos = listar_modelos_por_marca(marca_id)

        return jsonify([
            serializar_modelo(modelo) for modelo in modelos
        ]), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# OBTENER MODELO POR ID
@modelo_bp.route("/<int:modelo_id>", methods=["GET"])
@jwt_required()
def obtener(modelo_id):
    modelo = obtener_modelo(modelo_id)

    if modelo is None:
        return jsonify({"error": "El modelo no existe."}), 404

    return jsonify(serializar_modelo(modelo)), 200


# ACTUALIZAR MODELO
@modelo_bp.route("/<int:modelo_id>", methods=["PATCH"])
@jwt_required()
def actualizar(modelo_id):
    datos = request.get_json(silent=True) or {}

    campos_permitidos = {"nombre", "descripcion"}

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({"error": "Se recibieron campos no permitidos."}), 400

    if "nombre" in datos and datos["nombre"] is not None:
        if not isinstance(datos["nombre"], str):
            return jsonify({"error": "El nombre debe ser un texto."}), 400

    if "descripcion" in datos and datos["descripcion"] is not None:
        if not isinstance(datos["descripcion"], str):
            return jsonify({"error": "La descripción debe ser un texto."}), 400

    try:
        modelo = actualizar_modelo(
            modelo_id=modelo_id,
            nombre=datos.get("nombre"),
            descripcion=datos.get("descripcion"),
        )

        return jsonify({
            "mensaje": "Modelo actualizado correctamente.",
            "modelo": serializar_modelo(modelo),
        }), 200

    except ValueError as e:
        codigo = 404 if "no existe" in str(e).lower() else 400
        return jsonify({"error": str(e)}), codigo


# DESACTIVAR MODELO
@modelo_bp.route("/<int:modelo_id>/desactivar", methods=["PATCH"])
@jwt_required()
def desactivar(modelo_id):
    try:
        modelo = desactivar_modelo(modelo_id)

        return jsonify({
            "mensaje": "Modelo desactivado correctamente.",
            "modelo": serializar_modelo(modelo),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ACTIVAR MODELO
@modelo_bp.route("/<int:modelo_id>/activar", methods=["PATCH"])
@jwt_required()
def activar(modelo_id):
    try:
        modelo = activar_modelo(modelo_id)

        return jsonify({
            "mensaje": "Modelo activado correctamente.",
            "modelo": serializar_modelo(modelo),
        }), 200

    except ValueError as e:
        mensaje = str(e).lower()
        codigo = 404 if "no existe" in mensaje else 400
        return jsonify({"error": str(e)}), codigo
