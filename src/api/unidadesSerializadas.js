
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
