
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.personas import Persona, Empleado


_SIN_CAMBIOS = object()


def validar_texto_obligatorio(valor, campo, longitud_maxima):
    """Valida un texto obligatorio."""

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
    """Valida un texto opcional."""

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


def validar_fecha_ingreso(fecha):
    """Valida la fecha de ingreso del empleado."""

    if not isinstance(fecha, date):
        raise ValueError("La fecha de ingreso no es válida.")

    return fecha


def obtener_empleado(empleado_id):
    """Obtiene un empleado por su identificador."""

    empleado = db.session.get(Empleado, empleado_id)

    if empleado is None:
        raise ValueError("El empleado solicitado no existe.")

    return empleado


def crear_empleado(
    persona_id,
    cargo,
    fecha_ingreso,
    area_trabajo=None,
):
    """Registra un empleado asociado a una persona existente."""

    if (
        isinstance(persona_id, bool)
        or not isinstance(persona_id, int)
        or persona_id <= 0
    ):
        raise ValueError("El identificador de persona no es válido.")

    persona = db.session.get(Persona, persona_id)

    if persona is None:
        raise ValueError("No existe la persona que intentas asociar.")

    empleado_existente = db.session.scalar(
        select(Empleado.id).where(
            Empleado.persona_id == persona_id
        )
    )

    if empleado_existente is not None:
        raise ValueError("Esta persona ya está registrada como empleada.")

    cargo = validar_texto_obligatorio(cargo, "cargo", 100)

    area_trabajo = validar_texto_opcional(
        area_trabajo, "área de trabajo", 100
    )

    fecha_ingreso = validar_fecha_ingreso(fecha_ingreso)

    empleado = Empleado(
        persona_id=persona_id,
        cargo=cargo,
        area_trabajo=area_trabajo,
        fecha_ingreso=fecha_ingreso,
        estado=True,
    )

    try:
        db.session.add(empleado)
        db.session.commit()
        db.session.refresh(empleado)

    except IntegrityError:
        db.session.rollback()
        raise ValueError(
            "No se pudo registrar el empleado. "
            "Verifica que la persona no esté asociada a otro empleado."
        )

    return empleado


def listar_empleados(solo_activos=False):
    """Lista los empleados registrados."""

    consulta = select(Empleado).order_by(Empleado.id)

    if solo_activos:
        consulta = consulta.where(Empleado.estado.is_(True))

    return db.session.scalars(consulta).all()


def buscar_empleados(termino, solo_activos=False):
    """Busca empleados por datos personales o laborales."""

    if not isinstance(termino, str) or not termino.strip():
        raise ValueError("Debes proporcionar un término de búsqueda.")

    termino = termino.strip()
    patron = f"%{termino}%"

    consulta = (
        select(Empleado)
        .join(Empleado.persona)
        .where(
            or_(
                Empleado.cargo.ilike(patron),
                Empleado.area_trabajo.ilike(patron),
                Persona.primer_nombre.ilike(patron),
                Persona.segundo_nombre.ilike(patron),
                Persona.primer_apellido.ilike(patron),
                Persona.segundo_apellido.ilike(patron),
                Persona.cedula.ilike(patron),
            )
        )
        .order_by(Empleado.id)
    )

    if solo_activos:
        consulta = consulta.where(Empleado.estado.is_(True))

    return db.session.scalars(consulta).unique().all()


def actualizar_empleado(
    empleado_id,
    cargo=_SIN_CAMBIOS,
    area_trabajo=_SIN_CAMBIOS,
    fecha_ingreso=_SIN_CAMBIOS,
):
    """Actualiza los datos laborales de un empleado."""

    empleado = obtener_empleado(empleado_id)

    if cargo is not _SIN_CAMBIOS:
        empleado.cargo = validar_texto_obligatorio(
            cargo, "cargo", 100
        )

    if area_trabajo is not _SIN_CAMBIOS:
        empleado.area_trabajo = validar_texto_opcional(
            area_trabajo, "área de trabajo", 100
        )

    if fecha_ingreso is not _SIN_CAMBIOS:
        empleado.fecha_ingreso = validar_fecha_ingreso(fecha_ingreso)

    try:
        db.session.commit()
        db.session.refresh(empleado)

    except Exception:
        db.session.rollback()
        raise

    return empleado


def desactivar_empleado(empleado_id):
    """Desactiva un empleado."""

    empleado = obtener_empleado(empleado_id)

    # No dejamos un usuario activo vinculado a un empleado inactivo.
    if empleado.usuario is not None and empleado.usuario.estado:
        raise ValueError(
            "Primero debes desactivar la cuenta del usuario asociado."
        )

    empleado.estado = False

    try:
        db.session.commit()
        db.session.refresh(empleado)

    except Exception:
        db.session.rollback()
        raise

    return empleado


def activar_empleado(empleado_id):
    """Activa nuevamente un empleado."""

    empleado = obtener_empleado(empleado_id)

    empleado.estado = True

    try:
        db.session.commit()
        db.session.refresh(empleado)

    except Exception:
        db.session.rollback()
        raise

    return empleado
