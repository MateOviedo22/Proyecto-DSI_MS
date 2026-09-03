// src/pages/Ventas.jsx
// Cubre: RF-30 (registrar venta + actualizar existencias), RF-31 (precio
// automático), RF-32/33/35 (canal de venta piso/línea), RF-34 (factura),
// RF-54/55 (devoluciones, desde el historial).
import { useState, Fragment } from 'react';
import { useData } from '../context/DataContext';

export default function Ventas() {
  const [tab, setTab] = useState('nueva');

  return (
    <div className="container-fluid p-4">
      <h2 className="mb-3">Ventas y Facturación</h2>
      <ul className="nav nav-tabs mb-3">
        {[
          ['nueva', 'Nueva venta'],
          ['historial', 'Historial y facturas'],
        ].map(([valor, label]) => (
          <li className="nav-item" key={valor}>
            <button className={`nav-link ${tab === valor ? 'active' : ''}`} onClick={() => setTab(valor)}>
              {label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'nueva' ? <NuevaVentaTab onVentaConfirmada={() => setTab('historial')} /> : <HistorialTab />}
    </div>
  );
}

// =====================================================================
// Nueva venta: buscar producto (RF-3/4 reutilizado) → preventa → confirmar
// =====================================================================
function NuevaVentaTab({ onVentaConfirmada }) {
  const ctx = useData();
  const { buscarProductos, registrarVenta, numerosSerieDisponibles } = ctx;

  const [texto, setTexto] = useState('');
  const [carrito, setCarrito] = useState([]); // {productoId, varianteId, nombre, cantidad, precioUnitario, stockDisponible, numeroSerieId}
  const [canal, setCanal] = useState('piso');
  const [cliente, setCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [error, setError] = useState('');
  const [factura, setFactura] = useState(null);

  const resultados = texto.trim() ? buscarProductos(texto).filter((p) => p.activo !== false) : [];

  const agregarAlCarrito = (producto, varianteId) => {
    const variante = varianteId ? producto.variantes.find((v) => v.id === varianteId) : null;
    const stockDisponible = variante ? Number(variante.stockActual) : ctx.stockDeProducto(producto);
    if (stockDisponible <= 0) {
      setError(`"${producto.nombre}" no tiene existencias disponibles.`);
      return;
    }
    setCarrito((prev) => [
      ...prev,
      {
        productoId: producto.id,
        varianteId: varianteId || null,
        nombre: producto.nombre + (variante ? ` — ${variante.tipo}: ${variante.valor}` : ''),
        cantidad: 1,
        precioUnitario: Number(producto.precio), // RF-31: precio vigente automático
        stockDisponible,
        esElectronico: producto.esElectronico,
        numeroSerieId: '',
      },
    ]);
    setTexto('');
    setError('');
  };

  const cambiarCantidad = (i, cantidad) => {
    setCarrito((prev) => prev.map((l, idx) => (idx === i ? { ...l, cantidad } : l)));
  };
  const cambiarSerie = (i, numeroSerieId) => {
    setCarrito((prev) => prev.map((l, idx) => (idx === i ? { ...l, numeroSerieId } : l)));
  };
  const quitarLinea = (i) => setCarrito((prev) => prev.filter((_, idx) => idx !== i));

  const total = carrito.reduce((sum, l) => sum + Number(l.cantidad || 0) * l.precioUnitario, 0);

  const confirmarVenta = () => {
    if (carrito.length === 0) { setError('Agrega al menos un producto a la venta.'); return; }
    for (const l of carrito) {
      if (!l.cantidad || l.cantidad <= 0) { setError('Revisa las cantidades del carrito.'); return; }
      if (l.cantidad > l.stockDisponible) { setError(`No hay suficiente stock de "${l.nombre}".`); return; }
    }
    const res = registrarVenta({
      canal, cliente, metodoPago,
      items: carrito.map((l) => ({
        productoId: l.productoId,
        varianteId: l.varianteId,
        cantidad: Number(l.cantidad),
        precioUnitario: l.precioUnitario,
        numeroSerieId: l.numeroSerieId || null,
        nombre: l.nombre,
      })),
    });
    if (!res.ok) { setError(res.error); return; }
    setFactura(res.venta);
    setCarrito([]); setCliente(''); setMetodoPago('Efectivo'); setCanal('piso'); setError('');
  };

  if (factura) {
    return <FacturaGenerada venta={factura} onNuevaVenta={() => { setFactura(null); onVentaConfirmada(); }} />;
  }

  return (
    <div className="row g-4">
      <div className="col-md-7">
        <label className="form-label">Buscar producto</label>
        <input className="form-control mb-2" placeholder="Nombre del producto..." value={texto} onChange={(e) => setTexto(e.target.value)} />
        {resultados.length > 0 && (
          <div className="list-group mb-3">
            {resultados.map((p) => (
              <div className="list-group-item" key={p.id}>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <div className="fw-semibold">{p.nombre}</div>
                    <div className="text-muted small">
                      C$ {Number(p.precio).toFixed(2)} · stock: {ctx.stockDeProducto(p)}
                    </div>
                  </div>
                  {p.variantes?.length > 0 ? (
                    <div className="d-flex gap-1 flex-wrap">
                      {p.variantes.map((v) => (
                        <button key={v.id} className="btn btn-sm btn-outline-primary" disabled={v.stockActual <= 0}
                          onClick={() => agregarAlCarrito(p, v.id)}>
                          {v.valor} ({v.stockActual})
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button className="btn btn-sm btn-primary" disabled={ctx.stockDeProducto(p) <= 0} onClick={() => agregarAlCarrito(p, null)}>
                      Agregar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <h5>Preventa</h5>
        <div className="table-responsive bg-white rounded shadow-sm mb-3">
          <table className="table table-sm align-middle mb-0">
            <thead className="table-light"><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>
              {carrito.map((l, i) => (
                <Fragment key={i}>
                  <tr>
                    <td>{l.nombre}</td>
                    <td style={{ width: 90 }}>
                      <input type="number" min="1" max={l.stockDisponible} className="form-control form-control-sm"
                        value={l.cantidad} onChange={(e) => cambiarCantidad(i, e.target.value)} />
                    </td>
                    <td>C$ {l.precioUnitario.toFixed(2)}</td>
                    <td>C$ {(l.precioUnitario * (l.cantidad || 0)).toFixed(2)}</td>
                    <td><button className="btn btn-sm btn-outline-danger" onClick={() => quitarLinea(i)}><i className="bi bi-trash"></i></button></td>
                  </tr>
                  {l.esElectronico && numerosSerieDisponibles(l.productoId, l.varianteId).length > 0 && (
                    <tr>
                      <td colSpan={5} className="pt-0">
                        <label className="form-label mb-0 small">Número de serie a vender (opcional, para garantía)</label>
                        <select className="form-select form-select-sm" value={l.numeroSerieId} onChange={(e) => cambiarSerie(i, e.target.value)}>
                          <option value="">-- Sin especificar --</option>
                          {numerosSerieDisponibles(l.productoId, l.varianteId).map((s) => (
                            <option key={s.id} value={s.id}>{s.numero}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {carrito.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">Busca un producto y agrégalo a la preventa.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="col-md-5">
        <div className="bg-light p-3 rounded shadow-sm">
          <h5>Confirmar venta</h5>
          <div className="mb-2">
            <label className="form-label mb-0">Canal de venta</label>
            <div className="btn-group d-flex">
              <button type="button" className={`btn ${canal === 'piso' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCanal('piso')}>Venta en piso</button>
              <button type="button" className={`btn ${canal === 'linea' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setCanal('linea')}>Venta en línea</button>
            </div>
          </div>
          <div className="mb-2">
            <label className="form-label mb-0">Cliente (opcional)</label>
            <input className="form-control" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </div>
          <div className="mb-2">
            <label className="form-label mb-0">Método de pago</label>
            <select className="form-select" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <option>Efectivo</option>
              <option>Tarjeta</option>
              <option>Transferencia</option>
            </select>
          </div>
          <hr />
          <div className="d-flex justify-content-between fs-5 fw-bold mb-3">
            <span>Total</span><span>C$ {total.toFixed(2)}</span>
          </div>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button className="btn btn-success w-100" onClick={confirmarVenta}>Confirmar venta y generar factura</button>
        </div>
      </div>
    </div>
  );
}

function FacturaGenerada({ venta, onNuevaVenta }) {
  return (
    <div className="bg-white p-4 rounded shadow-sm" style={{ maxWidth: 600 }}>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h4 className="mb-0">MotoMan</h4>
          <div className="text-muted small">Comprobante de venta</div>
        </div>
        <div className="text-end">
          <div className="fw-bold">{venta.numeroFactura}</div>
          <div className="text-muted small">{new Date(venta.fecha).toLocaleString('es-NI')}</div>
        </div>
      </div>
      <div className="mb-2 small">
        <strong>Cliente:</strong> {venta.cliente} &nbsp;|&nbsp; <strong>Canal:</strong> {venta.canal === 'piso' ? 'Venta en piso' : 'Venta en línea'} &nbsp;|&nbsp; <strong>Pago:</strong> {venta.metodoPago}
      </div>
      <table className="table table-sm">
        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>
          {venta.items.map((it, i) => (
            <tr key={i}><td>{it.nombre}</td><td>{it.cantidad}</td><td>C$ {it.precioUnitario.toFixed(2)}</td><td>C$ {(it.precioUnitario * it.cantidad).toFixed(2)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={3} className="text-end">Total</th><th>C$ {venta.total.toFixed(2)}</th></tr></tfoot>
      </table>
      <div className="text-end">
        <button className="btn btn-outline-secondary me-2" onClick={() => window.print()}>Imprimir</button>
        <button className="btn btn-primary" onClick={onNuevaVenta}>Nueva venta</button>
      </div>
    </div>
  );
}

// =====================================================================
// Historial de ventas + devoluciones (RF-54, RF-55)
// =====================================================================
function HistorialTab() {
  const { ventas, registrarDevolucion } = useData();
  const [expandida, setExpandida] = useState(null);
  const [devolviendo, setDevolviendo] = useState(null); // {ventaId, itemIndex}
  const [cantidadDevolver, setCantidadDevolver] = useState('');
  const [motivoDevolver, setMotivoDevolver] = useState('');
  const [mensaje, setMensaje] = useState('');

  const confirmarDevolucion = (venta, item) => {
    const res = registrarDevolucion({
      ventaId: venta.id,
      productoId: item.productoId,
      varianteId: item.varianteId,
      cantidad: cantidadDevolver,
      motivo: motivoDevolver,
    });
    if (!res.ok) { setMensaje(res.error); return; }
    setMensaje('Devolución registrada y stock actualizado.');
    setDevolviendo(null); setCantidadDevolver(''); setMotivoDevolver('');
  };

  return (
    <div>
      {mensaje && <div className="alert alert-info">{mensaje}</div>}
      <div className="table-responsive bg-white rounded shadow-sm">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light"><tr><th></th><th>Factura</th><th>Fecha</th><th>Canal</th><th>Cliente</th><th>Total</th></tr></thead>
          <tbody>
            {ventas.map((v) => (
              <Fragment key={v.id}>
                <tr>
                  <td>
                    <button className="btn btn-sm btn-link p-0" onClick={() => setExpandida(expandida === v.id ? null : v.id)}>
                      <i className={`bi ${expandida === v.id ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                    </button>
                  </td>
                  <td>{v.numeroFactura}</td>
                  <td>{new Date(v.fecha).toLocaleString('es-NI')}</td>
                  <td><span className={`badge ${v.canal === 'piso' ? 'bg-primary' : 'bg-info text-dark'}`}>{v.canal === 'piso' ? 'Piso' : 'Línea'}</span></td>
                  <td>{v.cliente}</td>
                  <td>C$ {v.total.toFixed(2)}</td>
                </tr>
                {expandida === v.id && (
                  <tr>
                    <td></td>
                    <td colSpan={5}>
                      <table className="table table-sm mb-0 bg-light">
                        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th></th></tr></thead>
                        <tbody>
                          {v.items.map((it, i) => (
                            <tr key={i}>
                              <td>{it.nombre}</td>
                              <td>{it.cantidad}</td>
                              <td>C$ {it.precioUnitario.toFixed(2)}</td>
                              <td>
                                <button className="btn btn-sm btn-outline-warning" onClick={() => { setDevolviendo({ ventaId: v.id, itemIndex: i }); setCantidadDevolver(it.cantidad); }}>
                                  Devolver
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {devolviendo?.ventaId === v.id && (
                        <div className="bg-white border rounded p-2 mt-2">
                          <div className="row g-2 align-items-end">
                            <div className="col-md-3">
                              <label className="form-label mb-0 small">Cantidad a devolver</label>
                              <input type="number" className="form-control form-control-sm" value={cantidadDevolver} onChange={(e) => setCantidadDevolver(e.target.value)} />
                            </div>
                            <div className="col-md-5">
                              <label className="form-label mb-0 small">Motivo</label>
                              <input className="form-control form-control-sm" value={motivoDevolver} onChange={(e) => setMotivoDevolver(e.target.value)} placeholder="Ej. producto defectuoso" />
                            </div>
                            <div className="col-md-4">
                              <button className="btn btn-sm btn-success me-1" onClick={() => confirmarDevolucion(v, v.items[devolviendo.itemIndex])}>Confirmar</button>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => setDevolviendo(null)}>Cancelar</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {ventas.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Aún no hay ventas registradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
