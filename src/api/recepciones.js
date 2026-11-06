
import API from './axios';

// Registrar recepción de mercadería
export const crearRecepcion = async (datos) => {
    const response = await API.post('/recepciones/', datos);
    return response.data;
};

// Listar todas las recepciones
export const obtenerRecepciones = async () => {
    const response = await API.get('/recepciones/');
    return response.data;
};

// Obtener recepción por ID
export const obtenerRecepcion = async (recepcionId) => {
    const response = await API.get(
        `/recepciones/${recepcionId}`
    );
    return response.data;
};

// Listar recepciones asociadas a una compra
export const obtenerRecepcionesPorCompra = async (compraId) => {
    const response = await API.get(
        `/recepciones/compra/${compraId}`
    );
    return response.data;
};

// Actualizar observaciones de una recepción
export const actualizarObservacionesRecepcion = async (
    recepcionId,
    observaciones
) => {
    const response = await API.patch(
        `/recepciones/${recepcionId}/observaciones`,
        { observaciones }
    );
    return response.data;
};
