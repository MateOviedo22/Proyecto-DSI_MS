
import API from './axios';

// Registrar el precio inicial de un producto
export const registrarPrecio = async (productoId, datos) => {
    const response = await API.post(
        `/precios/producto/${productoId}`,
        datos
    );
    return response.data;
};

// Modificar el precio vigente de un producto
export const modificarPrecio = async (productoId, datos) => {
    const response = await API.patch(
        `/precios/producto/${productoId}`,
        datos
    );
    return response.data;
};

// Consultar el precio actual de un producto
export const obtenerPrecioActual = async (productoId) => {
    const response = await API.get(
        `/precios/producto/${productoId}/actual`
    );
    return response.data;
};

// Consultar el historial de precios de un producto
export const obtenerHistorialPrecios = async (productoId) => {
    const response = await API.get(
        `/precios/producto/${productoId}/historial`
    );
    return response.data;
};
