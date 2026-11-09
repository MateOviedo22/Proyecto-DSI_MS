
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


// Recepción atómica: concilia lo solicitado con lo recibido, registra rechazos y faltantes,
// crea el lote con el costo proporcional del envío, suma al inventario solo lo aceptado y
// registra los números de serie de las cámaras.
//   201 -> { recepcion, compra, lineas[ { faltante_acumulado, lote:{ costo_unitario_total } } ] }
//   400 -> cantidades inválidas / faltan series · 409 -> número de serie repetido
export const registrarRecepcionCompleta = async (datos) => {
    const response = await API.post('/recepciones/completa', datos);
    return { estado: response.status, ...response.data };
};
