"""Prueba de integración del backend contra PostgreSQL (63 comprobaciones).

Verifica CORS, 401/403, venta atómica (201), existencias insuficientes (409), atomicidad,
concurrencia, garantía de 15 días por número de serie, devoluciones, recepción con costo
proporcional del envío, precios masivos y usuarios.

Requisitos: una base vacía (distinta de la de trabajo) con migraciones y datos de demostración:

    flask --app run db upgrade
    flask --app run seed --demo
    python tests/prueba_integracion.py        # desde la carpeta backend

AVISO: la prueba crea ventas, reclamos y usuarios de ejemplo: no la ejecutes sobre datos reales.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import os, sys, threading, json
from datetime import datetime, timedelta, timezone
from app import create_app
from app.extensions import db
app = create_app()
resultados = []
def ok(cond, msg):
    resultados.append(cond); print(('✔ ' if cond else '✘ ') + msg)
def cliente(usuario, clave):
    c = app.test_client()
    r = c.post('/api/auth/login', json={'username': usuario, 'password': clave})
    assert r.status_code == 200, r.get_json()
    return c, {'Authorization': 'Bearer ' + r.get_json()['access_token']}
def J(c, m, url, h=None, **kw):
    r = getattr(c, m)(url, headers=h, **kw); return r.status_code, r.get_json(silent=True)

admin, HA = cliente('admin', 'admin123'); vend, HV = cliente('vendedor', 'venta123'); inv, HI = cliente('inventario', 'inventario123')
print('== Seguridad y CORS')
o = admin.options('/api/productos/catalogo', headers={'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,content-type'})
ok(o.status_code == 200 and o.headers.get('Access-Control-Allow-Origin') == 'http://localhost:3000' and 'authorization' in o.headers.get('Access-Control-Allow-Headers','').lower(), 'CORS: preflight permite el origen del frontend y la cabecera Authorization')
o = admin.options('/api/productos/catalogo', headers={'Origin': 'http://sitio-malo.com', 'Access-Control-Request-Method': 'GET'})
ok('Access-Control-Allow-Origin' not in o.headers, 'CORS: un origen no autorizado no recibe cabeceras de permiso')
ok(J(admin,'get','/api/categorias',HA)[0] == 200 and J(admin,'get','/api/categorias/',HA)[0] == 200, 'URLs con y sin "/" final responden 200 (sin 308 ni 404)')
st, b = J(admin, 'get', '/api/productos/catalogo'); ok(st == 401 and b['codigo'] == 'SIN_SESION', '401 SIN_SESION sin token')
st, b = J(admin, 'get', '/api/productos/catalogo', {'Authorization': 'Bearer basura.basura.basura'}); ok(st == 401, f'401 con token alterado (antes 422): {st}')
st, b = J(vend, 'post', '/api/productos/completo', HV, json={'sku': 'X', 'nombre': 'X', 'categoria': 'Cámaras', 'precio_venta': 1}); ok(st == 403 and b['codigo'] == 'SIN_PERMISO', '403: el Vendedor no puede crear productos')
st, b = J(inv, 'post', '/api/ventas/completa', HI, json={'metodo_pago': 'EFECTIVO', 'items': [{'producto_id': 1, 'cantidad': 1}]}); ok(st == 403, '403: el Encargado de Inventario no puede vender')
st, b = J(vend, 'get', '/api/usuarios', HV); ok(st == 403, '403: el Vendedor no puede listar usuarios')
st, b = J(vend, 'get', '/api/roles', HV); ok(st == 403, '403: el Vendedor no puede ver roles')

print('== Catálogo y costo proporcional (C = C_adq + E/n)')
st, cat = J(vend, 'get', '/api/productos/catalogo', HV); ok(st == 200 and len(cat) == 4, 'Catálogo: 4 productos para el Vendedor')
gp = next(p for p in cat if p['sku'] == 'GP-H12'); tri = next(p for p in cat if p['sku'] == 'TRI-OCT'); bat = next(p for p in cat if p['sku'] == 'BAT-GP'); mic = next(p for p in cat if p['sku'] == 'MIC-DJI')
ok(gp['precio_venta'] == '9800.00' and gp['existencia']['cantidad_actual'] == 8 and gp['unidades_serializadas_disponibles'] == 8, 'GoPro: precio 9800, stock 8 y 8 series en stock')
ok(gp['costo_unitario_total'] == '6650.00', f"GoPro: costo = 6500 + 1200/8 = {gp['costo_unitario_total']}")
ok(tri['costo_unitario_total'] == '200.00' and bat['costo_unitario_total'] == '260.00', 'Trípode (180+40/2=200) y Batería (250+210/21=260)')
ok(mic['existencia']['alerta'] == 'AGOTADO' and tri['existencia']['alerta'] == 'STOCK_BAJO', 'Alertas de stock: micrófono AGOTADO, trípode STOCK_BAJO')
st, b = J(inv, 'post', '/api/compras/costo-proporcional', HI, json={'costo_envio': 100, 'lineas': [{'id': 1, 'costo_unitario': 50, 'cantidad': 6}, {'id': 2, 'costo_unitario': 20, 'cantidad': 4}]})
ok(st == 200 and b['lineas'][0]['costo_envio_unitario'] == '10.00' and b['lineas'][0]['costo_unitario_total'] == '60.00' and b['lineas'][1]['costo_unitario_total'] == '30.00', 'Vista previa: envío 100 / 10 uds = 10.00 por unidad -> 60.00 y 30.00')
st, b = J(inv, 'post', '/api/precios/calcular', HI, json={'costo_adquisicion': 6500, 'costo_envio_total': 1200, 'unidades': 8, 'margen': 47.5, 'redondeo': 10})
ok(st == 200 and b['costo_unitario_total'] == '6650.00' and b['precio_sugerido'] == '9810.00', f"Precio = redondeo10[6650 x 1.475] = {b.get('precio_sugerido')}")

print('== Venta atómica: 201, series, garantía, factura')
series_elegidas = ['GP12-0005', 'GP12-0003']
st, v = J(vend, 'post', '/api/ventas/completa', HV, json={'canal': 'ONLINE', 'metodo_pago': 'TARJETA', 'cliente': {'nombre': 'María López', 'identificacion_fiscal': 'J0310000000001'},
    'items': [{'producto_id': gp['id'], 'cantidad': 2, 'numeros_serie': series_elegidas}, {'producto_id': bat['id'], 'cantidad': 3}]})
ok(st == 201, f'POST /ventas/completa -> {st}')
ok(v['factura']['numero_factura'].startswith('F') or v['factura']['numero_factura'], f"Factura emitida: {v['factura']['numero_factura']}")
it = {i['producto_id']: i for i in v['items']}
ok(sorted(it[gp['id']]['numeros_serie']) == sorted(series_elegidas), f"Se respetaron los números de serie elegidos: {it[gp['id']]['numeros_serie']}")
ok(v['venta']['total'] == str(2*9800 + 3*480) + '.00', f"Total = 2x9800 + 3x480 = {v['venta']['total']}")
ok(it[gp['id']]['dias_garantia'] == 15 and it[gp['id']]['fecha_fin_garantia'] is not None, 'La garantía de 15 días inicia con la venta')
ex = {e['producto_id']: e for e in v['existencias']}
ok(ex[gp['id']]['cantidad_actual'] == 6 and ex[bat['id']]['cantidad_actual'] == 18, 'Existencias descontadas: GoPro 8->6, Batería 21->18')
ok(v['cliente']['nombre'] == 'María López' and v['vendedor']['username'] == 'vendedor', 'Cliente y vendedor quedan en el comprobante')

print('== 409 por existencias insuficientes y atomicidad')
def estado_bd():
    with app.app_context():
        from app.models.ventas import Venta
        from app.models.inventario import Existencia
        return db.session.query(Venta).count(), {e.producto_id: e.cantidad_actual for e in db.session.query(Existencia)}
antes = estado_bd()
st, b = J(vend, 'post', '/api/ventas/completa', HV, json={'metodo_pago': 'EFECTIVO', 'items': [{'producto_id': tri['id'], 'cantidad': 5}]})
ok(st == 409 and b['codigo'] == 'EXISTENCIAS_INSUFICIENTES' and 'Trípode' in b['error'] and b['disponibles'] == 2 and b['solicitadas'] == 5, f"409: {b['error']}")
st, b = J(vend, 'post', '/api/ventas/completa', HV, json={'metodo_pago': 'EFECTIVO', 'items': [{'producto_id': bat['id'], 'cantidad': 1}, {'producto_id': mic['id'], 'cantidad': 1}]})
ok(st == 409 and 'Micrófono' in b['error'], f"409 en la 2.ª línea: {b['error'][:70]}")
ok(estado_bd() == antes, 'Atomicidad: tras los 409 no quedó ninguna venta ni cambió ninguna existencia')
st, b = J(vend, 'post', '/api/ventas/completa', HV, json={'metodo_pago': 'EFECTIVO', 'items': [{'producto_id': gp['id'], 'cantidad': 1, 'numeros_serie': ['GP12-0003']}]})
ok(st == 409 and b['codigo'] == 'SERIES_NO_DISPONIBLES', f'409: no se puede vender dos veces la misma cámara ({b["codigo"]})')
for payload, nombre in [({'metodo_pago': 'EFECTIVO', 'items': [{'producto_id': 1, 'cantidad': 0}]}, 'cantidad 0'), ({'metodo_pago': 'EFECTIVO', 'items': []}, 'sin líneas'), ({'metodo_pago': 'BITCOIN', 'items': [{'producto_id': tri['id'], 'cantidad': 1}]}, 'método de pago inválido'), ({'canal': 'LUNA', 'metodo_pago': 'EFECTIVO', 'items': [{'producto_id': tri['id'], 'cantidad': 1}]}, 'canal inválido')]:
    st, b = J(vend, 'post', '/api/ventas/completa', HV, json=payload); ok(st == 400, f'400 Bad Request: {nombre}')
st, b = J(vend, 'post', '/api/ventas/completa', HV, json={'metodo_pago': 'EFECTIVO', 'items': [{'producto_id': 9999, 'cantidad': 1}]}); ok(st == 404, '404: producto inexistente')
ok(estado_bd() == antes, 'Los 400/404 tampoco dejaron datos a medias')

print('== Concurrencia: dos ventas simultáneas del último ejemplar')
res = []
def vender():
    c, h = cliente('vendedor', 'venta123')
    res.append(J(c, 'post', '/api/ventas/completa', h, json={'metodo_pago': 'EFECTIVO', 'items': [{'producto_id': tri['id'], 'cantidad': 2}]})[0])
hilos = [threading.Thread(target=vender) for _ in range(2)]
[t.start() for t in hilos]; [t.join() for t in hilos]
ok(sorted(res) == [201, 409], f'Dos ventas de 2 trípodes con stock 2 -> {sorted(res)} (una 201 y una 409)')
ok(estado_bd()[1][tri['id']] == 0, 'El stock del trípode quedó en 0 (nunca negativo)')

print('== Garantía por número de serie (15 días)')
st, g1 = J(vend, 'get', '/api/unidades-serializadas/buscar?numero_serie=gp12-0005', HV)
ok(st == 200 and g1['garantia']['estado'] == 'VIGENTE' and g1['garantia']['dias_restantes'] in (14, 15) and g1['venta']['numero_venta'] == v['venta']['numero_venta'], f"Búsqueda (sin distinguir mayúsculas): {g1['garantia']['mensaje']}")
ok(g1['factura']['numero_factura'] == v['factura']['numero_factura'] and g1['cliente']['nombre'] == 'María López', 'La serie localiza factura y cliente de la venta')
st, r = J(vend, 'post', '/api/reclamos-garantia/por-serie', HV, json={'numero_serie': 'GP12-0005', 'motivo': 'No enciende'}); ok(st == 201 and r['reclamo']['estado'] == 'ABIERTO', 'POST reclamo por serie -> 201')
st, r = J(vend, 'post', '/api/reclamos-garantia/por-serie', HV, json={'numero_serie': 'GP12-0005', 'motivo': 'Otra vez'}); ok(st == 409, f"409: ya hay un reclamo pendiente ({r['error'][:55]})")
st, r = J(vend, 'post', '/api/reclamos-garantia/por-serie', HV, json={'numero_serie': 'GP12-0001', 'motivo': 'x'}); ok(st == 409 and r['codigo'] == 'NO_VENDIDA', '409: la unidad sigue en inventario (no figura en ninguna venta)')
st, r = J(vend, 'get', '/api/unidades-serializadas/buscar?numero_serie=NO-EXISTE', HV); ok(st == 404, '404: número de serie inexistente')
with app.app_context():   # simular que la venta fue hace 20 días
    from app.models.ventas import UnidadSerializada, Venta
    u = db.session.query(UnidadSerializada).filter_by(numero_serie='GP12-0003').one()
    u.fecha_fin_garantia = datetime.now(timezone.utc) - timedelta(days=5); db.session.commit()
st, g2 = J(vend, 'get', '/api/unidades-serializadas/buscar?numero_serie=GP12-0003', HV); ok(g2['garantia']['estado'] == 'VENCIDA', f"Garantía vencida: {g2['garantia']['mensaje']}")
st, r = J(vend, 'post', '/api/reclamos-garantia/por-serie', HV, json={'numero_serie': 'GP12-0003', 'motivo': 'Falla'}); ok(st == 409 and r['codigo'] == 'GARANTIA_VENCIDA', f"409 GARANTIA_VENCIDA: {r['error']}")

print('== Devolución')
st, hist = J(vend, 'get', '/api/ventas/detalladas', HV); venta_det = next(x for x in hist if x['numero_venta'] == v['venta']['numero_venta']); linea_gp = next(i for i in venta_det['items'] if i['producto_id'] == gp['id'])
st, d = J(vend, 'post', '/api/devoluciones/completa', HV, json={'venta_id': venta_det['id'], 'motivo': 'Defecto de fábrica', 'items': [{'detalle_venta_id': linea_gp['detalle_id'], 'cantidad': 1, 'numeros_serie': ['GP12-0005'], 'estado_producto': 'BUEN_ESTADO'}]})
ok(st == 201 and d['devolucion']['estado'] == 'COMPLETADA', f"POST devolución -> {st} ({d['devolucion']['estado'] if st==201 else d})")
ok(estado_bd()[1][gp['id']] == 7, 'La devolución reintegró la cámara: existencias GoPro 6 -> 7')
st, d2 = J(vend, 'post', '/api/devoluciones/completa', HV, json={'venta_id': venta_det['id'], 'motivo': 'otra', 'items': [{'detalle_venta_id': linea_gp['detalle_id'], 'cantidad': 1, 'numeros_serie': ['GP12-0005']}]})
ok(st == 409, f'409: la misma unidad no se puede devolver dos veces')

print('== Recepción con faltante, rechazo y costo proporcional')
st, comp = J(inv, 'post', '/api/compras/completa', HI, json={'proveedor_id': 1, 'items': [{'producto_id': bat['id'], 'cantidad': 10, 'costo_unitario': 250}]}); ok(st == 201 and comp['compra']['estado'] == 'ENVIADA', 'Compra registrada -> 201 (estado ENVIADA)')
linea = comp['compra']['items'][0]
st, rc = J(inv, 'post', '/api/recepciones/completa', HI, json={'compra_id': comp['compra']['id'], 'costo_envio': 100, 'items': [{'detalle_compra_id': linea['id'], 'cantidad_recibida': 7, 'cantidad_rechazada': 1, 'motivo_rechazo': 'Caja golpeada'}]})
ok(st == 201, f'POST recepción -> {st}')
l0 = rc['lineas'][0]
ok(l0['cantidad_aceptada'] == 6 and l0['faltante_acumulado'] == 3 and rc['compra']['estado'] == 'PARCIALMENTE_RECIBIDA', f"Recibidas 7, rechazada 1: se suman 6; faltan 3; compra {rc['compra']['estado']}")
ok(l0['lote']['costo_envio_unitario'] == '16.67' and l0['lote']['costo_unitario_total'] == '266.67', f"Costo proporcional del lote: 250 + 100/6 = {l0['lote']['costo_unitario_total']}")
st, pv = J(inv, 'post', '/api/compras/costo-proporcional', HI, json={'costo_envio': 100, 'lineas': [{'costo_unitario': 250, 'cantidad': 6}]}); ok(pv['lineas'][0]['costo_unitario_total'] == l0['lote']['costo_unitario_total'], 'La vista previa coincide con el costo que guarda el servidor')
ok(estado_bd()[1][bat['id']] == 18 + 6, 'El inventario subió solo con lo aceptado: 18 -> 24')
st, r = J(inv, 'post', '/api/recepciones/completa', HI, json={'compra_id': comp['compra']['id'], 'items': [{'detalle_compra_id': linea['id'], 'cantidad_recibida': 9}]}); ok(st == 400 and 'supera' in r['error'], f"400: no se puede recibir más de lo solicitado ({r['error'][:50]})")
st, cam = J(inv, 'post', '/api/compras/completa', HI, json={'proveedor_id': 2, 'items': [{'producto_id': gp['id'], 'cantidad': 2, 'costo_unitario': 6500}]})
st, r = J(inv, 'post', '/api/recepciones/completa', HI, json={'compra_id': cam['compra']['id'], 'items': [{'detalle_compra_id': cam['compra']['items'][0]['id'], 'cantidad_recibida': 2, 'numeros_serie': ['GP12-0100']}]}); ok(st == 400 and 'número de serie' in r['error'], f"400: cámaras sin todas sus series ({r['error'][:60]})")
estado_antes = estado_bd()[1]
ok(estado_antes[gp['id']] == 7, 'La recepción fallida no sumó nada al inventario (atómica)')
st, r = J(inv, 'post', '/api/recepciones/completa', HI, json={'compra_id': cam['compra']['id'], 'items': [{'detalle_compra_id': cam['compra']['items'][0]['id'], 'cantidad_recibida': 2, 'numeros_serie': ['GP12-0001', 'GP12-0101']}]}); ok(st == 409, '409: número de serie ya registrado')

print('== Precios, reportes y usuarios')
st, pv = J(inv, 'post', '/api/precios/actualizar-masivo', HI, json={'categoria_id': bat['categoria_id'], 'modo': 'porcentaje', 'valor': 10, 'direccion': 'subir', 'redondeo': 10, 'aplicar': False})
ok(st == 200 and pv['aplicado'] is False and pv['cambios'][0]['precio_nuevo'] == '530.00', f"Vista previa +10% con redondeo a 10: 480 -> {pv['cambios'][0]['precio_nuevo']}")
ok(next(p for p in J(inv, 'get', '/api/productos/catalogo', HI)[1] if p['sku']=='BAT-GP')['precio_venta'] == '480.00', 'La vista previa no modificó el precio')
st, pa = J(inv, 'post', '/api/precios/actualizar-masivo', HI, json={'categoria_id': bat['categoria_id'], 'modo': 'porcentaje', 'valor': 10, 'redondeo': 10}); ok(st == 200 and pa['aplicado'], 'Precio aplicado')
st, pm = J(inv, 'post', '/api/precios/actualizar-masivo', HI, json={'producto_ids': [mic['id']], 'modo': 'margen', 'valor': 50}); ok(st == 400 and 'costos' in pm['error'], '400: no se fija margen sin costo registrado')
st, hist = J(vend, 'get', '/api/ventas/detalladas', HV)
l = next(i for i in next(x for x in hist if x['numero_venta'] == v['venta']['numero_venta'])['items'] if i['producto_id'] == gp['id'])
ok(st == 200 and l['costo_unitario'] == '6650.00' and l['cantidad_devuelta'] == 1 and l['numeros_serie'] == ['GP12-0003'] and l['numeros_serie_devueltos'] == ['GP12-0005'], 'Reporte: la línea trae costo 6650, 1 devuelta, su serie vendida y su serie devuelta')
st, r = J(admin, 'post', '/api/usuarios', HA, json={'username': 'nuevo1', 'password': 'Clave1234', 'rol_id': 2}); uid = r['usuario']['id']; ok(st == 201, 'Admin crea usuario -> 201')
ok(J(admin, 'patch', f'/api/usuarios/{uid}/restablecer-contrasena', HA, json={'nueva_contrasena': 'Otra12345'})[0] == 200 and app.test_client().post('/api/auth/login', json={'username': 'nuevo1', 'password': 'Otra12345'}).status_code == 200, 'Admin restablece la contraseña y el usuario entra con la nueva')
print(f"\n{sum(resultados)}/{len(resultados)} comprobaciones correctas")
sys.exit(0 if all(resultados) else 1)
