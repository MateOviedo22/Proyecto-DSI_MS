
import API from './axios';

// Registrar cliente
export const crearCliente = async (datos) => {
    const response = await API.post('/clientes/', datos);
    return response.data;
};

// Listar todos los clientes
export const obtenerClientes = async () => {
    const response = await API.get('/clientes/');
    return response.data;
};

// Buscar clientes por término
export const buscarClientes = async (termino) => {
    const response = await API.get('/clientes/', {
        params: { buscar: termino },
    });

    return response.data;
};

// Obtener cliente por ID
export const obtenerCliente = async (id) => {
    const response = await API.get(`/clientes/${id}`);
    return response.data;
};

// Buscar cliente por identificación fiscal
export const obtenerClientePorIdentificacion = async (valor) => {
    const response = await API.get('/clientes/identificacion', {
        params: { valor },
    });

    return response.data;
};

// Actualizar cliente
export const actualizarCliente = async (id, datos) => {
    const response = await API.patch(`/clientes/${id}`, datos);
    return response.data;
};
