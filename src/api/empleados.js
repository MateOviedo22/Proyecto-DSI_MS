
import API from './axios';

// Registrar un empleado
export const crearEmpleado = async (datos) => {
    const response = await API.post('/empleados', datos);
    return response.data;
};

// Listar empleados
export const obtenerEmpleados = async (soloActivos = false) => {
    const response = await API.get('/empleados', {
        params: { solo_activos: soloActivos },
    });
    return response.data;
};

// Buscar empleados por nombre u otro término admitido por el servicio
export const buscarEmpleados = async (
    termino,
    soloActivos = false
) => {
    const response = await API.get('/empleados', {
        params: {
            buscar: termino,
            solo_activos: soloActivos,
        },
    });
    return response.data;
};

// Obtener un empleado por su ID
export const obtenerEmpleado = async (empleadoId) => {
    const response = await API.get(`/empleados/${empleadoId}`);
    return response.data;
};

// Actualizar información de un empleado
export const actualizarEmpleado = async (empleadoId, datos) => {
    const response = await API.patch(
        `/empleados/${empleadoId}`,
        datos
    );
    return response.data;
};

// Desactivar un empleado
export const desactivarEmpleado = async (empleadoId) => {
    const response = await API.patch(
        `/empleados/${empleadoId}/desactivar`
    );
    return response.data;
};

// Activar un empleado
export const activarEmpleado = async (empleadoId) => {
    const response = await API.patch(
        `/empleados/${empleadoId}/activar`
    );
    return response.data;
};
