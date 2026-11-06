
import API from './axios';

// Crear un pedido
export const crearPedido = async (datos) => {
    const response = await API.post('/pedidos/', datos);
    return response.data;
};

// Listar todos los pedidos
export const obtenerPedidos = async () => {
    const response = await API.get('/pedidos/');
    return response.data;
};

// Listar pedidos por cliente
export const obtenerPedidosPorCliente = async (clienteId) => {
    const response = await API.get('/pedidos/', {
        params: { cliente_id: clienteId }
    });
    return response.data;
};

// Listar pedidos por estado
export const obtenerPedidosPorEstado = async (estado) => {
    const response = await API.get('/pedidos/', {
        params: { estado }
    });
    return response.data;
};

// Filtrar pedidos por cliente y estado
export const filtrarPedidos = async (clienteId, estado) => {
    const response = await API.get('/pedidos/', {
        params: {
            cliente_id: clienteId,
            estado
        }
    });
    return response.data;
};

// Consultar un pedido por ID
export const obtenerPedido = async (pedidoId) => {
    const response = await API.get(`/pedidos/${pedidoId}`);
    return response.data;
};

// Cambiar el estado de un pedido
export const cambiarEstadoPedido = async (pedidoId, nuevoEstado) => {
    const response = await API.patch(
        `/pedidos/${pedidoId}/estado`,
        { nuevo_estado: nuevoEstado }
    );
    return response.data;
};

// Actualizar los datos de entrega
export const actualizarDatosEntrega = async (pedidoId, datos) => {
    const response = await API.patch(
        `/pedidos/${pedidoId}/entrega`,
        datos
    );
    return response.data;
};

// Cancelar un pedido
export const cancelarPedido = async (pedidoId) => {
    const response = await API.patch(
        `/pedidos/${pedidoId}/cancelar`
    );
    return response.data;
};
