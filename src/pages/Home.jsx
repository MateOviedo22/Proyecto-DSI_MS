import { Link } from 'react-router-dom';
import InfoCard from '../components/InfoCard';
import { useData } from '../context/DataContext';
import { useT } from '../context/LanguageContext';

export default function Home() {
  const { productos, productosBajoStock, productosAgotados, stockDeProducto, usuarioActual, ventas } = useData();
  const t = useT();

  const activos = productos.filter((p) => p.activo !== false);
  const unidadesTotales = activos.reduce((sum, p) => sum + stockDeProducto(p), 0);

  const hoy = new Date().toDateString();
  const ventasHoy = ventas.filter((v) => new Date(v.fecha).toDateString() === hoy);
  const totalVentasHoy = ventasHoy.reduce((sum, v) => sum + v.total, 0);

  return (
    <div className="container-fluid p-4">
      {/* Bienvenida */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap">
        <h3 className="mb-0">{t('bienvenido')}, {usuarioActual?.nombreCompleto || usuarioActual?.nombreUsuario}</h3>
        <span className="text-muted fs-6">Panel de control - MotoMan</span>
      </div>

      {/* Métricas generales */}
      <section aria-label="Estadísticas del sistema">
        <div className="row g-3 mb-4">
          <div className="col-md-4 col-lg-3">
            <InfoCard title="Productos activos" value={activos.length} icon="bi-box-seam" />
          </div>
          <div className="col-md-4 col-lg-3">
            <InfoCard title="Unidades totales en inventario" value={unidadesTotales} icon="bi-boxes" />
          </div>
          <div className="col-md-4 col-lg-3">
            <InfoCard title="Productos bajo stock mínimo" value={productosBajoStock.length} icon="bi-exclamation-triangle" />
          </div>
          <div className="col-md-4 col-lg-3">
            <InfoCard title="Productos agotados" value={productosAgotados.length} icon="bi-bell-fill" />
          </div>
          <div className="col-md-4 col-lg-3">
            <InfoCard title="Ventas del día" value={`C$ ${totalVentasHoy.toFixed(2)}`} icon="bi-cash-stack" />
          </div>
          <div className="col-md-4 col-lg-3">
            <InfoCard title="Ventas del día (cantidad)" value={ventasHoy.length} icon="bi-receipt" />
          </div>
        </div>
      </section>

      {/* Acciones rápidas */}
      <section aria-label="Acciones rápidas">
        <div className="d-flex flex-wrap gap-2">
          <Link to="/productos" className="btn btn-outline-primary">
            <i className="bi bi-box-seam me-2"></i>Ver catálogo
          </Link>
          <Link to="/registrar-producto" className="btn btn-primary">
            <i className="bi bi-plus-lg me-2"></i>Registrar producto
          </Link>
          <Link to="/registrar-venta" className="btn btn-success">
            <i className="bi bi-receipt me-2"></i>Registrar venta
          </Link>
          <Link to="/ingresar-inventario" className="btn btn-success">
            <i className="bi bi-box-arrow-in-down me-2"></i>Movimiento de inventario
          </Link>
          <Link to="/proveedores" className="btn btn-outline-secondary">
            <i className="bi bi-truck me-2"></i>Proveedores
          </Link>
          <Link to="/reportes" className="btn btn-info">
            <i className="bi bi-bar-chart-line me-2"></i>Ver reportes
          </Link>
        </div>
      </section>
    </div>
  );
}
