
import API from './axios';

// Crear asociación entre producto y proveedor
export const crearAsociacionProductoProveedor = async (datos) => {
    const response = await API.post('/producto-proveedores/', datos);
    return response.data;
};

// Listar todas las asociaciones
export const obtenerAsociaciones = async () => {
    const response = await API.get('/producto-proveedores/');
    return response.data;
};

// Obtener asociación por ID
export const obtenerAsociacion = async (asociacionId) => {
    const response = await API.get(
        `/producto-proveedores/${asociacionId}`
    );
    return response.data;
};

// Listar proveedores asociados a un producto
export const obtenerProveedoresPorProducto = async (productoId) => {
    const response = await API.get(
        `/producto-proveedores/producto/${productoId}`
    );
    return response.data;
};

// Listar productos asociados a un proveedor
export const obtenerProductosPorProveedor = async (proveedorId) => {
    const response = await API.get(
        `/producto-proveedores/proveedor/${proveedorId}`
    );
    return response.data;
};

// Buscar asociación por producto y proveedor
export const buscarAsociacion = async (productoId, proveedorId) => {
    const response = await API.get(
        `/producto-proveedores/buscar/${productoId}/${proveedorId}`
    );
    return response.data;
};

// Actualizar datos de una asociación
export const actualizarAsociacion = async (asociacionId, datos) => {
    const response = await API.patch(
        `/producto-proveedores/${asociacionId}`,
        datos
    );
    return response.data;
};

// Establecer proveedor principal
export const establecerProveedorPrincipal = async (asociacionId) => {
    const response = await API.patch(
        `/producto-proveedores/${asociacionId}/principal`
    );
    return response.data;
};

// Desactivar asociación
export const desactivarAsociacion = async (asociacionId) => {
    const response = await API.patch(
        `/producto-proveedores/${asociacionId}/desactivar`
    );
    return response.data;
};

// Activar asociación
export const activarAsociacion = async (asociacionId) => {
    const response = await API.patch(
        `/producto-proveedores/${asociacionId}/activar`
    );
    return response.data;
};
