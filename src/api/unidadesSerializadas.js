
import API from './axios';

// Obtener una unidad serializada por ID
export const obtenerUnidadSerializada = async (unidadId) => {
    const response = await API.get(
        `/unidades-serializadas/${unidadId}`
    );
    return response.data;
};

// Listar unidades serializadas por producto
export const obtenerUnidadesPorProducto = async (productoId) => {
    const response = await API.get(
        `/unidades-serializadas/producto/${productoId}`
    );
    return response.data;
};

// Listar unidades serializadas por detalle de venta
export const obtenerUnidadesPorDetalleVenta = async (
    detalleVentaId
) => {
    const response = await API.get(
        `/unidades-serializadas/detalle-venta/${detalleVentaId}`
    );
    return response.data;
};


// Todas las unidades serializadas (número, producto, estado, venta asociada)
export const obtenerUnidades = async () => {
    const response = await API.get('/unidades-serializadas/listado');
    return response.data;
};

// Unidades EN_STOCK de un producto (para elegir la serie al vender)
export const obtenerUnidadesDisponibles = async (productoId) => {
    const response = await API.get('/unidades-serializadas/disponibles', { params: { producto_id: productoId } });
    return response.data;
};

// Registra números de serie nuevos de un producto (201; 409 si alguno ya existe)
export const registrarSeries = async (datos) => {
    const response = await API.post('/unidades-serializadas/registro', datos);
    return { estado: response.status, ...response.data };
};

// Trazabilidad por número de serie: producto, lote, venta, factura, cliente y estado de la
// garantía (VIGENTE / VENCIDA / SIN_GARANTIA / NO_VENDIDA) con días transcurridos y restantes.
export const buscarPorNumeroSerie = async (numeroSerie) => {
    const response = await API.get('/unidades-serializadas/buscar', { params: { numero_serie: numeroSerie } });
    return response.data;
};
