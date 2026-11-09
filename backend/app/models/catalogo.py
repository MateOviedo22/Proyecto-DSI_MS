from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Categoria(db.Model):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    productos: Mapped[list["Producto"]] = relationship(back_populates="categoria")


class Marca(db.Model):
    __tablename__ = "marcas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    modelos: Mapped[list["Modelo"]] = relationship(back_populates="marca")


class Modelo(db.Model):
    __tablename__ = "modelos"

    __table_args__ = (
        UniqueConstraint("marca_id", "nombre", name="uq_modelo_marca_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    marca_id: Mapped[int] = mapped_column(ForeignKey("marcas.id", ondelete="RESTRICT"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    marca: Mapped["Marca"] = relationship(back_populates="modelos")
    productos: Mapped[list["Producto"]] = relationship(back_populates="modelo")


class Producto(db.Model):
    __tablename__ = "productos"

    __table_args__ = (
        CheckConstraint("dias_garantia_default IS NULL OR dias_garantia_default >= 0", name="ck_producto_dias_garantia_no_negativos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    especificaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False)
    modelo_id: Mapped[int | None] = mapped_column(ForeignKey("modelos.id", ondelete="RESTRICT"), nullable=True)
    requiere_numero_serie: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dias_garantia_default: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    categoria: Mapped["Categoria"] = relationship(back_populates="productos")
    modelo: Mapped["Modelo | None"] = relationship(back_populates="productos")
    historial_precios: Mapped[list["PrecioProducto"]] = relationship(back_populates="producto")
    proveedores_asociados: Mapped[list["ProductoProveedor"]] = relationship(back_populates="producto")
    detalles_compra: Mapped[list["DetalleCompra"]] = relationship(back_populates="producto")
    detalles_pedido: Mapped[list["DetallePedido"]] = relationship(back_populates="producto")
    detalles_venta: Mapped[list["DetalleVenta"]] = relationship(back_populates="producto")
    unidades_serializadas: Mapped[list["UnidadSerializada"]] = relationship(back_populates="producto")
    existencia: Mapped["Existencia | None"] = relationship(back_populates="producto", uselist=False)
    movimientos_inventario: Mapped[list["MovimientoInventario"]] = relationship(back_populates="producto")
    notificaciones: Mapped[list["Notificacion"]] = relationship(back_populates="producto")


class PrecioProducto(db.Model):
    __tablename__ = "precios_producto"

    __table_args__ = (
        CheckConstraint("precio_venta >= 0", name="ck_precio_producto_no_negativo"),
        CheckConstraint("vigente_hasta IS NULL OR vigente_hasta > vigente_desde", name="ck_periodo_precio_valido"),
        Index("uq_precio_producto_vigente", "producto_id", unique=True, postgresql_where=text("vigente_hasta IS NULL")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False, index=True)
    precio_venta: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    vigente_desde: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    vigente_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    motivo: Mapped[str | None] = mapped_column(String(255), nullable=True)

    producto: Mapped["Producto"] = relationship(back_populates="historial_precios")
    usuario: Mapped["Usuario"] = relationship(back_populates="precios_modificados")


class ProductoProveedor(db.Model):
    __tablename__ = "productos_proveedores"

    __table_args__ = (
        UniqueConstraint("producto_id", "proveedor_id", name="uq_producto_proveedor"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    proveedor_id: Mapped[int] = mapped_column(ForeignKey("proveedores.id", ondelete="RESTRICT"), nullable=False)
    codigo_producto_proveedor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    es_principal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    estado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)

    producto: Mapped["Producto"] = relationship(back_populates="proveedores_asociados")
    proveedor: Mapped["Proveedor"] = relationship(back_populates="productos_asociados")
