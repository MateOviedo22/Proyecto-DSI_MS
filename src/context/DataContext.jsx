// src/context/DataContext.jsx
//
// Contexto global de datos de negocio: productos, proveedores, inventario,
// compras, ventas, garantías, devoluciones, usuarios, configuración y auditoría.
// Toda la lógica vive aquí para que las pantallas trabajen sobre la misma información.
//
// Persistencia: localStorage (ver src/data/storage.js). Cuando exista
// backend, solo hay que cambiar las funciones de este archivo.

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getCollection, getObject, saveCollection, generateId, seedIfEmpty, exportarTodo, importarTodo } from '../data/storage';
import { seedProductos, seedProveedores, seedUsuarios, seedConfig } from '../data/seed';
import { generarSalt, hashConSalt, verificarConSalt } from '../utils/passwordHash';
import { puede, ROLES } from '../utils/permisos';
import { diasEntre } from '../utils/formato';

import {
  cerrarSesionAPI,
  obtenerPerfil,
} from '../api/auth';

const DataContext = createContext(null);

seedIfEmpty('productos', seedProductos);
seedIfEmpty('proveedores', seedProveedores);
seedIfEmpty('movimientos', []);
seedIfEmpty('pendientesCompra', []);
seedIfEmpty('compras', []);
seedIfEmpty('numerosSerie', []);
seedIfEmpty('ventas', []);
seedIfEmpty('garantias', []);
seedIfEmpty('devoluciones', []);
seedIfEmpty('usuarios', seedUsuarios);
seedIfEmpty('auditoria', []);
seedIfEmpty('config', seedConfig);

const MAX_AUDITORIA = 2000;


export function DataProvider({ children }) {
  const [productos, setProductos] = useState(() => getCollection('productos'));
  const [proveedores, setProveedores] = useState(() => getCollection('proveedores'));
  const [movimientos, setMovimientos] = useState(() => getCollection('movimientos'));
  const [pendientesCompra, setPendientesCompra] = useState(() => getCollection('pendientesCompra'));
  const [compras, setCompras] = useState(() => getCollection('compras'));
  const [numerosSerie, setNumerosSerie] = useState(() => getCollection('numerosSerie'));
  const [ventas, setVentas] = useState(() => getCollection('ventas'));
  const [garantias, setGarantias] = useState(() => getCollection('garantias'));
  const [devoluciones, setDevoluciones] = useState(() => getCollection('devoluciones'));
  const [usuarios, setUsuarios] = useState(() => getCollection('usuarios'));
  const [auditoria, setAuditoria] = useState(() => getCollection('auditoria'));
  const [config, setConfig] = useState(() => getObject('config', seedConfig));
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
        const respuesta = await obtenerPerfil();
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

  useEffect(() => saveCollection('productos', productos), [productos]);
  useEffect(() => saveCollection('proveedores', proveedores), [proveedores]);
  useEffect(() => saveCollection('movimientos', movimientos), [movimientos]);
  useEffect(() => saveCollection('pendientesCompra', pendientesCompra), [pendientesCompra]);
  useEffect(() => saveCollection('compras', compras), [compras]);
  useEffect(() => saveCollection('numerosSerie', numerosSerie), [numerosSerie]);
  useEffect(() => saveCollection('ventas', ventas), [ventas]);
  useEffect(() => saveCollection('garantias', garantias), [garantias]);
  useEffect(() => saveCollection('devoluciones', devoluciones), [devoluciones]);
  useEffect(() => saveCollection('usuarios', usuarios), [usuarios]);
  useEffect(() => saveCollection('auditoria', auditoria), [auditoria]);
  useEffect(() => saveCollection('config', config), [config]);
  // useEffect(() => {
  //   if (usuarioActualId) localStorage.setItem('motoman_sesion', usuarioActualId);
  //   else localStorage.removeItem('motoman_sesion');
  // }, [usuarioActualId]);

  // Sesión activa y permisos (autenticación mediante backend)
  const usuarioActual = usuarioBackend
    ? {
      ...usuarioBackend,
      id: usuarioBackend.id,
      nombreUsuario:
        usuarioBackend.username ||
        usuarioBackend.nombreUsuario ||
        '',
      nombreCompleto:
        usuarioBackend.nombre_completo ||
        usuarioBackend.nombreCompleto ||
        usuarioBackend.username ||
        usuarioBackend.nombreUsuario ||
        '',
      rol:
        typeof usuarioBackend.rol === 'object'
          ? usuarioBackend.rol?.nombre || ''
          : usuarioBackend.nombre_rol ||
          usuarioBackend.rol_nombre ||
          usuarioBackend.rol ||
          '',
    }
    : null;

  const usuarioRef = useRef(usuarioActual);
  usuarioRef.current = usuarioActual;

  const tienePermiso = useCallback(
    (modulo) => puede(usuarioActual?.rol, modulo, config.permisos),
    [usuarioActual, config.permisos]
  );

  // ---------------------------------------------------------------
  // Auditoría (RNF "Registro de operaciones" / "Conservación del historial")
  // ---------------------------------------------------------------
  const registrarAuditoria = useCallback((modulo, accion, detalle = '', usuarioOverride = null) => {
    const u = usuarioOverride || usuarioRef.current;
    const entrada = {
      id: generateId('aud'),
      fecha: new Date().toISOString(),
      usuarioId: u?.id || null,
      usuario: u?.nombreUsuario || 'sistema',
      rol: u?.rol || '',
      modulo,
      accion,
      detalle,
    };
    setAuditoria((prev) => [entrada, ...prev].slice(0, MAX_AUDITORIA));
  }, []);

  // ---------------------------------------------------------------
  // Configuración
  // ---------------------------------------------------------------
  const actualizarConfig = (cambios, detalle = 'Configuración actualizada') => {
    setConfig((prev) => ({ ...prev, ...cambios }));
    registrarAuditoria('Configuración', 'Actualizar', detalle);
  };

  // ---------------------------------------------------------------
  // Helpers de stock (RF-4, RF-8, RF-9, RF-11, RNF "Visibilidad del estado")
  // ---------------------------------------------------------------
  const stockDeProducto = useCallback((producto) => {
    if (producto.variantes && producto.variantes.length > 0) {
      return producto.variantes.reduce((sum, v) => sum + Number(v.stockActual || 0), 0);
    }
    return Number(producto.stockActual || 0);
  }, []);

  // Mínimo propio del producto o, si no tiene, el umbral global de la configuración (RF-8).
  const minimoDeProducto = useCallback(
    (p) => (Number(p.stockMinimo) > 0 ? Number(p.stockMinimo) : Number(config.umbralStock || 0)),
    [config.umbralStock]
  );

  // Nivel de respaldo / stock objetivo (RF-11)
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

  const costoTotalDeProducto = useCallback((p) => Number(p.costo || 0) + Number(p.costoEnvio || 0), []);
  const margenDeProducto = useCallback(
    (p) => {
      const costoTotal = costoTotalDeProducto(p);
      if (!costoTotal) return null;
      return ((Number(p.precio || 0) - costoTotal) / costoTotal) * 100;
    },
    [costoTotalDeProducto]
  );

  // ---------------------------------------------------------------
  // Productos (RF-1, RF-2, RF-3, RF-20 a RF-24)
  // ---------------------------------------------------------------
  const crearProducto = (datos) => {
    const cantidadInicial = Number(datos.cantidadInicial || 0);
    const { cantidadInicial: _omit, ...resto } = datos;
    const nuevo = { id: generateId('prod'), activo: true, variantes: [], stockActual: cantidadInicial, ...resto };
    setProductos((prev) => [...prev, nuevo]);
    if (cantidadInicial > 0) {
      setMovimientos((prev) => [
        {
          id: generateId('mov'), productoId: nuevo.id, varianteId: null, tipo: 'entrada', motivo: 'ajuste_inicial',
          cantidad: cantidadInicial, comentario: 'Existencia inicial al registrar el producto', fecha: new Date().toISOString(),
          usuario: usuarioRef.current?.nombreUsuario || '',
        },
        ...prev,
      ]);
    }
    registrarAuditoria('Productos', 'Crear', `Producto "${nuevo.nombre}"`);
    return nuevo;
  };

  const editarProducto = (id, cambios) => {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
    registrarAuditoria('Productos', 'Editar', `Producto "${cambios.nombre || productos.find((p) => p.id === id)?.nombre || id}"`);
  };

  const darDeBajaProducto = (id) => {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, activo: false } : p)));
    registrarAuditoria('Productos', 'Dar de baja', `Producto "${productos.find((p) => p.id === id)?.nombre || id}"`);
  };

  const reactivarProducto = (id) => {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, activo: true } : p)));
    registrarAuditoria('Productos', 'Reactivar', `Producto "${productos.find((p) => p.id === id)?.nombre || id}"`);
  };

  // Actualización de precios individual o masiva por porcentaje (RNF "Simplicidad en la actualización de precios")
  // cambios: [{ id, precio }]
  const actualizarPrecios = (cambios, detalle = '') => {
    const mapa = new Map(cambios.map((c) => [c.id, Number(c.precio)]));
    setProductos((prev) => prev.map((p) => (mapa.has(p.id) ? { ...p, precio: mapa.get(p.id) } : p)));
    registrarAuditoria('Productos', 'Actualizar precios', detalle || `${cambios.length} producto(s)`);
    return { ok: true, total: cambios.length };
  };

  const buscarProductos = useCallback(
    (texto = '', categoria = '') => {
      const t = texto.trim().toLowerCase();
      const c = categoria.trim().toLowerCase();
      return productos.filter((p) => {
        const coincideTexto = !t || p.nombre.toLowerCase().includes(t) || (p.categoria || '').toLowerCase().includes(t);
        const coincideCategoria = !c || (p.categoria || '').toLowerCase() === c;
        return coincideTexto && coincideCategoria;
      });
    },
    [productos]
  );

  const categoriasExistentes = Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean))).sort();

  // ---------------------------------------------------------------
  // Proveedores (RF-51, RF-52, RF-53)
  // ---------------------------------------------------------------
  const crearProveedor = (datos) => {
    const nuevo = { id: generateId('prov'), activo: true, ...datos };
    setProveedores((prev) => [...prev, nuevo]);
    registrarAuditoria('Proveedores', 'Crear', `Proveedor "${nuevo.nombre}"`);
    return nuevo;
  };

  const editarProveedor = (id, cambios) => {
    setProveedores((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
    registrarAuditoria('Proveedores', 'Editar', `Proveedor "${cambios.nombre || id}"`);
  };

  const eliminarProveedor = (id) => {
    const enUso = productos.some((p) => p.proveedorId === id && p.activo !== false);
    if (enUso) return { ok: false, error: 'Este proveedor tiene productos activos asociados; no se puede eliminar.' };
    registrarAuditoria('Proveedores', 'Eliminar', `Proveedor "${proveedores.find((p) => p.id === id)?.nombre || id}"`);
    setProveedores((prev) => prev.filter((p) => p.id !== id));
    return { ok: true };
  };

  // ---------------------------------------------------------------
  // Inventario: entradas y salidas (RF-5, RF-6, RF-7, RF-46)
  // ---------------------------------------------------------------
  const aplicarMovimiento = ({ productoId, varianteId, tipo, motivo, cantidad, comentario }) => {
    const cant = Number(cantidad);
    if (!productoId || !cant || cant <= 0) return { ok: false, error: 'Selecciona un producto y una cantidad válida.' };
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return { ok: false, error: 'Producto no encontrado.' };

    const delta = tipo === 'entrada' ? cant : -cant;
    if (tipo === 'salida') {
      const stockDisponible = varianteId
        ? Number(producto.variantes.find((v) => v.id === varianteId)?.stockActual || 0)
        : stockDeProducto(producto);
      if (cant > stockDisponible) return { ok: false, error: `No hay suficiente stock disponible (existen ${stockDisponible}).` };
    }

    setProductos((prev) =>
      prev.map((p) => {
        if (p.id !== productoId) return p;
        if (varianteId && p.variantes?.length) {
          return {
            ...p,
            variantes: p.variantes.map((v) =>
              v.id === varianteId ? { ...v, stockActual: Math.max(0, Number(v.stockActual || 0) + delta) } : v
            ),
          };
        }
        return { ...p, stockActual: Math.max(0, Number(p.stockActual || 0) + delta) };
      })
    );

    const mov = {
      id: generateId('mov'), productoId, varianteId: varianteId || null, tipo, motivo, cantidad: cant,
      comentario: comentario || '', fecha: new Date().toISOString(), usuario: usuarioRef.current?.nombreUsuario || '',
    };
    setMovimientos((prev) => [mov, ...prev]);
    return { ok: true, movimiento: mov };
  };

  const registrarMovimiento = (datos) => {
    const res = aplicarMovimiento(datos);
    if (res.ok) {
      const p = productos.find((x) => x.id === datos.productoId);
      registrarAuditoria('Inventario', datos.tipo === 'entrada' ? 'Entrada' : 'Salida', `${datos.cantidad} × ${p?.nombre || ''} (${datos.motivo})`);
    }
    return res;
  };

  const productosBajoStock = productos.filter((p) => p.activo !== false && estaBajoStock(p));
  const productosAgotados = productos.filter((p) => p.activo !== false && estaAgotado(p));

  // Lista unificada de alertas, agotados primero (RF-8, RF-9)
  const alertas = [
    ...productosAgotados.map((p) => ({ producto: p, tipo: 'agotado', stock: 0, minimo: minimoDeProducto(p) })),
    ...productosBajoStock.map((p) => ({ producto: p, tipo: 'bajo', stock: stockDeProducto(p), minimo: minimoDeProducto(p) })),
  ];

  // ---------------------------------------------------------------
  // Pendientes de compra (RF-13)
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
  // Compras y recepción (RF-12, RF-14 a RF-19, RF-25, RF-27)
  // ---------------------------------------------------------------
  const crearCompra = ({ proveedorId, costoEnvio, items }) => {
    const nueva = {
      id: generateId('compra'), proveedorId, fecha: new Date().toISOString(), costoEnvio: Number(costoEnvio || 0),
      estado: 'pendiente', fechaRecepcion: null,
      items: items.map((it) => ({
        id: generateId('item'), productoId: it.productoId, varianteId: it.varianteId || null,
        cantidadComprada: Number(it.cantidadComprada), costoUnitario: Number(it.costoUnitario),
        cantidadRecibida: null, faltante: null, lote: '', numerosSerie: [], incidencia: '',
      })),
    };
    setCompras((prev) => [nueva, ...prev]);
    registrarAuditoria('Compras', 'Orden de compra', `${nueva.items.length} línea(s) a ${proveedores.find((p) => p.id === proveedorId)?.nombre || ''}`);
    return nueva;
  };

  const recibirCompra = (compraId, itemsRecibidos) => {
    const compra = compras.find((c) => c.id === compraId);
    if (!compra) return { ok: false, error: 'Compra no encontrada.' };

    let huboIncidencia = false;
    const itemsActualizados = compra.items.map((item) => {
      const info = itemsRecibidos.find((r) => r.itemId === item.id);
      if (!info) return item;
      const cantidadRecibida = Number(info.cantidadRecibida || 0);
      const faltante = Math.max(0, Number(item.cantidadComprada) - cantidadRecibida);
      if (faltante > 0 || info.incidencia) huboIncidencia = true;
      return {
        ...item, cantidadRecibida, faltante, lote: info.lote || '',
        numerosSerie: (info.numerosSerie || []).filter(Boolean), incidencia: info.incidencia || '',
      };
    });

    setCompras((prev) =>
      prev.map((c) =>
        c.id === compraId
          ? { ...c, items: itemsActualizados, estado: huboIncidencia ? 'recibida_con_incidencias' : 'recibida', fechaRecepcion: new Date().toISOString() }
          : c
      )
    );

    itemsActualizados.forEach((item) => {
      if (item.cantidadRecibida > 0) {
        aplicarMovimiento({
          productoId: item.productoId, varianteId: item.varianteId, tipo: 'entrada', motivo: 'compra',
          cantidad: item.cantidadRecibida, comentario: item.lote ? `Recepción de compra — lote ${item.lote}` : 'Recepción de compra',
        });
      }
    });

    const nuevasSeries = itemsActualizados.flatMap((item) =>
      item.numerosSerie.map((numero) => ({
        id: generateId('serie'), numero, productoId: item.productoId, varianteId: item.varianteId, lote: item.lote,
        compraId, ventaId: null, fechaIngreso: new Date().toISOString(),
      }))
    );
    if (nuevasSeries.length > 0) setNumerosSerie((prev) => [...prev, ...nuevasSeries]);

    registrarAuditoria('Compras', 'Recepción', `Orden recibida${huboIncidencia ? ' con incidencias' : ''} (${itemsActualizados.length} línea(s))`);
    return { ok: true };
  };

  const buscarPorLote = useCallback(
    (lote) => {
      const l = lote.trim().toLowerCase();
      if (!l) return [];
      const resultados = [];
      compras.forEach((c) => {
        c.items.forEach((item) => {
          if (item.lote && item.lote.toLowerCase() === l) {
            resultados.push({
              compraId: c.id, productoId: item.productoId, varianteId: item.varianteId,
              cantidadRecibida: item.cantidadRecibida, fechaRecepcion: c.fechaRecepcion,
            });
          }
        });
      });
      return resultados;
    },
    [compras]
  );

  const buscarPorNumeroSerie = useCallback(
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
    (productoId, varianteId) =>
      numerosSerie.filter((s) => s.productoId === productoId && (varianteId ? s.varianteId === varianteId : !s.varianteId) && !s.ventaId),
    [numerosSerie]
  );

  const nombreVariante = (producto, varianteId) => producto?.variantes?.find((v) => v.id === varianteId)?.valor || '';

  // items: [{ productoId, varianteId, cantidad, numeroSerieId }]  — el precio vigente lo toma el sistema (RF-31)
  const registrarVenta = ({ canal, cliente, metodoPago, items }) => {
    if (!items || items.length === 0) return { ok: false, error: 'Agrega al menos un producto a la venta.' };
    if (!['piso', 'linea'].includes(canal)) return { ok: false, error: 'Selecciona el canal de venta.' };
    if (!metodoPago) return { ok: false, error: 'Selecciona el método de pago.' };

    // Validación de stock acumulado por producto/variante (varias líneas pueden compartir producto)
    const acumulado = {};
    for (const it of items) {
      const producto = productos.find((p) => p.id === it.productoId);
      if (!producto || producto.activo === false) return { ok: false, error: 'Uno de los productos ya no está disponible.' };
      if (producto.variantes?.length > 0 && !it.varianteId) return { ok: false, error: `Selecciona la variante de "${producto.nombre}".` };
      const clave = `${it.productoId}|${it.varianteId || ''}`;
      acumulado[clave] = (acumulado[clave] || 0) + Number(it.cantidad);
      const disponible = it.varianteId
        ? Number(producto.variantes.find((v) => v.id === it.varianteId)?.stockActual || 0)
        : stockDeProducto(producto);
      if (acumulado[clave] > disponible) return { ok: false, error: `Stock insuficiente para "${producto.nombre}" (disponible: ${disponible}).` };
    }

    const serieIds = items.map((it) => it.numeroSerieId).filter(Boolean);
    if (new Set(serieIds).size !== serieIds.length) return { ok: false, error: 'Un mismo número de serie está repetido en la venta.' };
    for (const id of serieIds) {
      const s = numerosSerie.find((x) => x.id === id);
      if (!s || s.ventaId) return { ok: false, error: 'Un número de serie seleccionado ya no está disponible.' };
    }

    const lineas = items.map((it) => {
      const producto = productos.find((p) => p.id === it.productoId);
      const serie = it.numeroSerieId ? numerosSerie.find((s) => s.id === it.numeroSerieId) : null;
      return {
        productoId: it.productoId, varianteId: it.varianteId || null, nombre: producto.nombre, categoria: producto.categoria || 'Sin categoría',
        varianteValor: nombreVariante(producto, it.varianteId), cantidad: Number(it.cantidad),
        precioUnitario: Number(producto.precio), costoUnitario: costoTotalDeProducto(producto),
        numeroSerieId: serie?.id || null, numeroSerie: serie?.numero || '',
      };
    });

    const ultimo = ventas.reduce((m, v) => Math.max(m, parseInt(String(v.numeroFactura).replace(/\D/g, ''), 10) || 0), 0);
    const nuevaVenta = {
      id: generateId('venta'), numeroFactura: `FAC-${String(ultimo + 1).padStart(6, '0')}`, fecha: new Date().toISOString(),
      canal, cliente: (cliente || '').trim() || 'Consumidor final', metodoPago, items: lineas,
      total: lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0),
      vendedor: usuarioRef.current?.nombreCompleto || usuarioRef.current?.nombreUsuario || '',
      vendedorId: usuarioRef.current?.id || null,
    };

    lineas.forEach((l) =>
      aplicarMovimiento({
        productoId: l.productoId, varianteId: l.varianteId, tipo: 'salida', motivo: 'venta', cantidad: l.cantidad,
        comentario: `${nuevaVenta.numeroFactura} · ${canal === 'piso' ? 'Venta en piso' : 'Venta en línea'}`,
      })
    );
    setVentas((prev) => [nuevaVenta, ...prev]);
    if (serieIds.length > 0) {
      setNumerosSerie((prev) => prev.map((s) => (serieIds.includes(s.id) ? { ...s, ventaId: nuevaVenta.id, fechaVenta: nuevaVenta.fecha } : s)));
    }
    registrarAuditoria('Ventas', 'Registrar venta', `${nuevaVenta.numeroFactura} · ${canal === 'piso' ? 'en piso' : 'en línea'} · C$ ${nuevaVenta.total.toFixed(2)}`);
    return { ok: true, venta: nuevaVenta };
  };

  // ---------------------------------------------------------------
  // Devoluciones (RF-54, RF-55) y venta neta
  // ---------------------------------------------------------------
  const devueltoDe = useCallback(
    (ventaId, productoId, varianteId) =>
      devoluciones
        .filter((d) => d.ventaId === ventaId && d.productoId === productoId && (d.varianteId || null) === (varianteId || null))
        .reduce((s, d) => s + Number(d.cantidad), 0),
    [devoluciones]
  );

  // Líneas de una venta agrupadas por producto/variante con cantidades netas de devoluciones.
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

  const registrarDevolucion = ({ ventaId, productoId, varianteId, cantidad, motivo }) => {
    const cant = Number(cantidad);
    const venta = ventas.find((v) => v.id === ventaId);
    if (!venta) return { ok: false, error: 'Selecciona la venta asociada.' };
    const linea = lineasNetas(venta).find((l) => l.productoId === productoId && (l.varianteId || null) === (varianteId || null));
    if (!linea) return { ok: false, error: 'Ese producto no pertenece a la venta seleccionada.' };
    if (!cant || cant <= 0) return { ok: false, error: 'La cantidad debe ser mayor que cero.' };
    if (cant > linea.cantidadNeta) return { ok: false, error: `Solo se pueden devolver ${linea.cantidadNeta} unidad(es) de esta venta.` };
    if (!String(motivo || '').trim()) return { ok: false, error: 'Indica el motivo de la devolución.' };

    const res = aplicarMovimiento({
      productoId, varianteId: varianteId || null, tipo: 'entrada', motivo: 'devolucion_cliente', cantidad: cant,
      comentario: `Devolución de ${venta.numeroFactura} — ${motivo}`,
    });
    if (!res.ok) return res;

    const nueva = {
      id: generateId('devol'), ventaId, numeroFactura: venta.numeroFactura, productoId, varianteId: varianteId || null,
      nombre: linea.nombre, varianteValor: linea.varianteValor, cantidad: cant, monto: cant * Number(linea.precioUnitario),
      motivo: String(motivo).trim(), fecha: new Date().toISOString(), usuario: usuarioRef.current?.nombreUsuario || '',
    };
    setDevoluciones((prev) => [nueva, ...prev]);
    registrarAuditoria('Devoluciones', 'Registrar devolución', `${cant} × ${linea.nombre} de ${venta.numeroFactura}`);
    return { ok: true, devolucion: nueva };
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
  // Garantías (RF-36, RF-37, RF-38)
  // ---------------------------------------------------------------
  // Verifica un número de serie contra el registro de ventas.
  const verificarSerie = useCallback(
    (numero) => {
      const serie = buscarPorNumeroSerie(numero);
      if (!serie) return null;
      const producto = productos.find((p) => p.id === serie.productoId) || null;
      const venta = serie.ventaId ? ventas.find((v) => v.id === serie.ventaId) || null : null;
      const dias = venta ? diasEntre(venta.fecha) : null;
      const limite = Number(config.diasGarantia || 15);
      return {
        serie, producto, venta, diasTranscurridos: dias, diasGarantia: limite,
        diasRestantes: dias === null ? null : Math.max(0, limite - dias),
        dentroDePeriodo: dias !== null && dias <= limite,
        garantiasPrevias: garantias.filter((g) => g.numeroSerieId === serie.id),
      };
    },
    [buscarPorNumeroSerie, productos, ventas, garantias, config.diasGarantia]
  );

  const registrarGarantia = ({ numeroSerieId, descripcion }) => {
    const serie = numerosSerie.find((s) => s.id === numeroSerieId);
    if (!serie) return { ok: false, error: 'Número de serie no encontrado.' };
    const info = verificarSerie(serie.numero);
    if (!info.venta) return { ok: false, error: 'Ese número de serie no figura en ninguna venta: no se puede registrar la garantía.' };
    const nueva = {
      id: generateId('garantia'), numeroSerieId, numero: serie.numero, productoId: serie.productoId,
      nombre: info.producto?.nombre || '', ventaId: info.venta.id, numeroFactura: info.venta.numeroFactura, cliente: info.venta.cliente,
      descripcion: (descripcion || '').trim(), dentroDePeriodo: info.dentroDePeriodo, diasTranscurridos: info.diasTranscurridos,
      estado: 'abierta', fecha: new Date().toISOString(), usuario: usuarioRef.current?.nombreUsuario || '',
    };
    setGarantias((prev) => [nueva, ...prev]);
    registrarAuditoria('Garantías', 'Registrar garantía', `Serie ${serie.numero} · ${info.venta.numeroFactura}`);
    return { ok: true, garantia: nueva };
  };

  const actualizarEstadoGarantia = (id, estado) => {
    setGarantias((prev) => prev.map((g) => (g.id === id ? { ...g, estado } : g)));
    registrarAuditoria('Garantías', 'Cambiar estado', `Garantía → ${estado}`);
  };

  // ---------------------------------------------------------------
  // Usuarios, roles y acceso (RF-47 a RF-50, RNF de seguridad)
  // ---------------------------------------------------------------
  const ROLES_DISPONIBLES = ROLES;

  const crearUsuario = async ({ nombreUsuario, nombreCompleto, rol, password, preguntaSeguridad, respuestaSeguridad }) => {
    const nombre = String(nombreUsuario || '').trim();
    if (!nombre) return { ok: false, error: 'El nombre de usuario es obligatorio.' };
    if (usuarios.some((u) => u.nombreUsuario.toLowerCase() === nombre.toLowerCase())) {
      return { ok: false, error: 'Ya existe un usuario con ese nombre de usuario.' };
    }
    const saltPassword = generarSalt();
    const saltRespuesta = generarSalt();
    const nuevo = {
      id: generateId('user'), nombreUsuario: nombre, nombreCompleto: nombreCompleto || '', rol, activo: true,
      passwordHash: await hashConSalt(password, saltPassword), saltPassword,
      preguntaSeguridad: preguntaSeguridad || '',
      respuestaHash: await hashConSalt((respuestaSeguridad || '').toLowerCase().trim(), saltRespuesta), saltRespuesta,
    };
    setUsuarios((prev) => [...prev, nuevo]);
    registrarAuditoria('Usuarios', 'Crear', `Usuario "${nombre}" (${rol})`);
    return { ok: true, usuario: nuevo };
  };

  const administradoresActivos = (excluirId) => usuarios.filter((u) => u.rol === 'Administrador' && u.activo !== false && u.id !== excluirId).length;

  const editarUsuario = (id, cambios) => {
    const actual = usuarios.find((u) => u.id === id);
    if (!actual) return { ok: false, error: 'Usuario no encontrado.' };
    if (actual.rol === 'Administrador' && cambios.rol && cambios.rol !== 'Administrador' && administradoresActivos(id) === 0) {
      return { ok: false, error: 'Debe quedar al menos un administrador activo.' };
    }
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...cambios } : u)));
    registrarAuditoria('Usuarios', 'Editar', `Usuario "${actual.nombreUsuario}"`);
    return { ok: true };
  };

  const cambiarPasswordUsuario = async (id, nuevaContrasena) => {
    const saltPassword = generarSalt();
    const passwordHash = await hashConSalt(nuevaContrasena, saltPassword);
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, passwordHash, saltPassword } : u)));
    registrarAuditoria('Usuarios', 'Cambiar contraseña', `Usuario "${usuarios.find((u) => u.id === id)?.nombreUsuario || id}"`);
    return { ok: true };
  };

  const darDeBajaUsuario = (id) => {
    const u = usuarios.find((x) => x.id === id);
    if (!u) return { ok: false, error: 'Usuario no encontrado.' };
    if (u.id === usuarioActualId) return { ok: false, error: 'No puedes desactivar tu propia cuenta.' };
    if (u.rol === 'Administrador' && administradoresActivos(id) === 0) return { ok: false, error: 'Debe quedar al menos un administrador activo.' };
    setUsuarios((prev) => prev.map((x) => (x.id === id ? { ...x, activo: false } : x)));
    registrarAuditoria('Usuarios', 'Desactivar', `Usuario "${u.nombreUsuario}"`);
    return { ok: true };
  };

  const reactivarUsuario = (id) => {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, activo: true } : u)));
    registrarAuditoria('Usuarios', 'Reactivar', `Usuario "${usuarios.find((u) => u.id === id)?.nombreUsuario || id}"`);
  };

  // Inicio de sesión (RF-49): compara el hash, nunca la contraseña en texto plano.
  const verificarCredenciales = async (nombreUsuario, password) => {
    const usuario = usuarios.find((u) => u.nombreUsuario.toLowerCase() === nombreUsuario.trim().toLowerCase() && u.activo !== false);
    if (!usuario) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
    const valido = await verificarConSalt(password, usuario.saltPassword, usuario.passwordHash);
    if (!valido) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
    return { ok: true, usuario };
  };

  // Recuperación de contraseña (RF-50) mediante pregunta de seguridad.
  const obtenerPreguntaSeguridad = (nombreUsuario) => {
    const usuario = usuarios.find((u) => u.nombreUsuario.toLowerCase() === nombreUsuario.trim().toLowerCase() && u.activo !== false);
    return usuario?.preguntaSeguridad || null;
  };

  const recuperarContrasena = async ({ nombreUsuario, respuestaSeguridad, nuevaContrasena }) => {
    const usuario = usuarios.find((u) => u.nombreUsuario.toLowerCase() === nombreUsuario.trim().toLowerCase() && u.activo !== false);
    if (!usuario) return { ok: false, error: 'No existe ese usuario.' };
    const valido = await verificarConSalt((respuestaSeguridad || '').toLowerCase().trim(), usuario.saltRespuesta, usuario.respuestaHash);
    if (!valido) return { ok: false, error: 'La respuesta de seguridad no es correcta.' };
    await cambiarPasswordUsuario(usuario.id, nuevaContrasena);
    return { ok: true };
  };


  // Inicio y cierre de sesión mediante JWT
  const iniciarSesion = (usuario) => {
    const usuarioNormalizado = {
      ...usuario,
      nombreUsuario:
        usuario.username ||
        usuario.nombreUsuario ||
        '',
      nombreCompleto:
        usuario.nombre_completo ||
        usuario.nombreCompleto ||
        usuario.username ||
        usuario.nombreUsuario ||
        '',
      rol:
        typeof usuario.rol === 'object'
          ? usuario.rol?.nombre || ''
          : usuario.nombre_rol ||
          usuario.rol_nombre ||
          usuario.rol ||
          '',
    };

    setUsuarioBackend(usuario);
    setUsuarioActualId(usuario.id || null);

    localStorage.setItem('usuario', JSON.stringify(usuario));
    localStorage.removeItem('motoman_sesion');

    registrarAuditoria(
      'Acceso',
      'Inicio de sesión',
      '',
      usuarioNormalizado
    );
  };

  const cerrarSesion = () => {
    registrarAuditoria('Acceso', 'Cierre de sesión');

    setUsuarioBackend(null);
    setUsuarioActualId(null);

    cerrarSesionAPI();
    localStorage.removeItem('motoman_sesion');
  };

  // ---------------------------------------------------------------
  // Respaldo y recuperación (RNF "Respaldo y recuperación")
  // ---------------------------------------------------------------
  const exportarRespaldo = () => {
    registrarAuditoria('Configuración', 'Exportar respaldo');
    // Esperamos al siguiente ciclo para que la auditoría quede guardada dentro del respaldo.
    return new Promise((resolve) => setTimeout(() => resolve(exportarTodo()), 50));
  };
  const restaurarRespaldo = (respaldo) => {
    const res = importarTodo(respaldo);
    if (res.ok) window.location.reload();
    return res;
  };

  const value = {
    productos, proveedores, movimientos, config, actualizarConfig,
    stockDeProducto, minimoDeProducto, objetivoDeProducto, cantidadSugeridaReposicion,
    estaBajoStock, estaAgotado, costoTotalDeProducto, margenDeProducto, categoriasExistentes,
    crearProducto, editarProducto, darDeBajaProducto, reactivarProducto, actualizarPrecios, buscarProductos,
    crearProveedor, editarProveedor, eliminarProveedor,
    registrarMovimiento, productosBajoStock, productosAgotados, alertas,
    pendientesCompra, crearPendienteCompra, marcarPendienteAtendido, eliminarPendiente,
    compras, crearCompra, recibirCompra,
    numerosSerie, buscarPorLote, buscarPorNumeroSerie,
    ventas, registrarVenta, numerosSerieDisponibles, lineasNetas,
    devoluciones, registrarDevolucion, devueltoDe,
    unidadesRecientes, esAltaRotacion,
    garantias, verificarSerie, registrarGarantia, actualizarEstadoGarantia,
    usuarios, ROLES_DISPONIBLES, crearUsuario, editarUsuario, cambiarPasswordUsuario, darDeBajaUsuario, reactivarUsuario,
    verificarCredenciales, obtenerPreguntaSeguridad, recuperarContrasena,
    usuarioActual,
    usuarioActualId,
    cargandoSesion,
    iniciarSesion,
    cerrarSesion,
    tienePermiso,
    auditoria, registrarAuditoria, exportarRespaldo, restaurarRespaldo,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}
