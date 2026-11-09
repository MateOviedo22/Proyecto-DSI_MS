// src/api/errores.js
// Errores HTTP normalizados. El interceptor de axios.js convierte cualquier fallo de
// la API en un ApiError; la interfaz usa describirError() para decidir qué mostrar.
//
//   400 Bad Request   datos inválidos        -> mensaje junto al formulario
//   401 Unauthorized  sesión vencida/inválida -> se cierra la sesión
//   403 Forbidden     rol sin permiso         -> aviso "no tienes permiso"
//   404 Not Found     recurso inexistente     -> mensaje junto al formulario
//   409 Conflict      existencias insuficientes, duplicados, garantía vencida...
//                     -> mensaje que identifica el producto y refresco de existencias
//   5xx / sin red     problema del servidor   -> aviso general

export class ApiError extends Error {
  constructor({ mensaje, estado = 0, codigo = null, detalle = null, red = false }) {
    super(mensaje);
    this.name = 'ApiError';
    this.estado = estado; // código HTTP (0 = el servidor no respondió)
    this.codigo = codigo; // código de aplicación, p. ej. EXISTENCIAS_INSUFICIENTES
    this.detalle = detalle; // cuerpo JSON completo de la respuesta
    this.red = red;
  }
}

export function tipoDeEstado(estado) {
  if (estado === 0) return 'red';
  if (estado === 400 || estado === 422) return 'validacion';
  if (estado === 401) return 'sesion';
  if (estado === 403) return 'permiso';
  if (estado === 404) return 'no_encontrado';
  if (estado === 409) return 'conflicto';
  if (estado >= 500) return 'servidor';
  return 'otro';
}

const TITULOS = {
  red: 'Sin conexión',
  validacion: 'Datos inválidos',
  sesion: 'Sesión vencida',
  permiso: 'Sin permiso',
  no_encontrado: 'No encontrado',
  conflicto: 'No se pudo completar',
  servidor: 'Error del servidor',
  otro: 'Error',
};

const MENSAJES_POR_ESTADO = {
  0: 'No se pudo conectar con el servidor. Verifica que el backend esté encendido.',
  401: 'Tu sesión expiró. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta operación.',
  404: 'No se encontró el recurso solicitado.',
  500: 'El servidor tuvo un problema. Intenta de nuevo en un momento.',
};

export function mensajePorEstado(estado) {
  return MENSAJES_POR_ESTADO[estado] || (estado >= 500 ? MENSAJES_POR_ESTADO[500] : `Error inesperado (${estado}).`);
}

// Devuelve { estado, codigo, tipo, titulo, mensaje, detalle } para cualquier error.
export function describirError(error) {
  if (error instanceof ApiError) {
    const tipo = tipoDeEstado(error.estado);
    return { estado: error.estado, codigo: error.codigo, tipo, titulo: TITULOS[tipo], mensaje: error.message, detalle: error.detalle };
  }
  return { estado: 0, codigo: null, tipo: 'otro', titulo: TITULOS.otro, mensaje: error?.message || 'Ocurrió un error inesperado.', detalle: null };
}

// Estados 4xx que el usuario puede corregir y que se muestran junto al formulario.
export const esErrorDeNegocio = (error) => [400, 404, 409, 422].includes(error?.estado);
