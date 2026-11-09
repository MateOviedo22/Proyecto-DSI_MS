// src/context/DataContext.jsx
//
// Contexto global de datos de negocio. Los datos viven en el BACKEND (Flask + PostgreSQL):
// este contexto los carga al iniciar sesión y, cada vez que una operación de escritura
// termina, vuelve a consultar lo que cambió. Las pantallas leen el estado y llaman a las
// funciones de escritura, que devuelven siempre { ok, ... } o { ok:false, error, estado, codigo }.
//
// Sigue guardado en el navegador (no existe en el backend): pendientes de compra,
// configuración visual/de reglas y el registro de actividad de esta sesión.

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getCollection, getObject, saveCollection, generateId, seedIfEmpty } from '../data/storage';
import { seedConfig } from '../data/seed';
import { puede, ROLES } from '../utils/permisos';
import { MOTIVOS } from '../utils/formato';

import { cerrarSesionAPI, obtenerPerfil } from '../api/auth';
import { silenciarErrores } from '../api/axios';
import { describirError } from '../api/errores';
import { obtenerCatalogo, crearProductoCompleto, editarProductoCompleto, desactivarProducto, activarProducto } from '../api/productos';
import { actualizarPreciosMasivo } from '../api/precios';
import { obtenerProveedores, crearProveedor as crearProveedorApi, actualizarProveedor, desactivarProveedor } from '../api/proveedores';
import { obtenerMovimientosDetallados, ajustarExistencia } from '../api/movimientosInventario';
import { obtenerComprasDetalladas, registrarCompraCompleta } from '../api/compras';
import { registrarRecepcionCompleta } from '../api/recepciones';
import { obtenerVentasDetalladas, registrarVentaCompleta } from '../api/ventas';
import { obtenerUnidades, buscarPorNumeroSerie } from '../api/unidadesSerializadas';
import { obtenerDevolucionesDetalladas, registrarDevolucionCompleta } from '../api/devoluciones';
import {
  obtenerReclamosDetallados,
  registrarReclamoPorSerie,
  cambiarEstadoReclamo,
  actualizarResolucionReclamo,
} from '../api/reclamosGarantia';
import {
  obtenerUsuariosDetallados,
  crearUsuario as crearUsuarioApi,
  actualizarUsuario,
  desactivarUsuario,
  activarUsuario,
  restablecerContrasena,
} from '../api/usuarios';
import { obtenerRoles } from '../api/roles';
import {
  productoDesdeApi,
  productoAApi,
  proveedorDesdeApi,
  proveedorAApi,
  movimientoDesdeApi,
  numeroSerieDesdeApi,
  compraDesdeApi,
  ventaDesdeApi,
  comprobanteAVenta,
  devolucionesDesdeApi,
  garantiaDesdeApi,
  trazabilidadAInfo,
  usuarioDesdeApi,
  canalAApi,
  metodoAApi,
} from '../api/adaptadores';

const DataContext = createContext(null);

seedIfEmpty('pendientesCompra', []);
seedIfEmpty('auditoria', []);
seedIfEmpty('config', seedConfig);

const MAX_AUDITORIA = 2000;
const TODAS_LAS_PARTES = ['productos', 'proveedores', 'movimientos', 'compras', 'numerosSerie', 'ventas', 'devoluciones', 'garantias', 'usuarios'];

export function DataProvider({ children }) {
  // ----------------------------- Datos del servidor -----------------------------
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [numerosSerie, setNumerosSerie] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [garantias, setGarantias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);

  // ----------------------------- Datos locales -----------------------------
  const [pendientesCompra, setPendientesCompra] = useState(() => getCollection('pendientesCompra'));
  const [auditoria, setAuditoria] = useState(() => getCollection('auditoria'));
  const [config, setConfig] = useState(() => getObject('config', seedConfig));
  useEffect(() => saveCollection('pendientesCompra', pendientesCompra), [pendientesCompra]);
  useEffect(() => saveCollection('auditoria', auditoria), [auditoria]);
  useEffect(() => saveCollection('config', config), [config]);

  // ----------------------------- Sesión (JWT) -----------------------------
  const [usuarioBackend, setUsuarioBackend] = useState(null);
  const [usuarioActualId, setUsuarioActualId] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  useEffect(() => {
    const validarSesion = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setUsuarioBackend(null);
        setUsuarioActualId(null);
        setCargandoSesion(false);
        return;
      }

      try {
        const respuesta = await silenciarErrores(() => obtenerPerfil());
        const usuario = respuesta?.usuario;

        if (!usuario) {
          throw new Error('No se recibieron los datos del usuario.');
        }

        setUsuarioBackend(usuario);
        setUsuarioActualId(usuario.id);
        localStorage.setItem('usuario', JSON.stringify(usuario));
      } catch (error) {
        cerrarSesionAPI();
        setUsuarioBackend(null);
        setUsuarioActualId(null);
      } finally {
        setCargandoSesion(false);
      }
    };

    validarSesion();
  }, []);

  // El interceptor de axios avisa cuando el servidor rechaza el token (401).
  useEffect(() => {
    const alExpirar = () => {
      setUsuarioBackend(null);
      setUsuarioActualId(null);
    };
    window.addEventListener('motoman:sesion-expirada', alExpirar);
    return () => window.removeEventListener('motoman:sesion-expirada', alExpirar);
  }, []);

  const usuarioActual = usuarioBackend
    ? {
        ...usuarioBackend,
        id: usuarioBackend.id,
        nombreUsuario: usuarioBackend.username || usuarioBackend.nombreUsuario || '',
        nombreCompleto:
          usuarioBackend.nombre_completo || usuarioBackend.nombreCompleto || usuarioBackend.username || usuarioBackend.nombreUsuario || '',
        rol:
          typeof usuarioBackend.rol === 'object'
            ? usuarioBackend.rol?.nombre || ''
            : usuarioBackend.nombre_rol || usuarioBackend.rol_nombre || usuarioBackend.rol || '',
      }
    : null;

  const usuarioRef = useRef(usuarioActual);
  usuarioRef.current = usuarioActual;
  const configRef = useRef(config);
  configRef.current = config;

  const tienePermiso = useCallback((modulo) => puede(usuarioActual?.rol, modulo, config.permisos), [usuarioActual, config.permisos]);

  // ----------------------------- Registro de actividad (local) -----------------------------
  const registrarAuditoria = useCallback((modulo, accion, detalle = '', usuarioOverride = null) => {
    const u = usuarioOverride || usuarioRef.current;
    setAuditoria((prev) =>
      [
        {
          id: generateId('aud'),
          fecha: new Date().toISOString(),
          usuarioId: u?.id || null,
          usuario: u?.nombreUsuario || 'sistema',
          rol: u?.rol || '',
          modulo,
          accion,
          detalle,
        },
        ...prev,
      ].slice(0, MAX_AUDITORIA)
    );
  }, []);

  const actualizarConfig = (cambios, detalle = 'Configuración actualizada') => {
    setConfig((prev) => ({ ...prev, ...cambios }));
    registrarAuditoria('Configuración', 'Actualizar', detalle);
  };

  // ----------------------------- Carga desde el servidor -----------------------------
  const recargar = useCallback(async (partes = TODAS_LAS_PARTES) => {
    const rol = usuarioRef.current?.rol;
    if (!rol) return;
    const permiso = (modulo) => puede(rol, modulo, configRef.current.permisos);

    const tareas = {
      productos: async () => setProductos((await obtenerCatalogo()).map(productoDesdeApi)),
      proveedores: async () => permiso('proveedores') && setProveedores((await obtenerProveedores()).map(proveedorDesdeApi).filter((p) => p.activo)),
      movimientos: async () => permiso('inventario') && setMovimientos((await obtenerMovimientosDetallados()).map(movimientoDesdeApi)),
      compras: async () => permiso('compras') && setCompras((await obtenerComprasDetalladas()).map(compraDesdeApi)),
      numerosSerie: async () => setNumerosSerie((await obtenerUnidades()).map(numeroSerieDesdeApi)),
      ventas: async () => setVentas((await obtenerVentasDetalladas()).map(ventaDesdeApi)),
      devoluciones: async () => setDevoluciones((await obtenerDevolucionesDetalladas()).flatMap(devolucionesDesdeApi)),
      garantias: async () => setGarantias((await obtenerReclamosDetallados()).map(garantiaDesdeApi)),
      usuarios: async () => {
        if (!permiso('usuarios')) return;
        setUsuarios((await obtenerUsuariosDetallados()).map(usuarioDesdeApi));
        setRoles(await obtenerRoles());
      },
    };

    // Carga en segundo plano: un 403 en un módulo sin permiso no debe mostrar avisos.
    await silenciarErrores(() => Promise.allSettled(partes.map((parte) => tareas[parte]())));
  }, []);

  useEffect(() => {
    if (!usuarioActualId) {
      setProductos([]); setProveedores([]); setMovimientos([]); setCompras([]); setNumerosSerie([]);
      setVentas([]); setDevoluciones([]); setGarantias([]); setUsuarios([]); setRoles([]);
      return;
    }
    setCargandoDatos(true);
    recargar().finally(() => setCargandoDatos(false));
  }, [usuarioActualId, recargar]);

  // Ejecuta una operación de escritura y traduce el resultado a { ok } / { ok:false, error, estado, codigo }.
  //   despues:  qué volver a consultar si la operación tuvo éxito.
  //   alFallar: qué refrescar si hubo un 409 (p. ej. las existencias cambiaron mientras se vendía).
  const ejecutar = useCallback(
    async (accion, { despues = [], alFallar = [] } = {}) => {
      try {
        const datos = await accion();
        if (despues.length) await recargar(despues);
        return { ok: true, datos };
      } catch (error) {
        const d = describirError(error);
        if (d.estado === 409 && alFallar.length) recargar(alFallar);
        return { ok: false, error: d.mensaje, estado: d.estado, codigo: d.codigo, tipo: d.tipo, detalle: d.detalle };
      }
    },
    [recargar]
  );

  // ---------------------------------------------------------------
  // Ayudas de stock (RF-4, RF-8, RF-9, RF-11, RNF "Visibilidad del estado")
  // ---------------------------------------------------------------
  const stockDeProducto = useCallback((producto) => Number(producto.stockActual || 0), []);

  const minimoDeProducto = useCallback(
    (p) => (Number(p.stockMinimo) > 0 ? Number(p.stockMinimo) : Number(config.umbralStock || 0)),
    [config.umbralStock]
  );
  const objetivoDeProducto = useCallback(
    (p) => (Number(p.stockObjetivo) > 0 ? Number(p.stockObjetivo) : Math.max(1, minimoDeProducto(p) * 2)),
    [minimoDeProducto]
  );
  const estaAgotado = useCallback((p) => stockDeProducto(p) === 0, [stockDeProducto]);
  const estaBajoStock = useCallback(
    (p) => stockDeProducto(p) > 0 && stockDeProducto(p) <= minimoDeProducto(p),
    [stockDeProducto, minimoDeProducto]
  );
  const cantidadSugeridaReposicion = useCallback(
    (p) => Math.max(1, objetivoDeProducto(p) - stockDeProducto(p)),
    [objetivoDeProducto, stockDeProducto]
  );

  // El costo total (adquisición + envío proporcional) lo calcula el servidor al recibir la compra.
  const costoTotalDeProducto = useCallback((p) => Number(p.costo || 0), []);
  const margenDeProducto = useCallback(
    (p) => {
      const costoTotal = costoTotalDeProducto(p);
      if (!costoTotal) return null;
      return ((Number(p.precio || 0) - costoTotal) / costoTotal) * 100;
    },
    [costoTotalDeProducto]
  );

  const categoriasExistentes = useMemo(() => Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean))).sort(), [productos]);

  const buscarProductos = useCallback(
    (texto = '', categoria = '') => {
      const t = texto.trim().toLowerCase();
      const c = categoria.trim().toLowerCase();
      return productos.filter((p) => {
        const coincideTexto = !t || p.nombre.toLowerCase().includes(t) || (p.categoria || '').toLowerCase().includes(t) || (p.sku || '').toLowerCase().includes(t);
        const coincideCategoria = !c || (p.categoria || '').toLowerCase() === c;
        return coincideTexto && coincideCategoria;
      });
    },
    [productos]
  );

  // ---------------------------------------------------------------
  // Productos y precios (RF-1 a RF-3, RF-20 a RF-24)
  // ---------------------------------------------------------------
  const crearProducto = async (datos) => {
    const res = await ejecutar(() => crearProductoCompleto(productoAApi(datos)), { despues: ['productos', 'movimientos'] });
    if (!res.ok) return res;
    registrarAuditoria('Productos', 'Crear', `Producto "${datos.nombre}"`);
    return { ok: true, producto: productoDesdeApi(res.datos.producto) };
  };

  const editarProducto = async (id, cambios) => {
    const res = await ejecutar(() => editarProductoCompleto(Number(id), productoAApi(cambios)), { despues: ['productos'] });
    if (res.ok) registrarAuditoria('Productos', 'Editar', `Producto "${cambios.nombre || id}"`);
    return res;
  };

  const darDeBajaProducto = async (id) => {
    const res = await ejecutar(() => desactivarProducto(Number(id)), { despues: ['productos'] });
    if (res.ok) registrarAuditoria('Productos', 'Dar de baja', `Producto ${id}`);
    return res;
  };

  const reactivarProducto = async (id) => {
    const res = await ejecutar(() => activarProducto(Number(id)), { despues: ['productos'] });
    if (res.ok) registrarAuditoria('Productos', 'Reactivar', `Producto ${id}`);
    return res;
  };

  // Cambio masivo de precios calculado en el servidor (porcentaje o margen + redondeo).
  const previsualizarPrecios = async (parametros) => ejecutar(() => actualizarPreciosMasivo({ ...parametros, aplicar: false }));
  const aplicarPreciosMasivo = async (parametros) => {
    const res = await ejecutar(() => actualizarPreciosMasivo({ ...parametros, aplicar: true }), { despues: ['productos'] });
    if (res.ok) registrarAuditoria('Productos', 'Actualizar precios', `${res.datos.cambios.length} producto(s)`);
    return res;
  };

  // ---------------------------------------------------------------
  // Proveedores (RF-51 a RF-53)
  // ---------------------------------------------------------------
  const crearProveedor = async (datos) => {
    const res = await ejecutar(() => crearProveedorApi(proveedorAApi(datos)), { despues: ['proveedores'] });
    if (res.ok) registrarAuditoria('Proveedores', 'Crear', `Proveedor "${datos.nombre}"`);
    return res;
  };
  const editarProveedor = async (id, datos) => {
    const res = await ejecutar(() => actualizarProveedor(Number(id), proveedorAApi(datos)), { despues: ['proveedores'] });
    if (res.ok) registrarAuditoria('Proveedores', 'Editar', `Proveedor "${datos.nombre}"`);
    return res;
  };
  // El backend no borra proveedores: los desactiva y conserva su historial de compras.
  const eliminarProveedor = async (id) => {
    const enUso = productos.some((p) => p.proveedorId === id && p.activo !== false);
    if (enUso) return { ok: false, error: 'Este proveedor tiene productos activos asociados; no se puede desactivar.' };
    const res = await ejecutar(() => desactivarProveedor(Number(id)), { despues: ['proveedores'] });
    if (res.ok) registrarAuditoria('Proveedores', 'Desactivar', `Proveedor ${id}`);
    return res;
  };

  // ---------------------------------------------------------------
  // Inventario: ajustes manuales (RF-5 a RF-7). Las ventas y recepciones registran sus propios movimientos.
  // ---------------------------------------------------------------
  const registrarMovimiento = async ({ productoId, tipo, motivo, cantidad, comentario }) => {
    const detalle = `${MOTIVOS[motivo] || motivo}${comentario ? ` — ${comentario}` : ''}`;
    const res = await ejecutar(
      () => ajustarExistencia({
        producto_id: Number(productoId),
        cantidad: Number(cantidad),
        tipo_ajuste: tipo === 'entrada' ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
        motivo: detalle,
      }),
      { despues: ['productos', 'movimientos'], alFallar: ['productos'] }
    );
    if (res.ok) registrarAuditoria('Inventario', tipo === 'entrada' ? 'Entrada' : 'Salida', `${cantidad} × ${productoId} (${motivo})`);
    return res;
  };

  const productosBajoStock = productos.filter((p) => p.activo !== false && estaBajoStock(p));
  const productosAgotados = productos.filter((p) => p.activo !== false && estaAgotado(p));
  const alertas = [
    ...productosAgotados.map((p) => ({ producto: p, tipo: 'agotado', stock: 0, minimo: minimoDeProducto(p) })),
    ...productosBajoStock.map((p) => ({ producto: p, tipo: 'bajo', stock: stockDeProducto(p), minimo: minimoDeProducto(p) })),
  ];

  // ---------------------------------------------------------------
  // Pendientes de compra (RF-13): lista de trabajo local
  // ---------------------------------------------------------------
  const crearPendienteCompra = (datos) => {
    const nuevo = { id: generateId('pend'), fechaRegistro: new Date().toISOString(), atendido: false, ...datos };
    setPendientesCompra((prev) => [nuevo, ...prev]);
    registrarAuditoria('Compras', 'Pendiente de compra', `${datos.cantidadRequerida} × ${productos.find((p) => p.id === datos.productoId)?.nombre || ''}`);
    return nuevo;
  };
  const marcarPendienteAtendido = (id) => setPendientesCompra((prev) => prev.map((p) => (p.id === id ? { ...p, atendido: true } : p)));
  const eliminarPendiente = (id) => setPendientesCompra((prev) => prev.filter((p) => p.id !== id));

  // ---------------------------------------------------------------
  // Compras y recepción (RF-12 a RF-19, RF-25 a RF-27)
  // ---------------------------------------------------------------
  const crearCompra = async ({ proveedorId, costoEnvio, items }) => {
    const res = await ejecutar(
      () => registrarCompraCompleta({
        proveedor_id: Number(proveedorId),
        observaciones: Number(costoEnvio) > 0 ? `Envío estimado: C$ ${Number(costoEnvio).toFixed(2)}` : null,
        items: items.map((i) => ({ producto_id: Number(i.productoId), cantidad: Number(i.cantidadComprada), costo_unitario: Number(i.costoUnitario) })),
      }),
      { despues: ['compras'] }
    );
    if (res.ok) registrarAuditoria('Compras', 'Orden de compra', `${items.length} línea(s)`);
    return res.ok ? { ok: true, compra: compraDesdeApi(res.datos.compra) } : res;
  };

  // Recepción atómica: el servidor concilia lo solicitado con lo recibido, crea el lote con el
  // costo proporcional del envío y suma al inventario solo lo aceptado.
  const recibirCompra = async (compraId, itemsRecibidos, { costoEnvio = 0, observaciones = '' } = {}) => {
    const res = await ejecutar(
      () => registrarRecepcionCompleta({
        compra_id: Number(compraId),
        costo_envio: Number(costoEnvio || 0),
        observaciones: observaciones || null,
        items: itemsRecibidos.map((i) => ({
          detalle_compra_id: Number(i.itemId),
          cantidad_recibida: Number(i.cantidadRecibida || 0),
          cantidad_rechazada: Number(i.cantidadRechazada || 0),
          motivo_rechazo: i.incidencia || null,
          numeros_serie: (i.numerosSerie || []).filter(Boolean),
        })),
      }),
      { despues: ['productos', 'movimientos', 'compras', 'numerosSerie'] }
    );
    if (res.ok) registrarAuditoria('Compras', 'Recepción', `Compra ${compraId}`);
    return res.ok ? { ok: true, recepcion: res.datos } : res;
  };

  const buscarPorLote = useCallback(
    (lote) => {
      const l = lote.trim().toLowerCase();
      if (!l) return [];
      return compras.flatMap((c) =>
        c.items
          .filter((i) => i.lote && i.lote.toLowerCase().split(', ').includes(l))
          .map((i) => ({ compraId: c.id, productoId: i.productoId, varianteId: null, cantidadRecibida: i.cantidadRecibida, fechaRecepcion: c.fechaRecepcion }))
      );
    },
    [compras]
  );

  const buscarPorNumeroSerieLocal = useCallback(
    (numero) => {
      const n = numero.trim().toLowerCase();
      if (!n) return null;
      return numerosSerie.find((s) => s.numero.toLowerCase() === n) || null;
    },
    [numerosSerie]
  );

  // ---------------------------------------------------------------
  // Ventas y facturación (RF-30 a RF-35)
  // ---------------------------------------------------------------
  const numerosSerieDisponibles = useCallback(
    (productoId) => numerosSerie.filter((s) => s.productoId === productoId && !s.ventaId),
    [numerosSerie]
  );

  // items: [{ productoId, cantidad, numeroSerieId }]. El precio vigente lo toma el servidor (RF-31).
  // Respuesta: 201 -> { ok:true, venta }   400/404/409 -> { ok:false, error, estado, codigo }
  const registrarVenta = async ({ canal, cliente, metodoPago, items }) => {
    const lineas = new Map();
    items.forEach((it) => {
      const linea = lineas.get(it.productoId) || { producto_id: Number(it.productoId), cantidad: 0, numeros_serie: [] };
      linea.cantidad += Number(it.cantidad);
      const serie = it.numeroSerieId ? numerosSerie.find((s) => s.id === it.numeroSerieId) : null;
      if (serie) linea.numeros_serie.push(serie.numero);
      lineas.set(it.productoId, linea);
    });

    const c = configRef.current;
    const res = await ejecutar(
      () => registrarVentaCompleta({
        canal: canalAApi(canal),
        metodo_pago: metodoAApi(metodoPago),
        cliente: cliente && cliente.trim() ? { nombre: cliente.trim() } : null,
        emisor: { nombre: c.nombreEmpresa, razon_social: c.razonSocial, ruc: c.ruc, direccion: c.direccion, telefono: c.telefono },
        items: Array.from(lineas.values()),
      }),
      { despues: ['productos', 'ventas', 'movimientos', 'numerosSerie'], alFallar: ['productos', 'numerosSerie'] }
    );
    if (!res.ok) return res;
    const venta = comprobanteAVenta(res.datos);
    registrarAuditoria('Ventas', 'Registrar venta', `${venta.numeroFactura} · ${canal === 'piso' ? 'en piso' : 'en línea'} · C$ ${venta.total.toFixed(2)}`);
    return { ok: true, venta, estado: res.datos.estado };
  };

  // ---------------------------------------------------------------
  // Devoluciones (RF-54, RF-55) y venta neta
  // ---------------------------------------------------------------
  const devueltoDe = useCallback(
    (ventaId, productoId, varianteId) =>
      devoluciones
        .filter((d) => d.ventaId === ventaId && d.productoId === productoId && (d.varianteId || null) === (varianteId || null) && d.estado === 'COMPLETADA')
        .reduce((s, d) => s + Number(d.cantidad), 0),
    [devoluciones]
  );

  const lineasNetas = useCallback(
    (venta) => {
      const grupos = new Map();
      venta.items.forEach((it) => {
        const k = `${it.productoId}|${it.varianteId || ''}`;
        const g = grupos.get(k) || { ...it, cantidad: 0, ingreso: 0, costo: 0 };
        g.cantidad += Number(it.cantidad);
        g.ingreso += Number(it.cantidad) * Number(it.precioUnitario);
        g.costo += Number(it.cantidad) * Number(it.costoUnitario || 0);
        grupos.set(k, g);
      });
      return Array.from(grupos.values()).map((g) => {
        const devuelto = Math.min(g.cantidad, devueltoDe(venta.id, g.productoId, g.varianteId));
        const f = g.cantidad ? (g.cantidad - devuelto) / g.cantidad : 0;
        return { ...g, devuelto, cantidadNeta: g.cantidad - devuelto, ingresoNeto: g.ingreso * f, costoNeto: g.costo * f };
      });
    },
    [devueltoDe]
  );

  const registrarDevolucion = async ({ ventaId, productoId, cantidad, motivo, numerosSerie: series = [], estadoProducto = 'BUEN_ESTADO' }) => {
    const venta = ventas.find((v) => v.id === ventaId);
    const linea = venta?.items.find((i) => i.productoId === productoId);
    if (!linea) return { ok: false, error: 'Ese producto no pertenece a la venta seleccionada.' };
    if (!String(motivo || '').trim()) return { ok: false, error: 'Indica el motivo de la devolución.' };

    const res = await ejecutar(
      () => registrarDevolucionCompleta({
        venta_id: Number(ventaId),
        motivo: String(motivo).trim(),
        items: [{
          detalle_venta_id: linea.detalleId,
          cantidad: Number(cantidad),
          numeros_serie: series,
          estado_producto: estadoProducto,
          se_reintegra_inventario: estadoProducto === 'BUEN_ESTADO',
        }],
      }),
      { despues: ['productos', 'ventas', 'devoluciones', 'movimientos', 'numerosSerie'], alFallar: ['ventas', 'devoluciones', 'numerosSerie'] }
    );
    if (res.ok) registrarAuditoria('Devoluciones', 'Registrar devolución', `${cantidad} × ${linea.nombre} de ${venta.numeroFactura}`);
    return res;
  };

  // ---------------------------------------------------------------
  // Rotación (RF-10)
  // ---------------------------------------------------------------
  const unidadesVendidasPorProducto = useMemo(() => {
    const mapa = {};
    const limite = Date.now() - Number(config.ventanaRotacionDias || 30) * 86400000;
    ventas.forEach((v) => {
      if (new Date(v.fecha).getTime() < limite) return;
      lineasNetas(v).forEach((l) => {
        mapa[l.productoId] = (mapa[l.productoId] || 0) + l.cantidadNeta;
      });
    });
    return mapa;
  }, [ventas, lineasNetas, config.ventanaRotacionDias]);

  const unidadesRecientes = (productoId) => unidadesVendidasPorProducto[productoId] || 0;
  const esAltaRotacion = (p) => Number(config.umbralAltaRotacion) > 0 && unidadesRecientes(p.id) >= Number(config.umbralAltaRotacion);

  // ---------------------------------------------------------------
  // Garantías (RF-36 a RF-38): el servidor localiza la venta por el número de serie
  // y determina si el reclamo está dentro de los 15 días.
  // ---------------------------------------------------------------
  const verificarSerie = async (numero) => {
    try {
      return { ok: true, info: trazabilidadAInfo(await buscarPorNumeroSerie(numero.trim())) };
    } catch (error) {
      const d = describirError(error);
      return d.estado === 404 ? { ok: true, info: null } : { ok: false, error: d.mensaje, estado: d.estado };
    }
  };

  const registrarGarantia = async ({ numeroSerie, descripcion }) => {
    const res = await ejecutar(() => registrarReclamoPorSerie({ numero_serie: numeroSerie, motivo: descripcion }), { despues: ['garantias'] });
    if (res.ok) registrarAuditoria('Garantías', 'Registrar garantía', `Serie ${numeroSerie}`);
    return res.ok ? { ok: true, info: trazabilidadAInfo(res.datos) } : res;
  };

  const actualizarEstadoGarantia = async (id, estado, resolucion = '') => {
    const res = await ejecutar(
      async () => {
        if (estado === 'RESUELTO' && resolucion.trim()) await actualizarResolucionReclamo(Number(id), resolucion.trim());
        return cambiarEstadoReclamo(Number(id), estado);
      },
      { despues: ['garantias'] }
    );
    if (res.ok) registrarAuditoria('Garantías', 'Cambiar estado', `Reclamo ${id} → ${estado}`);
    return res;
  };

  // ---------------------------------------------------------------
  // Usuarios, roles y acceso (RF-47 a RF-50). Solo el Administrador los gestiona (el servidor lo impone).
  // ---------------------------------------------------------------
  const ROLES_DISPONIBLES = ROLES;
  const rolId = (nombre) => roles.find((r) => r.nombre === nombre)?.id;

  const crearUsuario = async ({ nombreUsuario, email, rol, password }) => {
    const id = rolId(rol);
    if (!id) return { ok: false, error: 'No se encontró el rol seleccionado en el servidor.' };
    const res = await ejecutar(() => crearUsuarioApi({ username: nombreUsuario.trim(), password, rol_id: id, email: email?.trim() || null }), { despues: ['usuarios'] });
    if (res.ok) registrarAuditoria('Usuarios', 'Crear', `Usuario "${nombreUsuario}" (${rol})`);
    return res;
  };

  const editarUsuario = async (id, { rol, email }) => {
    const cambios = {};
    if (rol) cambios.rol_id = rolId(rol);
    if (email !== undefined) cambios.email = email || null;
    const res = await ejecutar(() => actualizarUsuario(Number(id), cambios), { despues: ['usuarios'] });
    if (res.ok) registrarAuditoria('Usuarios', 'Editar', `Usuario ${id}`);
    return res;
  };

  const cambiarPasswordUsuario = async (id, nueva) => {
    const res = await ejecutar(() => restablecerContrasena(Number(id), nueva));
    if (res.ok) registrarAuditoria('Usuarios', 'Restablecer contraseña', `Usuario ${id}`);
    return res;
  };

  const darDeBajaUsuario = async (id) => {
    if (String(id) === String(usuarioActual?.id)) return { ok: false, error: 'No puedes desactivar tu propia cuenta.' };
    const res = await ejecutar(() => desactivarUsuario(Number(id)), { despues: ['usuarios'] });
    if (res.ok) registrarAuditoria('Usuarios', 'Desactivar', `Usuario ${id}`);
    return res;
  };

  const reactivarUsuario = async (id) => {
    const res = await ejecutar(() => activarUsuario(Number(id)), { despues: ['usuarios'] });
    if (res.ok) registrarAuditoria('Usuarios', 'Reactivar', `Usuario ${id}`);
    return res;
  };

  // La recuperación por pregunta de seguridad no existe en el servidor: el administrador restablece la contraseña.
  const verificarCredenciales = async () => ({ ok: false, error: 'El inicio de sesión se realiza contra el servidor.' });
  const obtenerPreguntaSeguridad = () => null;
  const recuperarContrasena = async () => ({ ok: false, error: 'Pide a un administrador que restablezca tu contraseña.' });

  // Inicio y cierre de sesión mediante JWT
  const iniciarSesion = (usuario) => {
    const usuarioNormalizado = {
      ...usuario,
      nombreUsuario: usuario.username || usuario.nombreUsuario || '',
      nombreCompleto: usuario.nombre_completo || usuario.nombreCompleto || usuario.username || usuario.nombreUsuario || '',
      rol: typeof usuario.rol === 'object' ? usuario.rol?.nombre || '' : usuario.nombre_rol || usuario.rol_nombre || usuario.rol || '',
    };

    setUsuarioBackend(usuario);
    setUsuarioActualId(usuario.id || null);
    localStorage.setItem('usuario', JSON.stringify(usuario));
    registrarAuditoria('Acceso', 'Inicio de sesión', '', usuarioNormalizado);
  };

  const cerrarSesion = () => {
    registrarAuditoria('Acceso', 'Cierre de sesión');
    setUsuarioBackend(null);
    setUsuarioActualId(null);
    cerrarSesionAPI();
  };

  // Los datos viven en PostgreSQL: el respaldo se hace en el servidor (pg_dump), no desde el navegador.
  const exportarRespaldo = async () => ({ ok: false, error: 'El respaldo se realiza en el servidor con pg_dump.' });
  const restaurarRespaldo = () => ({ ok: false, error: 'La restauración se realiza en el servidor con pg_restore.' });

  const value = {
    productos, proveedores, movimientos, config, actualizarConfig,
    stockDeProducto, minimoDeProducto, objetivoDeProducto, cantidadSugeridaReposicion,
    estaBajoStock, estaAgotado, costoTotalDeProducto, margenDeProducto, categoriasExistentes,
    crearProducto, editarProducto, darDeBajaProducto, reactivarProducto, previsualizarPrecios, aplicarPreciosMasivo, buscarProductos,
    crearProveedor, editarProveedor, eliminarProveedor,
    registrarMovimiento, productosBajoStock, productosAgotados, alertas,
    pendientesCompra, crearPendienteCompra, marcarPendienteAtendido, eliminarPendiente,
    compras, crearCompra, recibirCompra,
    numerosSerie, buscarPorLote, buscarPorNumeroSerie: buscarPorNumeroSerieLocal,
    ventas, registrarVenta, numerosSerieDisponibles, lineasNetas,
    devoluciones, registrarDevolucion, devueltoDe,
    unidadesRecientes, esAltaRotacion,
    garantias, verificarSerie, registrarGarantia, actualizarEstadoGarantia,
    usuarios, roles, ROLES_DISPONIBLES, crearUsuario, editarUsuario, cambiarPasswordUsuario, darDeBajaUsuario, reactivarUsuario,
    verificarCredenciales, obtenerPreguntaSeguridad, recuperarContrasena,
    usuarioActual, usuarioActualId, cargandoSesion, cargandoDatos, recargar, iniciarSesion, cerrarSesion, tienePermiso,
    auditoria, registrarAuditoria, exportarRespaldo, restaurarRespaldo,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}
