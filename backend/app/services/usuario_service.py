from sqlalchemy import select
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db
from app.models.personas import Usuario, Rol, Empleado


def crear_usuario(
    username: str,
    password: str,
    rol_id: int,
    email: str | None = None,
    empleado_id: int | None = None,
) -> Usuario:

    username = username.strip().lower()
    email = email.strip().lower() if email else None

    if not username:
        raise ValueError("El nombre de usuario es obligatorio.")

    if len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres.")

    existente = db.session.scalar(
        select(Usuario).where(
            Usuario.username.ilike(username)
        )
    )

    if existente:
        raise ValueError("El nombre de usuario ya está registrado.")

    if email:
        existente_email = db.session.scalar(
            select(Usuario).where(
                Usuario.email.ilike(email)
            )
        )

        if existente_email:
            raise ValueError("El correo electrónico ya está registrado.")

    rol = db.session.get(Rol, rol_id)

    if rol is None or not rol.estado:
        raise ValueError("El rol no existe o está inactivo.")

    if empleado_id is not None:
        empleado = db.session.get(Empleado, empleado_id)

        if empleado is None or not empleado.estado:
            raise ValueError("El empleado no existe o está inactivo.")

        usuario_existente = db.session.scalar(
            select(Usuario).where(
                Usuario.empleado_id == empleado_id
            )
        )

        if usuario_existente:
            raise ValueError("El empleado ya tiene un usuario asignado.")

    usuario = Usuario(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        rol_id=rol_id,
        empleado_id=empleado_id,
        estado=True,
    )

    try:
        db.session.add(usuario)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return usuario


def listar_usuarios() -> list[Usuario]:
    return db.session.scalars(
        select(Usuario).order_by(Usuario.username)
    ).all()


def obtener_usuario(usuario_id: int) -> Usuario | None:
    return db.session.get(Usuario, usuario_id)


def buscar_usuario(username: str) -> Usuario | None:
    username = username.strip()

    if not username:
        return None

    return db.session.scalar(
        select(Usuario).where(
            Usuario.username.ilike(username)
        )
    )


def verificar_credenciales(
    username: str,
    password: str,
) -> Usuario | None:

    usuario = buscar_usuario(username)

    if usuario is None or not usuario.estado:
        return None

    if not usuario.rol.estado:
        return None

    if not check_password_hash(usuario.password_hash, password):
        return None

    return usuario


def cambiar_contrasena(
    usuario_id: int,
    contrasena_actual: str,
    nueva_contrasena: str,
) -> Usuario:

    usuario = obtener_usuario(usuario_id)

    if usuario is None:
        raise ValueError("El usuario no existe.")

    if not check_password_hash(
        usuario.password_hash,
        contrasena_actual,
    ):
        raise ValueError("La contraseña actual es incorrecta.")

    if len(nueva_contrasena) < 8:
        raise ValueError("La nueva contraseña debe tener al menos 8 caracteres.")

    usuario.password_hash = generate_password_hash(nueva_contrasena)

    db.session.commit()
    return usuario


def actualizar_usuario(
    usuario_id: int,
    username: str | None = None,
    email: str | None = None,
    rol_id: int | None = None,
    empleado_id: int | None = None,
) -> Usuario:

    usuario = obtener_usuario(usuario_id)

    if usuario is None:
        raise ValueError("El usuario no existe.")

    if username is not None:
        username = username.strip().lower()

        if not username:
            raise ValueError("El nombre de usuario es obligatorio.")

        existente = db.session.scalar(
            select(Usuario).where(
                Usuario.username.ilike(username),
                Usuario.id != usuario_id,
            )
        )

        if existente:
            raise ValueError("El nombre de usuario ya está registrado.")

        usuario.username = username

    if email is not None:
        email = email.strip().lower() or None

        if email:
            existente = db.session.scalar(
                select(Usuario).where(
                    Usuario.email.ilike(email),
                    Usuario.id != usuario_id,
                )
            )

            if existente:
                raise ValueError("El correo electrónico ya está registrado.")

        usuario.email = email

    if rol_id is not None:
        rol = db.session.get(Rol, rol_id)

        if rol is None or not rol.estado:
            raise ValueError("El rol no existe o está inactivo.")

        usuario.rol_id = rol_id

    if empleado_id is not None:
        empleado = db.session.get(Empleado, empleado_id)

        if empleado is None or not empleado.estado:
            raise ValueError("El empleado no existe o está inactivo.")

        existente = db.session.scalar(
            select(Usuario).where(
                Usuario.empleado_id == empleado_id,
                Usuario.id != usuario_id,
            )
        )

        if existente:
            raise ValueError("El empleado ya tiene otro usuario asignado.")

        usuario.empleado_id = empleado_id

    db.session.commit()
    return usuario


def desactivar_usuario(usuario_id: int) -> Usuario:
    usuario = obtener_usuario(usuario_id)

    if usuario is None:
        raise ValueError("El usuario no existe.")

    usuario.estado = False
    db.session.commit()

    return usuario


def activar_usuario(usuario_id: int) -> Usuario:
    usuario = obtener_usuario(usuario_id)

    if usuario is None:
        raise ValueError("El usuario no existe.")

    if not usuario.rol.estado:
        raise ValueError("No se puede activar un usuario cuyo rol está inactivo.")

    usuario.estado = True
    db.session.commit()

    return usuario
