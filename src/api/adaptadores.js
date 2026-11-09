// src/api/adaptadores.js
// Traduce los datos del backend (snake_case, estados en MAYÚSCULAS, importes como texto)
// a la forma que usan las pantallas (camelCase, estados en minúscula, números), y al revés.
// Así las pantallas no dependen del formato exacto de la API.

const numero = (valor) => (valor === null || valor === undefined || valor === '' ? 0 : Number(valor));
const id = (valor) => (valor === null || valor === undefined ? null : String(valor));

// ----------------------------- Catálogos de valores -----------------------------
export const canalDesdeApi = (canal) => (String(canal).toUpperCase() === 'PISO' ? 'piso' : 'linea');
export const canalAApi = (canal) => (canal === 'piso' ? 'PISO' : 'ONLINE');

const METODOS = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', OTRO: 'Otro' };
export const metodoDesdeApi = (metodo) => METODOS[String(metodo).toUpperCase()] || metodo;
export const metodoAApi = (metodo) => String(metodo || 'Otro').toUpperCase();

// Estados del reclamo de garantía y sus transiciones válidas en el backend.
export const ESTADOS_RECLAMO = {
  ABIERTO: { etiqueta: 'Abierto', clase: 'bg-warning', siguientes: ['EN_REVISION', 'RECHAZADO'] },
  EN_REVISION: { etiqueta: 'En revisión', clase: 'bg-info', siguientes: ['APROBADO', 'RECHAZADO'] },
  APROBADO: { etiqueta: 'Aprobado', clase: 'bg-primary', siguientes: ['RESUELTO'] },
  RECHAZADO: { etiqueta: 'Rechazado', clase: 'bg-danger', siguientes: ['CERRADO'] },
  RESUELTO: { etiqueta: 'Resuelto', clase: 'bg-success', siguientes: ['CERRADO'] },
  CERRADO: { etiqueta: 'Cerrado', clase: 'bg-secondary', siguientes: [] },
};

// ----------------------------- Productos -----------------------------
export function productoDesdeApi(p) {
  const existencia = p.existencia || {};
  return {
    id: id(p.id),
    sku: p.sku,
    nombre: p.nombre,
    descripcion: p.descripcion || '',
    categoria: p.categoria || '',
    categoriaId: p.categoria_id,
    proveedorId: id(p.proveedor_id) || '',
    // El costo viene de las recepciones de compra (costo de adquisición + envío proporcional).
    costo: numero(p.costo_unitario_total),
    costoEnvio: 0,
    tieneCosto: p.costo_unitario_total !== null && p.costo_unitario_total !== undefined,
    precio: numero(p.precio_venta),
    stockMinimo: numero(existencia.umbral_minimo),
    stockObjetivo: numero(existencia.stock_respaldo),
    stockActual: numero(existencia.cantidad_actual),
    esElectronico: Boolean(p.requiere_numero_serie), // alias para las pantallas existentes
    requiereSerie: Boolean(p.requiere_numero_serie),
    diasGarantia: p.dias_garantia_default,
    unidadesSerie: numero(p.unidades_serializadas_disponibles),
    activo: p.estado !== false,
    variantes: [], // el backend modela cada variante como un producto distinto
    imagen: '',
  };
}

export const productoAApi = (datos) => {
  const payload = {
    sku: String(datos.sku || '').trim(),
    nombre: String(datos.nombre || '').trim(),
    descripcion: datos.descripcion || null,
    categoria: String(datos.categoria || '').trim(),
    requiere_numero_serie: Boolean(datos.requiereSerie ?? datos.esElectronico),
    dias_garantia_default:
      datos.diasGarantia === '' || datos.diasGarantia === null || datos.diasGarantia === undefined ? null : Number(datos.diasGarantia),
    precio_venta: Number(datos.precio),
    umbral_minimo: Number(datos.stockMinimo || 0),
    stock_respaldo: Number(datos.stockObjetivo || 0),
  };
  if (datos.proveedorId) payload.proveedor_id = Number(datos.proveedorId);
  if (datos.cantidadInicial !== undefined) payload.cantidad_inicial = Number(datos.cantidadInicial || 0);
  return payload;
};

// ----------------------------- Proveedores -----------------------------
export const proveedorDesdeApi = (p) => ({
  id: id(p.id),
  nombre: p.nombre,
  contacto: p.contacto_nombre || '',
  telefono: p.telefono || '',
  email: p.email || '',
  direccion: p.direccion || '',
  activo: p.estado !== false,
});

export const proveedorAApi = (d) => ({
  nombre: String(d.nombre || '').trim(),
  contacto_nombre: d.contacto || null,
  telefono: d.telefono || null,
  email: d.email || null,
  direccion: d.direccion || null,
});

// ----------------------------- Inventario -----------------------------
export function movimientoDesdeApi(m) {
  const entrada = ['ENTRADA', 'AJUSTE_ENTRADA'].includes(m.tipo_movimiento);
  let motivo = m.tipo_movimiento.startsWith('AJUSTE') ? 'ajuste' : entrada ? 'ajuste' : 'perdida';
  if (m.origen === 'RECEPCION') motivo = 'compra';
  else if (m.origen === 'VENTA') motivo = 'venta';
  else if (m.origen === 'DEVOLUCION') motivo = 'devolucion_cliente';
  else if (/existencia inicial/i.test(m.motivo || '')) motivo = 'ajuste_inicial';
  else if (/p[eé]rdida|da[nñ]o/i.test(m.motivo || '')) motivo = 'perdida';
  else if (/proveedor/i.test(m.motivo || '')) motivo = 'devolucion_proveedor';
  return {
    id: id(m.id),
    productoId: id(m.producto_id),
    varianteId: null,
    tipo: entrada ? 'entrada' : 'salida',
    motivo,
    cantidad: m.cantidad,
    comentario: m.motivo || '',
    fecha: m.fecha_movimiento,
    usuario: m.usuario || '',
  };
}

export const numeroSerieDesdeApi = (u) => ({
  id: id(u.id),
  numero: u.numero_serie,
  productoId: id(u.producto_id),
  varianteId: null,
  lote: u.lote_id ? `Lote ${u.lote_id}` : '',
  compraId: null,
  // Un número libre solo si está EN_STOCK; cualquier otro estado impide venderlo.
  ventaId: u.venta_id ? id(u.venta_id) : u.estado === 'EN_STOCK' ? null : u.estado,
  estado: u.estado,
  fechaIngreso: u.fecha_registro,
  fechaVenta: u.fecha_venta,
});

// ----------------------------- Compras -----------------------------
export function compraDesdeApi(c) {
  const faltaAlgo = c.items.some((i) => i.faltante > 0 || i.cantidad_rechazada > 0);
  const abierta = ['ENVIADA', 'PARCIALMENTE_RECIBIDA', 'BORRADOR'].includes(c.estado);
  const recepciones = c.recepciones || [];
  const ultima = [...recepciones].reverse().find((r) => r.estado === 'RECIBIDA');
  return {
    id: id(c.id),
    proveedorId: id(c.proveedor_id),
    proveedor: c.proveedor,
    fecha: c.fecha_pedido,
    costoEnvio: recepciones.reduce((s, r) => s + numero(r.costo_envio), 0),
    // 'pendiente' = todavía se puede registrar una recepción (incluye las parciales)
    estado: abierta ? 'pendiente' : faltaAlgo ? 'recibida_con_incidencias' : 'recibida',
    estadoServidor: c.estado,
    fechaRecepcion: ultima ? ultima.fecha_recepcion : null,
    total: numero(c.total),
    items: c.items.map((i) => ({
      id: id(i.id),
      productoId: id(i.producto_id),
      varianteId: null,
      cantidadComprada: i.cantidad_solicitada,
      costoUnitario: numero(i.costo_unitario),
      cantidadRecibida: i.cantidad_recibida,
      cantidadRechazada: i.cantidad_rechazada,
      faltante: i.faltante,
      requiereSerie: Boolean(i.requiere_numero_serie),
      lote: i.lotes.length ? i.lotes.map((l) => `L${l.id}`).join(', ') : '',
      costoUnitarioTotal: i.lotes.length ? numero(i.lotes[i.lotes.length - 1].costo_unitario_total) : null,
      numerosSerie: [],
      incidencia: i.cantidad_rechazada > 0 ? `${i.cantidad_rechazada} unidad(es) rechazada(s)` : '',
    })),
  };
}

// ----------------------------- Ventas -----------------------------
export function ventaDesdeApi(v) {
  return {
    id: id(v.id),
    numeroFactura: v.numero_factura || v.numero_venta,
    numeroVenta: v.numero_venta,
    fecha: v.fecha_venta,
    canal: canalDesdeApi(v.canal),
    cliente: v.cliente || 'Consumidor final',
    metodoPago: metodoDesdeApi(v.metodo_pago),
    vendedor: v.vendedor || '',
    total: numero(v.total),
    items: v.items.map((i) => ({
      detalleId: i.detalle_id,
      productoId: id(i.producto_id),
      varianteId: null,
      nombre: i.nombre,
      categoria: i.categoria || 'Sin categoría',
      varianteValor: '',
      cantidad: i.cantidad,
      precioUnitario: numero(i.precio_unitario),
      costoUnitario: numero(i.costo_unitario),
      numeroSerieId: null,
      numeroSerie: (i.numeros_serie || []).join(', '),
      numerosSerie: i.numeros_serie || [],
      numerosSerieDevueltos: i.numeros_serie_devueltos || [],
      diasGarantia: i.dias_garantia,
    })),
  };
}

// Comprobante de POST /ventas/completa -> venta lista para imprimir en FacturaModal
export function comprobanteAVenta(c) {
  return {
    id: id(c.venta.id),
    numeroFactura: c.factura?.numero_factura || c.venta.numero_venta,
    numeroVenta: c.venta.numero_venta,
    fecha: c.venta.fecha_venta,
    canal: canalDesdeApi(c.venta.canal),
    cliente: c.cliente?.nombre || 'Consumidor final',
    metodoPago: metodoDesdeApi(c.venta.metodo_pago),
    vendedor: c.vendedor?.username || '',
    total: numero(c.venta.total),
    emisor: c.emisor || null,
    alertas: (c.existencias || []).filter((e) => e.alerta),
    items: c.items.map((i) => ({
      productoId: id(i.producto_id),
      nombre: i.nombre,
      varianteValor: '',
      cantidad: i.cantidad,
      precioUnitario: numero(i.precio_unitario),
      numeroSerie: (i.numeros_serie || []).join(', '),
      fechaFinGarantia: i.fecha_fin_garantia,
    })),
  };
}

// ----------------------------- Devoluciones y garantías -----------------------------
export function devolucionesDesdeApi(d) {
  return d.items.map((i) => ({
    id: `${d.id}-${i.id}`,
    devolucionId: id(d.id),
    ventaId: id(d.venta_id),
    numeroFactura: d.numero_factura || d.numero_venta,
    productoId: id(i.producto_id),
    varianteId: null,
    nombre: i.producto,
    varianteValor: '',
    cantidad: i.cantidad,
    monto: i.cantidad * numero(i.precio_unitario),
    motivo: d.motivo,
    estado: d.estado,
    estadoProducto: i.estado_producto,
    numeroSerie: i.numero_serie || '',
    fecha: d.fecha_devolucion,
    usuario: d.usuario,
  }));
}

export const garantiaDesdeApi = (g) => ({
  id: id(g.id),
  numero: g.numero_serie,
  nombre: g.producto,
  numeroFactura: g.numero_factura || g.numero_venta || '',
  cliente: g.cliente || '',
  descripcion: g.motivo,
  resolucion: g.resolucion || '',
  dentroDePeriodo: g.dentro_de_plazo !== false,
  estado: g.estado,
  fecha: g.fecha_apertura,
  fechaCierre: g.fecha_cierre,
});

// Trazabilidad por serie -> forma que muestra la pantalla de garantías
export function trazabilidadAInfo(t) {
  return {
    serie: { id: id(t.unidad.id), numero: t.unidad.numero_serie, lote: t.lote ? `Lote ${t.lote.id}` : '', estado: t.unidad.estado },
    producto: { id: id(t.producto.id), nombre: t.producto.nombre, sku: t.producto.sku },
    venta: t.venta
      ? {
          id: id(t.venta.id),
          numeroFactura: t.factura?.numero_factura || t.venta.numero_venta,
          fecha: t.venta.fecha_venta,
          cliente: t.cliente?.nombre || 'Consumidor final',
        }
      : null,
    garantia: t.garantia,
    dentroDePeriodo: t.garantia.estado === 'VIGENTE',
    diasTranscurridos: t.garantia.dias_transcurridos ?? null,
    diasRestantes: t.garantia.dias_restantes ?? null,
    diasGarantia: t.garantia.dias_garantia ?? null,
    garantiasPrevias: t.reclamos || [],
  };
}

// ----------------------------- Usuarios -----------------------------
export const usuarioDesdeApi = (u) => ({
  id: id(u.id),
  nombreUsuario: u.username,
  nombreCompleto: u.nombre_completo || u.username,
  email: u.email || '',
  rol: u.rol,
  rolId: u.rol_id,
  activo: u.estado !== false,
  ultimoLogin: u.ultimo_login,
});
