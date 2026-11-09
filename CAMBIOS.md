# Integración frontend ↔ backend · MotoMan

Ver **INTEGRACION.md** para la puesta en marcha, las reglas HTTP y las limitaciones conocidas.

## Backend (Flask + PostgreSQL)
Nuevos: `app/errors.py`, `app/security.py`, `app/cli.py`, `app/services/{transaccion,costos,flujo_service}.py`,
`app/routes/flujo_routes.py`, `.env.example`, `tests/prueba_integracion.py`.

Modificados: `app/__init__.py`, `app/config.py`, `app/extensions.py`, `app/routes/venta_routes.py`,
`app/services/{venta_service,lote_service,unidad_serializada_service}.py`.

## Frontend (React)
Nuevos: `src/api/{errores,adaptadores}.js`, `.env.example`.

Ampliados con las funciones de los flujos: `src/api/{ventas,productos,precios,compras,recepciones,unidadesSerializadas,reclamosGarantia,devoluciones,movimientosInventario,usuarios}.js`.

Reescritos: `src/api/axios.js`, `src/context/DataContext.jsx`, `src/components/{ActualizarPreciosModal,Modal,FacturaModal}.jsx`,
`src/pages/{RegistroProducto,GarantiasDevoluciones,Usuarios}.jsx`.

Ajustados: `src/App.js`, `src/context/UiContext.jsx`, `src/pages/{Login,Productos,IngresoInventario,Proveedores,Compras,RegistrarVenta,Configuracion}.jsx`,
`src/styles/theme.css`, `src/App.test.js`.

Eliminado: `src/flujo.test.js` (probaba el modo local con `localStorage`, que ya no existe).
