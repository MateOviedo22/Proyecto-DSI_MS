
import API from './axios';

// Crear un registro de existencia para un producto
export const crearExistencia = async (datos) => {
    const response = await API.post('/existencias/', datos);
    return response.data;
};

// Listar todas las existencias
export const obtenerExistencias = async () => {
    const response = await API.get('/existencias/');
    return response.data;
};

// Obtener la existencia de un producto
export const obtenerExistencia = async (productoId) => {
    const response = await API.get(`/existencias/${productoId}`);
    return response.data;
};

// Consultar la cantidad actual de stock de un producto
export const consultarStock = async (productoId) => {
    const response = await API.get(
        `/existencias/${productoId}/stock`
    );
    return response.data;
};

// Actualizar los niveles de stock de un producto
export const actualizarNivelesStock = async (
    productoId,
    datos
) => {
    const response = await API.patch(
        `/existencias/${productoId}/niveles`,
        datos
    );
    return response.data;
};

// Listar productos con stock bajo
export const obtenerStockBajo = async () => {
    const response = await API.get('/existencias/stock-bajo');
    return response.data;
};

// Listar productos sin existencias
export const obtenerStockAgotado = async () => {
    const response = await API.get('/existencias/stock-agotado');
    return response.data;
};
