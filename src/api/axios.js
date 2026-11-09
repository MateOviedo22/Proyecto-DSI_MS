import axios from 'axios';
import { ApiError, mensajePorEstado, tipoDeEstado } from './errores';

// URL base del backend. Se configura con REACT_APP_API_URL (ver .env.example).
const API = axios.create({
    baseURL: (process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api').replace(/\/+$/, ''),
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 20000,
});

// ---------------------------------------------------------------------------
// Avisos globales. Mientras silenciarErrores() está activo no se emiten (cargas en segundo plano).
// ---------------------------------------------------------------------------
let silencio = 0;

export async function silenciarErrores(funcion) {
    silencio += 1;
    try {
        return await funcion();
    } finally {
        silencio -= 1;
    }
}

const avisar = (tipo, mensaje, estado) => {
    if (silencio > 0) return;
    window.dispatchEvent(new CustomEvent('motoman:error-http', { detail: { tipo, mensaje, estado } }));
};

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
},
    (error)=> Promise.reject(error));

// ---------------------------------------------------------------------------
// Toda respuesta con error se convierte en un ApiError con { estado, codigo, mensaje }.
// ---------------------------------------------------------------------------
API.interceptors.response.use(
    (respuesta) => respuesta,
    (error) => {
        // El servidor no respondió (apagado, sin red, tiempo agotado).
        if (!error.response) {
            const sinConexion = new ApiError({ mensaje: mensajePorEstado(0), estado: 0, codigo: 'SIN_CONEXION', red: true });
            avisar('red', sinConexion.message, 0);
            return Promise.reject(sinConexion);
        }

        const { status, data } = error.response;
        const mensaje = data?.error || data?.mensaje || data?.message || data?.msg || mensajePorEstado(status);
        const apiError = new ApiError({ mensaje, estado: status, codigo: data?.codigo || null, detalle: data || null });
        const esLogin = String(error.config?.url || '').includes('/auth/login');

        if (status === 401 && !esLogin) {
            // Token vencido o inválido: se limpia la sesión y la aplicación vuelve al login.
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            window.dispatchEvent(new Event('motoman:sesion-expirada'));
        } else if (status === 403 || status >= 500) {
            avisar(tipoDeEstado(status), mensaje, status);
        }
        // 400 / 404 / 409: los muestra el formulario que hizo la petición (error corregible).

        return Promise.reject(apiError);
    }
);

export default API;
