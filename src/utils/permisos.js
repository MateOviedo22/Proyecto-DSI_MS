// src/utils/permisos.js
// Roles y permisos por módulo (RF-47 a RF-49, RNF "Control de acceso por usuario").
// La matriz por defecto puede modificarse desde Usuarios y roles; se guarda en la configuración.

export const ROLES = ['Administrador', 'Vendedor', 'Encargado de Inventario'];

export const MODULOS = [
  { id: 'inicio', label: 'Panel de inicio' },
  { id: 'productos', label: 'Consultar catálogo y existencias' },
  { id: 'productos_gestion', label: 'Registrar, editar y dar de baja productos; actualizar precios' },
  { id: 'costos', label: 'Ver costos y márgenes de ganancia' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'compras', label: 'Compras y recepción de mercadería' },
  { id: 'inventario', label: 'Movimientos de inventario' },
  { id: 'ventas', label: 'Ventas y facturación' },
  { id: 'garantias', label: 'Garantías y devoluciones' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'usuarios', label: 'Usuarios y roles' },
  { id: 'configuracion', label: 'Configuración, respaldos y auditoría' },
];

export const PERMISOS_POR_DEFECTO = {
  Administrador: MODULOS.map((m) => m.id),
  Vendedor: ['inicio', 'productos', 'ventas', 'garantias'],
  'Encargado de Inventario': ['inicio', 'productos', 'productos_gestion', 'costos', 'proveedores', 'compras', 'inventario', 'reportes'],
};

// El Administrador siempre conserva todos los permisos (evita bloquear el sistema).
export function puede(rol, modulo, matriz = PERMISOS_POR_DEFECTO) {
  if (rol === 'Administrador') return true;
  return Boolean(matriz?.[rol]?.includes(modulo));
}
