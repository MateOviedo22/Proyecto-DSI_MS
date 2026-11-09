
import API from './axios';

// Agregar un producto a una devolución
export const agregarDetalleDevolucion = async (datos) => {
    const response = await API.post('/detalles-devolucion/', datos);
    return response.data;
};

// Listar los detalles de una devolución
export const obtenerDetallesPorDevolucion = async (devolucionId) => {
    const response = await API.get(
        `/detalles-devolucion/devolucion/${devolucionId}`
    );
    return response.data;
};

// Obtener un detalle específico de devolución
export const obtenerDetalleDevolucion = async (detalleId) => {
    const response = await API.get(`/detalles-devolucion/${detalleId}`);
    return response.data;
};

// Registrar la inspección de un producto devuelto
export const inspeccionarDetalleDevolucion = async (detalleId, datos) => {
    const response = await API.patch(
        `/detalles-devolucion/${detalleId}/inspeccionar`,
        datos
    );
    return response.data;
};
