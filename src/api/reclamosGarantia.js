
import API from './axios';

// Registrar un reclamo de garantía
export const crearReclamoGarantia = async (datos) => {
    const response = await API.post('/reclamos-garantia/', datos);
    return response.data;
};

// Obtener todos los reclamos
export const obtenerReclamosGarantia = async () => {
    const response = await API.get('/reclamos-garantia/');
    return response.data;
};

// Obtener reclamos de una unidad serializada
export const obtenerReclamosPorUnidad = async (unidadSerializadaId) => {
    const response = await API.get(
        `/reclamos-garantia/unidad/${unidadSerializadaId}`
    );
    return response.data;
};

// Obtener reclamos por estado
export const obtenerReclamosPorEstado = async (estado) => {
    const response = await API.get(
        `/reclamos-garantia/estado/${encodeURIComponent(estado)}`
    );
    return response.data;
};

// Obtener un reclamo por ID
export const obtenerReclamoGarantia = async (reclamoId) => {
    const response = await API.get(`/reclamos-garantia/${reclamoId}`);
    return response.data;
};

// Registrar o actualizar la resolución
export const actualizarResolucionReclamo = async (
    reclamoId,
    resolucion
) => {
    const response = await API.patch(
        `/reclamos-garantia/${reclamoId}/resolucion`,
        { resolucion }
    );
    return response.data;
};

// Cambiar estado del reclamo
export const cambiarEstadoReclamo = async (
    reclamoId,
    estado
) => {
    const response = await API.patch(
        `/reclamos-garantia/${reclamoId}/estado`,
        { estado }
    );
    return response.data;
};
