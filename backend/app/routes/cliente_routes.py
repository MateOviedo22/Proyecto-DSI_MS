
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.cliente_service import (
    crear_cliente,
    listar_clientes,
    obtener_cliente,
    obtener_cliente_por_identificacion,
    buscar_clientes,
    actualizar_cliente,
)


cliente_bp = Blueprint(
    "cliente",
    __name__,
    url_prefix="/api/clientes"
)


def serializar_cliente(cliente):
    return {
        "id": cliente.id,
        "nombre": cliente.nombre,
        "identificacion_fiscal": cliente.identificacion_fiscal,
        "telefono": cliente.telefono,
        "email": cliente.email,
        "direccion": cliente.direccion,
    }


@cliente_bp.route("/", methods=["POST"])
@jwt_required()
def crear():
    datos = request.get_json(silent=True) or {}

    try:
        cliente = crear_cliente(
            nombre=datos.get("nombre"),
            identificacion_fiscal=datos.get("identificacion_fiscal"),
            telefono=datos.get("telefono"),
            email=datos.get("email"),
            direccion=datos.get("direccion"),
        )

        return jsonify({
            "mensaje": "Cliente registrado correctamente.",
            "cliente": serializar_cliente(cliente),
        }), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@cliente_bp.route("/", methods=["GET"])
@jwt_required()
def listar():
    termino = request.args.get("buscar")

    try:
        if termino:
            clientes = buscar_clientes(termino)
        else:
            clientes = listar_clientes()

        return jsonify({
            "clientes": [
                serializar_cliente(cliente)
                for cliente in clientes
            ]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@cliente_bp.route("/<int:cliente_id>", methods=["GET"])
@jwt_required()
def obtener(cliente_id):
    try:
        cliente = obtener_cliente(cliente_id)

        return jsonify({
            "cliente": serializar_cliente(cliente)
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@cliente_bp.route("/identificacion", methods=["GET"])
@jwt_required()
def obtener_por_identificacion():
    identificacion = request.args.get("valor")

    try:
        cliente = obtener_cliente_por_identificacion(
            identificacion
        )

        if cliente is None:
            return jsonify({
                "error": "No se encontró un cliente con esa identificación."
            }), 404

        return jsonify({
            "cliente": serializar_cliente(cliente)
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@cliente_bp.route("/<int:cliente_id>", methods=["PATCH"])
@jwt_required()
def actualizar(cliente_id):
    datos = request.get_json(silent=True) or {}

    try:
        cliente = actualizar_cliente(
            cliente_id=cliente_id,
            nombre=datos.get("nombre"),
            identificacion_fiscal=datos.get("identificacion_fiscal"),
            telefono=datos.get("telefono"),
            email=datos.get("email"),
            direccion=datos.get("direccion"),
        )

        return jsonify({
            "mensaje": "Cliente actualizado correctamente.",
            "cliente": serializar_cliente(cliente),
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
