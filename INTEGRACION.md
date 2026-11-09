# Integración frontend ↔ backend · MotoMan

## 1. Puesta en marcha (Windows / PowerShell)

```powershell
# 1) Base de datos: crea una base vacía llamada "motoman" en PostgreSQL

# 2) Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # edita .env: clave de postgres y los dos SECRET
flask --app run db upgrade      # crea las 30 tablas
flask --app run seed --demo     # roles, usuarios, categorías y productos de ejemplo (sin --demo: solo roles y usuarios)
python run.py                   # API en http://127.0.0.1:5000  ·  Swagger en /apidocs

# 3) Frontend (otra terminal, en la raíz del proyecto)
copy .env.example .env
npm install
npm start
```

Usuarios de prueba: `admin / admin123` · `vendedor / venta123` · `inventario / inventario123`.
Cámaras de ejemplo con serie: `GP12-0001` a `GP12-0008`.

## 2. Códigos HTTP y cómo los muestra la interfaz

| Código | Cuándo | Qué ve el usuario |
|---|---|---|
| **201** | Venta, recepción, devolución, producto, usuario o reclamo creados | Aviso de éxito; ventas abren la factura |
| **400** | Datos inválidos (cantidad 0, canal o pago inválido, contraseña corta, series incompletas) | Mensaje junto al formulario |
| **401** | Sin sesión, token vencido o alterado | Se cierra la sesión y vuelve al login |
| **403** | El rol no autoriza la operación | Aviso global "No tiene permisos…" |
| **404** | Producto, venta o número de serie inexistente | Mensaje junto al formulario |
| **409** | Existencias insuficientes, número de serie repetido o vendido, garantía vencida, reclamo ya abierto | Mensaje que nombra el producto; se refrescan las existencias |
| **5xx / sin red** | Falla del servidor o servidor apagado | Aviso global; el login no cuenta el intento |

## 3. Endpoints nuevos (todos exigen JWT)

| Método y ruta | Roles | Qué hace |
|---|---|---|
| `POST /api/ventas/completa` | Admin, Vendedor | Venta + detalles + salida de inventario + series + garantía + factura, en **una** transacción. 201 / 409 |
| `GET /api/ventas/detalladas`, `/ventas/<id>/comprobante` | todos | Historial y reportes (líneas, costo aplicado, devueltos, series) |
| `GET /api/unidades-serializadas/buscar?numero_serie=` | todos | Trazabilidad y estado de la garantía de 15 días |
| `POST /api/reclamos-garantia/por-serie` | Admin, Vendedor | Reclamo localizando la venta por la serie |
| `POST /api/unidades-serializadas/registro` | Admin, Inventario | Alta de números de serie |
| `POST /api/recepciones/completa` | Admin, Inventario | Concilia lo recibido, rechazos, lote con **costo proporcional del envío** y series |
| `POST /api/compras/costo-proporcional` | Admin, Inventario | Vista previa de C = C_adq + E/n |
| `POST /api/compras/completa`, `GET /compras/detalladas` | Admin, Inventario | Orden de compra y su seguimiento |
| `POST /api/devoluciones/completa` | Admin, Vendedor | Devolución, inspección y reingreso a inventario |
| `GET /api/productos/catalogo`, `POST /productos/completo`, `PATCH /productos/<id>/completo` | lectura todos; escritura Admin, Inventario | Producto + precio + existencias + costo |
| `POST /api/precios/actualizar-masivo`, `/precios/calcular` | Admin, Inventario | Cambio por porcentaje o margen con redondeo; fórmula P = redondeo[C × (1 + m)] |
| `GET /api/usuarios/detallados`, `PATCH /usuarios/<id>/restablecer-contrasena` | Admin | Gestión de usuarios |

## 4. Control de acceso por rol (lo impone el servidor)

La matriz está en `backend/app/security.py` y coincide con la del frontend. Un rol sin permiso recibe 403 aunque llame a la API directamente.
Vendedor: ventas, devoluciones, garantías y consulta del catálogo. Encargado de Inventario: catálogo, existencias, proveedores, compras, recepciones y series.
Administrador: todo, incluido usuarios y roles.

## 5. Errores del backend que se corrigieron
1. `confirmar_venta` recibía un argumento que no acepta: **ninguna venta podía confirmarse**.
2. `/api/roles` estaba abierto sin sesión.
3. La recepción fallaba si el envío no se repartía en centavos exactos (p. ej. 100 entre 6 unidades).
4. URLs con y sin `/` final daban 308 o 404; los tokens alterados devolvían 422.
5. La venta no guardaba el costo, así que no existía el reporte de ganancias.

## 6. Limitaciones y decisiones
- **Variantes de producto:** el backend no las modela; cada variante se registra como un producto aparte.
- **Costo de un producto:** es el del lote recibido más reciente (adquisición + envío proporcional).
- **Productos con número de serie** entran al inventario por una compra con sus series (no por stock inicial ni ajuste manual).
- **Solo se guardan en el navegador:** pendientes de compra, configuración y el registro de actividad de la sesión.
- **Respaldo:** se hace en el servidor con `pg_dump` / `pg_restore`.
- **Recuperación de contraseña:** la hace el Administrador (el backend no guarda preguntas de seguridad).
- **Contraseñas:** el servidor usa scrypt (Werkzeug); el documento menciona bcrypt (nivel de seguridad equivalente).
- Foto del producto, auditoría permanente en base de datos y alertas por correo no existen en el backend.

## 7. Pruebas realizadas
- Backend sobre **PostgreSQL 18**: `backend/tests/prueba_integracion.py` (63 comprobaciones), migración sin diferencias con los modelos y concurrencia real (dos ventas del último ejemplar: una 201 y una 409).
- Frontend en Firefox contra el backend real: 36 comprobaciones (login, ventas con 201 y 409, garantía de 15 días, devolución con serie, 403, recepción con envío proporcional, precios masivos, usuarios, reportes, token alterado y servidor apagado).
