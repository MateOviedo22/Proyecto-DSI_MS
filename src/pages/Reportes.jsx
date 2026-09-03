// src/pages/Reportes.jsx
// Cubre: RF-39 (ventas), RF-40 (productos más vendidos), RF-41 (categorías/
// variantes más vendidas), RF-42 (ventas por canal), RF-43 (comparación de
// canales), RF-44 (costos y ganancias), RF-45 (inventario), RF-46
// (movimientos de inventario). Todos calculados sobre los datos reales
// del sistema (ventas, compras, inventario), ya no simulados.
import { useState, useMemo } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend,
} from 'chart.js';
import { useData } from '../context/DataContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const TIPOS = [
  { valor: 'ventas', label: 'Ventas' },
  { valor: 'productos_top', label: 'Productos más vendidos' },
  { valor: 'categorias_top', label: 'Categorías más vendidas' },
  { valor: 'canal', label: 'Ventas por canal' },
  { valor: 'costos_ganancias', label: 'Costos y ganancias' },
  { valor: 'inventario', label: 'Inventario actual' },
  { valor: 'movimientos', label: 'Movimientos de inventario' },
];

const COLORES = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#0dcaf0'];

export default function Reportes() {
  const { ventas, movimientos, productos, costoTotalDeProducto, stockDeProducto } = useData();
  const [tipo, setTipo] = useState('ventas');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const dentroDelRango = (fechaISO) => {
    const f = new Date(fechaISO);
    if (fechaInicio && f < new Date(fechaInicio)) return false;
    if (fechaFin && f > new Date(fechaFin + 'T23:59:59')) return false;
    return true;
  };

  const ventasFiltradas = useMemo(
    () => ventas.filter((v) => dentroDelRango(v.fecha)),
    [ventas, fechaInicio, fechaFin]
  );
  const movimientosFiltrados = useMemo(
    () => movimientos.filter((m) => dentroDelRango(m.fecha)),
    [movimientos, fechaInicio, fechaFin]
  );

  const productoNombre = (id) => productos.find((p) => p.id === id)?.nombre || '(producto eliminado)';

  return (
    <div className="container-fluid p-4">
      <h2 className="mb-3">Reportes</h2>

      <div className="row g-2 mb-4">
        <div className="col-md-4">
          <label className="form-label mb-0">Tipo de reporte</label>
          <select className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
          </select>
        </div>
        {tipo !== 'inventario' && (
          <>
            <div className="col-md-4">
              <label className="form-label mb-0">Desde</label>
              <input type="date" className="form-control" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label mb-0">Hasta</label>
              <input type="date" className="form-control" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {tipo === 'ventas' && <ReporteVentas ventas={ventasFiltradas} />}
      {tipo === 'productos_top' && <ReporteProductosTop ventas={ventasFiltradas} />}
      {tipo === 'categorias_top' && <ReporteCategoriasTop ventas={ventasFiltradas} productos={productos} />}
      {tipo === 'canal' && <ReporteCanal ventas={ventasFiltradas} />}
      {tipo === 'costos_ganancias' && <ReporteCostosGanancias ventas={ventasFiltradas} productos={productos} costoTotalDeProducto={costoTotalDeProducto} />}
      {tipo === 'inventario' && <ReporteInventario productos={productos} costoTotalDeProducto={costoTotalDeProducto} stockDeProducto={stockDeProducto} />}
      {tipo === 'movimientos' && <ReporteMovimientos movimientos={movimientosFiltrados} productoNombre={productoNombre} />}
    </div>
  );
}

function ReporteVentas({ ventas }) {
  if (ventas.length === 0) return <div className="text-muted">No hay ventas en el rango seleccionado.</div>;

  const porDia = {};
  ventas.forEach((v) => {
    const dia = new Date(v.fecha).toLocaleDateString('es-NI');
    porDia[dia] = (porDia[dia] || 0) + v.total;
  });
  const labels = Object.keys(porDia);
  const data = { labels, datasets: [{ label: 'Ventas (C$)', data: Object.values(porDia), backgroundColor: '#0d6efd' }] };
  const total = ventas.reduce((s, v) => s + v.total, 0);

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-md-4"><div className="card p-3 text-center"><div className="text-muted small">Ventas registradas</div><div className="fs-4 fw-bold">{ventas.length}</div></div></div>
        <div className="col-md-4"><div className="card p-3 text-center"><div className="text-muted small">Monto total</div><div className="fs-4 fw-bold">C$ {total.toFixed(2)}</div></div></div>
        <div className="col-md-4"><div className="card p-3 text-center"><div className="text-muted small">Venta promedio</div><div className="fs-4 fw-bold">C$ {(total / ventas.length).toFixed(2)}</div></div></div>
      </div>
      <div style={{ maxWidth: 700 }}><Bar data={data} /></div>
    </div>
  );
}

function ReporteProductosTop({ ventas }) {
  const cantidadPorProducto = {};
  ventas.forEach((v) => v.items.forEach((it) => {
    cantidadPorProducto[it.nombre] = (cantidadPorProducto[it.nombre] || 0) + Number(it.cantidad);
  }));
  const top = Object.entries(cantidadPorProducto).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length === 0) return <div className="text-muted">No hay ventas en el rango seleccionado.</div>;

  const data = {
    labels: top.map(([nombre]) => nombre),
    datasets: [{ label: 'Cantidad vendida', data: top.map(([, cant]) => cant), backgroundColor: COLORES }],
  };
  return <div style={{ maxWidth: 500 }}><Pie data={data} /></div>;
}

function ReporteCategoriasTop({ ventas, productos }) {
  const cantidadPorCategoria = {};
  ventas.forEach((v) => v.items.forEach((it) => {
    const prod = productos.find((p) => p.id === it.productoId);
    const cat = prod?.categoria || 'Sin categoría';
    cantidadPorCategoria[cat] = (cantidadPorCategoria[cat] || 0) + Number(it.cantidad);
  }));
  const entradas = Object.entries(cantidadPorCategoria).sort((a, b) => b[1] - a[1]);
  if (entradas.length === 0) return <div className="text-muted">No hay ventas en el rango seleccionado.</div>;

  const data = {
    labels: entradas.map(([cat]) => cat),
    datasets: [{ label: 'Unidades vendidas', data: entradas.map(([, c]) => c), backgroundColor: COLORES }],
  };
  return <div style={{ maxWidth: 600 }}><Bar data={data} /></div>;
}

function ReporteCanal({ ventas }) {
  const resumen = {
    piso: { monto: 0, cantidad: 0 },
    linea: { monto: 0, cantidad: 0 },
  };
  ventas.forEach((v) => {
    resumen[v.canal].monto += v.total;
    resumen[v.canal].cantidad += 1;
  });
  const totalMonto = resumen.piso.monto + resumen.linea.monto;

  const data = {
    labels: ['Venta en piso', 'Venta en línea'],
    datasets: [
      { label: 'Monto (C$)', data: [resumen.piso.monto, resumen.linea.monto], backgroundColor: '#0d6efd' },
    ],
  };

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <div className="card p-3">
            <div className="text-muted small">Venta en piso</div>
            <div className="fs-5 fw-bold">C$ {resumen.piso.monto.toFixed(2)} — {resumen.piso.cantidad} ventas</div>
            <div className="text-muted small">{totalMonto > 0 ? ((resumen.piso.monto / totalMonto) * 100).toFixed(1) : 0}% del total</div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3">
            <div className="text-muted small">Venta en línea</div>
            <div className="fs-5 fw-bold">C$ {resumen.linea.monto.toFixed(2)} — {resumen.linea.cantidad} ventas</div>
            <div className="text-muted small">{totalMonto > 0 ? ((resumen.linea.monto / totalMonto) * 100).toFixed(1) : 0}% del total</div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 500 }}><Bar data={data} /></div>
    </div>
  );
}

function ReporteCostosGanancias({ ventas, productos, costoTotalDeProducto }) {
  let ingresos = 0, costos = 0;
  ventas.forEach((v) => {
    ingresos += v.total;
    v.items.forEach((it) => {
      const prod = productos.find((p) => p.id === it.productoId);
      if (prod) costos += costoTotalDeProducto(prod) * Number(it.cantidad);
    });
  });
  const ganancia = ingresos - costos;
  const margen = costos > 0 ? (ganancia / costos) * 100 : null;

  return (
    <div className="row g-3">
      <div className="col-md-3"><div className="card p-3 text-center"><div className="text-muted small">Ingresos</div><div className="fs-5 fw-bold">C$ {ingresos.toFixed(2)}</div></div></div>
      <div className="col-md-3"><div className="card p-3 text-center"><div className="text-muted small">Costos</div><div className="fs-5 fw-bold">C$ {costos.toFixed(2)}</div></div></div>
      <div className="col-md-3"><div className="card p-3 text-center"><div className="text-muted small">Ganancia</div><div className={`fs-5 fw-bold ${ganancia >= 0 ? 'text-success' : 'text-danger'}`}>C$ {ganancia.toFixed(2)}</div></div></div>
      <div className="col-md-3"><div className="card p-3 text-center"><div className="text-muted small">Margen</div><div className="fs-5 fw-bold">{margen === null ? '—' : `${margen.toFixed(1)}%`}</div></div></div>
      <div className="col-12 text-muted small">
        Nota: el costo de cada venta se calcula con el costo actual del producto (costo de adquisición + envío). Si el costo cambió después de la venta, esta cifra es una aproximación.
      </div>
    </div>
  );
}

function ReporteInventario({ productos, costoTotalDeProducto, stockDeProducto }) {
  const activos = productos.filter((p) => p.activo !== false);
  const valorTotal = activos.reduce((sum, p) => sum + stockDeProducto(p) * costoTotalDeProducto(p), 0);

  return (
    <div>
      <div className="card p-3 mb-3" style={{ maxWidth: 320 }}>
        <div className="text-muted small">Valor total del inventario (a costo)</div>
        <div className="fs-5 fw-bold">C$ {valorTotal.toFixed(2)}</div>
      </div>
      <div className="table-responsive bg-white rounded shadow-sm">
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light"><tr><th>Producto</th><th>Categoría</th><th>Existencias</th><th>Costo total unit.</th><th>Valor en inventario</th></tr></thead>
          <tbody>
            {activos.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{p.categoria || '—'}</td>
                <td>{stockDeProducto(p)}</td>
                <td>C$ {costoTotalDeProducto(p).toFixed(2)}</td>
                <td>C$ {(stockDeProducto(p) * costoTotalDeProducto(p)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReporteMovimientos({ movimientos, productoNombre }) {
  if (movimientos.length === 0) return <div className="text-muted">No hay movimientos en el rango seleccionado.</div>;
  return (
    <div className="table-responsive bg-white rounded shadow-sm">
      <table className="table table-sm align-middle mb-0">
        <thead className="table-light"><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Motivo</th><th>Cantidad</th></tr></thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id}>
              <td>{new Date(m.fecha).toLocaleString('es-NI')}</td>
              <td>{productoNombre(m.productoId)}</td>
              <td><span className={`badge ${m.tipo === 'entrada' ? 'bg-success' : 'bg-danger'}`}>{m.tipo}</span></td>
              <td>{m.motivo}</td>
              <td>{m.cantidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
