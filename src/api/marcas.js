
import API from './axios';

// Crear una marca
export const crearMarca = async (nombre) => {
    const response = await API.post('/marcas/', { nombre });
    return response.data;
};

// Listar todas las marcas
export const obtenerMarcas = async () => {
    const response = await API.get('/marcas/');
    return response.data;
};

// Buscar marcas por nombre
export const buscarMarcas = async (termino) => {
    const response = await API.get('/marcas/', {
        params: { buscar: termino },
    });
    return response.data;
};

// Obtener una marca por su ID
export const obtenerMarca = async (marcaId) => {
    const response = await API.get(`/marcas/${marcaId}`);
    return response.data;
};

// Actualizar una marca
export const actualizarMarca = async (marcaId, nombre) => {
    const response = await API.patch(`/marcas/${marcaId}`, {
        nombre,
    });
    return response.data;
};

// Desactivar una marca
export const desactivarMarca = async (marcaId) => {
    const response = await API.patch(
        `/marcas/${marcaId}/desactivar`
    );
    return response.data;
};

// Activar una marca
export const activarMarca = async (marcaId) => {
    const response = await API.patch(
        `/marcas/${marcaId}/activar`
    );
    return response.data;
};
