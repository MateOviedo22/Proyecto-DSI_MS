// src/App.js
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { ThemeProvider } from './context/ThemeContext';
import { DataProvider, useData } from './context/DataContext';
import { UiProvider } from './context/UiContext';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import EmptyState from './components/EmptyState';

import Home from './pages/Home';
import Productos from './pages/Productos';
import RegistroProducto from './pages/RegistroProducto';
import Proveedores from './pages/Proveedores';
import Compras from './pages/Compras';
import IngresoInventario from './pages/IngresoInventario';
import RegistrarVenta from './pages/RegistrarVenta';
import GarantiasDevoluciones from './pages/GarantiasDevoluciones';
import GenerarReporte from './pages/GenerarReporte';
import Usuarios from './pages/Usuarios';
import Configuracion from './pages/Configuracion';
import Login from './pages/Login';

const TITULOS = {
  '/': 'Inicio',
  '/productos': 'Catálogo de productos',
  '/registrar-producto': 'Registrar producto',
  '/proveedores': 'Proveedores',
  '/compras': 'Compras y recepción',
  '/ingresar-inventario': 'Movimientos de inventario',
  '/registrar-venta': 'Ventas y facturación',
  '/garantias': 'Garantías y devoluciones',
  '/reportes': 'Reportes',
  '/usuarios': 'Usuarios y roles',
  '/configuracion': 'Configuración',
};

// Control de acceso por permisos (RNF "Control de acceso por usuario")
function Protegida({ modulo, children }) {
  const { tienePermiso } = useData();
  if (tienePermiso(modulo)) return children;
  return (
    <EmptyState icono="bi-lock" titulo="No tienes acceso a esta sección">
      Tu rol no incluye este módulo. Si lo necesitas, pide a un administrador que ajuste tus permisos.
    </EmptyState>
  );
}

function Aplicacion() {
  const { usuarioActual, cerrarSesion, cargandoSesion, cargandoDatos } = useData();
  const location = useLocation();
  const [colapsado, setColapsado] = useState(() => localStorage.getItem('motoman_sidebar') === 'colapsado');
  const [movilAbierto, setMovilAbierto] = useState(false);

  useEffect(() => {
    setMovilAbierto(false);
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const alternarMenu = () => {
    if (window.matchMedia('(max-width: 991.98px)').matches) {
      setMovilAbierto((v) => !v);
    } else {
      setColapsado((v) => {
        localStorage.setItem('motoman_sidebar', v ? 'abierto' : 'colapsado');
        return !v;
      });
    }
  };

  // Mientras se valida el token guardado no se muestra el login (evita un parpadeo al recargar).
  if (cargandoSesion) {
    return <div className="pantalla-carga" role="status" aria-live="polite"><div className="spinner-border text-primary" aria-hidden="true"></div><span>Cargando…</span></div>;
  }

  if (!usuarioActual) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const titulo = TITULOS[location.pathname] || (location.pathname.startsWith('/productos/editar') ? 'Editar producto' : 'MotoMan');

  return (
    <div className={`app-shell ${colapsado ? 'sidebar-colapsado' : ''}`}>
      <Sidebar colapsado={colapsado} movilAbierto={movilAbierto} onCerrarMovil={() => setMovilAbierto(false)} onAlternar={alternarMenu} />
      <div className="app-columna">
        <Topbar onMenu={alternarMenu} onCerrarSesion={cerrarSesion} titulo={titulo} />
        {cargandoDatos && <div className="barra-carga" role="progressbar" aria-label="Cargando datos del servidor"></div>}
        <main className="app-main" id="contenido">
          <Routes>
            <Route path="/" element={<Protegida modulo="inicio"><Home /></Protegida>} />
            <Route path="/productos" element={<Protegida modulo="productos"><Productos /></Protegida>} />
            <Route path="/registrar-producto" element={<Protegida modulo="productos_gestion"><RegistroProducto /></Protegida>} />
            <Route path="/productos/editar/:id" element={<Protegida modulo="productos_gestion"><RegistroProducto /></Protegida>} />
            <Route path="/proveedores" element={<Protegida modulo="proveedores"><Proveedores /></Protegida>} />
            <Route path="/compras" element={<Protegida modulo="compras"><Compras /></Protegida>} />
            <Route path="/ingresar-inventario" element={<Protegida modulo="inventario"><IngresoInventario /></Protegida>} />
            <Route path="/registrar-venta" element={<Protegida modulo="ventas"><RegistrarVenta /></Protegida>} />
            <Route path="/garantias" element={<Protegida modulo="garantias"><GarantiasDevoluciones /></Protegida>} />
            <Route path="/reportes" element={<Protegida modulo="reportes"><GenerarReporte /></Protegida>} />
            <Route path="/usuarios" element={<Protegida modulo="usuarios"><Usuarios /></Protegida>} />
            <Route path="/configuracion" element={<Protegida modulo="configuracion"><Configuracion /></Protegida>} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <UiProvider>
          <Router>
            <a href="#contenido" className="saltar-contenido">Saltar al contenido</a>
            <Aplicacion />
          </Router>
        </UiProvider>
      </DataProvider>
    </ThemeProvider>
  );
}