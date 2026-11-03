from flask import Flask
from flasgger import Swagger

from .config import Config
from .extensions import db, migrate

from .models.personas import Persona, Empleado, Rol, Usuario
from .models.catalogo import Categoria, Marca, Modelo, Producto, PrecioProducto, ProductoProveedor
from .models.compras import Proveedor, Compra, DetalleCompra, RecepcionMercaderia, DetalleRecepcion, Lote
from .models.inventario import Existencia, MovimientoInventario, Notificacion
from .models.ventas import (
    Cliente, Pedido, DetallePedido, Venta, DetalleVenta, Factura,
    UnidadSerializada, Devolucion, DetalleDevolucion, ReclamoGarantia,
)

#rutas
from .routes.categoria_routes import categoria_bp


__all__ = [
    "Persona", "Empleado", "Rol", "Usuario",
    "Categoria", "Marca", "Modelo", "Producto", "PrecioProducto", "ProductoProveedor",
    "Proveedor", "Compra", "DetalleCompra", "RecepcionMercaderia", "DetalleRecepcion", "Lote",
    "Existencia", "MovimientoInventario", "Notificacion",
    "Cliente", "Pedido", "DetallePedido", "Venta", "DetalleVenta", "Factura",
    "UnidadSerializada", "Devolucion", "DetalleDevolucion", "ReclamoGarantia",
]


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    Swagger(app)

    db.init_app(app)
    migrate.init_app(app, db)

    # Registrar las rutas de categorías
    app.register_blueprint(categoria_bp)

    @app.route("/")
    def home():
        return {"message": "API en funcionamiento"}

    @app.route("/db-check")
    def db_check():
        from sqlalchemy import text
        db.session.execute(text("SELECT 1"))
        return {"message": "Conexión a PostgreSql Correcta."}

    return app
