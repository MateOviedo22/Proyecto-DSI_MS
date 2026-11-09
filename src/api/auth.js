
import API from './axios';

// Iniciar sesión contra Flask
export const iniciarSesion = async (credenciales) => {
    const response = await API.post('/auth/login', {
        username: credenciales.username,
        password: credenciales.password,
    });

    const { access_token, usuario } = response.data;

    if (!access_token || !usuario) {
        throw new Error('El servidor no devolvió los datos necesarios para iniciar sesión.');
    }

    localStorage.setItem('token', access_token);
    localStorage.setItem('usuario', JSON.stringify(usuario));

    return response.data;
};

// Consultar y validar al usuario autenticado
export const obtenerPerfil = async () => {
    const response = await API.get('/auth/me');
    return response.data;
};

// Cerrar sesión local
export const cerrarSesionAPI = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
};
