
import API from './axios';

// Registrar una persona
export const crearPersona = async (datos) => {
    const response = await API.post('/personas', datos);
    return response.data;
};

// Listar todas las personas
export const obtenerPersonas = async () => {
    const response = await API.get('/personas');
    return response.data;
};

// Buscar personas por término
export const buscarPersonas = async (termino) => {
    const response = await API.get('/personas', {
        params: { buscar: termino }
    });
    return response.data;
};

// Consultar una persona por ID
export const obtenerPersona = async (personaId) => {
    const response = await API.get(`/personas/${personaId}`);
    return response.data;
};

// Actualizar los datos de una persona
export const actualizarPersona = async (personaId, datos) => {
    const response = await API.patch(
        `/personas/${personaId}`,
        datos
    );
    return response.data;
};
