
from datetime import date

from flask import Blueprint, jsonify, request

from app.services.empleado_service import (
    crear_empleado,
    listar_empleados,
    obtener_empleado,
    buscar_empleados,
    actualizar_empleado,
    activar_empleado,
    desactivar_empleado,
)


empleado_bp = Blueprint(
    "empleados",
    __name__,
    url_prefix="/api/empleados"
)


def empleado_a_dict(empleado):
    persona = empleado.persona

    return {
        "id": empleado.id,
        "persona_id": empleado.persona_id,
        "cargo": empleado.cargo,
        "area_trabajo": empleado.area_trabajo,
        "fecha_ingreso": (
            empleado.fecha_ingreso.isoformat()
            if empleado.fecha_ingreso else None
        ),
        "estado": empleado.estado,
        "persona": {
            "primer_nombre": persona.primer_nombre,
            "segundo_nombre": persona.segundo_nombre,
            "primer_apellido": persona.primer_apellido,
            "segundo_apellido": persona.segundo_apellido,
            "cedula": persona.cedula,
            "correo": persona.correo,
            "telefono": persona.telefono,
        } if persona else None,
    }


def convertir_fecha(valor):
    if not isinstance(valor, str):
        raise ValueError("La fecha de ingreso debe tener formato YYYY-MM-DD.")

    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ValueError(
            "La fecha de ingreso debe ser válida y tener formato YYYY-MM-DD."
        )


@empleado_bp.route("", methods=["POST"])
def registrar_empleado():
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({"error": "Se requiere un objeto JSON válido."}), 400

    campos_permitidos = {
        "persona_id",
        "cargo",
        "fecha_ingreso",
        "area_trabajo",
    }

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({"error": "Se enviaron campos no permitidos."}), 400

    persona_id = datos.get("persona_id")

    if isinstance(persona_id, bool) or not isinstance(persona_id, int):
        return jsonify({"error": "El persona_id debe ser un entero."}), 400

    try:
        fecha_ingreso = convertir_fecha(datos.get("fecha_ingreso"))

        empleado = crear_empleado(
            persona_id=persona_id,
            cargo=datos.get("cargo"),
            fecha_ingreso=fecha_ingreso,
            area_trabajo=datos.get("area_trabajo"),
        )

        return jsonify({
            "mensaje": "Empleado registrado correctamente.",
            "empleado": empleado_a_dict(empleado)
        }), 201

    except ValueError as error:
        mensaje = str(error)
        codigo = 404 if "no existe" in mensaje.lower() else 400

        return jsonify({"error": mensaje}), codigo


@empleado_bp.route("", methods=["GET"])
def obtener_empleados():
    termino = request.args.get("buscar")
    solo_activos_param = request.args.get("solo_activos", "false").lower()

    if solo_activos_param not in {"true", "false"}:
        return jsonify({
            "error": "El parámetro solo_activos debe ser true o false."
        }), 400

    solo_activos = solo_activos_param == "true"

    try:
        if termino:
            empleados = buscar_empleados(
                termino,
                solo_activos=solo_activos
            )
        else:
            empleados = listar_empleados(
                solo_activos=solo_activos
            )

        return jsonify([
            empleado_a_dict(empleado)
            for empleado in empleados
        ]), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@empleado_bp.route("/<int:empleado_id>", methods=["GET"])
def consultar_empleado(empleado_id):
    try:
        empleado = obtener_empleado(empleado_id)
        return jsonify(empleado_a_dict(empleado)), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 404


@empleado_bp.route("/<int:empleado_id>", methods=["PATCH"])
def modificar_empleado(empleado_id):
    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({"error": "Se requiere un objeto JSON válido."}), 400

    if not datos:
        return jsonify({"error": "Debe proporcionar al menos un campo."}), 400

    campos_permitidos = {
        "cargo",
        "area_trabajo",
        "fecha_ingreso",
    }

    if not set(datos.keys()).issubset(campos_permitidos):
        return jsonify({"error": "Se enviaron campos no permitidos."}), 400

    try:
        if "fecha_ingreso" in datos:
            datos["fecha_ingreso"] = convertir_fecha(
                datos["fecha_ingreso"]
            )

        empleado = actualizar_empleado(
            empleado_id,
            **datos
        )

        return jsonify({
            "mensaje": "Empleado actualizado correctamente.",
            "empleado": empleado_a_dict(empleado)
        }), 200

    except ValueError as error:
        mensaje = str(error)
        codigo = 404 if "no existe" in mensaje.lower() else 400

        return jsonify({"error": mensaje}), codigo


@empleado_bp.route("/<int:empleado_id>/desactivar", methods=["PATCH"])
def desactivar(empleado_id):
    try:
        empleado = desactivar_empleado(empleado_id)

        return jsonify({
            "mensaje": "Empleado desactivado correctamente.",
            "empleado": empleado_a_dict(empleado)
        }), 200

    except ValueError as error:
        mensaje = str(error)
        codigo = 404 if "no existe" in mensaje.lower() else 400

        return jsonify({"error": mensaje}), codigo


@empleado_bp.route("/<int:empleado_id>/activar", methods=["PATCH"])
def activar(empleado_id):
    try:
        empleado = activar_empleado(empleado_id)

        return jsonify({
            "mensaje": "Empleado activado correctamente.",
            "empleado": empleado_a_dict(empleado)
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 404
