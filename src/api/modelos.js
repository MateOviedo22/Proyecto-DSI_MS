
import API from './axios';

// Crear un modelo
export const crearModelo = async (datos) => {
    const response = await API.post('/modelos/', datos);
    return response.data;
};

// Listar todos los modelos
export const obtenerModelos = async () => {
    const response = await API.get('/modelos/');
    return response.data;
};

// Buscar modelos por nombre
export const buscarModelos = async (termino) => {
    const response = await API.get('/modelos/', {
        params: { buscar: termino },
    });
    return response.data;
};

// Listar modelos asociados a una marca
export const obtenerModelosPorMarca = async (marcaId) => {
    const response = await API.get(`/modelos/marca/${marcaId}`);
    return response.data;
};

// Obtener un modelo por su ID
export const obtenerModelo = async (modeloId) => {
    const response = await API.get(`/modelos/${modeloId}`);
    return response.data;
};

// Actualizar un modelo
export const actualizarModelo = async (modeloId, datos) => {
    const response = await API.patch(
        `/modelos/${modeloId}`,
        datos
    );
    return response.data;
};

// Desactivar un modelo
export const desactivarModelo = async (modeloId) => {
    const response = await API.patch(
        `/modelos/${modeloId}/desactivar`
    );
    return response.data;
};

// Activar un modelo
export const activarModelo = async (modeloId) => {
    const response = await API.patch(
        `/modelos/${modeloId}/activar`
    );
    return response.data;
};
