
import API from './axios';

// Listar todos los lotes
export const obtenerLotes = async () => {
  const response = await API.get('/lotes/');
  return response.data;
};

// Obtener un lote por su ID
export const obtenerLote = async (loteId) => {
  const response = await API.get(`/lotes/${loteId}`);
  return response.data;
};

// Listar lotes asociados a un detalle de recepción
export const obtenerLotesPorDetalleRecepcion = async (
  detalleRecepcionId
) => {
  const response = await API.get(
    `/lotes/detalle-recepcion/${detalleRecepcionId}`
  );
  return response.data;
};

// Finalizar la recepción de mercancía
export const finalizarRecepcion = async (recepcionId) => {
  const response = await API.post(
    `/lotes/finalizar-recepcion/${recepcionId}`
  );
  return response.data;
};
