
import API from './axios';

// Crear una venta
export const crearVenta = async (datos) => {
    const response = await API.post('/ventas/', datos);
    return response.data;
};

// Listar todas las ventas
export const obtenerVentas = async () => {
    const response = await API.get('/ventas/');
    return response.data;
};

// Listar ventas por estado
export const obtenerVentasPorEstado = async (estado) => {
    const response = await API.get(
        `/ventas/estado/${encodeURIComponent(estado)}`
    );
    return response.data;
};

// Listar ventas por cliente
export const obtenerVentasPorCliente = async (clienteId) => {
    const response = await API.get(
        `/ventas/cliente/${clienteId}`
    );
    return response.data;
};

// Obtener una venta por ID
export const obtenerVenta = async (ventaId) => {
    const response = await API.get(`/ventas/${ventaId}`);
    return response.data;
};

// Confirmar una venta
export const confirmarVenta = async (ventaId) => {
    const response = await API.patch(
        `/ventas/${ventaId}/confirmar`
    );
    return response.data;
};

// Anular una venta
export const anularVenta = async (ventaId, motivo) => {
    const response = await API.patch(
        `/ventas/${ventaId}/anular`,
        { motivo }
    );
    return response.data;
};


// ---------------------------------------------------------------------------
// Flujo transaccional de ventas (Cap. II, "Ciclo de vida de una venta")
// ---------------------------------------------------------------------------

// Registra la venta completa en UNA petición: crea la venta, agrega los productos,
// descuenta existencias, asigna números de serie, inicia la garantía y emite la factura.
//   201 -> comprobante { venta, factura, emisor, cliente, vendedor, items, existencias }
//   400 -> datos inválidos · 403 -> rol sin permiso · 404 -> producto inexistente
//   409 -> existencias insuficientes (el mensaje identifica el producto)
export const registrarVentaCompleta = async (datos) => {
    const response = await API.post('/ventas/completa', datos);
    return { estado: response.status, ...response.data };
};

// Ventas con sus líneas, costo aplicado, devoluciones y series (historial y reportes)
export const obtenerVentasDetalladas = async (filtros = {}) => {
    const response = await API.get('/ventas/detalladas', { params: filtros });
    return response.data;
};

// Comprobante de una venta ya emitida (reimpresión de factura)
export const obtenerComprobante = async (ventaId) => {
    const response = await API.get(`/ventas/${ventaId}/comprobante`);
    return response.data;
};
