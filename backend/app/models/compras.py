from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Proveedor(db.Model):
    __tablename__ = "proveedores"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    contacto_nombre: Mapped[str | None] = mapped_column(String(120), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    direccion: Mapped[str | None] = mapped_column(Text, nullable=True)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    compras: Mapped[list["Compra"]] = relationship(back_populates="proveedor")
    productos_asociados: Mapped[list["ProductoProveedor"]] = relationship(back_populates="proveedor")


class Compra(db.Model):
    __tablename__ = "compras"

    __table_args__ = (
        CheckConstraint("subtotal >= 0 AND total >= 0", name="ck_compra_importes_no_negativos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    proveedor_id: Mapped[int] = mapped_column(ForeignKey("proveedores.id", ondelete="RESTRICT"), nullable=False)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    numero_referencia: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    fecha_pedido: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="BORRADOR", index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    proveedor: Mapped["Proveedor"] = relationship(back_populates="compras")
    usuario: Mapped["Usuario"] = relationship(back_populates="compras_registradas")
    detalles: Mapped[list["DetalleCompra"]] = relationship(back_populates="compra", cascade="all, delete-orphan")
    recepciones: Mapped[list["RecepcionMercaderia"]] = relationship(back_populates="compra")


class DetalleCompra(db.Model):
    __tablename__ = "detalles_compra"

    __table_args__ = (
        CheckConstraint("cantidad_solicitada > 0", name="ck_detalle_compra_cantidad_positiva"),
        CheckConstraint("costo_unitario >= 0 AND descuento >= 0 AND subtotal >= 0", name="ck_detalle_compra_importes_no_negativos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    compra_id: Mapped[int] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    cantidad_solicitada: Mapped[int] = mapped_column(Integer, nullable=False)
    costo_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    descuento: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    compra: Mapped["Compra"] = relationship(back_populates="detalles")
    producto: Mapped["Producto"] = relationship(back_populates="detalles_compra")
    recepciones_detalle: Mapped[list["DetalleRecepcion"]] = relationship(back_populates="detalle_compra")


class RecepcionMercaderia(db.Model):
    __tablename__ = "recepciones_mercaderia"

    id: Mapped[int] = mapped_column(primary_key=True)
    compra_id: Mapped[int] = mapped_column(ForeignKey("compras.id", ondelete="RESTRICT"), nullable=False, index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    fecha_recepcion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="EN_REVISION")
    costo_envio: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    compra: Mapped["Compra"] = relationship(back_populates="recepciones")
    usuario: Mapped["Usuario"] = relationship(back_populates="recepciones_registradas")
    detalles: Mapped[list["DetalleRecepcion"]] = relationship(back_populates="recepcion", cascade="all, delete-orphan")


class DetalleRecepcion(db.Model):
    __tablename__ = "detalles_recepcion"

    __table_args__ = (
        CheckConstraint("cantidad_recibida >= 0", name="ck_recepcion_recibida_no_negativa"),
        CheckConstraint("cantidad_aceptada >= 0", name="ck_recepcion_aceptada_no_negativa"),
        CheckConstraint("cantidad_rechazada >= 0", name="ck_recepcion_rechazada_no_negativa"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    recepcion_id: Mapped[int] = mapped_column(ForeignKey("recepciones_mercaderia.id", ondelete="CASCADE"), nullable=False)
    detalle_compra_id: Mapped[int] = mapped_column(ForeignKey("detalles_compra.id", ondelete="RESTRICT"), nullable=False)
    cantidad_recibida: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cantidad_aceptada: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cantidad_rechazada: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    resultado_revision: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDIENTE")
    motivo_rechazo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    recepcion: Mapped["RecepcionMercaderia"] = relationship(back_populates="detalles")
    detalle_compra: Mapped["DetalleCompra"] = relationship(back_populates="recepciones_detalle")
    lotes: Mapped[list["Lote"]] = relationship(back_populates="detalle_recepcion")
    movimientos_inventario: Mapped[list["MovimientoInventario"]] = relationship(back_populates="detalle_recepcion")


class Lote(db.Model):
    """Lote de un producto recibido. El producto se obtiene por DetalleRecepcion -> DetalleCompra."""

    __tablename__ = "lotes"

    __table_args__ = (
        CheckConstraint("cantidad_inicial > 0", name="ck_lote_cantidad_inicial_positiva"),
        CheckConstraint("costo_unitario_adquisicion >= 0 AND costo_envio_unitario >= 0 AND costo_unitario_total >= 0", name="ck_lote_costos_no_negativos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    detalle_recepcion_id: Mapped[int] = mapped_column(ForeignKey("detalles_recepcion.id", ondelete="RESTRICT"), nullable=False, index=True)
    codigo_lote_proveedor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Cantidad histórica recibida en este lote; no es el stock disponible actual.
    cantidad_inicial: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_recepcion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    costo_unitario_adquisicion: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    costo_envio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    costo_unitario_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    detalle_recepcion: Mapped["DetalleRecepcion"] = relationship(back_populates="lotes")
    movimientos: Mapped[list["MovimientoInventario"]] = relationship(back_populates="lote")
    unidades_serializadas: Mapped[list["UnidadSerializada"]] = relationship(back_populates="lote")