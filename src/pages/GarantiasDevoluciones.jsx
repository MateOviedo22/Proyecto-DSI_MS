// src/pages/GarantiasDevoluciones.jsx
// Cubre: RF-36 (registro de garantía por número de serie), RF-37 (verificar la serie contra la venta),
// RF-38 (período de garantía de 15 días), RF-54 (registro de devoluciones) y RF-55 (actualiza el inventario).
// La regla de los 15 días la evalúa el SERVIDOR: localiza la venta por la serie y calcula si el reclamo está a tiempo.
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { ESTADOS_RECLAMO } from '../api/adaptadores';
import { moneda, fecha, fechaHora } from '../utils/formato';

const ESTADOS_PRODUCTO = [
  { valor: 'BUEN_ESTADO', label: 'Buen estado (vuelve al inventario)' },
  { valor: 'DEFECTUOSO', label: 'Defectuoso' },
  { valor: 'DANADO', label: 'Dañado' },
  { valor: 'INCOMPLETO', label: 'Incompleto' },
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
  const { verificarSerie, registrarGarantia, garantias, actualizarEstadoGarantia, config } = useData();
  const { notificar } = useUi();
  const [serie, setSerie] = useState('');
  const [info, setInfo] = useState(undefined); // undefined: sin buscar · null: no existe
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [resolviendo, setResolviendo] = useState(null); // { id, texto }

  const verificar = async (e) => {
    e.preventDefault();
    setError('');
    setDescripcion('');
    if (!serie.trim()) return setInfo(undefined);
    setOcupado(true);
    const res = await verificarSerie(serie);
    setOcupado(false);
    if (!res.ok) { setInfo(undefined); return setError(res.error); }
    setInfo(res.info);
  };

  const registrar = async () => {
    if (!descripcion.trim()) return setError('Describe el problema que reporta el cliente.');
    setOcupado(true);
    const res = await registrarGarantia({ numeroSerie: info.serie.numero, descripcion });
    setOcupado(false);
    if (!res.ok) {
      // 409: garantía vencida, reclamo ya pendiente o unidad sin vender. Se vuelve a consultar para mostrar el estado real.
      setError(res.error);
      const nueva = await verificarSerie(info.serie.numero);
      if (nueva.ok) setInfo(nueva.info);
      return;
    }
    notificar('Garantía registrada (201).');
    setDescripcion(''); setError('');
    setInfo(res.info);
  };

  const cambiarEstado = async (id, estado, resolucion = '') => {
    const res = await actualizarEstadoGarantia(id, estado, resolucion);
    notificar(res.ok ? `Reclamo actualizado: ${ESTADOS_RECLAMO[estado].etiqueta}.` : res.error, res.ok ? 'ok' : 'error');
    return res.ok;
  };

  const confirmarResolucion = async () => {
    if (!resolviendo.texto.trim()) return;
    if (await cambiarEstado(resolviendo.id, 'RESUELTO', resolviendo.texto)) setResolviendo(null);
  };

  const g = info?.garantia;
  const puedeRegistrar = info?.venta && g?.estado === 'VIGENTE';

  return (
    <div className="reporte-grid">
      <section className="panel col-5x">
        <h2 className="panel-titulo">Verificar número de serie</h2>
        <p className="panel-sub">El período de garantía es de {config.diasGarantia} días desde la venta; lo comprueba el servidor.</p>
        <form onSubmit={verificar} className="d-flex gap-2">
          <div className="campo-icono flex-grow-1">
            <i className="bi bi-upc-scan"></i>
            <input className="form-control" placeholder="Número de serie de la cámara" value={serie} onChange={(e) => setSerie(e.target.value)} aria-label="Número de serie" autoFocus />
          </div>
          <button className="btn btn-primary" disabled={!serie.trim() || ocupado}>{ocupado ? '…' : 'Verificar'}</button>
        </form>

        {info === null && <div className="alert alert-danger mt-3 mb-0" role="alert">No existe ese número de serie en el inventario. Revisa que esté bien escrito.</div>}

        {info && (
          <div className="mt-3">
            <dl className="row mb-3" style={{ rowGap: '0.35rem' }}>
              <dt className="col-5 texto-suave fw-semibold">Producto</dt><dd className="col-7 mb-0 fw-semibold">{info.producto.nombre}</dd>
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

            <div className={`alert ${g.estado === 'VIGENTE' ? 'alert-success' : 'alert-warning'}`} role="status">
              <i className={`bi ${g.estado === 'VIGENTE' ? 'bi-shield-check' : 'bi-shield-exclamation'} me-2`}></i>{g.mensaje}
            </div>

            {puedeRegistrar && (
              <>
                <label htmlFor="g-desc">Problema reportado</label>
                <textarea id="g-desc" className="form-control" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. no enciende, lente rayado…" />
                <button type="button" className="btn btn-primary mt-3" onClick={registrar} disabled={ocupado}><i className="bi bi-shield-plus me-2"></i>Registrar garantía</button>
              </>
            )}
            {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
            {info.garantiasPrevias.length > 0 && <div className="texto-suave mt-3">Esta cámara ya tiene {info.garantiasPrevias.length} reclamo(s) registrado(s).</div>}
          </div>
        )}
        {info === undefined && error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
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
                {garantias.map((r) => {
                  const estado = ESTADOS_RECLAMO[r.estado] || ESTADOS_RECLAMO.ABIERTO;
                  return (
                    <tr key={r.id}>
                      <td>{fecha(r.fecha)}</td>
                      <td><div className="fw-semibold">{r.nombre}</div><div className="texto-suave">{r.numero}</div></td>
                      <td>{r.numeroFactura || '—'}</td>
                      <td style={{ maxWidth: 220 }}>{r.descripcion}{r.resolucion && <div className="texto-suave">Resolución: {r.resolucion}</div>}</td>
                      <td>
                        <span className={`badge ${estado.clase}`}>{estado.etiqueta}</span>
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {estado.siguientes.map((sig) => (
                            <button key={sig} type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => (sig === 'RESUELTO' ? setResolviendo({ id: r.id, texto: '' }) : cambiarEstado(r.id, sig))}>
                              → {ESTADOS_RECLAMO[sig].etiqueta}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        abierto={Boolean(resolviendo)}
        onCerrar={() => setResolviendo(null)}
        titulo="Resolución del reclamo"
        tamano="sm"
        pie={<><button type="button" className="btn btn-outline-secondary" onClick={() => setResolviendo(null)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={confirmarResolucion}>Marcar como resuelto</button></>}
      >
        <label htmlFor="g-resol">¿Cómo se resolvió?</label>
        <textarea id="g-resol" className="form-control" rows={3} value={resolviendo?.texto || ''} onChange={(e) => setResolviendo((r) => ({ ...r, texto: e.target.value }))} placeholder="Ej. se reemplazó la cámara por una nueva" />
      </Modal>
    </div>
  );
}

// =====================================================================
function Devoluciones() {
  const { ventas, lineasNetas, registrarDevolucion, devoluciones } = useData();
  const { notificar } = useUi();
  const [ventaId, setVentaId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [estadoProducto, setEstadoProducto] = useState('BUEN_ESTADO');
  const [seriesElegidas, setSeriesElegidas] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const venta = ventas.find((v) => v.id === ventaId);
  const lineas = venta ? lineasNetas(venta) : [];
  const linea = lineas.find((l) => l.productoId === productoId);
  const seriesVendidas = linea ? linea.numerosSerie || [] : [];
  const requiereSeries = seriesVendidas.length > 0;

  const alternarSerie = (numero) =>
    setSeriesElegidas((prev) => (prev.includes(numero) ? prev.filter((n) => n !== numero) : [...prev, numero]));

  const guardar = async (e) => {
    e.preventDefault();
    if (requiereSeries && seriesElegidas.length !== Number(cantidad)) {
      return setError(`Selecciona ${cantidad} número(s) de serie de la lista.`);
    }
    setEnviando(true);
    setError('');
    const res = await registrarDevolucion({ ventaId, productoId, cantidad, motivo, estadoProducto, numerosSerie: seriesElegidas });
    setEnviando(false);
    if (!res.ok) return setError(res.error); // 400 / 404 / 409 (p. ej. la unidad ya se devolvió)
    notificar('Devolución registrada (201) y existencias actualizadas.');
    setProductoId(''); setCantidad('1'); setMotivo(''); setSeriesElegidas([]); setEstadoProducto('BUEN_ESTADO'); setError('');
  };

  return (
    <div className="reporte-grid">
      <section className="panel col-5x">
        <h2 className="panel-titulo">Registrar devolución</h2>
        <p className="panel-sub">Si el producto vuelve en buen estado, regresa al inventario automáticamente.</p>
        <form onSubmit={guardar} className="d-grid gap-3">
          <div>
            <label htmlFor="d-venta">Venta asociada</label>
            <select id="d-venta" className="form-select" value={ventaId} onChange={(e) => { setVentaId(e.target.value); setProductoId(''); setSeriesElegidas([]); setError(''); }}>
              <option value="">Elige una factura</option>
              {ventas.map((v) => <option key={v.id} value={v.id}>{v.numeroFactura} · {v.cliente} · {moneda(v.total)}</option>)}
            </select>
          </div>
          {venta && (
            <div>
              <label htmlFor="d-linea">Producto</label>
              <select id="d-linea" className="form-select" value={productoId} onChange={(e) => { setProductoId(e.target.value); setSeriesElegidas([]); setCantidad('1'); }}>
                <option value="">Elige el producto devuelto</option>
                {lineas.map((l) => (
                  <option key={l.productoId} value={l.productoId} disabled={l.cantidadNeta === 0}>{l.nombre} (por devolver: {l.cantidadNeta})</option>
                ))}
              </select>
            </div>
          )}
          {linea && (
            <>
              <div className="row g-2">
                <div className="col-4">
                  <label htmlFor="d-cant">Cantidad</label>
                  <input id="d-cant" type="number" min="1" max={linea.cantidadNeta} className="form-control" value={cantidad} onChange={(e) => { setCantidad(e.target.value); setSeriesElegidas([]); }} />
                </div>
                <div className="col-8">
                  <label htmlFor="d-estado">Estado del producto</label>
                  <select id="d-estado" className="form-select" value={estadoProducto} onChange={(e) => setEstadoProducto(e.target.value)}>
                    {ESTADOS_PRODUCTO.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {requiereSeries && (
                <div>
                  <label>Números de serie devueltos ({seriesElegidas.length} de {cantidad})</label>
                  <div className="d-flex flex-wrap gap-2">
                    {seriesVendidas.map((n) => (
                      <label key={n} className={`btn btn-sm ${seriesElegidas.includes(n) ? 'btn-primary' : 'btn-outline-secondary'} mb-0`} style={{ fontWeight: 500 }}>
                        <input type="checkbox" className="d-none" checked={seriesElegidas.includes(n)} onChange={() => alternarSerie(n)} />{n}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="d-mot">Motivo</label>
                <input id="d-mot" list="motivos-devolucion" className="form-control" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. defecto de fábrica" />
                <datalist id="motivos-devolucion">
                  <option value="Defecto de fábrica" /><option value="Producto equivocado" /><option value="El cliente cambió de opinión" /><option value="Daño en el envío" />
                </datalist>
              </div>
            </>
          )}
          {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
          <button className="btn btn-primary" disabled={!linea || enviando}><i className="bi bi-arrow-return-left me-2"></i>{enviando ? 'Registrando…' : 'Registrar devolución'}</button>
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
              <thead><tr><th>Fecha</th><th>Producto</th><th>Factura</th><th className="text-end">Cant.</th><th className="text-end">Monto</th><th>Estado</th><th>Motivo</th></tr></thead>
              <tbody>
                {devoluciones.map((d) => (
                  <tr key={d.id}>
                    <td>{fechaHora(d.fecha)}</td>
                    <td className="fw-semibold">{d.nombre}{d.numeroSerie && <div className="texto-suave">{d.numeroSerie}</div>}</td>
                    <td>{d.numeroFactura}</td>
                    <td className="text-end">{d.cantidad}</td>
                    <td className="text-end">{moneda(d.monto)}</td>
                    <td><span className={`badge ${d.estadoProducto === 'BUEN_ESTADO' ? 'bg-success' : 'bg-warning'}`}>{ESTADOS_PRODUCTO.find((s) => s.valor === d.estadoProducto)?.label.split(' (')[0] || d.estadoProducto}</span></td>
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
