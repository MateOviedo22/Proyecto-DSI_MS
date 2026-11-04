from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Persona(db.Model):
    __tablename__ = "personas"

    id: Mapped[int] = mapped_column(primary_key=True)
    primer_nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    segundo_nombre: Mapped[str | None] = mapped_column(String(80), nullable=True)
    primer_apellido: Mapped[str] = mapped_column(String(80), nullable=False)
    segundo_apellido: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cedula: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    correo: Mapped[str | None] = mapped_column(String(254), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(30), nullable=True)
    direccion: Mapped[str | None] = mapped_column(Text, nullable=True)
    fecha_nacimiento: Mapped[date | None] = mapped_column(Date, nullable=True)

    empleado: Mapped["Empleado | None"] = relationship(back_populates="persona", uselist=False)

    @property
    def nombre_completo(self) -> str:
        return " ".join(
            parte for parte in (
                self.primer_nombre,
                self.segundo_nombre,
                self.primer_apellido,
                self.segundo_apellido,
            ) if parte
        )


class Empleado(db.Model):
    __tablename__ = "empleados"

    id: Mapped[int] = mapped_column(primary_key=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id", ondelete="RESTRICT"), nullable=False, unique=True)
    cargo: Mapped[str] = mapped_column(String(100), nullable=False)
    area_trabajo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fecha_ingreso: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    persona: Mapped["Persona"] = relationship(back_populates="empleado")
    usuario: Mapped["Usuario | None"] = relationship(back_populates="empleado", uselist=False)


class Rol(db.Model):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="rol")


class Usuario(db.Model):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    empleado_id: Mapped[int | None] = mapped_column(ForeignKey("empleados.id", ondelete="RESTRICT"), unique=True, nullable=True)
    rol_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    username: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ultimo_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    empleado: Mapped["Empleado | None"] = relationship(back_populates="usuario")
    rol: Mapped["Rol"] = relationship(back_populates="usuarios")

    precios_modificados: Mapped[list["PrecioProducto"]] = relationship(back_populates="usuario")
    compras_registradas: Mapped[list["Compra"]] = relationship(back_populates="usuario")
    recepciones_registradas: Mapped[list["RecepcionMercaderia"]] = relationship(back_populates="usuario")
    pedidos_registrados: Mapped[list["Pedido"]] = relationship(back_populates="usuario")
    ventas_registradas: Mapped[list["Venta"]] = relationship(back_populates="usuario")
    devoluciones_registradas: Mapped[list["Devolucion"]] = relationship(back_populates="usuario")
    movimientos_inventario: Mapped[list["MovimientoInventario"]] = relationship(back_populates="usuario")
    notificaciones: Mapped[list["Notificacion"]] = relationship(back_populates="usuario")
