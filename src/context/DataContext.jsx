// src/context/DataContext.jsx
//
// Contexto global de datos de negocio: productos, proveedores y
// movimientos de inventario. Centraliza la lógica que antes vivía
// (a medias) dentro de cada pantalla, para que Productos, Inventario,
// y más adelante Ventas y Reportes, trabajen sobre la misma información.
//
// Persistencia: localStorage (ver src/data/storage.js). Cuando exista
// backend, solo hay que cambiar las funciones de este archivo.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCollection, saveCollection, generateId, seedIfEmpty } from "../data/storage";
import { seedProductos, seedProveedores, seedUsuarios } from "../data/seed";
import { generarSalt, hashConSalt, verificarConSalt } from "../utils/passwordHash";

const DataContext = createContext(null);

seedIfEmpty("productos", seedProductos);
seedIfEmpty("proveedores", seedProveedores);
seedIfEmpty("movimientos", []);
seedIfEmpty("pendientesCompra", []);
seedIfEmpty("compras", []);
seedIfEmpty("numerosSerie", []);
seedIfEmpty("ventas", []);
seedIfEmpty("garantias", []);
seedIfEmpty("devoluciones", []);
seedIfEmpty("usuarios", seedUsuarios);

export function DataProvider({ children }) {
  const [productos, setProductos] = useState(() => getCollection("productos"));
  const [proveedores, setProveedores] = useState(() => getCollection("proveedores"));
  const [movimientos, setMovimientos] = useState(() => getCollection("movimientos"));
  const [pendientesCompra, setPendientesCompra] = useState(() => getCollection("pendientesCompra"));
  const [compras, setCompras] = useState(() => getCollection("compras"));
  const [numerosSerie, setNumerosSerie] = useState(() => getCollection("numerosSerie"));
  const [ventas, setVentas] = useState(() => getCollection("ventas"));
  const [garantias, setGarantias] = useState(() => getCollection("garantias"));
  const [devoluciones, setDevoluciones] = useState(() => getCollection("devoluciones"));
  const [usuarios, setUsuarios] = useState(() => getCollection("usuarios"));
  const [usuarioActualId, setUsuarioActualId] = useState(() => localStorage.getItem("motoman_sesion"));

  useEffect(() => saveCollection("productos", productos), [productos]);
  useEffect(() => saveCollection("proveedores", proveedores), [proveedores]);
  useEffect(() => saveCollection("movimientos", movimientos), [movimientos]);
  useEffect(() => saveCollection("pendientesCompra", pendientesCompra), [pendientesCompra]);
  useEffect(() => saveCollection("compras", compras), [compras]);
  useEffect(() => saveCollection("numerosSerie", numerosSerie), [numerosSerie]);
  useEffect(() => saveCollection("ventas", ventas), [ventas]);
  useEffect(() => saveCollection("garantias", garantias), [garantias]);
  useEffect(() => saveCollection("devoluciones", devoluciones), [devoluciones]);
  useEffect(() => saveCollection("usuarios", usuarios), [usuarios]);

  useEffect(() => {
    if (usuarioActualId) localStorage.setItem("motoman_sesion", usuarioActualId);
    else localStorage.removeItem("motoman_sesion");
  }, [usuarioActualId]);

  // ---------------------------------------------------------------
  // Helpers de stock (RF-4, RF-8, RF-9, RNF-2)
  // ---------------------------------------------------------------
  const stockDeProducto = useCallback((producto) => {
    if (producto.variantes && producto.variantes.length > 0) {
      return producto.variantes.reduce((sum, v) => sum + Number(v.stockActual || 0), 0);
    }
    return Number(producto.stockActual || 0);
  }, []);

  const estaBajoStock = useCallback(
    (producto) => stockDeProducto(producto) <= Number(producto.stockMinimo || 0),
    [stockDeProducto]
  );

  const estaAgotado = useCallback((producto) => stockDeProducto(producto) === 0, [stockDeProducto]);

  const costoTotalDeProducto = useCallback(
    (producto) => Number(producto.costo || 0) + Number(producto.costoEnvio || 0),
    []
  );

  const margenDeProducto = useCallback(
    (producto) => {
      const costoTotal = costoTotalDeProducto(producto);
      if (!costoTotal) return null;
      return ((Number(producto.precio || 0) - costoTotal) / costoTotal) * 100;
    },
    [costoTotalDeProducto]
  );

  // ---------------------------------------------------------------
  // Productos (RF-1, RF-2, RF-3, RF-20 a RF-24)
  // ---------------------------------------------------------------
  const crearProducto = (datos) => {
    const cantidadInicial = Number(datos.cantidadInicial || 0);
    const { cantidadInicial: _omit, ...resto } = datos;

    const nuevo = {
      id: generateId("prod"),
      activo: true,
      variantes: [],
      stockActual: cantidadInicial,
      ...resto,
    };

    setProductos((prev) => [...prev, nuevo]);

    if (cantidadInicial > 0) {
      const mov = {
        id: generateId("mov"),
        productoId: nuevo.id,
        varianteId: null,
        tipo: "entrada",
        motivo: "ajuste_inicial",
        cantidad: cantidadInicial,
        comentario: "Existencia inicial al registrar el producto",
        fecha: new Date().toISOString(),
      };
      setMovimientos((prev) => [mov, ...prev]);
    }
    return nuevo;
  };

  const editarProducto = (id, cambios) => {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  };

  const darDeBajaProducto = (id) => {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, activo: false } : p)));
  };

  const reactivarProducto = (id) => {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, activo: true } : p)));
  };

  const buscarProductos = useCallback(
    (texto = "", categoria = "") => {
      const t = texto.trim().toLowerCase();
      const c = categoria.trim().toLowerCase();
      return productos.filter((p) => {
        const coincideTexto = !t || p.nombre.toLowerCase().includes(t);
        const coincideCategoria = !c || (p.categoria || "").toLowerCase() === c;
        return coincideTexto && coincideCategoria;
      });
    },
    [productos]
  );

  const categoriasExistentes = Array.from(
    new Set(productos.map((p) => p.categoria).filter(Boolean))
  ).sort();

  // ---------------------------------------------------------------
  // Proveedores (RF-51, RF-52, RF-53)
  // ---------------------------------------------------------------
  const crearProveedor = (datos) => {
    const nuevo = { id: generateId("prov"), activo: true, ...datos };
    setProveedores((prev) => [...prev, nuevo]);
    return nuevo;
  };

  const editarProveedor = (id, cambios) => {
    setProveedores((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  };

  const eliminarProveedor = (id) => {
    const enUso = productos.some((p) => p.proveedorId === id && p.activo !== false);
    if (enUso) {
      return { ok: false, error: "Este proveedor tiene productos activos asociados; no se puede eliminar." };
    }
    setProveedores((prev) => prev.filter((p) => p.id !== id));
    return { ok: true };
  };

  // ---------------------------------------------------------------
  // Inventario: entradas y salidas (RF-5, RF-6, RF-7, RF-46)
  // ---------------------------------------------------------------
  const registrarMovimiento = ({ productoId, varianteId, tipo, motivo, cantidad, comentario }) => {
    const cant = Number(cantidad);
    if (!productoId || !cant || cant <= 0) {
      return { ok: false, error: "Selecciona un producto y una cantidad válida." };
    }

    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return { ok: false, error: "Producto no encontrado." };

    const delta = tipo === "entrada" ? cant : -cant;

    if (tipo === "salida") {
      const stockDisponible = varianteId
        ? Number(producto.variantes.find((v) => v.id === varianteId)?.stockActual || 0)
        : stockDeProducto(producto);
      if (cant > stockDisponible) {
        return { ok: false, error: `No hay suficiente stock disponible (existen ${stockDisponible}).` };
      }
    }

    setProductos((prev) =>
      prev.map((p) => {
        if (p.id !== productoId) return p;
        if (varianteId && p.variantes?.length) {
          return {
            ...p,
            variantes: p.variantes.map((v) =>
              v.id === varianteId
                ? { ...v, stockActual: Math.max(0, Number(v.stockActual || 0) + delta) }
                : v
            ),
          };
        }
        return { ...p, stockActual: Math.max(0, Number(p.stockActual || 0) + delta) };
      })
    );

    const mov = {
      id: generateId("mov"),
      productoId,
      varianteId: varianteId || null,
      tipo,
      motivo,
      cantidad: cant,
      comentario: comentario || "",
      fecha: new Date().toISOString(),
    };
    setMovimientos((prev) => [mov, ...prev]);
    return { ok: true, movimiento: mov };
  };

  const productosBajoStock = productos.filter((p) => p.activo !== false && estaBajoStock(p));
  const productosAgotados = productos.filter((p) => p.activo !== false && estaAgotado(p));

  // ---------------------------------------------------------------
  // Productos pendientes de compra (RF-13): lista de planificación,
  // separada de una orden de compra formal.
  // ---------------------------------------------------------------
  const crearPendienteCompra = (datos) => {
    const nuevo = {
      id: generateId("pend"),
      fechaRegistro: new Date().toISOString(),
      atendido: false,
      ...datos,
    };
    setPendientesCompra((prev) => [nuevo, ...prev]);
    return nuevo;
  };

  const marcarPendienteAtendido = (id) => {
    setPendientesCompra((prev) => prev.map((p) => (p.id === id ? { ...p, atendido: true } : p)));
  };

  const eliminarPendiente = (id) => {
    setPendientesCompra((prev) => prev.filter((p) => p.id !== id));
  };

  // ---------------------------------------------------------------
  // Compras (RF-12 registro, RF-14 historial, RF-18 pendientes de recepción)
  // ---------------------------------------------------------------
  const crearCompra = ({ proveedorId, costoEnvio, items }) => {
    const nueva = {
      id: generateId("compra"),
      proveedorId,
      fecha: new Date().toISOString(),
      costoEnvio: Number(costoEnvio || 0),
      estado: "pendiente", // pendiente | recibida | recibida_con_incidencias
      fechaRecepcion: null,
      items: items.map((it) => ({
        id: generateId("item"),
        productoId: it.productoId,
        varianteId: it.varianteId || null,
        cantidadComprada: Number(it.cantidadComprada),
        costoUnitario: Number(it.costoUnitario),
        cantidadRecibida: null,
        faltante: null,
        lote: "",
        numerosSerie: [],
        incidencia: "",
      })),
    };
    setCompras((prev) => [nueva, ...prev]);
    return nueva;
  };

  // Recepción de mercadería (RF-15 comparar cantidades, RF-16 faltantes,
  // RF-17 estado de recepción, RF-19 incidencias, RF-25 lotes, RF-27 series).
  // itemsRecibidos: [{ itemId, cantidadRecibida, lote, numerosSerie: [...], incidencia }]
  const recibirCompra = (compraId, itemsRecibidos) => {
    const compra = compras.find((c) => c.id === compraId);
    if (!compra) return { ok: false, error: "Compra no encontrada." };

    let huboIncidencia = false;
    const itemsActualizados = compra.items.map((item) => {
      const info = itemsRecibidos.find((r) => r.itemId === item.id);
      if (!info) return item;
      const cantidadRecibida = Number(info.cantidadRecibida || 0);
      const faltante = Math.max(0, Number(item.cantidadComprada) - cantidadRecibida);
      if (faltante > 0 || info.incidencia) huboIncidencia = true;
      return {
        ...item,
        cantidadRecibida,
        faltante,
        lote: info.lote || "",
        numerosSerie: (info.numerosSerie || []).filter(Boolean),
        incidencia: info.incidencia || "",
      };
    });

    setCompras((prev) =>
      prev.map((c) =>
        c.id === compraId
          ? {
              ...c,
              items: itemsActualizados,
              estado: huboIncidencia ? "recibida_con_incidencias" : "recibida",
              fechaRecepcion: new Date().toISOString(),
            }
          : c
      )
    );

    // Actualiza el stock real y registra el movimiento de entrada por cada línea recibida.
    itemsActualizados.forEach((item) => {
      if (item.cantidadRecibida > 0) {
        registrarMovimiento({
          productoId: item.productoId,
          varianteId: item.varianteId,
          tipo: "entrada",
          motivo: "compra",
          cantidad: item.cantidadRecibida,
          comentario: item.lote ? `Recepción de compra — lote ${item.lote}` : "Recepción de compra",
        });
      }
    });

    // Registra los números de serie recibidos, para trazabilidad (RF-27, RF-29).
    const nuevasSeries = itemsActualizados.flatMap((item) =>
      item.numerosSerie.map((numero) => ({
        id: generateId("serie"),
        numero,
        productoId: item.productoId,
        varianteId: item.varianteId,
        lote: item.lote,
        compraId,
        ventaId: null,
        fechaIngreso: new Date().toISOString(),
      }))
    );
    if (nuevasSeries.length > 0) {
      setNumerosSerie((prev) => [...prev, ...nuevasSeries]);
    }

    return { ok: true };
  };

  // Consulta de productos por lote (RF-26)
  const buscarPorLote = useCallback(
    (lote) => {
      const l = lote.trim().toLowerCase();
      if (!l) return [];
      const resultados = [];
      compras.forEach((c) => {
        c.items.forEach((item) => {
          if (item.lote && item.lote.toLowerCase() === l) {
            resultados.push({
              compraId: c.id,
              productoId: item.productoId,
              varianteId: item.varianteId,
              cantidadRecibida: item.cantidadRecibida,
              fechaRecepcion: c.fechaRecepcion,
            });
          }
        });
      });
      return resultados;
    },
    [compras]
  );

  // Trazabilidad por número de serie (RF-29)
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
      numerosSerie.filter(
        (s) => s.productoId === productoId && (varianteId ? s.varianteId === varianteId : !s.varianteId) && !s.ventaId
      ),
    [numerosSerie]
  );

  // items: [{ productoId, varianteId, cantidad, precioUnitario, numeroSerieId }]
  const registrarVenta = ({ canal, cliente, metodoPago, items }) => {
    if (!items || items.length === 0) {
      return { ok: false, error: "Agrega al menos un producto a la venta." };
    }

    for (const it of items) {
      const producto = productos.find((p) => p.id === it.productoId);
      if (!producto) return { ok: false, error: "Producto no encontrado." };
      const disponible = it.varianteId
        ? Number(producto.variantes.find((v) => v.id === it.varianteId)?.stockActual || 0)
        : stockDeProducto(producto);
      if (Number(it.cantidad) > disponible) {
        return { ok: false, error: `Stock insuficiente para "${producto.nombre}" (disponible: ${disponible}).` };
      }
    }

    items.forEach((it) => {
      registrarMovimiento({
        productoId: it.productoId,
        varianteId: it.varianteId || null,
        tipo: "salida",
        motivo: "venta",
        cantidad: it.cantidad,
        comentario: canal === "piso" ? "Venta en piso" : "Venta en línea",
      });
    });

    const total = items.reduce((sum, it) => sum + Number(it.cantidad) * Number(it.precioUnitario), 0);
    const numeroFactura = `FAC-${String(ventas.length + 1).padStart(6, "0")}`;

    const nuevaVenta = {
      id: generateId("venta"),
      numeroFactura,
      fecha: new Date().toISOString(),
      canal, // 'piso' | 'linea'
      cliente: cliente || "Consumidor final",
      metodoPago,
      items: items.map((it) => ({ ...it })),
      total,
    };
    setVentas((prev) => [nuevaVenta, ...prev]);

    const seriesVendidas = items.filter((it) => it.numeroSerieId);
    if (seriesVendidas.length > 0) {
      setNumerosSerie((prev) =>
        prev.map((s) => {
          const it = seriesVendidas.find((x) => x.numeroSerieId === s.id);
          return it ? { ...s, ventaId: nuevaVenta.id } : s;
        })
      );
    }

    return { ok: true, venta: nuevaVenta };
  };

  // ---------------------------------------------------------------
  // Garantías (RF-36, RF-37, RF-38 — período de 15 días)
  // ---------------------------------------------------------------
  const PERIODO_GARANTIA_DIAS = 15;

  const registrarGarantia = ({ numeroSerieId, descripcion }) => {
    const serie = numerosSerie.find((s) => s.id === numeroSerieId);
    if (!serie) return { ok: false, error: "Número de serie no encontrado." };
    const venta = ventas.find((v) => v.id === serie.ventaId);
    const dentroDePeriodo = venta
      ? Date.now() - new Date(venta.fecha).getTime() <= PERIODO_GARANTIA_DIAS * 24 * 60 * 60 * 1000
      : false;

    const nueva = {
      id: generateId("garantia"),
      numeroSerieId,
      numero: serie.numero,
      ventaId: serie.ventaId || null,
      descripcion: descripcion || "",
      dentroDePeriodo,
      fecha: new Date().toISOString(),
    };
    setGarantias((prev) => [nueva, ...prev]);
    return { ok: true, garantia: nueva };
  };

  // ---------------------------------------------------------------
  // Devoluciones (RF-54, RF-55)
  // ---------------------------------------------------------------
  const registrarDevolucion = ({ ventaId, productoId, varianteId, cantidad, motivo }) => {
    const cant = Number(cantidad);
    if (!cant || cant <= 0) return { ok: false, error: "Cantidad inválida." };

    const res = registrarMovimiento({
      productoId,
      varianteId: varianteId || null,
      tipo: "entrada",
      motivo: "devolucion_cliente",
      cantidad: cant,
      comentario: `Devolución de la venta ${ventaId} — ${motivo || "sin motivo especificado"}`,
    });
    if (!res.ok) return res;

    const nueva = {
      id: generateId("devol"),
      ventaId,
      productoId,
      varianteId: varianteId || null,
      cantidad: cant,
      motivo: motivo || "",
      fecha: new Date().toISOString(),
    };
    setDevoluciones((prev) => [nueva, ...prev]);
    return { ok: true };
  };

  // ---------------------------------------------------------------
  // Usuarios, roles y acceso (RF-47 a RF-50, RNF-12 a RNF-15)
  // Contraseñas con hash SHA-256 + salt (ver src/utils/passwordHash.js):
  // nunca se guarda ni se compara texto plano.
  // ---------------------------------------------------------------
  const ROLES_DISPONIBLES = ["Administrador", "Vendedor", "Encargado de Inventario"];

  const crearUsuario = async ({ nombreUsuario, nombreCompleto, rol, password, preguntaSeguridad, respuestaSeguridad }) => {
    const yaExiste = usuarios.some((u) => u.nombreUsuario.toLowerCase() === nombreUsuario.trim().toLowerCase());
    if (yaExiste) return { ok: false, error: "Ya existe un usuario con ese nombre de usuario." };

    const saltPassword = generarSalt();
    const saltRespuesta = generarSalt();
    const nuevo = {
      id: generateId("user"),
      nombreUsuario: nombreUsuario.trim(),
      nombreCompleto: nombreCompleto || "",
      rol,
      activo: true,
      passwordHash: await hashConSalt(password, saltPassword),
      saltPassword,
      preguntaSeguridad: preguntaSeguridad || "",
      respuestaHash: await hashConSalt((respuestaSeguridad || "").toLowerCase().trim(), saltRespuesta),
      saltRespuesta,
    };
    setUsuarios((prev) => [...prev, nuevo]);
    return { ok: true, usuario: nuevo };
  };

  const editarUsuario = (id, cambios) => {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...cambios } : u)));
  };

  const cambiarPasswordUsuario = async (id, nuevaContrasena) => {
    const saltPassword = generarSalt();
    const passwordHash = await hashConSalt(nuevaContrasena, saltPassword);
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, passwordHash, saltPassword } : u)));
    return { ok: true };
  };

  const darDeBajaUsuario = (id) => {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, activo: false } : u)));
  };
  const reactivarUsuario = (id) => {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, activo: true } : u)));
  };

  // Inicio de sesión (RF-49): compara el hash, nunca la contraseña en texto plano.
  const verificarCredenciales = async (nombreUsuario, password) => {
    const usuario = usuarios.find(
      (u) => u.nombreUsuario.toLowerCase() === nombreUsuario.trim().toLowerCase() && u.activo !== false
    );
    if (!usuario) return { ok: false, error: "Usuario o contraseña incorrectos." };
    const valido = await verificarConSalt(password, usuario.saltPassword, usuario.passwordHash);
    if (!valido) return { ok: false, error: "Usuario o contraseña incorrectos." };
    return { ok: true, usuario };
  };

  // Recuperación de contraseña (RF-50): mediante pregunta de seguridad,
  // ya que no existe backend/correo todavía para enviar un enlace real.
  const obtenerPreguntaSeguridad = (nombreUsuario) => {
    const usuario = usuarios.find((u) => u.nombreUsuario.toLowerCase() === nombreUsuario.trim().toLowerCase());
    return usuario?.preguntaSeguridad || null;
  };

  const recuperarContrasena = async ({ nombreUsuario, respuestaSeguridad, nuevaContrasena }) => {
    const usuario = usuarios.find((u) => u.nombreUsuario.toLowerCase() === nombreUsuario.trim().toLowerCase());
    if (!usuario) return { ok: false, error: "No existe ese usuario." };
    const valido = await verificarConSalt(
      (respuestaSeguridad || "").toLowerCase().trim(),
      usuario.saltRespuesta,
      usuario.respuestaHash
    );
    if (!valido) return { ok: false, error: "La respuesta de seguridad no es correcta." };
    await cambiarPasswordUsuario(usuario.id, nuevaContrasena);
    return { ok: true };
  };

  // Sesión activa (RNF-15 cierre de sesión seguro)
  const usuarioActual = usuarios.find((u) => u.id === usuarioActualId) || null;
  const iniciarSesion = (usuario) => setUsuarioActualId(usuario.id);
  const cerrarSesion = () => setUsuarioActualId(null);

  const value = {
    productos,
    proveedores,
    movimientos,

    stockDeProducto,
    estaBajoStock,
    estaAgotado,
    costoTotalDeProducto,
    margenDeProducto,
    categoriasExistentes,

    crearProducto,
    editarProducto,
    darDeBajaProducto,
    reactivarProducto,
    buscarProductos,

    crearProveedor,
    editarProveedor,
    eliminarProveedor,

    registrarMovimiento,

    productosBajoStock,
    productosAgotados,

    pendientesCompra,
    crearPendienteCompra,
    marcarPendienteAtendido,
    eliminarPendiente,

    compras,
    crearCompra,
    recibirCompra,

    numerosSerie,
    buscarPorLote,
    buscarPorNumeroSerie,

    ventas,
    registrarVenta,
    numerosSerieDisponibles,

    garantias,
    registrarGarantia,

    devoluciones,
    registrarDevolucion,

    usuarios,
    ROLES_DISPONIBLES,
    crearUsuario,
    editarUsuario,
    cambiarPasswordUsuario,
    darDeBajaUsuario,
    reactivarUsuario,
    verificarCredenciales,
    obtenerPreguntaSeguridad,
    recuperarContrasena,

    usuarioActual,
    iniciarSesion,
    cerrarSesion,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de <DataProvider>");
  return ctx;
}
