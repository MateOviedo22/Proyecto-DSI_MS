# MotoMan · Frontend mejorado

## Cómo probarlo
```
npm install
npm start
```
Usuarios de prueba (se crean la primera vez que abres la app):

| Usuario | Contraseña | Rol | Respuesta de seguridad |
|---|---|---|---|
| admin | admin123 | Administrador | firulais |
| vendedor | venta123 | Vendedor | managua |
| inventario | inventario123 | Encargado de Inventario | camaras |

Si ya habías abierto la app antes, borra los datos guardados (DevTools → Application → Local Storage → `localStorage.clear()`) y recarga.

## Archivos
Nuevos: `src/styles/theme.css`, `src/utils/{formato,exportar,permisos,passwordHash,graficos}.js`,
`src/context/{ThemeContext,UiContext}.jsx`,
`src/components/{Marca,Topbar,AlertasPanel,Modal,PageHeader,StatCard,StockMeter,EmptyState,ActualizarPreciosModal,FacturaModal}.jsx`,
`src/pages/GarantiasDevoluciones.jsx`, `src/flujo.test.js`.

Reescritos: `public/index.html`, `src/index.js`, `src/App.js`, `src/context/DataContext.jsx`, `src/data/{seed,storage}.js`,
`src/components/Sidebar.jsx`, `src/pages/{Login,Home,Productos,Proveedores,RegistrarVenta,GenerarReporte,Usuarios,Configuracion}.jsx`.

Ajustados: `src/pages/{RegistroProducto,IngresoInventario,Compras}.jsx`, `src/setupTests.js`, `src/App.test.js`.

Eliminar (obsoletos): `src/index.css`, `src/App.css`, `src/logo.svg`, `src/components/Sidebar.css`, `src/components/InfoCard.jsx`, `src/pages/Login.css`.
