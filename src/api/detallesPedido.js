
import API from './axios';

// Agregar un producto a un pedido
export const agregarDetallePedido = async (datos) => {
    const response = await API.post('/detalles-pedido/', datos);
    return response.data;
};

// Listar los detalles de un pedido
export const obtenerDetallesPorPedido = async (pedidoId) => {
    const response = await API.get(
        `/detalles-pedido/pedido/${pedidoId}`
    );
    return response.data;
};

// Obtener un detalle específico de pedido
export const obtenerDetallePedido = async (detalleId) => {
    const response = await API.get(`/detalles-pedido/${detalleId}`);
    return response.data;
};

// Obtener un producto específico dentro de un pedido
export const obtenerDetallePedidoPorProducto = async (
    pedidoId,
    productoId
) => {
    const response = await API.get(
        `/detalles-pedido/pedido/${pedidoId}/producto/${productoId}`
    );
    return response.data;
};

// Actualizar un detalle de pedido
export const actualizarDetallePedido = async (detalleId, datos) => {
    const response = await API.patch(
        `/detalles-pedido/${detalleId}`,
        datos
    );
    return response.data;
};

// Eliminar un producto de un pedido
export const eliminarDetallePedido = async (detalleId) => {
    const response = await API.delete(`/detalles-pedido/${detalleId}`);
    return response.data;
};
