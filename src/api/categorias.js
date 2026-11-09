
import API from './axios';

// Crear categoría
export const crearCategoria = async (datos) => {
    const response = await API.post('/categorias', datos);
    return response.data;
};

// Listar categorías
export const obtenerCategorias = async () => {
    const response = await API.get('/categorias');
    return response.data;
};

// Buscar categorías por nombre
export const buscarCategorias = async (nombre) => {
    const response = await API.get('/categorias', {
        params: { nombre },
    });

    return response.data;
};

// Obtener categoría por ID
export const obtenerCategoria = async (id) => {
    const response = await API.get(`/categorias/${id}`);
    return response.data;
};

// Actualizar categoría
export const actualizarCategoria = async (id, datos) => {
    const response = await API.patch(`/categorias/${id}`, datos);
    return response.data;
};

// Activar categoría
export const activarCategoria = async (id) => {
    const response = await API.patch(`/categorias/${id}/activar`);
    return response.data;
};

// Desactivar categoría
export const desactivarCategoria = async (id) => {
    const response = await API.patch(`/categorias/${id}/desactivar`);
    return response.data;
};
