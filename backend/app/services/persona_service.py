
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.personas import Persona


# Permite diferenciar entre un campo que no se quiere modificar
# y uno que se quiere limpiar asignándole None.
_SIN_CAMBIOS = object()


def validar_texto_obligatorio(valor, campo, longitud_maxima):
    """Valida y normaliza un texto obligatorio."""

    if not isinstance(valor, str):
        raise ValueError(f"El campo {campo} debe ser texto.")

    valor = valor.strip()

    if not valor:
        raise ValueError(f"El campo {campo} es obligatorio.")

    if len(valor) > longitud_maxima:
        raise ValueError(
            f"El campo {campo} no puede superar "
            f"{longitud_maxima} caracteres."
        )

    return valor


def validar_texto_opcional(valor, campo, longitud_maxima):
    """Valida un texto opcional. Una cadena vacía se convierte en None."""

    if valor is None:
        return None

    if not isinstance(valor, str):
        raise ValueError(f"El campo {campo} debe ser texto.")

    valor = valor.strip()

    if not valor:
        return None

    if len(valor) > longitud_maxima:
        raise ValueError(
            f"El campo {campo} no puede superar "
            f"{longitud_maxima} caracteres."
        )

    return valor


def validar_fecha_nacimiento(fecha):
    """Valida que la fecha de nacimiento sea válida y no futura."""

    if fecha is None:
        return None

    if not isinstance(fecha, date):
        raise ValueError("La fecha de nacimiento no es válida.")

    if fecha > date.today():
        raise ValueError("La fecha de nacimiento no puede ser futura.")

    return fecha


def validar_cedula_unica(cedula, persona_id=None):
    """Comprueba que la cédula no esté registrada en otra persona."""

    if cedula is None:
        return

    consulta = select(Persona.id).where(
        func.lower(Persona.cedula) == cedula.lower()
    )

    if persona_id is not None:
        consulta = consulta.where(Persona.id != persona_id)

    if db.session.scalar(consulta) is not None:
        raise ValueError("Ya existe una persona registrada con esa cédula.")


def crear_persona(
    primer_nombre,
    primer_apellido,
    segundo_nombre=None,
    segundo_apellido=None,
    cedula=None,
    correo=None,
    telefono=None,
    direccion=None,
    fecha_nacimiento=None,
):
    """Registra una nueva persona."""

    primer_nombre = validar_texto_obligatorio(
        primer_nombre, "primer nombre", 80
    )
    primer_apellido = validar_texto_obligatorio(
        primer_apellido, "primer apellido", 80
    )

    segundo_nombre = validar_texto_opcional(
        segundo_nombre, "segundo nombre", 80
    )
    segundo_apellido = validar_texto_opcional(
        segundo_apellido, "segundo apellido", 80
    )
    cedula = validar_texto_opcional(cedula, "cédula", 30)
    correo = validar_texto_opcional(correo, "correo", 254)
    telefono = validar_texto_opcional(telefono, "teléfono", 30)
    direccion = validar_texto_opcional(direccion, "dirección", 500)

    if correo:
        correo = correo.lower()

    fecha_nacimiento = validar_fecha_nacimiento(fecha_nacimiento)

    validar_cedula_unica(cedula)

    persona = Persona(
        primer_nombre=primer_nombre,
        segundo_nombre=segundo_nombre,
        primer_apellido=primer_apellido,
        segundo_apellido=segundo_apellido,
        cedula=cedula,
        correo=correo,
        telefono=telefono,
        direccion=direccion,
        fecha_nacimiento=fecha_nacimiento,
    )

    try:
        db.session.add(persona)
        db.session.commit()
        db.session.refresh(persona)

    except IntegrityError:
        db.session.rollback()
        raise ValueError(
            "No se pudo registrar la persona. "
            "Verifica que sus datos únicos no estén duplicados."
        )

    return persona


def listar_personas():
    """Obtiene todas las personas registradas."""

    consulta = select(Persona).order_by(
        Persona.primer_apellido,
        Persona.primer_nombre
    )

    return db.session.scalars(consulta).all()


def obtener_persona(persona_id):
    """Obtiene una persona por su identificador."""

    persona = db.session.get(Persona, persona_id)

    if persona is None:
        raise ValueError("La persona solicitada no existe.")

    return persona


def buscar_personas(termino):
    """Busca personas por nombre, apellido, cédula, correo o teléfono."""

    if not isinstance(termino, str) or not termino.strip():
        raise ValueError("Debes proporcionar un término de búsqueda.")

    termino = termino.strip()
    patron = f"%{termino}%"

    consulta = select(Persona).where(
        or_(
            Persona.primer_nombre.ilike(patron),
            Persona.segundo_nombre.ilike(patron),
            Persona.primer_apellido.ilike(patron),
            Persona.segundo_apellido.ilike(patron),
            Persona.cedula.ilike(patron),
            Persona.correo.ilike(patron),
            Persona.telefono.ilike(patron),
        )
    ).order_by(Persona.primer_apellido, Persona.primer_nombre)

    return db.session.scalars(consulta).all()


def actualizar_persona(
    persona_id,
    primer_nombre=_SIN_CAMBIOS,
    segundo_nombre=_SIN_CAMBIOS,
    primer_apellido=_SIN_CAMBIOS,
    segundo_apellido=_SIN_CAMBIOS,
    cedula=_SIN_CAMBIOS,
    correo=_SIN_CAMBIOS,
    telefono=_SIN_CAMBIOS,
    direccion=_SIN_CAMBIOS,
    fecha_nacimiento=_SIN_CAMBIOS,
):
    """Actualiza los datos de una persona."""

    persona = obtener_persona(persona_id)

    if primer_nombre is not _SIN_CAMBIOS:
        persona.primer_nombre = validar_texto_obligatorio(
            primer_nombre, "primer nombre", 80
        )

    if segundo_nombre is not _SIN_CAMBIOS:
        persona.segundo_nombre = validar_texto_opcional(
            segundo_nombre, "segundo nombre", 80
        )

    if primer_apellido is not _SIN_CAMBIOS:
        persona.primer_apellido = validar_texto_obligatorio(
            primer_apellido, "primer apellido", 80
        )

    if segundo_apellido is not _SIN_CAMBIOS:
        persona.segundo_apellido = validar_texto_opcional(
            segundo_apellido, "segundo apellido", 80
        )

    if cedula is not _SIN_CAMBIOS:
        cedula = validar_texto_opcional(cedula, "cédula", 30)
        validar_cedula_unica(cedula, persona_id)
        persona.cedula = cedula

    if correo is not _SIN_CAMBIOS:
        correo = validar_texto_opcional(correo, "correo", 254)
        persona.correo = correo.lower() if correo else None

    if telefono is not _SIN_CAMBIOS:
        persona.telefono = validar_texto_opcional(
            telefono, "teléfono", 30
        )

    if direccion is not _SIN_CAMBIOS:
        persona.direccion = validar_texto_opcional(
            direccion, "dirección", 500
        )

    if fecha_nacimiento is not _SIN_CAMBIOS:
        persona.fecha_nacimiento = validar_fecha_nacimiento(
            fecha_nacimiento
        )

    try:
        db.session.commit()
        db.session.refresh(persona)

    except Exception:
        db.session.rollback()
        raise

    return persona
