
import API from './axios';

// Registrar un usuario
export const crearUsuario = async (datos) => {
    const response = await API.post('/usuarios', datos);
    return response.data;
};

// Listar usuarios
export const obtenerUsuarios = async () => {
    const response = await API.get('/usuarios');
    return response.data;
};

// Buscar usuario por username
export const buscarUsuario = async (username) => {
    const response = await API.get('/usuarios', {
        params: { username }
    });
    return response.data;
};

// Obtener usuario por ID
export const obtenerUsuario = async (usuarioId) => {
    const response = await API.get(`/usuarios/${usuarioId}`);
    return response.data;
};

// Actualizar información de usuario
export const actualizarUsuario = async (usuarioId, datos) => {
    const response = await API.patch(
        `/usuarios/${usuarioId}`,
        datos
    );
    return response.data;
};

// Cambiar contraseña
export const cambiarContrasena = async (
    usuarioId,
    contrasenaActual,
    nuevaContrasena
) => {
    const response = await API.patch(
        `/usuarios/${usuarioId}/contrasena`,
        {
            contrasena_actual: contrasenaActual,
            nueva_contrasena: nuevaContrasena
        }
    );
    return response.data;
};

// Desactivar usuario
export const desactivarUsuario = async (usuarioId) => {
    const response = await API.patch(
        `/usuarios/${usuarioId}/desactivar`
    );
    return response.data;
};

// Activar usuario
export const activarUsuario = async (usuarioId) => {
    const response = await API.patch(
        `/usuarios/${usuarioId}/activar`
    );
    return response.data;
};
