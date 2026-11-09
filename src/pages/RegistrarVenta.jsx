// src/pages/RegistrarVenta.jsx
// Cubre: RF-30 (registro de ventas con descuento automático de existencias), RF-31 (precio vigente automático),
// RF-32/RF-33/RF-35 (canal piso / en línea), RF-34 (factura), RF-28/RF-29 (número de serie asociado a la venta).
import { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import FacturaModal from '../components/FacturaModal';
import { moneda, fechaHora } from '../utils/formato';

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia', 'Otro'];

export default function RegistrarVenta() {
  const { productos, registrarVenta, stockDeProducto, numerosSerieDisponibles, numerosSerie, ventas } = useData();
  const { notificar } = useUi();

  const [tab, setTab] = useState('nueva');
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]); // { key, productoId, varianteId, cantidad, numeroSerieId }
  const [canal, setCanal] = useState('piso');
  const [cliente, setCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [elegirVariante, setElegirVariante] = useState(null);
  const [facturaAbierta, setFacturaAbierta] = useState(null);

  const activos = productos.filter((p) => p.activo !== false);
  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return activos.filter((p) => !t || p.nombre.toLowerCase().includes(t) || (p.categoria || '').toLowerCase().includes(t));
  }, [activos, busqueda]);

  const producto = (id) => productos.find((p) => p.id === id);
  const stockDe = (p, varianteId) => (varianteId ? Number(p.variantes.find((v) => v.id === varianteId)?.stockActual || 0) : stockDeProducto(p));
  const enCarrito = (productoId, varianteId) =>
    carrito.filter((l) => l.productoId === productoId && (l.varianteId || null) === (varianteId || null)).reduce((s, l) => s + l.cantidad, 0);
  const seriesUsadas = new Set(carrito.map((l) => l.numeroSerieId).filter(Boolean));

  const agregar = (p, varianteId = null) => {
    setError('');
    if (p.variantes?.length > 0 && !varianteId) return setElegirVariante(p);
    if (enCarrito(p.id, varianteId) + 1 > stockDe(p, varianteId)) return notificar(`No hay más existencias de "${p.nombre}".`, 'aviso');

    const libres = numerosSerieDisponibles(p.id, varianteId).filter((s) => !seriesUsadas.has(s.id));
    if (p.esElectronico && libres.length > 0) {
      return setCarrito((prev) => [...prev, { key: `${Date.now()}_${Math.random()}`, productoId: p.id, varianteId, cantidad: 1, numeroSerieId: libres[0].id }]);
    }
    setCarrito((prev) => {
      const existente = prev.find((l) => l.productoId === p.id && (l.varianteId || null) === varianteId && !l.numeroSerieId);
      if (existente) return prev.map((l) => (l === existente ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...prev, { key: `${Date.now()}_${Math.random()}`, productoId: p.id, varianteId, cantidad: 1, numeroSerieId: null }];
    });
  };

  const cambiarCantidad = (key, delta) => {
    setCarrito((prev) =>
      prev.flatMap((l) => {
        if (l.key !== key) return [l];
        const nueva = l.cantidad + delta;
        if (nueva <= 0) return [];
        const p = producto(l.productoId);
        if (delta > 0 && enCarrito(l.productoId, l.varianteId) + 1 > stockDe(p, l.varianteId)) {
          notificar('No hay más existencias disponibles.', 'aviso');
          return [l];
        }
        return [{ ...l, cantidad: nueva }];
      })
    );
  };
  const quitar = (key) => setCarrito((prev) => prev.filter((l) => l.key !== key));
  const cambiarSerie = (key, id) => setCarrito((prev) => prev.map((l) => (l.key === key ? { ...l, numeroSerieId: id } : l)));

  const total = carrito.reduce((s, l) => s + l.cantidad * Number(producto(l.productoId)?.precio || 0), 0);
  const unidades = carrito.reduce((s, l) => s + l.cantidad, 0);

  // Si el servidor reporta (409) que una serie dejó de estar disponible, la línea pasa a asignación automática.
  useEffect(() => {
    setCarrito((prev) =>
      prev.map((l) => (l.numeroSerieId && !numerosSerie.some((s) => s.id === l.numeroSerieId && !s.ventaId) ? { ...l, numeroSerieId: null } : l))
    );
  }, [numerosSerie]);

  // Registro atómico en el servidor. Respuestas:
  //   201 -> venta registrada y facturada  ·  400 -> datos inválidos  ·  403 -> sin permiso (aviso global)
  //   404 -> producto inexistente          ·  409 -> existencias insuficientes (el mensaje nombra el producto)
  const cobrar = async () => {
    setEnviando(true);
    setError('');
    const res = await registrarVenta({ canal, cliente, metodoPago, items: carrito });
    setEnviando(false);

    if (!res.ok) {
      if (res.estado === 409) notificar(res.error, 'aviso'); // las existencias ya se refrescaron en segundo plano
      return setError(res.estado === 403 ? 'Tu rol no puede registrar ventas.' : res.error);
    }

    setCarrito([]); setCliente(''); setMetodoPago('Efectivo');
    notificar(`Venta ${res.venta.numeroFactura} registrada.`);
    res.venta.alertas.forEach((a) => notificar(`${a.nombre}: ${a.alerta === 'AGOTADO' ? 'agotado' : `stock bajo (${a.cantidad_actual})`}.`, 'aviso'));
    setFacturaAbierta(res.venta);
  };

  return (
    <div className="container-fluid">
      <PageHeader titulo="Ventas y facturación" descripcion="Registra ventas en piso o en línea. El precio vigente y el descuento de existencias son automáticos.">
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'nueva'} className={tab === 'nueva' ? 'activo' : ''} onClick={() => setTab('nueva')}>Nueva venta</button>
          <button type="button" role="tab" aria-selected={tab === 'historial'} className={tab === 'historial' ? 'activo' : ''} onClick={() => setTab('historial')}>Historial ({ventas.length})</button>
        </div>
      </PageHeader>

      {tab === 'nueva' ? (
        <div className="venta-layout">
          <section>
            <div className="campo-icono">
              <i className="bi bi-search"></i>
              <input className="form-control" placeholder="Buscar producto por nombre o categoría…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar producto" autoFocus />
            </div>
            {lista.length === 0 ? (
              <EmptyState icono="bi-search" titulo="No hay productos con esa búsqueda" />
            ) : (
              <div className="producto-lista">
                {lista.map((p) => {
                  const stock = stockDeProducto(p);
                  return (
                    <button key={p.id} type="button" className="producto-tile" disabled={stock === 0} onClick={() => agregar(p)}>
                      <span className="nombre">{p.nombre}</span>
                      <span className="texto-suave">{p.categoria || 'Sin categoría'}{p.variantes?.length ? ` · ${p.variantes.length} variantes` : ''}</span>
                      <span className="d-flex justify-content-between align-items-center mt-1">
                        <span className="precio">{moneda(p.precio)}</span>
                        {stock === 0 ? <span className="badge bg-danger">Agotado</span> : <span className="badge bg-secondary">{stock} disp.</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="panel carrito" aria-label="Venta actual">
            <h2 className="panel-titulo">Venta actual</h2>
            <div className="seg seg-completo my-3" role="group" aria-label="Canal de venta">
              <button type="button" className={canal === 'piso' ? 'activo' : ''} onClick={() => setCanal('piso')}><i className="bi bi-shop me-2"></i>En piso</button>
              <button type="button" className={canal === 'linea' ? 'activo' : ''} onClick={() => setCanal('linea')}><i className="bi bi-globe2 me-2"></i>En línea</button>
            </div>

            {carrito.length === 0 ? (
              <EmptyState icono="bi-cart" titulo="Aún no hay productos">Toca un producto de la lista para agregarlo a la venta.</EmptyState>
            ) : (
              <div>
                {carrito.map((l) => {
                  const p = producto(l.productoId);
                  const variante = p.variantes?.find((v) => v.id === l.varianteId);
                  const opciones = numerosSerie.filter((s) => s.productoId === l.productoId && (l.varianteId ? s.varianteId === l.varianteId : !s.varianteId) && !s.ventaId && (s.id === l.numeroSerieId || !seriesUsadas.has(s.id)));
                  return (
                    <div className="carrito-linea" key={l.key}>
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-semibold">{p.nombre}</div>
                        {variante && <div className="texto-suave">{variante.tipo}: {variante.valor}</div>}
                        {l.numeroSerieId && (
                          <select className="form-select form-select-sm mt-1" value={l.numeroSerieId} onChange={(e) => cambiarSerie(l.key, e.target.value)} aria-label="Número de serie">
                            {opciones.map((s) => <option key={s.id} value={s.id}>N.º de serie {s.numero}</option>)}
                          </select>
                        )}
                      </div>
                      <div className="text-end fw-semibold">{moneda(l.cantidad * p.precio)}</div>
                      <div className="d-flex align-items-center gap-2">
                        {l.numeroSerieId ? <span className="texto-suave">1 × {moneda(p.precio)}</span> : (
                          <div className="stepper">
                            <button type="button" onClick={() => cambiarCantidad(l.key, -1)} aria-label="Quitar una unidad">−</button>
                            <span>{l.cantidad}</span>
                            <button type="button" onClick={() => cambiarCantidad(l.key, 1)} aria-label="Agregar una unidad">+</button>
                          </div>
                        )}
                        {!l.numeroSerieId && <span className="texto-suave">× {moneda(p.precio)}</span>}
                      </div>
                      <div className="text-end"><button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => quitar(l.key)}>Quitar</button></div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="row g-2 mt-2">
              <div className="col-12">
                <label htmlFor="cliente">Cliente (opcional)</label>
                <input id="cliente" className="form-control" placeholder="Consumidor final" value={cliente} onChange={(e) => setCliente(e.target.value)} />
              </div>
              <div className="col-12">
                <label htmlFor="pago">Método de pago</label>
                <select id="pago" className="form-select" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                  {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="total-venta">
              <span className="texto-suave">{unidades} unidad(es)</span>
              <strong>{moneda(total)}</strong>
            </div>
            {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
            <button type="button" className="btn btn-primary btn-lg w-100 mt-3" disabled={carrito.length === 0 || enviando} onClick={cobrar}>
              <i className="bi bi-receipt me-2"></i>{enviando ? 'Registrando…' : 'Cobrar y emitir factura'}
            </button>
          </aside>
        </div>
      ) : (
        <HistorialVentas onVerFactura={setFacturaAbierta} />
      )}

      <Modal abierto={Boolean(elegirVariante)} onCerrar={() => setElegirVariante(null)} titulo={`Elige la variante de ${elegirVariante?.nombre || ''}`} tamano="sm">
        <div className="d-grid gap-2">
          {elegirVariante?.variantes.map((v) => (
            <button key={v.id} type="button" className="producto-tile" disabled={Number(v.stockActual) === 0} onClick={() => { agregar(elegirVariante, v.id); setElegirVariante(null); }}>
              <span className="nombre">{v.tipo}: {v.valor}</span>
              <span className="texto-suave">{Number(v.stockActual) === 0 ? 'Agotado' : `${v.stockActual} disponibles`}</span>
            </button>
          ))}
        </div>
      </Modal>

      <FacturaModal venta={facturaAbierta} onCerrar={() => setFacturaAbierta(null)} />
    </div>
  );
}

function HistorialVentas({ onVerFactura }) {
  const { ventas } = useData();
  const [texto, setTexto] = useState('');
  const [canal, setCanal] = useState('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const filtradas = ventas.filter((v) => {
    const t = texto.trim().toLowerCase();
    const f = new Date(v.fecha);
    return (
      (!t || v.numeroFactura.toLowerCase().includes(t) || v.cliente.toLowerCase().includes(t)) &&
      (canal === 'todos' || v.canal === canal) &&
      (!desde || f >= new Date(`${desde}T00:00:00`)) &&
      (!hasta || f <= new Date(`${hasta}T23:59:59`))
    );
  });
  const suma = filtradas.reduce((s, v) => s + v.total, 0);

  return (
    <>
      <div className="toolbar">
        <div className="campo-icono grow">
          <i className="bi bi-search"></i>
          <input className="form-control" placeholder="Buscar por factura o cliente…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar ventas" />
        </div>
        <select className="form-select" style={{ maxWidth: 170 }} value={canal} onChange={(e) => setCanal(e.target.value)} aria-label="Canal">
          <option value="todos">Todos los canales</option>
          <option value="piso">En piso</option>
          <option value="linea">En línea</option>
        </select>
        <input type="date" className="form-control" style={{ maxWidth: 160 }} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <input type="date" className="form-control" style={{ maxWidth: 160 }} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
      </div>
      <div className="table-responsive bg-white">
        <table className="table table-hover align-middle">
          <thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Pago</th><th className="text-end">Total</th><th></th></tr></thead>
          <tbody>
            {filtradas.map((v) => (
              <tr key={v.id}>
                <td className="fw-semibold">{v.numeroFactura}</td>
                <td>{fechaHora(v.fecha)}</td>
                <td>{v.cliente}</td>
                <td><span className={`badge ${v.canal === 'piso' ? 'bg-primary' : 'bg-info'}`}>{v.canal === 'piso' ? 'En piso' : 'En línea'}</span></td>
                <td>{v.metodoPago}</td>
                <td className="text-end fw-semibold">{moneda(v.total)}</td>
                <td className="text-end"><button className="btn btn-sm btn-outline-secondary" onClick={() => onVerFactura(v)}><i className="bi bi-printer me-1"></i>Factura</button></td>
              </tr>
            ))}
            {filtradas.length === 0 && <tr><td colSpan={7}><EmptyState icono="bi-receipt" titulo="No hay ventas con esos filtros" /></td></tr>}
          </tbody>
          {filtradas.length > 0 && (
            <tfoot><tr><td colSpan={5} className="text-end texto-suave">{filtradas.length} venta(s)</td><td className="text-end fw-bold">{moneda(suma)}</td><td></td></tr></tfoot>
          )}
        </table>
      </div>
    </>
  );
}
