
import API from './axios';

// Agregar un producto a una venta
export const agregarDetalleVenta = async (datos) => {
    const response = await API.post('/detalles-venta/', datos);
    return response.data;
};

// Listar los detalles de una venta
export const obtenerDetallesPorVenta = async (ventaId) => {
    const response = await API.get(
        `/detalles-venta/venta/${ventaId}`
    );
    return response.data;
};

// Obtener un detalle específico de venta
export const obtenerDetalleVenta = async (detalleId) => {
    const response = await API.get(`/detalles-venta/${detalleId}`);
    return response.data;
};

// Actualizar un detalle de venta
export const actualizarDetalleVenta = async (detalleId, datos) => {
    const response = await API.patch(
        `/detalles-venta/${detalleId}`,
        datos
    );
    return response.data;
};

// Eliminar un detalle de venta
export const eliminarDetalleVenta = async (detalleId) => {
    const response = await API.delete(`/detalles-venta/${detalleId}`);
    return response.data;
};
