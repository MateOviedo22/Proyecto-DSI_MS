// src/App.js
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

import Sidebar from './components/Sidebar';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import { DataProvider, useData } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useT } from './context/LanguageContext';

import Home from './pages/Home';
import Productos from './pages/Productos';
import RegistroProducto from './pages/RegistroProducto';
import Proveedores from './pages/Proveedores';
import Compras from './pages/Compras';
import IngresoInventario from './pages/IngresoInventario';
import Ventas from './pages/Ventas';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';
import Configuracion from './pages/Configuracion';
import Login from './pages/Login';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <LanguageProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </LanguageProvider>
      </ThemeProvider>
    </Router>
  );
}

function AppContent() {
  const { usuarioActual, cerrarSesion } = useData();
  const t = useT();
  const [sidebarAbierto, setSidebarAbierto] = useState(true);

  useEffect(() => {
    const sidebarState = localStorage.getItem('sidebarMotoMan');
    if (sidebarState !== null) setSidebarAbierto(sidebarState === 'true');
  }, []);

  const toggleSidebar = () => {
    const nuevoEstado = !sidebarAbierto;
    setSidebarAbierto(nuevoEstado);
    localStorage.setItem('sidebarMotoMan', nuevoEstado);
  };

  if (!usuarioActual) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="d-flex">
      <Sidebar isCollapsed={!sidebarAbierto} toggleSidebar={toggleSidebar} rolActual={usuarioActual.rol} />
      <div
        className="flex-grow-1"
        style={{
          marginLeft: sidebarAbierto ? '220px' : '60px',
          transition: 'margin-left 0.3s',
          minHeight: '100vh',
        }}
      >
        {/* Navbar superior */}
        <div className="p-3 border-bottom bg-body d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={toggleSidebar} title={sidebarAbierto ? 'Ocultar menú' : 'Mostrar menú'}>
              <i className="bi bi-list fs-5"></i>
            </button>
            <h4 className="mb-0">MotoMan</h4>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted small">{usuarioActual.nombreCompleto || usuarioActual.nombreUsuario} · {usuarioActual.rol}</span>
            <button className="btn btn-outline-danger btn-sm" onClick={cerrarSesion}>
              {t('cerrarSesion')}
            </button>
          </div>
        </div>

        {/* RUTAS del contenido privado */}
        <div className="p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/registrar-producto" element={<RegistroProducto />} />
            <Route path="/productos/editar/:id" element={<RegistroProducto />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/compras" element={<Compras />} />
            <Route path="/ingresar-inventario" element={<IngresoInventario />} />
            <Route path="/registrar-venta" element={<Ventas />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route
              path="/usuarios"
              element={usuarioActual.rol === 'Administrador' ? <Usuarios /> : <AccesoRestringido />}
            />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function AccesoRestringido() {
  const t = useT();
  return (
    <div className="alert alert-warning">
      <i className="bi bi-shield-lock me-2"></i>{t('accesoRestringido')}
    </div>
  );
}

export default App;
