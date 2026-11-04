
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select

from app.extensions import db
from app.models.ventas import Venta, Factura


ESTADOS_FACTURA = {"EMITIDA", "ANULADA"}


def generar_numero_factura():
    """Genera un identificador para la factura."""
    fecha = datetime.now().strftime("%Y%m%d")
    identificador = uuid4().hex[:8].upper()

    return f"FAC-{fecha}-{identificador}"


def crear_snapshot_cliente(cliente):
    """Conserva los datos del cliente al emitir la factura."""
    if not cliente:
        return None

    return {
        "nombre": cliente.nombre,
        "identificacion_fiscal": cliente.identificacion_fiscal,
        "telefono": cliente.telefono,
        "email": cliente.email,
        "direccion": cliente.direccion,
    }


def emitir_factura(venta_id, datos_emisor_snapshot):
    """
    Emite una factura para una venta completada.
    Cada venta puede tener una sola factura.
    """
    try:
        if (
            not isinstance(datos_emisor_snapshot, dict)
            or not datos_emisor_snapshot
        ):
            raise ValueError("Debe proporcionar los datos del emisor.")

        venta = db.session.scalar(
            select(Venta)
            .where(Venta.id == venta_id)
            .with_for_update()
        )

        if not venta:
            raise ValueError("La venta indicada no existe.")

        if venta.estado != "COMPLETADA":
            raise ValueError(
                "Solo se pueden facturar ventas completadas."
            )

        factura_existente = db.session.scalar(
            select(Factura)
            .where(Factura.venta_id == venta_id)
            .with_for_update()
        )

        if factura_existente:
            raise ValueError(
                "La venta ya tiene una factura registrada."
            )

        factura = Factura(
            venta_id=venta.id,
            numero_factura=generar_numero_factura(),
            estado="EMITIDA",
            subtotal=venta.subtotal,
            descuento_total=venta.descuento_total,
            impuesto_total=venta.impuesto_total,
            total_final=venta.total,
            datos_emisor_snapshot=datos_emisor_snapshot.copy(),
            datos_cliente_snapshot=crear_snapshot_cliente(venta.cliente),
        )

        db.session.add(factura)
        db.session.commit()

        return factura

    except Exception:
        db.session.rollback()
        raise


def obtener_factura(factura_id):
    """Obtiene una factura por su identificador."""
    return db.session.get(Factura, factura_id)


def obtener_factura_por_venta(venta_id):
    """Obtiene la factura asociada a una venta."""
    return db.session.scalar(
        select(Factura).where(Factura.venta_id == venta_id)
    )


def obtener_factura_por_numero(numero_factura):
    """Obtiene una factura por su número."""
    if not isinstance(numero_factura, str) or not numero_factura.strip():
        raise ValueError("Debe proporcionar un número de factura válido.")

    return db.session.scalar(
        select(Factura).where(
            Factura.numero_factura == numero_factura.strip()
        )
    )


def listar_facturas():
    """Lista las facturas de la más reciente a la más antigua."""
    return db.session.scalars(
        select(Factura).order_by(Factura.fecha_emision.desc())
    ).all()


def listar_facturas_por_estado(estado):
    """Lista las facturas según su estado."""
    if not isinstance(estado, str):
        raise ValueError("El estado de factura debe ser texto.")

    estado = estado.strip().upper()

    if estado not in ESTADOS_FACTURA:
        raise ValueError("El estado de factura no es válido.")

    return db.session.scalars(
        select(Factura)
        .where(Factura.estado == estado)
        .order_by(Factura.fecha_emision.desc())
    ).all()


def anular_factura(factura_id, motivo):
    """
    Anula una factura sin modificar la venta asociada.
    """
    try:
        if not isinstance(motivo, str) or not motivo.strip():
            raise ValueError("Debe indicar el motivo de anulación.")

        factura = db.session.scalar(
            select(Factura)
            .where(Factura.id == factura_id)
            .with_for_update()
        )

        if not factura:
            raise ValueError("La factura indicada no existe.")

        if factura.estado != "EMITIDA":
            raise ValueError(
                "Solo se pueden anular facturas emitidas."
            )

        factura.estado = "ANULADA"
        factura.motivo_anulacion = motivo.strip()

        db.session.commit()
        return factura

    except Exception:
        db.session.rollback()
        raise
