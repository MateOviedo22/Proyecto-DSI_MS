// src/pages/Home.jsx
// Panel de inicio con datos reales: ventas del día, existencias, alertas y actividad reciente.
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StockMeter from '../components/StockMeter';
import EmptyState from '../components/EmptyState';
import { paleta, opcionesEjes } from '../utils/graficos';
import { moneda, monedaEntera, numero, fechaHora, esHoy, aInputFecha, saludo } from '../utils/formato';

export default function Home() {
  const {
    productos, ventas, compras, alertas, usuarioActual, tienePermiso, config, stockDeProducto, minimoDeProducto, objetivoDeProducto,
    cantidadSugeridaReposicion, crearPendienteCompra, pendientesCompra, productosAgotados, productosBajoStock, unidadesRecientes, esAltaRotacion,
  } = useData();
  const { modoOscuro } = useTheme();
  const { notificar } = useUi();
  const navigate = useNavigate();

  const activos = productos.filter((p) => p.activo !== false);
  const unidadesTotales = activos.reduce((s, p) => s + stockDeProducto(p), 0);
  const ventasHoy = ventas.filter((v) => esHoy(v.fecha));
  const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0);
  const pendientesRecepcion = compras.filter((c) => c.estado === 'pendiente').length;
  const altaRotacion = activos.filter((p) => esAltaRotacion(p)).sort((a, b) => unidadesRecientes(b.id) - unidadesRecientes(a.id)).slice(0, 5);

  const nombre = (usuarioActual?.nombreCompleto || usuarioActual?.nombreUsuario || '').split(' ')[0];

  // Ventas de los últimos 7 días por canal
  const serie = useMemo(() => {
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const clave = (d) => aInputFecha(d);
    const piso = dias.map(() => 0);
    const linea = dias.map(() => 0);
    ventas.forEach((v) => {
      const idx = dias.findIndex((d) => clave(d) === aInputFecha(new Date(v.fecha)));
      if (idx >= 0) (v.canal === 'piso' ? piso : linea)[idx] += v.total;
    });
    return { etiquetas: dias.map((d) => d.toLocaleDateString('es-NI', { weekday: 'short', day: 'numeric' })), piso, linea };
  }, [ventas]);

  const c = paleta(modoOscuro);
  const datosGrafico = {
    labels: serie.etiquetas,
    datasets: [
      { label: 'En piso', data: serie.piso, backgroundColor: c.piso, borderRadius: 6, maxBarThickness: 34 },
      { label: 'En línea', data: serie.linea, backgroundColor: c.linea, borderRadius: 6, maxBarThickness: 34 },
    ],
  };
  const hayVentas = ventas.length > 0;

  const agregarPendiente = (p) => {
    const yaPendiente = pendientesCompra.some((x) => x.productoId === p.id && !x.atendido);
    if (yaPendiente) return notificar(`"${p.nombre}" ya está en pendientes de compra.`, 'info');
    crearPendienteCompra({ productoId: p.id, cantidadRequerida: cantidadSugeridaReposicion(p), prioridad: stockDeProducto(p) === 0 ? 'alta' : 'media' });
    notificar(`"${p.nombre}" agregado a pendientes de compra.`);
  };

  return (
    <div className="container-fluid">
      <PageHeader
        titulo={`${saludo()}, ${nombre}`}
        descripcion={new Date().toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      >
        {tienePermiso('ventas') && (
          <Link to="/registrar-venta" className="btn btn-primary"><i className="bi bi-receipt me-2"></i>Registrar venta</Link>
        )}
        {tienePermiso('inventario') && (
          <Link to="/ingresar-inventario" className="btn btn-outline-secondary"><i className="bi bi-arrow-left-right me-2"></i>Movimiento</Link>
        )}
        {tienePermiso('productos_gestion') && (
          <Link to="/registrar-producto" className="btn btn-outline-secondary"><i className="bi bi-plus-lg me-2"></i>Nuevo producto</Link>
        )}
      </PageHeader>

      <section className="kpi-grid" aria-label="Indicadores del negocio">
        <StatCard titulo="Ventas de hoy" valor={monedaEntera(totalHoy)} detalle={`${ventasHoy.length} venta(s) registrada(s)`} icono="bi-cash-stack" tono="ok" onClick={tienePermiso('ventas') ? () => navigate('/registrar-venta') : undefined} />
        <StatCard titulo="Unidades en inventario" valor={numero(unidadesTotales)} detalle={`${activos.length} producto(s) activo(s)`} icono="bi-boxes" tono="primary" onClick={() => navigate('/productos')} />
        <StatCard titulo="Stock bajo el mínimo" valor={productosBajoStock.length} detalle="Conviene reponer pronto" icono="bi-exclamation-triangle" tono="warn" onClick={() => navigate('/productos?filtro=bajo')} />
        <StatCard titulo="Productos agotados" valor={productosAgotados.length} detalle="Sin existencias" icono="bi-slash-circle" tono="danger" onClick={() => navigate('/productos?filtro=agotados')} />
      </section>

      <div className="reporte-grid">
        {config.mostrarGraficas && (
          <section className="panel col-7x">
            <h2 className="panel-titulo">Ventas de los últimos 7 días</h2>
            <p className="panel-sub">Monto vendido por canal, en córdobas.</p>
            {hayVentas ? (
              <div className="graf-caja"><Bar data={datosGrafico} options={opcionesEjes(modoOscuro, { apilado: true, moneda: true })} /></div>
            ) : (
              <EmptyState icono="bi-bar-chart" titulo="Todavía no hay ventas">Cuando registres la primera venta, aquí verás cómo se reparten entre piso y en línea.</EmptyState>
            )}
          </section>
        )}

        <section className={`panel ${config.mostrarGraficas ? 'col-5x' : 'col-12x'}`}>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h2 className="panel-titulo">Necesitan reposición</h2>
              <p className="panel-sub">Agotados primero, luego los que están bajo el mínimo.</p>
            </div>
            {pendientesRecepcion > 0 && tienePermiso('compras') && (
              <Link to="/compras" className="badge bg-warning">{pendientesRecepcion} por recibir</Link>
            )}
          </div>
          {alertas.length === 0 ? (
            <EmptyState icono="bi-check2-circle" titulo="Inventario en orden">No hay productos agotados ni por debajo del mínimo.</EmptyState>
          ) : (
            <ul className="list-unstyled mb-0 d-grid gap-3">
              {alertas.slice(0, 6).map((a) => (
                <li key={a.producto.id} className="d-flex align-items-center justify-content-between gap-3">
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="fw-semibold text-truncate">{a.producto.nombre}</div>
                    <StockMeter stock={a.stock} minimo={a.minimo} objetivo={objetivoDeProducto(a.producto)} compacto />
                  </div>
                  {tienePermiso('compras') && (
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => agregarPendiente(a.producto)} title="Agregar a pendientes de compra">
                      <i className="bi bi-cart-plus"></i>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel col-7x">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="panel-titulo mb-0">Últimas ventas</h2>
            {tienePermiso('ventas') && <Link to="/registrar-venta" className="btn btn-sm btn-outline-secondary">Ver historial</Link>}
          </div>
          {ventas.length === 0 ? (
            <EmptyState icono="bi-receipt" titulo="Sin ventas registradas" />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead><tr><th>Factura</th><th>Fecha</th><th>Canal</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {ventas.slice(0, 5).map((v) => (
                    <tr key={v.id}>
                      <td className="fw-semibold">{v.numeroFactura}</td>
                      <td>{fechaHora(v.fecha)}</td>
                      <td><span className={`badge ${v.canal === 'piso' ? 'bg-primary' : 'bg-info'}`}>{v.canal === 'piso' ? 'En piso' : 'En línea'}</span></td>
                      <td className="text-end fw-semibold">{moneda(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel col-5x">
          <h2 className="panel-titulo">Alta rotación</h2>
          <p className="panel-sub">Vendidos en los últimos {config.ventanaRotacionDias} días (mínimo {config.umbralAltaRotacion} unidades).</p>
          {altaRotacion.length === 0 ? (
            <EmptyState icono="bi-graph-up-arrow" titulo="Aún no hay productos de alta rotación" />
          ) : (
            <ul className="list-unstyled mb-0 d-grid gap-2">
              {altaRotacion.map((p) => (
                <li key={p.id} className="d-flex justify-content-between align-items-center">
                  <span className="fw-semibold">{p.nombre}</span>
                  <span className="badge bg-success">{unidadesRecientes(p.id)} uds.</span>
                </li>
              ))}
            </ul>
          )}
          {altaRotacion.length > 0 && <div className="texto-suave mt-3">Revisa su nivel de respaldo antes de temporadas altas como diciembre.</div>}
        </section>
      </div>
    </div>
  );
}
