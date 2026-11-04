from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.persona_service import (
    crear_persona,
    listar_personas,
    obtener_persona,
    buscar_personas,
    actualizar_persona,
)


persona_bp = Blueprint(
    "personas",
    __name__,
    url_prefix="/api/personas"
)


def persona_a_dict(persona):
    return {
        "id": persona.id,
        "primer_nombre": persona.primer_nombre,
        "segundo_nombre": persona.segundo_nombre,
        "primer_apellido": persona.primer_apellido,
        "segundo_apellido": persona.segundo_apellido,
        "cedula": persona.cedula,
        "correo": persona.correo,
        "telefono": persona.telefono,
        "direccion": persona.direccion,
        "fecha_nacimiento": (
            persona.fecha_nacimiento.isoformat()
            if persona.fecha_nacimiento else None
        ),
    }


def convertir_fecha(valor, campo):
    if valor is None:
        return None

    if not isinstance(valor, str):
        raise ValueError(f"El campo {campo} debe tener formato YYYY-MM-DD.")

    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ValueError(
            f"El campo {campo} debe tener una fecha válida en formato YYYY-MM-DD."
        )


@persona_bp.route("", methods=["POST"])
@jwt_required()
def registrar_persona():
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({"error": "Se requiere un objeto JSON válido."}), 400

    campos_permitidos = {
        "primer_nombre",
        "segundo_nombre",
        "primer_apellido",
        "segundo_apellido",
        "cedula",
        "correo",
        "telefono",
        "direccion",
        "fecha_nacimiento",
    }

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({"error": "Se enviaron campos no permitidos."}), 400

    try:
        fecha_nacimiento = convertir_fecha(
            datos.get("fecha_nacimiento"),
            "fecha_nacimiento"
        )

        persona = crear_persona(
            primer_nombre=datos.get("primer_nombre"),
            segundo_nombre=datos.get("segundo_nombre"),
            primer_apellido=datos.get("primer_apellido"),
            segundo_apellido=datos.get("segundo_apellido"),
            cedula=datos.get("cedula"),
            correo=datos.get("correo"),
            telefono=datos.get("telefono"),
            direccion=datos.get("direccion"),
            fecha_nacimiento=fecha_nacimiento,
        )

        return jsonify({
            "mensaje": "Persona registrada correctamente.",
            "persona": persona_a_dict(persona)
        }), 201

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@persona_bp.route("", methods=["GET"])
@jwt_required()
def obtener_personas():
    termino = request.args.get("buscar")

    try:
        if termino:
            personas = buscar_personas(termino)
        else:
            personas = listar_personas()

        return jsonify([
            persona_a_dict(persona)
            for persona in personas
        ]), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@persona_bp.route("/<int:persona_id>", methods=["GET"])
@jwt_required()
def consultar_persona(persona_id):
    try:
        persona = obtener_persona(persona_id)
        return jsonify(persona_a_dict(persona)), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 404


@persona_bp.route("/<int:persona_id>", methods=["PATCH"])
@jwt_required()
def modificar_persona(persona_id):
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({"error": "Se requiere un objeto JSON válido."}), 400

    if not datos:
        return jsonify({"error": "Debe proporcionar al menos un campo."}), 400

    campos_permitidos = {
        "primer_nombre",
        "segundo_nombre",
        "primer_apellido",
        "segundo_apellido",
        "cedula",
        "correo",
        "telefono",
        "direccion",
        "fecha_nacimiento",
    }

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({"error": "Se enviaron campos no permitidos."}), 400

    try:
        if "fecha_nacimiento" in datos:
            datos["fecha_nacimiento"] = convertir_fecha(
                datos["fecha_nacimiento"],
                "fecha_nacimiento"
            )

        persona = actualizar_persona(
            persona_id,
            **datos
        )

        return jsonify({
            "mensaje": "Persona actualizada correctamente.",
            "persona": persona_a_dict(persona)
        }), 200

    except ValueError as error:
        mensaje = str(error)
        codigo = 404 if "no existe" in mensaje.lower() else 400

        return jsonify({"error": mensaje}), codigo