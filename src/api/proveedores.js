
import API from './axios';

// Crear proveedor
export const crearProveedor = async (datos) => {
    const response = await API.post('/proveedores/', datos);
    return response.data;
};

// Listar todos los proveedores
export const obtenerProveedores = async () => {
    const response = await API.get('/proveedores/');
    return response.data;
};

// Buscar proveedores por nombre
export const buscarProveedores = async (termino) => {
    const response = await API.get('/proveedores/', {
        params: { buscar: termino }
    });
    return response.data;
};

// Obtener proveedor por ID
export const obtenerProveedor = async (proveedorId) => {
    const response = await API.get(
        `/proveedores/${proveedorId}`
    );
    return response.data;
};

// Actualizar proveedor
export const actualizarProveedor = async (proveedorId, datos) => {
    const response = await API.patch(
        `/proveedores/${proveedorId}`,
        datos
    );
    return response.data;
};

// Desactivar proveedor
export const desactivarProveedor = async (proveedorId) => {
    const response = await API.patch(
        `/proveedores/${proveedorId}/desactivar`
    );
    return response.data;
};

// Activar proveedor
export const activarProveedor = async (proveedorId) => {
    const response = await API.patch(
        `/proveedores/${proveedorId}/activar`
    );
    return response.data;
};
