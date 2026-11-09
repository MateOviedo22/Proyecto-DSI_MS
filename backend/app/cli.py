"""Comandos de línea de comandos (Flask CLI).

Uso (desde la carpeta backend):
    flask --app run seed               roles, usuarios de prueba y categorías
    flask --app run seed --solo-admin  solo roles y el usuario administrador
    flask --app run seed --demo        además proveedores, productos, compras y recepciones de ejemplo
"""

import os

import click
from sqlalchemy import select

from app.extensions import db
from app.models.catalogo import Categoria
from app.models.personas import Rol, Usuario
from app.services.usuario_service import crear_usuario

# Los nombres de rol deben coincidir con los que usa el frontend (src/utils/permisos.js).
ROLES = [
    ("Administrador", "Acceso total al sistema"),
    ("Vendedor", "Ventas, garantías, devoluciones y consulta del catálogo"),
    ("Encargado de Inventario", "Inventario, compras, proveedores y reportes"),
]

USUARIOS_DEMO = [
    ("vendedor", "venta123", "Vendedor", "vendedor@motoman.local"),
    ("inventario", "inventario123", "Encargado de Inventario", "inventario@motoman.local"),
]

CATEGORIAS = ["Cámaras", "Trípodes", "Baterías", "Micrófonos"]


def _cargar_demo(admin):
    """Productos, proveedores, una compra recibida por producto (con costo de envío) y números de serie."""
    from app.models.catalogo import Producto
    from app.models.compras import Proveedor
    from app.services.flujo_service import (
        construir_catalogo,
        crear_compra_completa,
        crear_producto_completo,
        registrar_recepcion_completa,
    )
    from app.services.proveedor_services import crear_proveedor

    if db.session.scalar(select(Producto.id).limit(1)):
        click.echo("  = Ya hay productos: se omite la carga de demostración.")
        return

    proveedores = {
        nombre: crear_proveedor(nombre, contacto, telefono, correo)
        for nombre, contacto, telefono, correo in [
            ("Importadora Acción Nica", "Carlos Reyes", "8888-1234", "ventas@accionica.com.ni"),
            ("GoPro Distribuidora CA", "Laura Gómez", "7777-5678", "contacto@goprodistribuidora.com"),
        ]
    }
    categorias = {c.nombre: c.id for c in db.session.scalars(select(Categoria))}
    gopro = proveedores["GoPro Distribuidora CA"].id
    accion = proveedores["Importadora Acción Nica"].id

    # (sku, nombre, categoría, proveedor, serie?, garantía, precio, mínimo, respaldo, unidades, costo, envío total)
    productos = [
        ("GP-H12", "Cámara GoPro Hero 12", "Cámaras", gopro, True, 15, 9800, 3, 10, 8, 6500, 1200),
        ("TRI-OCT", "Trípode flexible Octopus", "Trípodes", accion, False, None, 350, 5, 15, 2, 180, 40),
        ("BAT-GP", "Batería GoPro", "Baterías", gopro, False, None, 480, 10, 40, 21, 250, 210),
        ("MIC-DJI", "Micrófono inalámbrico DJI Mic", "Micrófonos", accion, False, None, 3600, 4, 12, 0, None, 0),
    ]
    for sku, nombre, categoria, proveedor_id, serie, garantia, precio, minimo, respaldo, unidades, costo, envio in productos:
        producto = crear_producto_completo(admin.id, {
            "sku": sku, "nombre": nombre, "categoria_id": categorias[categoria],
            "requiere_numero_serie": serie, "dias_garantia_default": garantia,
            "precio_venta": precio, "umbral_minimo": minimo, "stock_respaldo": respaldo,
            "proveedor_id": proveedor_id,
        })
        click.echo(f"  + Producto creado: {nombre}")
        if unidades:
            compra = crear_compra_completa(admin.id, {
                "proveedor_id": proveedor_id,
                "items": [{"producto_id": producto["id"], "cantidad": unidades, "costo_unitario": costo}],
            })
            linea = compra["items"][0]
            item = {"detalle_compra_id": linea["id"], "cantidad_recibida": unidades}
            if serie:
                item["numeros_serie"] = [f"GP12-{n:04d}" for n in range(1, unidades + 1)]
            registrar_recepcion_completa(admin.id, {"compra_id": compra["id"], "costo_envio": envio, "items": [item]})
            click.echo(f"      recibidas {unidades} unidad(es) con envío de C$ {envio}")
    click.echo(f"  = Catálogo de demostración: {len(construir_catalogo())} producto(s).")
    del Proveedor


@click.command("seed")
@click.option("--solo-admin", is_flag=True, help="Crea únicamente los roles y el usuario administrador.")
@click.option("--demo", is_flag=True, help="Carga además proveedores, productos y compras de ejemplo.")
def seed(solo_admin, demo):
    """Crea los datos iniciales necesarios para poder iniciar sesión."""
    roles = {}
    for nombre, descripcion in ROLES:
        rol = db.session.scalar(select(Rol).where(Rol.nombre == nombre))
        if not rol:
            rol = Rol(nombre=nombre, descripcion=descripcion, estado=True)
            db.session.add(rol)
            db.session.flush()
            click.echo(f"  + Rol creado: {nombre}")
        roles[nombre] = rol
    db.session.commit()

    usuarios = [("admin", os.getenv("ADMIN_PASSWORD", "admin123"), "Administrador", "admin@motoman.local")]
    if not solo_admin:
        usuarios += USUARIOS_DEMO
    for username, password, rol_nombre, email in usuarios:
        if db.session.scalar(select(Usuario).where(Usuario.username == username)):
            continue
        crear_usuario(username=username, password=password, rol_id=roles[rol_nombre].id, email=email)
        click.echo(f"  + Usuario creado: {username} ({rol_nombre})")

    if not solo_admin:
        for nombre in CATEGORIAS:
            if not db.session.scalar(select(Categoria).where(Categoria.nombre == nombre)):
                db.session.add(Categoria(nombre=nombre, estado=True))
                click.echo(f"  + Categoría creada: {nombre}")
        db.session.commit()

    if demo and not solo_admin:
        _cargar_demo(db.session.scalar(select(Usuario).where(Usuario.username == "admin")))

    click.echo("Listo. Cambia las contraseñas de prueba antes de usar el sistema en producción.")


def register_cli(app):
    app.cli.add_command(seed)
