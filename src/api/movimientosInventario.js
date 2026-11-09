
import API from './axios';

// Listar todos los movimientos de inventario
export const obtenerMovimientos = async () => {
    const response = await API.get('/movimientos-inventario/');
    return response.data;
};

// Obtener un movimiento por su ID
export const obtenerMovimiento = async (movimientoId) => {
    const response = await API.get(
        `/movimientos-inventario/${movimientoId}`
    );
    return response.data;
};

// Listar movimientos asociados a un producto
export const obtenerMovimientosPorProducto = async (productoId) => {
    const response = await API.get(
        `/movimientos-inventario/producto/${productoId}`
    );
    return response.data;
};

// Registrar un ajuste manual de inventario
export const ajustarExistencia = async (datos) => {
    const response = await API.post(
        '/movimientos-inventario/ajustes',
        datos
    );
    return response.data;
};


// Entradas y salidas con nombre de producto, usuario y origen (recepción, venta, devolución)
export const obtenerMovimientosDetallados = async () => {
    const response = await API.get('/movimientos-inventario/detallados');
    return response.data;
};
