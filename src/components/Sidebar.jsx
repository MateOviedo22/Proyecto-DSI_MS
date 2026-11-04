// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Marca from './Marca';

const GRUPOS = [
  { titulo: null, items: [{ label: 'Inicio', path: '/', icon: 'bi-grid-1x2-fill', modulo: 'inicio', fin: true }] },
  {
    titulo: 'Inventario',
    items: [
      { label: 'Catálogo de productos', path: '/productos', icon: 'bi-box-seam', modulo: 'productos' },
      { label: 'Movimientos', path: '/ingresar-inventario', icon: 'bi-arrow-left-right', modulo: 'inventario' },
      { label: 'Proveedores', path: '/proveedores', icon: 'bi-truck', modulo: 'proveedores' },
      { label: 'Compras y recepción', path: '/compras', icon: 'bi-bag-check', modulo: 'compras' },
    ],
  },
  {
    titulo: 'Comercial',
    items: [
      { label: 'Ventas y facturación', path: '/registrar-venta', icon: 'bi-receipt', modulo: 'ventas' },
      { label: 'Garantías y devoluciones', path: '/garantias', icon: 'bi-shield-check', modulo: 'garantias' },
    ],
  },
  { titulo: 'Análisis', items: [{ label: 'Reportes', path: '/reportes', icon: 'bi-bar-chart-line', modulo: 'reportes' }] },
  {
    titulo: 'Administración',
    items: [
      { label: 'Usuarios y roles', path: '/usuarios', icon: 'bi-people', modulo: 'usuarios' },
      { label: 'Configuración', path: '/configuracion', icon: 'bi-gear', modulo: 'configuracion' },
    ],
  },
];

export default function Sidebar({ colapsado, movilAbierto, onCerrarMovil }) {
  const { tienePermiso, config } = useData();

  return (
    <>
      {movilAbierto && <div className="sidebar-velo" onClick={onCerrarMovil} aria-hidden="true"></div>}
      <aside className={`sidebar ${colapsado ? 'es-colapsado' : ''} ${movilAbierto ? 'es-movil-abierto' : ''}`} aria-label="Navegación principal">
        <div className="sidebar-marca">
          <Marca />
          <div className="sidebar-marca-texto">
            <strong>{config.nombreEmpresa || 'MotoMan'}</strong>
            <span>Inventario y ventas</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {GRUPOS.map((grupo, gi) => {
            const visibles = grupo.items.filter((i) => tienePermiso(i.modulo));
            if (visibles.length === 0) return null;
            return (
              <div className="sidebar-grupo" key={gi}>
                {grupo.titulo && <div className="sidebar-grupo-titulo">{grupo.titulo}</div>}
                {visibles.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.fin}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'activo' : ''}`}
                    title={colapsado ? item.label : undefined}
                    onClick={onCerrarMovil}
                  >
                    <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
