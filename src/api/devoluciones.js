
import API from './axios';

// Crear una devolución
export const crearDevolucion = async (datos) => {
  const response = await API.post('/devoluciones/', datos);
  return response.data;
};

// Listar todas las devoluciones
export const obtenerDevoluciones = async () => {
  const response = await API.get('/devoluciones/');
  return response.data;
};

// Listar devoluciones asociadas a una venta
export const obtenerDevolucionesPorVenta = async (ventaId) => {
  const response = await API.get(`/devoluciones/venta/${ventaId}`);
  return response.data;
};

// Listar devoluciones por estado
export const obtenerDevolucionesPorEstado = async (estado) => {
  const response = await API.get(
    `/devoluciones/estado/${encodeURIComponent(estado)}`
  );
  return response.data;
};

// Obtener una devolución específica
export const obtenerDevolucion = async (devolucionId) => {
  const response = await API.get(`/devoluciones/${devolucionId}`);
  return response.data;
};

// Actualizar las observaciones de una devolución
export const actualizarObservacionesDevolucion = async (
  devolucionId,
  observaciones
) => {
  const response = await API.patch(
    `/devoluciones/${devolucionId}/observaciones`,
    { observaciones }
  );
  return response.data;
};

// Cambiar el estado de una devolución
export const cambiarEstadoDevolucion = async (
  devolucionId,
  estado
) => {
  const response = await API.patch(
    `/devoluciones/${devolucionId}/estado`,
    { estado }
  );
  return response.data;
};

// Finalizar una devolución
export const finalizarDevolucion = async (devolucionId) => {
  const response = await API.patch(
    `/devoluciones/${devolucionId}/finalizar`
  );
  return response.data;
};
