from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.ventas import Cliente


def validar_texto_obligatorio(valor, campo, longitud_maxima):
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


def obtener_cliente(cliente_id):
    cliente = db.session.get(Cliente, cliente_id)

    if cliente is None:
        raise ValueError("El cliente solicitado no existe.")

    return cliente


def validar_identificacion_unica(identificacion, cliente_id=None):
    if identificacion is None:
        return

    consulta = select(Cliente.id).where(
        func.lower(Cliente.identificacion_fiscal)
        == identificacion.lower()
    )

    if cliente_id is not None:
        consulta = consulta.where(Cliente.id != cliente_id)

    if db.session.scalar(consulta) is not None:
        raise ValueError(
            "Ya existe un cliente con esa identificación fiscal."
        )


def crear_cliente(
    nombre,
    identificacion_fiscal=None,
    telefono=None,
    email=None,
    direccion=None,
):
    nombre = validar_texto_obligatorio(nombre, "nombre", 160)

    identificacion_fiscal = validar_texto_opcional(
        identificacion_fiscal, "identificación fiscal", 50
    )

    telefono = validar_texto_opcional(telefono, "teléfono", 30)
    email = validar_texto_opcional(email, "correo", 254)
    direccion = validar_texto_opcional(direccion, "dirección", 10000)

    if email:
        email = email.lower()

    validar_identificacion_unica(identificacion_fiscal)

    cliente = Cliente(
        nombre=nombre,
        identificacion_fiscal=identificacion_fiscal,
        telefono=telefono,
        email=email,
        direccion=direccion,
    )

    try:
        db.session.add(cliente)
        db.session.commit()
        db.session.refresh(cliente)

    except IntegrityError:
        db.session.rollback()
        raise ValueError(
            "No se pudo registrar el cliente. "
            "Verifica que la identificación fiscal no esté duplicada."
        )

    return cliente


def listar_clientes():
    consulta = select(Cliente).order_by(Cliente.nombre)

    return db.session.scalars(consulta).all()


def obtener_cliente_por_identificacion(identificacion_fiscal):
    if not isinstance(identificacion_fiscal, str):
        raise ValueError("La identificación fiscal no es válida.")

    identificacion_fiscal = identificacion_fiscal.strip()

    if not identificacion_fiscal:
        raise ValueError("Debes proporcionar una identificación fiscal.")

    return db.session.scalar(
        select(Cliente).where(
            func.lower(Cliente.identificacion_fiscal)
            == identificacion_fiscal.lower()
        )
    )


def buscar_clientes(termino):
    if not isinstance(termino, str) or not termino.strip():
        raise ValueError("Debes proporcionar un término de búsqueda.")

    patron = f"%{termino.strip()}%"

    consulta = select(Cliente).where(
        or_(
            Cliente.nombre.ilike(patron),
            Cliente.identificacion_fiscal.ilike(patron),
            Cliente.telefono.ilike(patron),
            Cliente.email.ilike(patron),
        )
    ).order_by(Cliente.nombre)

    return db.session.scalars(consulta).all()


def actualizar_cliente(
    cliente_id,
    nombre=None,
    identificacion_fiscal=None,
    telefono=None,
    email=None,
    direccion=None,
):
    cliente = obtener_cliente(cliente_id)

    if nombre is not None:
        cliente.nombre = validar_texto_obligatorio(
            nombre, "nombre", 160
        )

    if identificacion_fiscal is not None:
        identificacion_fiscal = validar_texto_opcional(
            identificacion_fiscal, "identificación fiscal", 50
        )

        validar_identificacion_unica(
            identificacion_fiscal, cliente_id
        )

        cliente.identificacion_fiscal = identificacion_fiscal

    if telefono is not None:
        cliente.telefono = validar_texto_opcional(
            telefono, "teléfono", 30
        )

    if email is not None:
        email = validar_texto_opcional(email, "correo", 254)
        cliente.email = email.lower() if email else None

    if direccion is not None:
        cliente.direccion = validar_texto_opcional(
            direccion, "dirección", 10000
        )

    try:
        db.session.commit()
        db.session.refresh(cliente)

    except Exception:
        db.session.rollback()
        raise

    return cliente
