
import API from './axios';

// Listar todas las notificaciones del usuario autenticado
export const obtenerNotificaciones = async () => {
  const response = await API.get('/notificaciones/');
  return response.data;
};

// Listar únicamente las notificaciones no leídas
export const obtenerNotificacionesNoLeidas = async () => {
  const response = await API.get('/notificaciones/no-leidas');
  return response.data;
};

// Contar notificaciones no leídas
export const contarNotificacionesNoLeidas = async () => {
  const response = await API.get('/notificaciones/no-leidas/contar');
  return response.data;
};

// Crear una notificación
export const crearNotificacion = async (datos) => {
  const response = await API.post('/notificaciones/', datos);
  return response.data;
};

// Marcar una notificación como leída
export const marcarNotificacionComoLeida = async (notificacionId) => {
  const response = await API.patch(
    `/notificaciones/${notificacionId}/leer`
  );
  return response.data;
};

// Marcar todas las notificaciones como leídas
export const marcarTodasComoLeidas = async () => {
  const response = await API.patch('/notificaciones/leer-todas');
  return response.data;
};

// Eliminar una notificación
export const eliminarNotificacion = async (notificacionId) => {
  const response = await API.delete(
    `/notificaciones/${notificacionId}`
  );
  return response.data;
};

// Generar alerta de stock para un producto
export const generarAlertaStock = async (productoId) => {
  const response = await API.post(
    `/notificaciones/alerta-stock/${productoId}`
  );
  return response.data;
};
