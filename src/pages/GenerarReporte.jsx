// src/pages/GenerarReporte.jsx
// Cubre: RF-39 (ventas), RF-40 (más vendidos), RF-41 (categorías/variantes), RF-42 (ventas por canal),
// RF-43 (comparación de canales), RF-44 (costos y ganancias), RF-45 (inventario), RF-46 (movimientos).
// Todos los reportes usan datos reales y se pueden exportar a CSV o imprimir.
import { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { paleta, opcionesEjes, opcionesDona } from '../utils/graficos';
import { descargarCSV } from '../utils/exportar';
import { moneda, monedaEntera, numero, porcentaje, fechaHora, aInputFecha, inicioDelDia, finDelDia, MOTIVOS } from '../utils/formato';

const TABS = [
  { id: 'ventas', label: 'Ventas' },
  { id: 'productos', label: 'Más vendidos' },
  { id: 'categorias', label: 'Categorías y variantes' },
  { id: 'canales', label: 'Canales' },
  { id: 'costos', label: 'Costos y ganancias' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'movimientos', label: 'Movimientos' },
];

const PRESETS = [
  { id: 'hoy', label: 'Hoy', dias: 0 },
  { id: '7', label: '7 días', dias: 6 },
  { id: '30', label: '30 días', dias: 29 },
  { id: 'mes', label: 'Este mes' },
  { id: 'todo', label: 'Todo' },
];

const rangoPreset = (id) => {
  const hoy = new Date();
  if (id === 'todo') return { desde: '', hasta: '' };
  if (id === 'mes') return { desde: aInputFecha(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: aInputFecha(hoy) };
  const dias = PRESETS.find((p) => p.id === id)?.dias ?? 29;
  const ini = new Date(); ini.setDate(ini.getDate() - dias);
  return { desde: aInputFecha(ini), hasta: aInputFecha(hoy) };
};

const agrupar = (lista, clave, init, acumular) => {
  const m = new Map();
  lista.forEach((x) => {
    const k = clave(x);
    m.set(k, acumular(m.get(k) || init(x), x));
  });
  return Array.from(m.values());
};

export default function GenerarReporte() {
  const ctx = useData();
  const { ventas, movimientos, productos, lineasNetas, tienePermiso, minimoDeProducto, objetivoDeProducto, stockDeProducto, esAltaRotacion, unidadesRecientes } = ctx;
  const { modoOscuro } = useTheme();
  const c = paleta(modoOscuro);

  const [tab, setTab] = useState('ventas');
  const [preset, setPreset] = useState('30');
  const [{ desde, hasta }, setRango] = useState(rangoPreset('30'));
  const [tipoMov, setTipoMov] = useState('todos');

  const verCostos = tienePermiso('costos');
  const enRango = (iso) => {
    const d = new Date(iso);
    return (!desde || d >= inicioDelDia(desde)) && (!hasta || d <= finDelDia(hasta));
  };

  // ---------- Datos base del período ----------
  const ventasPeriodo = useMemo(() => ventas.filter((v) => enRango(v.fecha)), [ventas, desde, hasta]);
  const lineas = useMemo(
    () => ventasPeriodo.flatMap((v) => lineasNetas(v).map((l) => ({ ...l, canal: v.canal, fecha: v.fecha, ventaId: v.id }))),
    [ventasPeriodo, lineasNetas]
  );
  const ingresoBruto = ventasPeriodo.reduce((s, v) => s + v.total, 0);
  const ingresoNeto = lineas.reduce((s, l) => s + l.ingresoNeto, 0);
  const costoNeto = lineas.reduce((s, l) => s + l.costoNeto, 0);
  const unidadesNetas = lineas.reduce((s, l) => s + l.cantidadNeta, 0);
  const ganancia = ingresoNeto - costoNeto;
  const devuelto = ingresoBruto - ingresoNeto;

  // ---------- Series ----------
  const porDia = useMemo(() => {
    const fechas = ventasPeriodo.map((v) => new Date(v.fecha));
    const ini = desde ? inicioDelDia(desde) : fechas.length ? new Date(Math.min(...fechas)) : new Date();
    const fin = hasta ? finDelDia(hasta) : new Date();
    const dias = Math.ceil((fin - ini) / 86400000) + 1;
    const porMes = dias > 62;
    const mapa = new Map();
    if (!porMes) for (let i = 0; i < dias; i += 1) { const d = new Date(ini); d.setDate(d.getDate() + i); mapa.set(aInputFecha(d), 0); }
    ventasPeriodo.forEach((v) => {
      const d = new Date(v.fecha);
      const k = porMes ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : aInputFecha(d);
      mapa.set(k, (mapa.get(k) || 0) + v.total);
    });
    const claves = Array.from(mapa.keys()).sort();
    const etiqueta = (k) => (porMes ? new Date(`${k}-01T00:00:00`).toLocaleDateString('es-NI', { month: 'short', year: '2-digit' }) : new Date(`${k}T00:00:00`).toLocaleDateString('es-NI', { day: 'numeric', month: 'short' }));
    return claves.map((k) => ({ clave: k, etiqueta: etiqueta(k), monto: mapa.get(k) }));
  }, [ventasPeriodo, desde, hasta]);

  const porProducto = useMemo(
    () => agrupar(lineas, (l) => l.productoId, (l) => ({ productoId: l.productoId, nombre: l.nombre, categoria: l.categoria, unidades: 0, ingreso: 0, costo: 0 }), (a, l) => ({ ...a, unidades: a.unidades + l.cantidadNeta, ingreso: a.ingreso + l.ingresoNeto, costo: a.costo + l.costoNeto })).sort((a, b) => b.unidades - a.unidades),
    [lineas]
  );
  const porCategoria = useMemo(
    () => agrupar(lineas, (l) => l.categoria, (l) => ({ categoria: l.categoria, unidades: 0, ingreso: 0, costo: 0 }), (a, l) => ({ ...a, unidades: a.unidades + l.cantidadNeta, ingreso: a.ingreso + l.ingresoNeto, costo: a.costo + l.costoNeto })).sort((a, b) => b.unidades - a.unidades),
    [lineas]
  );
  const porVariante = useMemo(
    () => agrupar(lineas.filter((l) => l.varianteId), (l) => `${l.productoId}|${l.varianteId}`, (l) => ({ nombre: l.nombre, variante: l.varianteValor, unidades: 0, ingreso: 0 }), (a, l) => ({ ...a, unidades: a.unidades + l.cantidadNeta, ingreso: a.ingreso + l.ingresoNeto })).sort((a, b) => b.unidades - a.unidades),
    [lineas]
  );
  const porCanal = useMemo(
    () => ['piso', 'linea'].map((canal) => {
      const vs = ventasPeriodo.filter((v) => v.canal === canal);
      const ls = lineas.filter((l) => l.canal === canal);
      const monto = ls.reduce((s, l) => s + l.ingresoNeto, 0);
      return { canal, etiqueta: canal === 'piso' ? 'En piso' : 'En línea', ventas: vs.length, unidades: ls.reduce((s, l) => s + l.cantidadNeta, 0), monto, ticket: vs.length ? monto / vs.length : 0 };
    }),
    [ventasPeriodo, lineas]
  );
  const movsPeriodo = useMemo(() => movimientos.filter((m) => enRango(m.fecha) && (tipoMov === 'todos' || m.tipo === tipoMov)), [movimientos, desde, hasta, tipoMov]);
  const activos = productos.filter((p) => p.activo !== false);

  const nombreProd = (id) => productos.find((p) => p.id === id)?.nombre || '(eliminado)';
  const nombreVar = (pid, vid) => (vid ? ` — ${productos.find((p) => p.id === pid)?.variantes?.find((v) => v.id === vid)?.valor || ''}` : '');

  const totalMonto = porCanal.reduce((s, x) => s + x.monto, 0);

  // ---------- Exportación ----------
  const exportar = () => {
    const nombre = `motoman-${tab}-${aInputFecha()}.csv`;
    const filas = {
      ventas: [['Período', 'Monto vendido (C$)'], ...porDia.map((d) => [d.etiqueta, d.monto.toFixed(2)])],
      productos: [['Producto', 'Categoría', 'Unidades netas', 'Ingreso neto (C$)'], ...porProducto.map((p) => [p.nombre, p.categoria, p.unidades, p.ingreso.toFixed(2)])],
      categorias: [['Categoría', 'Unidades netas', 'Ingreso neto (C$)'], ...porCategoria.map((x) => [x.categoria, x.unidades, x.ingreso.toFixed(2)]), [], ['Producto', 'Variante', 'Unidades netas', 'Ingreso neto (C$)'], ...porVariante.map((x) => [x.nombre, x.variante, x.unidades, x.ingreso.toFixed(2)])],
      canales: [['Canal', 'Ventas', 'Unidades', 'Monto (C$)', 'Ticket promedio (C$)'], ...porCanal.map((x) => [x.etiqueta, x.ventas, x.unidades, x.monto.toFixed(2), x.ticket.toFixed(2)])],
      costos: [['Producto', 'Unidades', 'Ingreso (C$)', 'Costo (C$)', 'Ganancia (C$)'], ...porProducto.map((p) => [p.nombre, p.unidades, p.ingreso.toFixed(2), p.costo.toFixed(2), (p.ingreso - p.costo).toFixed(2)])],
      inventario: [['Producto', 'Categoría', 'Existencias', 'Mínimo', 'Nivel objetivo', 'Estado'], ...activos.map((p) => [p.nombre, p.categoria, stockDeProducto(p), minimoDeProducto(p), objetivoDeProducto(p), estadoTexto(p)])],
      movimientos: [['Fecha', 'Producto', 'Tipo', 'Motivo', 'Cantidad', 'Usuario', 'Comentario'], ...movsPeriodo.map((m) => [fechaHora(m.fecha), nombreProd(m.productoId) + nombreVar(m.productoId, m.varianteId), m.tipo, MOTIVOS[m.motivo] || m.motivo, m.cantidad, m.usuario || '', m.comentario])],
    }[tab];
    descargarCSV(nombre, filas);
  };
  function estadoTexto(p) { const s = stockDeProducto(p); return s === 0 ? 'Agotado' : s <= minimoDeProducto(p) ? 'Stock bajo' : 'Disponible'; }

  const sinDatos = <EmptyState icono="bi-bar-chart" titulo="No hay ventas en este período">Cambia el rango de fechas o registra ventas para ver resultados.</EmptyState>;
  const maxUnidades = Math.max(1, ...porProducto.map((p) => p.unidades));

  return (
    <div className="container-fluid">
      <PageHeader titulo="Reportes" descripcion="Resultados del negocio con datos reales. Exporta a CSV para abrirlos en Excel.">
        <button type="button" className="btn btn-outline-secondary" onClick={exportar}><i className="bi bi-filetype-csv me-2"></i>Exportar CSV</button>
        <button type="button" className="btn btn-outline-secondary" onClick={() => window.print()}><i className="bi bi-printer me-2"></i>Imprimir</button>
      </PageHeader>

      <div className="toolbar no-imprimir">
        <div className="seg" role="group" aria-label="Período">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={preset === p.id ? 'activo' : ''} onClick={() => { setPreset(p.id); setRango(rangoPreset(p.id)); }}>{p.label}</button>
          ))}
        </div>
        <input type="date" className="form-control" style={{ maxWidth: 160 }} value={desde} onChange={(e) => { setPreset('custom'); setRango({ desde: e.target.value, hasta }); }} aria-label="Desde" />
        <input type="date" className="form-control" style={{ maxWidth: 160 }} value={hasta} onChange={(e) => { setPreset('custom'); setRango({ desde, hasta: e.target.value }); }} aria-label="Hasta" />
      </div>

      <ul className="nav nav-tabs mb-4 no-imprimir" role="tablist">
        {TABS.map((t) => (
          <li className="nav-item" key={t.id}><button type="button" role="tab" aria-selected={tab === t.id} className={`nav-link ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button></li>
        ))}
      </ul>

      <div className="imprimible">
        {/* ---------------- Ventas ---------------- */}
        {tab === 'ventas' && (
          <>
            <div className="kpi-grid">
              <StatCard titulo="Ventas netas" valor={monedaEntera(ingresoNeto)} detalle={devuelto > 0 ? `${monedaEntera(devuelto)} en devoluciones` : 'Sin devoluciones'} icono="bi-cash-stack" tono="ok" />
              <StatCard titulo="Facturas emitidas" valor={ventasPeriodo.length} icono="bi-receipt" tono="primary" />
              <StatCard titulo="Unidades vendidas" valor={numero(unidadesNetas)} icono="bi-box-seam" tono="info" />
              <StatCard titulo="Ticket promedio" valor={monedaEntera(ventasPeriodo.length ? ingresoNeto / ventasPeriodo.length : 0)} icono="bi-receipt-cutoff" tono="warn" />
            </div>
            <section className="panel">
              <h2 className="panel-titulo">Monto vendido por {porDia.length > 0 && porDia[0].clave.length === 7 ? 'mes' : 'día'}</h2>
              <p className="panel-sub">Total facturado en el período seleccionado.</p>
              {ventasPeriodo.length === 0 ? sinDatos : (
                <div className="graf-caja alta"><Bar data={{ labels: porDia.map((d) => d.etiqueta), datasets: [{ label: 'Ventas (C$)', data: porDia.map((d) => d.monto), backgroundColor: c.piso, borderRadius: 6, maxBarThickness: 36 }] }} options={{ ...opcionesEjes(modoOscuro, { moneda: true }), plugins: { legend: { display: false } } }} /></div>
              )}
            </section>
          </>
        )}

        {/* ---------------- Más vendidos ---------------- */}
        {tab === 'productos' && (
          <section className="panel">
            <h2 className="panel-titulo">Productos más vendidos</h2>
            <p className="panel-sub">Ordenados por unidades netas (descontando devoluciones). La marca de rotación usa los últimos {ctx.config.ventanaRotacionDias} días.</p>
            {porProducto.length === 0 ? sinDatos : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th style={{ minWidth: 160 }}>Unidades</th><th className="text-end">Ingreso</th><th>Rotación</th></tr></thead>
                  <tbody>
                    {porProducto.slice(0, 15).map((p, i) => {
                      const prod = productos.find((x) => x.id === p.productoId);
                      return (
                        <tr key={p.productoId}>
                          <td className="texto-suave">{i + 1}</td>
                          <td className="fw-semibold">{p.nombre}</td>
                          <td>{p.categoria}</td>
                          <td><div className="d-flex align-items-center gap-2"><strong style={{ minWidth: 28 }}>{p.unidades}</strong><div className="barra-h flex-grow-1"><span style={{ width: `${(p.unidades / maxUnidades) * 100}%` }}></span></div></div></td>
                          <td className="text-end">{moneda(p.ingreso)}</td>
                          <td>{prod && esAltaRotacion(prod) ? <span className="badge bg-success">Alta · {unidadesRecientes(prod.id)} uds.</span> : <span className="badge bg-secondary">Normal</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ---------------- Categorías y variantes ---------------- */}
        {tab === 'categorias' && (
          porCategoria.length === 0 ? <section className="panel">{sinDatos}</section> : (
            <div className="reporte-grid">
              <section className="panel col-5x">
                <h2 className="panel-titulo">Unidades por categoría</h2>
                <p className="panel-sub">Participación de cada categoría en lo vendido.</p>
                <div className="graf-caja"><Doughnut data={{ labels: porCategoria.map((x) => x.categoria), datasets: [{ data: porCategoria.map((x) => x.unidades), backgroundColor: c.serie, borderWidth: 0 }] }} options={opcionesDona(modoOscuro)} /></div>
              </section>
              <section className="panel col-7x">
                <h2 className="panel-titulo">Variantes con más movimiento</h2>
                <p className="panel-sub">Por ejemplo, baterías para distintos modelos de GoPro.</p>
                {porVariante.length === 0 ? <div className="texto-suave">Todavía no se han vendido productos con variantes.</div> : (
                  <div className="table-responsive">
                    <table className="table align-middle">
                      <thead><tr><th>Producto</th><th>Variante</th><th className="text-end">Unidades</th><th className="text-end">Ingreso</th></tr></thead>
                      <tbody>{porVariante.map((v, i) => <tr key={i}><td className="fw-semibold">{v.nombre}</td><td>{v.variante}</td><td className="text-end">{v.unidades}</td><td className="text-end">{moneda(v.ingreso)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="panel col-12x">
                <h2 className="panel-titulo">Detalle por categoría</h2>
                <div className="table-responsive">
                  <table className="table"><thead><tr><th>Categoría</th><th className="text-end">Unidades</th><th className="text-end">Ingreso</th></tr></thead>
                    <tbody>{porCategoria.map((x) => <tr key={x.categoria}><td className="fw-semibold">{x.categoria}</td><td className="text-end">{x.unidades}</td><td className="text-end">{moneda(x.ingreso)}</td></tr>)}</tbody></table>
                </div>
              </section>
            </div>
          )
        )}

        {/* ---------------- Canales ---------------- */}
        {tab === 'canales' && (
          <>
            <div className="kpi-grid">
              {porCanal.map((x) => (
                <StatCard key={x.canal} titulo={`Ventas ${x.etiqueta.toLowerCase()}`} valor={monedaEntera(x.monto)} detalle={`${x.ventas} factura(s) · ${totalMonto ? porcentaje((x.monto / totalMonto) * 100, 0) : '0%'} del total`} icono={x.canal === 'piso' ? 'bi-shop' : 'bi-globe2'} tono={x.canal === 'piso' ? 'primary' : 'info'} />
              ))}
            </div>
            {ventasPeriodo.length === 0 ? <section className="panel">{sinDatos}</section> : (
              <div className="reporte-grid">
                <section className="panel col-5x">
                  <h2 className="panel-titulo">Reparto del monto vendido</h2>
                  <div className="graf-caja"><Doughnut data={{ labels: porCanal.map((x) => x.etiqueta), datasets: [{ data: porCanal.map((x) => x.monto), backgroundColor: [c.piso, c.linea], borderWidth: 0 }] }} options={opcionesDona(modoOscuro)} /></div>
                </section>
                <section className="panel col-7x">
                  <h2 className="panel-titulo">Comparación entre canales</h2>
                  <p className="panel-sub">Monto y volumen de ventas.</p>
                  <div className="table-responsive">
                    <table className="table align-middle">
                      <thead><tr><th>Canal</th><th className="text-end">Facturas</th><th className="text-end">Unidades</th><th className="text-end">Monto</th><th className="text-end">Ticket promedio</th></tr></thead>
                      <tbody>{porCanal.map((x) => <tr key={x.canal}><td className="fw-semibold">{x.etiqueta}</td><td className="text-end">{x.ventas}</td><td className="text-end">{x.unidades}</td><td className="text-end">{moneda(x.monto)}</td><td className="text-end">{moneda(x.ticket)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </>
        )}

        {/* ---------------- Costos y ganancias ---------------- */}
        {tab === 'costos' && (
          !verCostos ? <section className="panel"><EmptyState icono="bi-lock" titulo="Sin permiso para ver costos">Tu rol no incluye el acceso a costos y ganancias.</EmptyState></section> : (
            <>
              <div className="kpi-grid">
                <StatCard titulo="Ingresos netos" valor={monedaEntera(ingresoNeto)} icono="bi-graph-up-arrow" tono="primary" />
                <StatCard titulo="Costo de lo vendido" valor={monedaEntera(costoNeto)} detalle="Costo de adquisición + envío" icono="bi-box-seam" tono="warn" />
                <StatCard titulo="Ganancia" valor={monedaEntera(ganancia)} icono="bi-cash-coin" tono="ok" />
                <StatCard titulo="Margen sobre ventas" valor={ingresoNeto ? porcentaje((ganancia / ingresoNeto) * 100) : '—'} icono="bi-percent" tono="info" />
              </div>
              <section className="panel">
                <h2 className="panel-titulo">Costos y ganancia por producto</h2>
                <p className="panel-sub">El costo se toma del momento de la venta, así los cambios posteriores de precio no alteran el histórico.</p>
                {porProducto.length === 0 ? sinDatos : (
                  <div className="table-responsive">
                    <table className="table align-middle">
                      <thead><tr><th>Producto</th><th className="text-end">Unidades</th><th className="text-end">Ingreso</th><th className="text-end">Costo</th><th className="text-end">Ganancia</th><th className="text-end">Margen</th></tr></thead>
                      <tbody>{[...porProducto].sort((a, b) => b.ingreso - b.costo - (a.ingreso - a.costo)).map((p) => (
                        <tr key={p.productoId}><td className="fw-semibold">{p.nombre}</td><td className="text-end">{p.unidades}</td><td className="text-end">{moneda(p.ingreso)}</td><td className="text-end">{moneda(p.costo)}</td><td className="text-end fw-semibold">{moneda(p.ingreso - p.costo)}</td><td className="text-end">{p.ingreso ? porcentaje(((p.ingreso - p.costo) / p.ingreso) * 100) : '—'}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )
        )}

        {/* ---------------- Inventario ---------------- */}
        {tab === 'inventario' && (
          <>
            <div className="kpi-grid">
              <StatCard titulo="Unidades en existencia" valor={numero(activos.reduce((s, p) => s + stockDeProducto(p), 0))} icono="bi-boxes" tono="primary" />
              <StatCard titulo="Bajo el mínimo" valor={ctx.productosBajoStock.length} icono="bi-exclamation-triangle" tono="warn" />
              <StatCard titulo="Agotados" valor={ctx.productosAgotados.length} icono="bi-slash-circle" tono="danger" />
              {verCostos && <StatCard titulo="Valor al costo" valor={monedaEntera(activos.reduce((s, p) => s + stockDeProducto(p) * ctx.costoTotalDeProducto(p), 0))} detalle={`${monedaEntera(activos.reduce((s, p) => s + stockDeProducto(p) * Number(p.precio), 0))} a precio de venta`} icono="bi-safe" tono="ok" />}
            </div>
            <section className="panel">
              <h2 className="panel-titulo">Existencias actuales</h2>
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead><tr><th>Producto</th><th>Categoría</th><th className="text-end">Existencias</th><th className="text-end">Mínimo</th><th className="text-end">Objetivo</th><th>Estado</th></tr></thead>
                  <tbody>{activos.map((p) => {
                    const e = estadoTexto(p);
                    return <tr key={p.id}><td className="fw-semibold">{p.nombre}</td><td>{p.categoria || '—'}</td><td className="text-end">{stockDeProducto(p)}</td><td className="text-end">{minimoDeProducto(p)}</td><td className="text-end">{objetivoDeProducto(p)}</td><td><span className={`badge ${e === 'Agotado' ? 'bg-danger' : e === 'Stock bajo' ? 'bg-warning' : 'bg-success'}`}>{e}</span></td></tr>;
                  })}</tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ---------------- Movimientos ---------------- */}
        {tab === 'movimientos' && (
          <>
            <div className="kpi-grid">
              <StatCard titulo="Entradas" valor={numero(movsPeriodo.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + m.cantidad, 0))} detalle="unidades que ingresaron" icono="bi-box-arrow-in-down" tono="ok" />
              <StatCard titulo="Salidas" valor={numero(movsPeriodo.filter((m) => m.tipo === 'salida').reduce((s, m) => s + m.cantidad, 0))} detalle="unidades que salieron" icono="bi-box-arrow-up" tono="danger" />
            </div>
            <section className="panel">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <h2 className="panel-titulo mb-0">Entradas y salidas del período</h2>
                <div className="seg no-imprimir">
                  {[['todos', 'Todos'], ['entrada', 'Entradas'], ['salida', 'Salidas']].map(([v, l]) => <button key={v} type="button" className={tipoMov === v ? 'activo' : ''} onClick={() => setTipoMov(v)}>{l}</button>)}
                </div>
              </div>
              {movsPeriodo.length === 0 ? <EmptyState icono="bi-arrow-left-right" titulo="No hay movimientos en este período" /> : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Motivo</th><th className="text-end">Cant.</th><th>Usuario</th></tr></thead>
                    <tbody>{movsPeriodo.slice(0, 200).map((m) => (
                      <tr key={m.id}><td>{fechaHora(m.fecha)}</td><td>{nombreProd(m.productoId)}{nombreVar(m.productoId, m.varianteId)}</td><td><span className={`badge ${m.tipo === 'entrada' ? 'bg-success' : 'bg-danger'}`}>{m.tipo === 'entrada' ? 'Entrada' : 'Salida'}</span></td><td>{MOTIVOS[m.motivo] || m.motivo}</td><td className="text-end">{m.cantidad}</td><td>{m.usuario || '—'}</td></tr>
                    ))}</tbody>
                  </table>
                  {movsPeriodo.length > 200 && <div className="texto-suave p-2">Se muestran los 200 más recientes. Exporta a CSV para ver todos.</div>}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
