
import API from './axios';

// Crear producto
export const crearProducto = async (datos) => {
    const response = await API.post('/productos/', datos);
    return response.data;
};

// Listar todos los productos
export const obtenerProductos = async () => {
    const response = await API.get('/productos/');
    return response.data;
};

// Buscar productos por nombre o SKU
export const buscarProductos = async (termino) => {
    const response = await API.get('/productos/', {
        params: { buscar: termino }
    });
    return response.data;
};

// Listar productos por categoría
export const obtenerProductosPorCategoria = async (categoriaId) => {
    const response = await API.get(
        `/productos/categoria/${categoriaId}`
    );
    return response.data;
};

// Obtener producto por ID
export const obtenerProducto = async (productoId) => {
    const response = await API.get(`/productos/${productoId}`);
    return response.data;
};

// Actualizar producto
export const actualizarProducto = async (productoId, datos) => {
    const response = await API.patch(
        `/productos/${productoId}`,
        datos
    );
    return response.data;
};

// Desactivar producto
export const desactivarProducto = async (productoId) => {
    const response = await API.patch(
        `/productos/${productoId}/desactivar`
    );
    return response.data;
};

// Activar producto
export const activarProducto = async (productoId) => {
    const response = await API.patch(
        `/productos/${productoId}/activar`
    );
    return response.data;
};


// Catálogo: producto + categoría + precio vigente + existencias + costo + proveedor
export const obtenerCatalogo = async () => {
    const response = await API.get('/productos/catalogo');
    return response.data;
};

// Crea producto, precio inicial, existencia, proveedor y stock inicial en una transacción
export const crearProductoCompleto = async (datos) => {
    const response = await API.post('/productos/completo', datos);
    return { estado: response.status, ...response.data };
};

// Actualiza datos, precio, niveles de stock y proveedor principal en una transacción
export const editarProductoCompleto = async (productoId, datos) => {
    const response = await API.patch(`/productos/${productoId}/completo`, datos);
    return response.data;
};
