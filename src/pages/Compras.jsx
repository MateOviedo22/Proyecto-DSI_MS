// src/pages/Compras.jsx
// Cubre: RF-12 (registro de compras), RF-13 (pendientes de compra),
// RF-14 (historial), RF-15 (comparar comprado vs recibido), RF-16 (faltantes),
// RF-17 (estado de recepción), RF-18 (pendientes de recepción), RF-19 (incidencias),
// RF-25/26 (lotes), RF-27/29 (números de serie y trazabilidad).
import { useState, Fragment } from 'react';
import { useData } from '../context/DataContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { moneda, fecha, fechaHora } from '../utils/formato';

const PRIORIDADES = ['alta', 'media', 'baja'];

function EstadoBadge({ estado }) {
  const map = {
    pendiente: ['bg-warning text-dark', 'Pendiente de recepción'],
    recibida: ['bg-success', 'Recibida completa'],
    recibida_con_incidencias: ['bg-danger', 'Recibida con incidencias'],
  };
  const [clase, texto] = map[estado] || ['bg-secondary', estado];
  return <span className={`badge ${clase}`}>{texto}</span>;
}

export default function Compras() {
  const {
    productos, proveedores,
    pendientesCompra, crearPendienteCompra, marcarPendienteAtendido, eliminarPendiente,
    compras, crearCompra, recibirCompra,
    buscarPorLote, buscarPorNumeroSerie,
  } = useData();

  const [tab, setTab] = useState('pendientes');

  const productoNombre = (id) => productos.find((p) => p.id === id)?.nombre || '(producto eliminado)';
  const proveedorNombre = (id) => proveedores.find((p) => p.id === id)?.nombre || '—';
  const varianteInfo = (productoId, varianteId) => {
    if (!varianteId) return '';
    const prod = productos.find((p) => p.id === productoId);
    const v = prod?.variantes?.find((v) => v.id === varianteId);
    return v ? ` — ${v.tipo}: ${v.valor}` : '';
  };

  return (
    <div className="container-fluid">
      <PageHeader titulo="Compras y recepción" descripcion="Planifica reabastecimientos, registra órdenes de compra y compara lo comprado contra lo recibido." />

      <ul className="nav nav-tabs mb-4">
        {[
          ['pendientes', 'Pendientes de compra'],
          ['ordenes', 'Órdenes de compra'],
          ['consulta', 'Consultar lote / número de serie'],
        ].map(([valor, label]) => (
          <li className="nav-item" key={valor}>
            <button className={`nav-link ${tab === valor ? 'active' : ''}`} onClick={() => setTab(valor)}>
              {label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'pendientes' && (
        <PendientesCompraTab
          productos={productos}
          pendientesCompra={pendientesCompra}
          crearPendienteCompra={crearPendienteCompra}
          marcarPendienteAtendido={marcarPendienteAtendido}
          eliminarPendiente={eliminarPendiente}
          productoNombre={productoNombre}
        />
      )}

      {tab === 'ordenes' && (
        <OrdenesCompraTab
          productos={productos}
          proveedores={proveedores}
          compras={compras}
          crearCompra={crearCompra}
          recibirCompra={recibirCompra}
          productoNombre={productoNombre}
          proveedorNombre={proveedorNombre}
          varianteInfo={varianteInfo}
        />
      )}

      {tab === 'consulta' && (
        <ConsultaTab
          buscarPorLote={buscarPorLote}
          buscarPorNumeroSerie={buscarPorNumeroSerie}
          productoNombre={productoNombre}
        />
      )}
    </div>
  );
}

// =====================================================================
// Pendientes de compra (RF-13)
// =====================================================================
function PendientesCompraTab({ productos, pendientesCompra, crearPendienteCompra, marcarPendienteAtendido, eliminarPendiente, productoNombre }) {
  const [productoId, setProductoId] = useState('');
  const [cantidadRequerida, setCantidadRequerida] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [error, setError] = useState('');
  const [verAtendidos, setVerAtendidos] = useState(false);

  const agregar = (e) => {
    e.preventDefault();
    if (!productoId || !cantidadRequerida) {
      setError('Selecciona un producto y una cantidad.');
      return;
    }
    crearPendienteCompra({ productoId, cantidadRequerida: Number(cantidadRequerida), prioridad });
    setProductoId('');
    setCantidadRequerida('');
    setPrioridad('media');
    setError('');
  };

  const lista = pendientesCompra.filter((p) => (verAtendidos ? true : !p.atendido));

  return (
    <div>
      <form onSubmit={agregar} className="row g-2 align-items-end panel mb-3 mx-0">
        <div className="col-md-4">
          <label className="form-label mb-0">Producto</label>
          <select className="form-select" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            <option value="">-- Seleccionar --</option>
            {productos.filter((p) => p.activo !== false).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label mb-0">Cantidad requerida</label>
          <input type="number" className="form-control" value={cantidadRequerida} onChange={(e) => setCantidadRequerida(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label className="form-label mb-0">Prioridad</label>
          <select className="form-select" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <button className="btn btn-primary w-100">Agregar</button>
        </div>
        {error && <div className="col-12"><div className="alert alert-danger mb-0 py-1">{error}</div></div>}
      </form>

      <div className="form-check mb-2">
        <input type="checkbox" className="form-check-input" id="verAtendidos" checked={verAtendidos} onChange={(e) => setVerAtendidos(e.target.checked)} />
        <label className="form-check-label" htmlFor="verAtendidos">Mostrar atendidos</label>
      </div>

      <div className="table-responsive bg-white rounded shadow-sm">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr><th>Producto</th><th>Cantidad requerida</th><th>Prioridad</th><th>Registrado</th><th>Estado</th><th className="text-end">Acciones</th></tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className={p.atendido ? 'text-muted' : ''}>
                <td>{productoNombre(p.productoId)}</td>
                <td>{p.cantidadRequerida}</td>
                <td className="text-capitalize">
                  <span className={`badge ${p.prioridad === 'alta' ? 'bg-danger' : p.prioridad === 'media' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                    {p.prioridad}
                  </span>
                </td>
                <td>{fecha(p.fechaRegistro)}</td>
                <td>{p.atendido ? 'Atendido' : 'Pendiente'}</td>
                <td className="text-end">
                  {!p.atendido && (
                    <button className="btn btn-sm btn-outline-success me-1" onClick={() => marcarPendienteAtendido(p.id)}>
                      Marcar atendido
                    </button>
                  )}
                  <button className="btn btn-sm btn-outline-danger" onClick={() => eliminarPendiente(p.id)}>
                    <i className="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={6}><EmptyState icono="bi-cart-check" titulo="No hay productos pendientes de compra" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================================
// Órdenes de compra + recepción (RF-12, RF-14, RF-15 a RF-19, RF-25, RF-27)
// =====================================================================
function OrdenesCompraTab({ productos, proveedores, compras, crearCompra, recibirCompra, productoNombre, proveedorNombre, varianteInfo }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [proveedorId, setProveedorId] = useState('');
  const [costoEnvio, setCostoEnvio] = useState('');
  const [items, setItems] = useState([{ productoId: '', varianteId: '', cantidadComprada: '', costoUnitario: '' }]);
  const [error, setError] = useState('');
  const [expandida, setExpandida] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todas');

  const agregarItem = () => setItems((prev) => [...prev, { productoId: '', varianteId: '', cantidadComprada: '', costoUnitario: '' }]);
  const cambiarItem = (i, campo, valor) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  const quitarItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const guardarCompra = (e) => {
    e.preventDefault();
    if (!proveedorId) return setError('Selecciona un proveedor.');
    if (items.some((it) => !it.productoId || !it.cantidadComprada || !it.costoUnitario)) {
      return setError('Completa producto, cantidad y costo unitario en cada línea.');
    }
    crearCompra({ proveedorId, costoEnvio, items });
    setProveedorId(''); setCostoEnvio(''); setItems([{ productoId: '', varianteId: '', cantidadComprada: '', costoUnitario: '' }]);
    setError(''); setMostrarForm(false);
  };

  const lista = compras.filter((c) => filtroEstado === 'todas' ? true : c.estado === filtroEstado);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <select className="form-select" style={{ maxWidth: 260 }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="todas">Todas las órdenes</option>
          <option value="pendiente">Pendientes de recepción</option>
          <option value="recibida">Recibidas completas</option>
          <option value="recibida_con_incidencias">Recibidas con incidencias</option>
        </select>
        {!mostrarForm && (
          <button className="btn btn-primary" onClick={() => setMostrarForm(true)}>
            <i className="bi bi-plus-lg me-1"></i>Nueva orden de compra
          </button>
        )}
      </div>

      {mostrarForm && (
        <form onSubmit={guardarCompra} className="panel mb-3">
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label mb-0">Proveedor</label>
              <select className="form-select" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label mb-0">Costo de envío total</label>
              <input type="number" className="form-control" value={costoEnvio} onChange={(e) => setCostoEnvio(e.target.value)} />
            </div>
          </div>

          <h5 className="mt-3 mb-1">Productos a comprar</h5>
          {items.map((it, i) => {
            const prod = productos.find((p) => p.id === it.productoId);
            return (
              <div className="row g-2 align-items-center my-1" key={i}>
                <div className="col-md-4">
                  <select className="form-select form-select-sm" value={it.productoId} onChange={(e) => cambiarItem(i, 'productoId', e.target.value)}>
                    <option value="">-- Producto --</option>
                    {productos.filter((p) => p.activo !== false).map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                {prod?.variantes?.length > 0 && (
                  <div className="col-md-3">
                    <select className="form-select form-select-sm" value={it.varianteId} onChange={(e) => cambiarItem(i, 'varianteId', e.target.value)}>
                      <option value="">-- Variante --</option>
                      {prod.variantes.map((v) => <option key={v.id} value={v.id}>{v.tipo}: {v.valor}</option>)}
                    </select>
                  </div>
                )}
                <div className="col-md-2">
                  <input type="number" className="form-control form-control-sm" placeholder="Cantidad" value={it.cantidadComprada} onChange={(e) => cambiarItem(i, 'cantidadComprada', e.target.value)} />
                </div>
                <div className="col-md-2">
                  <input type="number" className="form-control form-control-sm" placeholder="Costo unitario" value={it.costoUnitario} onChange={(e) => cambiarItem(i, 'costoUnitario', e.target.value)} />
                </div>
                <div className="col-md-1 text-end">
                  {items.length > 1 && (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => quitarItem(i)}><i className="bi bi-trash"></i></button>
                  )}
                </div>
              </div>
            );
          })}
          <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={agregarItem}>
            <i className="bi bi-plus-lg me-1"></i>Agregar línea
          </button>

          {error && <div className="alert alert-danger mt-2 mb-0">{error}</div>}

          <div className="text-end mt-3">
            <button type="button" className="btn btn-outline-secondary me-2" onClick={() => setMostrarForm(false)}>Cancelar</button>
            <button className="btn btn-success">Registrar orden de compra</button>
          </div>
        </form>
      )}

      <div className="table-responsive bg-white rounded shadow-sm">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr><th></th><th>Proveedor</th><th>Fecha</th><th>Líneas</th><th className="text-end">Total</th><th>Estado</th><th className="text-end">Acciones</th></tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <Fragment key={c.id}>
                <tr>
                  <td>
                    <button className="btn btn-sm btn-link p-0" onClick={() => setExpandida(expandida === c.id ? null : c.id)}>
                      <i className={`bi ${expandida === c.id ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                    </button>
                  </td>
                  <td>{proveedorNombre(c.proveedorId)}</td>
                  <td>{fecha(c.fecha)}</td>
                  <td>{c.items.length}</td>
                  <td className="text-end">{moneda(c.items.reduce((t, i) => t + i.cantidadComprada * i.costoUnitario, 0) + Number(c.costoEnvio || 0))}</td>
                  <td><EstadoBadge estado={c.estado} /></td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setExpandida(expandida === c.id ? null : c.id)}>
                      {c.estado === 'pendiente' ? 'Recibir mercadería' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>
                {expandida === c.id && (
                  <tr>
                    <td></td>
                    <td colSpan={6}>
                      {c.estado === 'pendiente'
                        ? <FormularioRecepcion compra={c} productos={productos} productoNombre={productoNombre} varianteInfo={varianteInfo} recibirCompra={recibirCompra} onListo={() => setExpandida(null)} />
                        : <DetalleRecepcion compra={c} productoNombre={productoNombre} varianteInfo={varianteInfo} />}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={7}><EmptyState icono="bi-bag" titulo="No hay órdenes de compra registradas" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormularioRecepcion({ compra, productos, productoNombre, varianteInfo, recibirCompra, onListo }) {
  const [datos, setDatos] = useState(
    compra.items.map((item) => ({
      itemId: item.id,
      cantidadRecibida: item.cantidadComprada,
      lote: '',
      seriesTexto: '',
      incidencia: '',
    }))
  );

  const cambiar = (itemId, campo, valor) => {
    setDatos((prev) => prev.map((d) => (d.itemId === itemId ? { ...d, [campo]: valor } : d)));
  };

  const confirmar = () => {
    const itemsRecibidos = datos.map((d) => ({
      itemId: d.itemId,
      cantidadRecibida: d.cantidadRecibida,
      lote: d.lote,
      incidencia: d.incidencia,
      numerosSerie: d.seriesTexto.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
    }));
    recibirCompra(compra.id, itemsRecibidos);
    onListo();
  };

  return (
    <div className="bg-light p-3 rounded">
      <h5 className="mb-0">Comparar comprado vs. recibido</h5>
      {compra.items.map((item) => {
        const producto = productos.find((p) => p.id === item.productoId);
        const d = datos.find((x) => x.itemId === item.id);
        const faltantePreview = Math.max(0, Number(item.cantidadComprada) - Number(d.cantidadRecibida || 0));
        return (
          <div className="border p-3 mt-2 bg-white" key={item.id}>
            <div className="fw-semibold">
              {productoNombre(item.productoId)}{varianteInfo(item.productoId, item.varianteId)}
              <span className="text-muted"> — comprado: {item.cantidadComprada} × {moneda(item.costoUnitario)}</span>
            </div>
            <div className="row g-2 mt-1">
              <div className="col-md-2">
                <label className="form-label mb-0 small">Cantidad recibida</label>
                <input type="number" className="form-control form-control-sm" value={d.cantidadRecibida} onChange={(e) => cambiar(item.id, 'cantidadRecibida', e.target.value)} />
                {faltantePreview > 0 && <div className="text-danger small">Faltante: {faltantePreview}</div>}
              </div>
              <div className="col-md-2">
                <label className="form-label mb-0 small">Lote</label>
                <input className="form-control form-control-sm" value={d.lote} onChange={(e) => cambiar(item.id, 'lote', e.target.value)} />
              </div>
              {producto?.esElectronico && (
                <div className="col-md-4">
                  <label className="form-label mb-0 small">Números de serie (uno por línea o separados por coma)</label>
                  <textarea className="form-control form-control-sm" rows={2} value={d.seriesTexto} onChange={(e) => cambiar(item.id, 'seriesTexto', e.target.value)} />
                </div>
              )}
              <div className="col-md-4">
                <label className="form-label mb-0 small">Incidencia (opcional)</label>
                <input className="form-control form-control-sm" placeholder="Ej. caja golpeada, producto dañado..." value={d.incidencia} onChange={(e) => cambiar(item.id, 'incidencia', e.target.value)} />
              </div>
            </div>
          </div>
        );
      })}
      <div className="text-end mt-2">
        <button className="btn btn-success" onClick={confirmar}>Confirmar recepción</button>
      </div>
    </div>
  );
}

function DetalleRecepcion({ compra, productoNombre, varianteInfo }) {
  return (
    <div className="bg-light p-3 rounded">
      <div className="text-muted small mb-2">
        Recibida el {fechaHora(compra.fechaRecepcion)} · envío {moneda(compra.costoEnvio)}
      </div>
      <table className="table table-sm mb-0 bg-white">
        <thead><tr><th>Producto</th><th>Comprado</th><th>Recibido</th><th>Faltante</th><th>Costo unit.</th><th>Lote</th><th>Series</th><th>Incidencia</th></tr></thead>
        <tbody>
          {compra.items.map((item) => (
            <tr key={item.id}>
              <td>{productoNombre(item.productoId)}{varianteInfo(item.productoId, item.varianteId)}</td>
              <td>{item.cantidadComprada}</td>
              <td>{item.cantidadRecibida}</td>
              <td>{item.faltante > 0 ? <span className="text-danger fw-semibold">{item.faltante}</span> : 0}</td>
              <td>{moneda(item.costoUnitario)}</td>
              <td>{item.lote || '—'}</td>
              <td>{item.numerosSerie?.length ? item.numerosSerie.join(', ') : '—'}</td>
              <td>{item.incidencia || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =====================================================================
// Consulta por lote y por número de serie (RF-26, RF-29)
// =====================================================================
function ConsultaTab({ buscarPorLote, buscarPorNumeroSerie, productoNombre }) {
  const [lote, setLote] = useState('');
  const [resultadosLote, setResultadosLote] = useState(null);
  const [serie, setSerie] = useState('');
  const [resultadoSerie, setResultadoSerie] = useState(undefined);

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <h5 className="mb-2">Buscar por lote</h5>
        <div className="input-group mb-2">
          <input className="form-control" placeholder="Código de lote" value={lote} onChange={(e) => setLote(e.target.value)} />
          <button className="btn btn-outline-primary" onClick={() => setResultadosLote(buscarPorLote(lote))}>Buscar</button>
        </div>
        {resultadosLote && (
          resultadosLote.length === 0 ? <div className="text-muted">Sin resultados para ese lote.</div> : (
            <ul className="list-group">
              {resultadosLote.map((r, i) => (
                <li className="list-group-item" key={i}>
                  {productoNombre(r.productoId)} — recibido: {r.cantidadRecibida}
                  {r.fechaRecepcion && ` (${fecha(r.fechaRecepcion)})`}
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <div className="col-md-6">
        <h5 className="mb-2">Buscar por número de serie</h5>
        <div className="input-group mb-2">
          <input className="form-control" placeholder="Número de serie" value={serie} onChange={(e) => setSerie(e.target.value)} />
          <button className="btn btn-outline-primary" onClick={() => setResultadoSerie(buscarPorNumeroSerie(serie))}>Buscar</button>
        </div>
        {resultadoSerie !== undefined && (
          resultadoSerie === null ? <div className="text-muted">No se encontró ese número de serie.</div> : (
            <ul className="list-group">
              <li className="list-group-item"><strong>Producto:</strong> {productoNombre(resultadoSerie.productoId)}</li>
              <li className="list-group-item"><strong>Lote:</strong> {resultadoSerie.lote || '—'}</li>
              <li className="list-group-item"><strong>Ingresó:</strong> {fecha(resultadoSerie.fechaIngreso)}</li>
              <li className="list-group-item">
                <strong>Vendido:</strong> {resultadoSerie.ventaId ? `Sí (${fecha(resultadoSerie.fechaVenta)})` : 'No vendido todavía'}
              </li>
            </ul>
          )
        )}
      </div>
    </div>
  );
}
