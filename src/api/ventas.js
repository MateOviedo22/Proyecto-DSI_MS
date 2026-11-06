
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
