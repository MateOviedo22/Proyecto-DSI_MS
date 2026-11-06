
import API from './axios';

// Agregar producto a una compra
export const agregarDetalleCompra = async (datos) => {
    const response = await API.post('/detalles-compra/', datos);
    return response.data;
};

// Listar detalles de una compra
export const obtenerDetallesPorCompra = async (compraId) => {
    const response = await API.get(
        `/detalles-compra/compra/${compraId}`
    );

    return response.data;
};

// Obtener un detalle por ID
export const obtenerDetalleCompra = async (detalleId) => {
    const response = await API.get(
        `/detalles-compra/${detalleId}`
    );

    return response.data;
};

// Eliminar detalle de compra
export const eliminarDetalleCompra = async (detalleId) => {
    const response = await API.delete(
        `/detalles-compra/${detalleId}`
    );

    return response.data;
};
