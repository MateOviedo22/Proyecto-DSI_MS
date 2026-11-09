
import API from './axios';

// Emitir una factura
export const emitirFactura = async (datos) => {
    const response = await API.post('/facturas/', datos);
    return response.data;
};

// Listar todas las facturas
export const obtenerFacturas = async () => {
    const response = await API.get('/facturas/');
    return response.data;
};

// Listar facturas por estado
export const obtenerFacturasPorEstado = async (estado) => {
    const response = await API.get(
        `/facturas/estado/${encodeURIComponent(estado)}`
    );
    return response.data;
};

// Obtener factura asociada a una venta
export const obtenerFacturaPorVenta = async (ventaId) => {
    const response = await API.get(
        `/facturas/venta/${ventaId}`
    );
    return response.data;
};

// Buscar factura por número
export const obtenerFacturaPorNumero = async (numeroFactura) => {
    const response = await API.get(
        `/facturas/numero/${encodeURIComponent(numeroFactura)}`
    );
    return response.data;
};

// Obtener factura por ID
export const obtenerFactura = async (facturaId) => {
    const response = await API.get(`/facturas/${facturaId}`);
    return response.data;
};

// Anular una factura
export const anularFactura = async (facturaId, motivo) => {
    const response = await API.patch(
        `/facturas/${facturaId}/anular`,
        { motivo }
    );
    return response.data;
};
