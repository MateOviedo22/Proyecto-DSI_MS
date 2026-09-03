// src/data/seed.js
// Datos de ejemplo para que la aplicación no arranque vacía.
// Solo se cargan la primera vez (ver seedIfEmpty en storage.js).

export const seedProveedores = [
  {
    id: "prov_1",
    nombre: "Importadora Acción Nica",
    contacto: "Carlos Reyes",
    telefono: "8888-1234",
    email: "ventas@accionica.com.ni",
    activo: true,
  },
  {
    id: "prov_2",
    nombre: "GoPro Distribuidora CA",
    contacto: "Laura Gómez",
    telefono: "7777-5678",
    email: "contacto@goprodistribuidora.com",
    activo: true,
  },
];

export const seedProductos = [
  {
    id: "prod_1",
    nombre: "Cámara GoPro Hero 12",
    descripcion: "Cámara de acción 5.3K con estabilización HyperSmooth",
    categoria: "Cámaras",
    proveedorId: "prov_2",
    costo: 6500,
    costoEnvio: 150,
    precio: 9800,
    stockMinimo: 3,
    esElectronico: true,
    activo: true,
    variantes: [],
    stockActual: 8,
  },
  {
    id: "prod_2",
    nombre: "Trípode flexible Octopus",
    descripcion: "Trípode flexible universal para cámaras de acción",
    categoria: "Trípodes",
    proveedorId: "prov_1",
    costo: 180,
    costoEnvio: 20,
    precio: 350,
    stockMinimo: 5,
    esElectronico: false,
    activo: true,
    variantes: [],
    stockActual: 2,
  },
  {
    id: "prod_3",
    nombre: "Batería GoPro",
    descripcion: "Batería recargable para cámaras GoPro",
    categoria: "Baterías",
    proveedorId: "prov_2",
    costo: 250,
    costoEnvio: 10,
    precio: 480,
    stockMinimo: 10,
    esElectronico: true,
    activo: true,
    // Ejemplo de producto con variantes: cada una lleva su propio stock.
    variantes: [
      { id: "var_1", tipo: "Modelo", valor: "GoPro Hero 11/12", stockActual: 15 },
      { id: "var_2", tipo: "Modelo", valor: "GoPro Hero 9/10", stockActual: 6 },
    ],
    stockActual: 0,
  },
  {
    id: "prod_4",
    nombre: "Micrófono inalámbrico DJI Mic",
    descripcion: "Micrófono inalámbrico compacto con receptor",
    categoria: "Micrófonos",
    proveedorId: "prov_1",
    costo: 2200,
    costoEnvio: 80,
    precio: 3600,
    stockMinimo: 4,
    esElectronico: true,
    activo: true,
    variantes: [],
    stockActual: 0,
  },
];

// Usuarios de ejemplo. Contraseñas de prueba (ya con hash SHA-256 + salt,
// nunca en texto plano — ver src/utils/passwordHash.js):
//   admin    / admin123   (rol: Administrador)
//   vendedor / venta123   (rol: Vendedor)
export const seedUsuarios = [
  {
    id: "user_1",
    nombreUsuario: "admin",
    nombreCompleto: "Administrador MotoMan",
    rol: "Administrador",
    activo: true,
    passwordHash: "f76c14dedf6fe156c3134defb7eecd08ad3b49d3336a2f88b60e2feadb798ec4",
    saltPassword: "seed_admin_salt_01",
    preguntaSeguridad: "¿Cuál es el nombre de tu primera mascota?",
    respuestaHash: "5607b1752f40089acb985dc55a1bd5a3083384f802ea5dc5a26d021461c7833a",
    saltRespuesta: "seed_admin_pregunta_salt_01",
  },
  {
    id: "user_2",
    nombreUsuario: "vendedor",
    nombreCompleto: "Vendedor de piso",
    rol: "Vendedor",
    activo: true,
    passwordHash: "e3a1f43f529d9a494696405321c49f11af515075a9d1ad0948c021d015860795",
    saltPassword: "seed_vendedor_salt_01",
    preguntaSeguridad: "¿En qué ciudad naciste?",
    respuestaHash: "241a91d9c7b0653d7ac96639fddafee63826450784dfe5201aeb24e183b6a5c3",
    saltRespuesta: "seed_vendedor_pregunta_salt_01",
  },
];
