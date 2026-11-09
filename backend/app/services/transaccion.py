"""Transacción única para operaciones compuestas.

Los servicios existentes (``crear_venta``, ``agregar_detalle_venta``,
``confirmar_venta``, ``emitir_factura``...) llaman a ``db.session.commit()`` por
su cuenta. Para que una operación de varios pasos (por ejemplo, registrar una
venta completa) se confirme **completa o no se confirme en absoluto** (propiedad
de atomicidad, RNF 4), este contexto convierte esos ``commit`` internos en
``flush`` y realiza un único ``commit`` real al terminar con éxito. Si algo falla,
se hace ``rollback`` de todo. Los bloqueos de fila (``with_for_update``) se
mantienen hasta el final, de modo que dos ventas simultáneas del último ejemplar
no pueden coexistir.
"""

from contextlib import contextmanager

from app.extensions import db


@contextmanager
def transaccion_unica():
    sesion = db.session()
    sesion.commit = sesion.flush  # los commit() internos pasan a ser flush()
    try:
        yield sesion
    except BaseException:
        sesion.__dict__.pop("commit", None)
        sesion.rollback()
        raise
    else:
        sesion.__dict__.pop("commit", None)
        sesion.commit()
    finally:
        sesion.__dict__.pop("commit", None)
