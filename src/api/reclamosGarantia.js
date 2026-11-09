
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


// Registra el reclamo localizando la venta por el número de serie.
//   201 -> reclamo creado · 404 -> serie inexistente
//   409 -> garantía vencida (15 días), unidad sin vender o reclamo ya pendiente
export const registrarReclamoPorSerie = async (datos) => {
    const response = await API.post('/reclamos-garantia/por-serie', datos);
    return { estado: response.status, ...response.data };
};

// Reclamos con número de serie, producto, factura, cliente y si estaban dentro del plazo
export const obtenerReclamosDetallados = async () => {
    const response = await API.get('/reclamos-garantia/detallados');
    return response.data;
};
