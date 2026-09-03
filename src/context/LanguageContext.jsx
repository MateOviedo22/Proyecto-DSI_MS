// src/context/LanguageContext.jsx
//
// Cambio de idioma español/inglés para la interfaz principal (menú, barra
// superior, inicio de sesión, encabezados de página y acciones comunes).
// El contenido interno de cada módulo (Compras, Ventas, Reportes, etc.)
// se mantiene en español por ahora; extender la tabla `traducciones` es
// suficiente para ir cubriendo más pantallas. (creo que no seguié da weba esto de traducir)
import { createContext, useContext, useEffect, useState } from 'react';

const traducciones = {
  es: {
    inicio: 'Inicio',
    catalogoProductos: 'Catálogo de Productos',
    proveedores: 'Proveedores',
    comprasRecepcion: 'Compras y Recepción',
    movimientosInventario: 'Movimientos de Inventario',
    ventasFacturacion: 'Ventas y Facturación',
    reportes: 'Reportes',
    usuariosRoles: 'Usuarios y Roles',
    configuracion: 'Configuración',
    cerrarSesion: 'Cerrar sesión',
    accesoRestringido: 'No tienes permisos para acceder a esta sección. Solo el rol Administrador puede gestionar usuarios.',
    bienvenido: 'Bienvenido',
    usuario: 'Usuario',
    contrasena: 'Contraseña',
    login: 'LOGIN',
    olvidasteContrasena: '¿Olvidaste tu contraseña?',
    tema: 'Tema',
    modoClaro: 'Claro',
    modoOscuro: 'Oscuro',
    idioma: 'Idioma',
    eslogan: 'Gestión moderna de inventario y ventas',
  },
  en: {
    inicio: 'Home',
    catalogoProductos: 'Product Catalog',
    proveedores: 'Suppliers',
    comprasRecepcion: 'Purchases & Receiving',
    movimientosInventario: 'Inventory Movements',
    ventasFacturacion: 'Sales & Billing',
    reportes: 'Reports',
    usuariosRoles: 'Users & Roles',
    configuracion: 'Settings',
    cerrarSesion: 'Log out',
    accesoRestringido: 'You do not have permission to access this section. Only the Administrator role can manage users.',
    bienvenido: 'Welcome',
    usuario: 'Username',
    contrasena: 'Password',
    login: 'LOGIN',
    olvidasteContrasena: 'Forgot your password?',
    tema: 'Theme',
    modoClaro: 'Light',
    modoOscuro: 'Dark',
    idioma: 'Language',
    eslogan: 'Modern inventory and sales management',
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [idioma, setIdioma] = useState(() => localStorage.getItem('motoman_idioma') || 'es');

  useEffect(() => {
    localStorage.setItem('motoman_idioma', idioma);
  }, [idioma]);

  const t = (clave) => traducciones[idioma]?.[clave] ?? traducciones.es[clave] ?? clave;

  return (
    <LanguageContext.Provider value={{ idioma, setIdioma, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage debe usarse dentro de <LanguageProvider>');
  return ctx;
}

// Atajo para componentes que solo necesitan la función de traducción.
export function useT() {
  return useLanguage().t;
}
