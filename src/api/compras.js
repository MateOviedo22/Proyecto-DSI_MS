
import API from './axios';

// Crear compra
export const crearCompra = async (datos) => {
    const response = await API.post('/compras/', datos);
    return response.data;
};

// Listar todas las compras
export const obtenerCompras = async () => {
    const response = await API.get('/compras/');
    return response.data;
};

// Obtener compra por ID
export const obtenerCompra = async (compraId) => {
    const response = await API.get(`/compras/${compraId}`);
    return response.data;
};

// Listar compras de un proveedor
export const obtenerComprasPorProveedor = async (proveedorId) => {
    const response = await API.get(
        `/compras/proveedor/${proveedorId}`
    );

    return response.data;
};

// Cambiar estado de una compra
export const cambiarEstadoCompra = async (compraId, nuevoEstado) => {
    const response = await API.patch(
        `/compras/${compraId}/estado`,
        { nuevo_estado: nuevoEstado }
    );

    return response.data;
};

// Actualizar observaciones de una compra
export const actualizarObservacionesCompra = async (
    compraId,
    observaciones
) => {
    const response = await API.patch(
        `/compras/${compraId}/observaciones`,
        { observaciones }
    );

    return response.data;
};


// Vista previa del costo unitario total con el envío repartido en proporción: C = C_adq + E/n
export const calcularCostoProporcional = async (datos) => {
    const response = await API.post('/compras/costo-proporcional', datos);
    return response.data;
};

// Crea la orden con sus productos y la deja enviada al proveedor (201)
export const registrarCompraCompleta = async (datos) => {
    const response = await API.post('/compras/completa', datos);
    return { estado: response.status, ...response.data };
};

// Compras con sus líneas: solicitado, recibido, rechazado, faltante y costos de lote
export const obtenerComprasDetalladas = async () => {
    const response = await API.get('/compras/detalladas');
    return response.data;
};
