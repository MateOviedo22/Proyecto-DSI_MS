from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, JSON, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Cliente(db.Model):
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    identificacion_fiscal: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    direccion: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    pedidos: Mapped[list["Pedido"]] = relationship(back_populates="cliente")
    ventas: Mapped[list["Venta"]] = relationship(back_populates="cliente")


class Pedido(db.Model):
    __tablename__ = "pedidos"

    id: Mapped[int] = mapped_column(primary_key=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id", ondelete="RESTRICT"), nullable=False)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    canal: Mapped[str] = mapped_column(String(20), nullable=False, default="ONLINE")
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDIENTE", index=True)
    direccion_entrega: Mapped[str | None] = mapped_column(String(255), nullable=True)
    costo_delivery: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    cliente: Mapped["Cliente"] = relationship(back_populates="pedidos")
    usuario: Mapped["Usuario | None"] = relationship(back_populates="pedidos_registrados")
    detalles: Mapped[list["DetallePedido"]] = relationship(back_populates="pedido", cascade="all, delete-orphan")
    venta: Mapped["Venta | None"] = relationship(back_populates="pedido", uselist=False)


class DetallePedido(db.Model):
    __tablename__ = "detalles_pedido"

    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_detalle_pedido_cantidad_positiva"),
        CheckConstraint("precio_unitario_acordado IS NULL OR precio_unitario_acordado >= 0", name="ck_detalle_pedido_precio_no_negativo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    pedido_id: Mapped[int] = mapped_column(ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_unitario_acordado: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    pedido: Mapped["Pedido"] = relationship(back_populates="detalles")
    producto: Mapped["Producto"] = relationship(back_populates="detalles_pedido")


class Venta(db.Model):
    __tablename__ = "ventas"

    __table_args__ = (
        CheckConstraint("subtotal >= 0 AND descuento_total >= 0 AND impuesto_total >= 0 AND total >= 0", name="ck_venta_importes_no_negativos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    numero_venta: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("clientes.id", ondelete="RESTRICT"), nullable=True)
    pedido_id: Mapped[int | None] = mapped_column(ForeignKey("pedidos.id", ondelete="RESTRICT"), unique=True, nullable=True)
    fecha_venta: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    canal: Mapped[str] = mapped_column(String(20), nullable=False, default="PISO")
    metodo_pago: Mapped[str] = mapped_column(String(30), nullable=False)
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="BORRADOR", index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    descuento_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    impuesto_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    usuario: Mapped["Usuario"] = relationship(back_populates="ventas_registradas")
    cliente: Mapped["Cliente | None"] = relationship(back_populates="ventas")
    pedido: Mapped["Pedido | None"] = relationship(back_populates="venta")
    detalles: Mapped[list["DetalleVenta"]] = relationship(back_populates="venta", cascade="all, delete-orphan")
    factura: Mapped["Factura | None"] = relationship(back_populates="venta", uselist=False)
    devoluciones: Mapped[list["Devolucion"]] = relationship(back_populates="venta")


class DetalleVenta(db.Model):
    __tablename__ = "detalles_venta"

    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_detalle_venta_cantidad_positiva"),
        CheckConstraint("precio_unitario >= 0 AND descuento >= 0 AND monto_impuesto >= 0 AND subtotal >= 0 AND total_linea >= 0", name="ck_detalle_venta_importes_no_negativos"),
        CheckConstraint("tasa_impuesto >= 0", name="ck_detalle_venta_tasa_impuesto_no_negativa"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    sku_snapshot: Mapped[str] = mapped_column(String(80), nullable=False)
    producto_nombre_snapshot: Mapped[str] = mapped_column(String(160), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    # Snapshot: no se recalcula cuando el precio de catálogo cambia.
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    descuento: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tasa_impuesto: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=0)
    monto_impuesto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_linea: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    dias_garantia: Mapped[int | None] = mapped_column(Integer, nullable=True)

    venta: Mapped["Venta"] = relationship(back_populates="detalles")
    producto: Mapped["Producto"] = relationship(back_populates="detalles_venta")
    unidades_serializadas: Mapped[list["UnidadSerializada"]] = relationship(back_populates="detalle_venta")
    detalles_devolucion: Mapped[list["DetalleDevolucion"]] = relationship(back_populates="detalle_venta")
    movimientos_inventario: Mapped[list["MovimientoInventario"]] = relationship(back_populates="detalle_venta")


class Factura(db.Model):
    __tablename__ = "facturas"

    __table_args__ = (
        CheckConstraint("subtotal >= 0 AND descuento_total >= 0 AND impuesto_total >= 0 AND total_final >= 0", name="ck_factura_importes_no_negativos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id", ondelete="RESTRICT"), nullable=False, unique=True)
    numero_factura: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    fecha_emision: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="EMITIDA")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    descuento_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    impuesto_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_final: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    datos_emisor_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    datos_cliente_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    motivo_anulacion: Mapped[str | None] = mapped_column(Text, nullable=True)

    venta: Mapped["Venta"] = relationship(back_populates="factura")


class UnidadSerializada(db.Model):
    __tablename__ = "unidades_serializadas"

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False, index=True)
    lote_id: Mapped[int | None] = mapped_column(ForeignKey("lotes.id", ondelete="RESTRICT"), nullable=True)
    detalle_venta_id: Mapped[int | None] = mapped_column(ForeignKey("detalles_venta.id", ondelete="RESTRICT"), nullable=True)
    numero_serie: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="EN_STOCK")
    fecha_registro: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fecha_fin_garantia: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    producto: Mapped["Producto"] = relationship(back_populates="unidades_serializadas")
    lote: Mapped["Lote | None"] = relationship(back_populates="unidades_serializadas")
    detalle_venta: Mapped["DetalleVenta | None"] = relationship(back_populates="unidades_serializadas")
    devoluciones: Mapped[list["DetalleDevolucion"]] = relationship(back_populates="unidad_serializada")
    reclamos_garantia: Mapped[list["ReclamoGarantia"]] = relationship(back_populates="unidad_serializada")


class Devolucion(db.Model):
    __tablename__ = "devoluciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id", ondelete="RESTRICT"), nullable=False, index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    fecha_devolucion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    motivo: Mapped[str] = mapped_column(String(255), nullable=False)
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="REGISTRADA")
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    venta: Mapped["Venta"] = relationship(back_populates="devoluciones")
    usuario: Mapped["Usuario"] = relationship(back_populates="devoluciones_registradas")
    detalles: Mapped[list["DetalleDevolucion"]] = relationship(back_populates="devolucion", cascade="all, delete-orphan")


class DetalleDevolucion(db.Model):
    __tablename__ = "detalles_devolucion"

    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_detalle_devolucion_cantidad_positiva"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    devolucion_id: Mapped[int] = mapped_column(ForeignKey("devoluciones.id", ondelete="CASCADE"), nullable=False)
    detalle_venta_id: Mapped[int] = mapped_column(ForeignKey("detalles_venta.id", ondelete="RESTRICT"), nullable=False)
    unidad_serializada_id: Mapped[int | None] = mapped_column(ForeignKey("unidades_serializadas.id", ondelete="RESTRICT"), nullable=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    estado_producto: Mapped[str] = mapped_column(String(30), nullable=False)
    se_reintegra_inventario: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    devolucion: Mapped["Devolucion"] = relationship(back_populates="detalles")
    detalle_venta: Mapped["DetalleVenta"] = relationship(back_populates="detalles_devolucion")
    unidad_serializada: Mapped["UnidadSerializada | None"] = relationship(back_populates="devoluciones")
    movimientos_inventario: Mapped[list["MovimientoInventario"]] = relationship(back_populates="detalle_devolucion")


class ReclamoGarantia(db.Model):
    __tablename__ = "reclamos_garantia"

    id: Mapped[int] = mapped_column(primary_key=True)
    unidad_serializada_id: Mapped[int] = mapped_column(ForeignKey("unidades_serializadas.id", ondelete="RESTRICT"), nullable=False, index=True)
    fecha_apertura: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    motivo: Mapped[str] = mapped_column(Text, nullable=False)
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="ABIERTO")
    resolucion: Mapped[str | None] = mapped_column(Text, nullable=True)
    fecha_cierre: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    unidad_serializada: Mapped["UnidadSerializada"] = relationship(back_populates="reclamos_garantia")