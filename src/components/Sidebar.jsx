import { Link, useLocation } from 'react-router-dom';
import { useT } from '../context/LanguageContext';
import './Sidebar.css';

export default function Sidebar({ isCollapsed, toggleSidebar, rolActual }) {
  const location = useLocation();
  const t = useT();

  const navItems = [
    { label: t('inicio'), path: '/', icon: 'bi-house-door-fill' },
    { label: t('catalogoProductos'), path: '/productos', icon: 'bi-box-seam' },
    { label: t('proveedores'), path: '/proveedores', icon: 'bi-truck' },
    { label: t('comprasRecepcion'), path: '/compras', icon: 'bi-bag-check' },
    { label: t('movimientosInventario'), path: '/ingresar-inventario', icon: 'bi-box-arrow-in-down' },
    { label: t('ventasFacturacion'), path: '/registrar-venta', icon: 'bi-receipt' },
    { label: t('reportes'), path: '/reportes', icon: 'bi-bar-chart-line-fill' },
    // Solo el rol Administrador ve la gestión de usuarios (RNF-13, control de acceso).
    ...(rolActual === 'Administrador' ? [{ label: t('usuariosRoles'), path: '/usuarios', icon: 'bi-people-fill' }] : []),
    { label: t('configuracion'), path: '/configuracion', icon: 'bi-gear-fill' },
  ];

  return (
    <div
      className="bg-body-tertiary vh-100 border-end shadow-sm transition-all"
      style={{
        width: isCollapsed ? '60px' : '220px',
        position: 'fixed',
        overflowX: 'hidden',
        transition: 'width 0.3s ease',
      }}
    >

      <ul className="nav flex-column p-3">
        {navItems.map((item, index) => (
          <li className="nav-item mb-2" key={index}>
            <Link
              to={item.path}
              className={`nav-link d-flex align-items-center ${
                location.pathname === item.path
                  ? 'active text-primary fw-bold'
                  : ''
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <i className={`bi ${item.icon} me-2 fs-5`}></i>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
