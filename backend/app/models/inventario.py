
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Existencia(db.Model):
    __tablename__ = "existencias"

    __table_args__ = (
        CheckConstraint("cantidad_actual >= 0", name="ck_existencia_cantidad_no_negativa"),
        CheckConstraint("umbral_minimo >= 0 AND stock_respaldo >= 0", name="ck_existencia_niveles_no_negativos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False, unique=True)
    cantidad_actual: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    umbral_minimo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stock_respaldo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fecha_ultima_actualizacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    producto: Mapped["Producto"] = relationship(back_populates="existencia")


class MovimientoInventario(db.Model):
    __tablename__ = "movimientos_inventario"

    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_movimiento_cantidad_positiva"),
        CheckConstraint("costo_unitario_aplicado IS NULL OR costo_unitario_aplicado >= 0", name="ck_movimiento_costo_no_negativo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False, index=True)
    lote_id: Mapped[int | None] = mapped_column(ForeignKey("lotes.id", ondelete="RESTRICT"), nullable=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    detalle_recepcion_id: Mapped[int | None] = mapped_column(ForeignKey("detalles_recepcion.id", ondelete="RESTRICT"), nullable=True)
    detalle_venta_id: Mapped[int | None] = mapped_column(ForeignKey("detalles_venta.id", ondelete="RESTRICT"), nullable=True)
    detalle_devolucion_id: Mapped[int | None] = mapped_column(ForeignKey("detalles_devolucion.id", ondelete="RESTRICT"), nullable=True)
    tipo_movimiento: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # La cantidad siempre es positiva; tipo_movimiento define si suma o resta.
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_movimiento: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    motivo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    costo_unitario_aplicado: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    producto: Mapped["Producto"] = relationship(back_populates="movimientos_inventario")
    lote: Mapped["Lote | None"] = relationship(back_populates="movimientos")
    usuario: Mapped["Usuario"] = relationship(back_populates="movimientos_inventario")
    detalle_recepcion: Mapped["DetalleRecepcion | None"] = relationship(back_populates="movimientos_inventario")
    detalle_venta: Mapped["DetalleVenta | None"] = relationship(back_populates="movimientos_inventario")
    detalle_devolucion: Mapped["DetalleDevolucion | None"] = relationship(back_populates="movimientos_inventario")


class Notificacion(db.Model):
    __tablename__ = "notificaciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    producto_id: Mapped[int | None] = mapped_column(ForeignKey("productos.id", ondelete="SET NULL"), nullable=True)
    tipo: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    prioridad: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIA")
    mensaje: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fecha_lectura: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    usuario: Mapped["Usuario"] = relationship(back_populates="notificaciones")
    producto: Mapped["Producto | None"] = relationship(back_populates="notificaciones")