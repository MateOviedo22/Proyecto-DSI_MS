// src/pages/GarantiasDevoluciones.jsx
// Cubre: RF-36 (registro de garantía por número de serie), RF-37 (verificar la serie contra la venta),
// RF-38 (período de garantía, 15 días por defecto), RF-54 (registro de devoluciones), RF-55 (actualiza inventario).
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { moneda, fecha, fechaHora } from '../utils/formato';

const ESTADOS_GARANTIA = [
  { valor: 'abierta', label: 'Abierta', clase: 'bg-warning' },
  { valor: 'en_revision', label: 'En revisión', clase: 'bg-info' },
  { valor: 'resuelta', label: 'Resuelta', clase: 'bg-success' },
  { valor: 'rechazada', label: 'Rechazada', clase: 'bg-danger' },
];

export default function GarantiasDevoluciones() {
  const [tab, setTab] = useState('garantias');
  return (
    <div className="container-fluid">
      <PageHeader titulo="Garantías y devoluciones" descripcion="Verifica cámaras por número de serie y registra devoluciones de productos vendidos.">
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'garantias'} className={tab === 'garantias' ? 'activo' : ''} onClick={() => setTab('garantias')}>Garantías</button>
          <button type="button" role="tab" aria-selected={tab === 'devoluciones'} className={tab === 'devoluciones' ? 'activo' : ''} onClick={() => setTab('devoluciones')}>Devoluciones</button>
        </div>
      </PageHeader>
      {tab === 'garantias' ? <Garantias /> : <Devoluciones />}
    </div>
  );
}

// =====================================================================
function Garantias() {
  const { verificarSerie, registrarGarantia, garantias, actualizarEstadoGarantia, productos, config } = useData();
  const { notificar } = useUi();
  const [serie, setSerie] = useState('');
  const [info, setInfo] = useState(undefined); // undefined: sin buscar · null: no existe
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');

  const verificar = (e) => {
    e.preventDefault();
    setInfo(serie.trim() ? verificarSerie(serie) : undefined);
    setError(''); setDescripcion('');
  };

  const registrar = () => {
    if (!descripcion.trim()) return setError('Describe el problema que reporta el cliente.');
    const res = registrarGarantia({ numeroSerieId: info.serie.id, descripcion });
    if (!res.ok) return setError(res.error);
    notificar('Garantía registrada.');
    setDescripcion(''); setError('');
    setInfo(verificarSerie(info.serie.numero));
  };

  const nombreProducto = (id) => productos.find((p) => p.id === id)?.nombre || '—';

  return (
    <div className="reporte-grid">
      <section className="panel col-5x">
        <h2 className="panel-titulo">Verificar número de serie</h2>
        <p className="panel-sub">El período de garantía vigente es de {config.diasGarantia} días desde la venta.</p>
        <form onSubmit={verificar} className="d-flex gap-2">
          <div className="campo-icono flex-grow-1">
            <i className="bi bi-upc-scan"></i>
            <input className="form-control" placeholder="Número de serie de la cámara" value={serie} onChange={(e) => setSerie(e.target.value)} aria-label="Número de serie" autoFocus />
          </div>
          <button className="btn btn-primary" disabled={!serie.trim()}>Verificar</button>
        </form>

        {info === null && (
          <div className="alert alert-danger mt-3 mb-0" role="alert">No existe ese número de serie en el inventario. Revisa que esté bien escrito.</div>
        )}

        {info && (
          <div className="mt-3">
            <dl className="row mb-3" style={{ rowGap: '0.35rem' }}>
              <dt className="col-5 texto-suave fw-semibold">Producto</dt><dd className="col-7 mb-0 fw-semibold">{info.producto?.nombre || '—'}</dd>
              <dt className="col-5 texto-suave fw-semibold">Número de serie</dt><dd className="col-7 mb-0">{info.serie.numero}</dd>
              <dt className="col-5 texto-suave fw-semibold">Lote</dt><dd className="col-7 mb-0">{info.serie.lote || '—'}</dd>
              {info.venta ? (
                <>
                  <dt className="col-5 texto-suave fw-semibold">Factura</dt><dd className="col-7 mb-0">{info.venta.numeroFactura}</dd>
                  <dt className="col-5 texto-suave fw-semibold">Fecha de venta</dt><dd className="col-7 mb-0">{fecha(info.venta.fecha)}</dd>
                  <dt className="col-5 texto-suave fw-semibold">Cliente</dt><dd className="col-7 mb-0">{info.venta.cliente}</dd>
                </>
              ) : (
                <><dt className="col-5 texto-suave fw-semibold">Estado</dt><dd className="col-7 mb-0">En inventario, sin vender</dd></>
              )}
            </dl>

            {!info.venta ? (
              <div className="alert alert-warning mb-0">Este número de serie no figura en ninguna venta, por lo que no corresponde a un producto vendido por la tienda.</div>
            ) : (
              <>
                <div className={`alert ${info.dentroDePeriodo ? 'alert-success' : 'alert-warning'}`} role="status">
                  <i className={`bi ${info.dentroDePeriodo ? 'bi-shield-check' : 'bi-shield-exclamation'} me-2`}></i>
                  {info.dentroDePeriodo
                    ? `Dentro de garantía: ${info.diasTranscurridos} día(s) desde la venta, quedan ${info.diasRestantes}.`
                    : `Fuera del período de garantía: pasaron ${info.diasTranscurridos} día(s) (el límite es ${info.diasGarantia}).`}
                </div>
                <label htmlFor="g-desc">Problema reportado</label>
                <textarea id="g-desc" className="form-control" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. no enciende, lente rayado…" />
                {error && <div className="alert alert-danger mt-2 mb-0">{error}</div>}
                <button type="button" className="btn btn-primary mt-3" onClick={registrar}><i className="bi bi-shield-plus me-2"></i>Registrar garantía</button>
                {info.garantiasPrevias.length > 0 && <div className="texto-suave mt-3">Esta cámara ya tiene {info.garantiasPrevias.length} reclamo(s) registrado(s).</div>}
              </>
            )}
          </div>
        )}
      </section>

      <section className="panel col-7x">
        <h2 className="panel-titulo">Garantías registradas</h2>
        <p className="panel-sub">Seguimiento de los reclamos de clientes.</p>
        {garantias.length === 0 ? (
          <EmptyState icono="bi-shield-check" titulo="No hay garantías registradas" />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead><tr><th>Fecha</th><th>Producto / serie</th><th>Factura</th><th>Problema</th><th>Estado</th></tr></thead>
              <tbody>
                {garantias.map((g) => (
                  <tr key={g.id}>
                    <td>{fecha(g.fecha)}</td>
                    <td><div className="fw-semibold">{g.nombre || nombreProducto(g.productoId)}</div><div className="texto-suave">{g.numero}</div></td>
                    <td>{g.numeroFactura}{!g.dentroDePeriodo && <div><span className="badge bg-warning">Fuera de plazo</span></div>}</td>
                    <td style={{ maxWidth: 220 }}>{g.descripcion}</td>
                    <td>
                      <select className="form-select form-select-sm" value={g.estado} onChange={(e) => actualizarEstadoGarantia(g.id, e.target.value)} aria-label="Estado de la garantía">
                        {ESTADOS_GARANTIA.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// =====================================================================
function Devoluciones() {
  const { ventas, lineasNetas, registrarDevolucion, devoluciones } = useData();
  const { notificar } = useUi();
  const [ventaId, setVentaId] = useState('');
  const [lineaClave, setLineaClave] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  const venta = ventas.find((v) => v.id === ventaId);
  const lineas = venta ? lineasNetas(venta) : [];
  const clave = (l) => `${l.productoId}|${l.varianteId || ''}`;
  const linea = lineas.find((l) => clave(l) === lineaClave);

  const guardar = (e) => {
    e.preventDefault();
    const res = registrarDevolucion({ ventaId, productoId: linea?.productoId, varianteId: linea?.varianteId, cantidad, motivo });
    if (!res.ok) return setError(res.error);
    notificar('Devolución registrada y existencias actualizadas.');
    setLineaClave(''); setCantidad('1'); setMotivo(''); setError('');
  };

  return (
    <div className="reporte-grid">
      <section className="panel col-5x">
        <h2 className="panel-titulo">Registrar devolución</h2>
        <p className="panel-sub">El producto devuelto vuelve al inventario automáticamente.</p>
        <form onSubmit={guardar} className="d-grid gap-3">
          <div>
            <label htmlFor="d-venta">Venta asociada</label>
            <select id="d-venta" className="form-select" value={ventaId} onChange={(e) => { setVentaId(e.target.value); setLineaClave(''); setError(''); }}>
              <option value="">Elige una factura</option>
              {ventas.map((v) => <option key={v.id} value={v.id}>{v.numeroFactura} · {v.cliente} · {moneda(v.total)}</option>)}
            </select>
          </div>
          {venta && (
            <div>
              <label htmlFor="d-linea">Producto</label>
              <select id="d-linea" className="form-select" value={lineaClave} onChange={(e) => setLineaClave(e.target.value)}>
                <option value="">Elige el producto devuelto</option>
                {lineas.map((l) => (
                  <option key={clave(l)} value={clave(l)} disabled={l.cantidadNeta === 0}>
                    {l.nombre}{l.varianteValor ? ` — ${l.varianteValor}` : ''} (por devolver: {l.cantidadNeta})
                  </option>
                ))}
              </select>
            </div>
          )}
          {linea && (
            <div className="row g-2">
              <div className="col-4">
                <label htmlFor="d-cant">Cantidad</label>
                <input id="d-cant" type="number" min="1" max={linea.cantidadNeta} className="form-control" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
              </div>
              <div className="col-8">
                <label htmlFor="d-mot">Motivo</label>
                <input id="d-mot" list="motivos-devolucion" className="form-control" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. defecto de fábrica" />
                <datalist id="motivos-devolucion">
                  <option value="Defecto de fábrica" /><option value="Producto equivocado" /><option value="El cliente cambió de opinión" /><option value="Daño en el envío" />
                </datalist>
              </div>
            </div>
          )}
          {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
          <button className="btn btn-primary" disabled={!linea}><i className="bi bi-arrow-return-left me-2"></i>Registrar devolución</button>
        </form>
      </section>

      <section className="panel col-7x">
        <h2 className="panel-titulo">Devoluciones registradas</h2>
        <p className="panel-sub">Historial de productos devueltos por los clientes.</p>
        {devoluciones.length === 0 ? (
          <EmptyState icono="bi-arrow-return-left" titulo="No hay devoluciones registradas" />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead><tr><th>Fecha</th><th>Producto</th><th>Factura</th><th className="text-end">Cant.</th><th className="text-end">Monto</th><th>Motivo</th></tr></thead>
              <tbody>
                {devoluciones.map((d) => (
                  <tr key={d.id}>
                    <td>{fechaHora(d.fecha)}</td>
                    <td className="fw-semibold">{d.nombre}{d.varianteValor ? ` — ${d.varianteValor}` : ''}</td>
                    <td>{d.numeroFactura}</td>
                    <td className="text-end">{d.cantidad}</td>
                    <td className="text-end">{moneda(d.monto)}</td>
                    <td>{d.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
