
import API from './axios';

// Crear un rol
export const crearRol = async (datos) => {
    const response = await API.post('/roles/', datos);
    return response.data;
};

// Obtener todos los roles
export const obtenerRoles = async () => {
    const response = await API.get('/roles/');
    return response.data;
};

// Obtener un rol por ID
export const obtenerRol = async (rolId) => {
    const response = await API.get(`/roles/${rolId}`);
    return response.data;
};

// Actualizar un rol
export const actualizarRol = async (rolId, datos) => {
    const response = await API.patch(`/roles/${rolId}`, datos);
    return response.data;
};

// Desactivar un rol
export const desactivarRol = async (rolId) => {
    const response = await API.patch(`/roles/${rolId}/desactivar`);
    return response.data;
};

// Activar un rol
export const activarRol = async (rolId) => {
    const response = await API.patch(`/roles/${rolId}/activar`);
    return response.data;
};
