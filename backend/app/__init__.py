from flask import Flask
from flasgger import Swagger
from flask_cors import CORS


from .config import Config
from .extensions import db, migrate, jwt

from .models.personas import Persona, Empleado, Rol, Usuario
from .models.catalogo import Categoria, Marca, Modelo, Producto, PrecioProducto, ProductoProveedor
from .models.compras import Proveedor, Compra, DetalleCompra, RecepcionMercaderia, DetalleRecepcion, Lote
from .models.inventario import Existencia, MovimientoInventario, Notificacion
from .models.ventas import (
    Cliente, Pedido, DetallePedido, Venta, DetalleVenta, Factura,
    UnidadSerializada, Devolucion, DetalleDevolucion, ReclamoGarantia,
)

#rutas
from .routes.auth_routes import auth_bp
from .routes.categoria_routes import categoria_bp
from .routes.rol_routes import rol_bp
from .routes.persona_routes import persona_bp
from .routes.usuario_routes import usuario_bp
from .routes.empleado_routes import empleado_bp

from .routes.marca_routes import marca_bp
from .routes.modelo_routes import modelo_bp
from .routes.producto_routes import producto_bp
from .routes.precio_routes import precio_bp
from .routes.producto_proveedor_routes import producto_proveedor_bp
from .routes.proveedor_routes import proveedor_bp
from .routes.compra_routes import compra_bp
from .routes.detalle_compra_routes import detalle_compra_bp
from .routes.recepcion_routes import recepcion_bp
from .routes.lote_routes import lote_bp
from .routes.existencia_routes import existencia_bp
from .routes.movimiento_inventario_routes import movimiento_bp
from .routes.notificacion_routes import notificacion_bp
from .routes.cliente_routes import cliente_bp
from .routes.pedido_routes import pedido_bp
from .routes.detalle_pedido_routes import detalle_pedido_bp

from .routes.venta_routes import venta_bp
from .routes.detalle_venta_routes import detalle_venta_bp
from .routes.factura_routes import factura_bp

from .routes.unidad_serializada_routes import unidad_serializada_bp
from .routes.devolucion_routes import devolucion_bp
from .routes.detalle_devolucion_routes import detalle_devolucion_bp
from .routes.reclamo_garantia_routes import reclamo_garantia_bp

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
    
    CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]
        }
    },
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],)
    
    Swagger(app)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(categoria_bp)
    app.register_blueprint(rol_bp)
    app.register_blueprint(persona_bp)
    app.register_blueprint(usuario_bp)
    app.register_blueprint(empleado_bp)
    
    app.register_blueprint(marca_bp)
    app.register_blueprint(modelo_bp)
    app.register_blueprint(producto_bp)
    app.register_blueprint(precio_bp)
    app.register_blueprint(producto_proveedor_bp)
    app.register_blueprint(proveedor_bp)
    app.register_blueprint(compra_bp)
    app.register_blueprint(detalle_compra_bp)
    app.register_blueprint(recepcion_bp)
    app.register_blueprint(lote_bp)
    app.register_blueprint(existencia_bp)
    app.register_blueprint(movimiento_bp)
    app.register_blueprint(notificacion_bp)
    app.register_blueprint(cliente_bp)
    app.register_blueprint(pedido_bp)
    app.register_blueprint(detalle_pedido_bp)
    app.register_blueprint(venta_bp)
    app.register_blueprint(detalle_venta_bp)
    app.register_blueprint(factura_bp)
    app.register_blueprint(unidad_serializada_bp)
    app.register_blueprint(devolucion_bp)
    app.register_blueprint(detalle_devolucion_bp)
    app.register_blueprint(reclamo_garantia_bp)
    

    @app.route("/")
    def home():
        return {"message": "API en funcionamiento"}

    @app.route("/db-check")
    def db_check():
        from sqlalchemy import text
        db.session.execute(text("SELECT 1"))
        return {"message": "Conexión a PostgreSql Correcta."}

    return app
