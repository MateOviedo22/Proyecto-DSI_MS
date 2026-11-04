// src/components/Topbar.jsx
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import AlertasPanel from './AlertasPanel';

const iniciales = (nombre = '') =>
  nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

export default function Topbar({ onMenu, onCerrarSesion, titulo }) {
  const { modoOscuro, alternarTema } = useTheme();
  const { usuarioActual } = useData();
  const nombre = usuarioActual?.nombreCompleto || usuarioActual?.nombreUsuario || '';

  return (
    <header className="topbar">
      <div className="topbar-izq">
        <button type="button" className="btn-icono" onClick={onMenu} aria-label="Mostrar u ocultar menú">
          <i className="bi bi-list"></i>
        </button>
        <span className="topbar-titulo">{titulo}</span>
      </div>

      <div className="topbar-der">
        <AlertasPanel />
        <button type="button" className="btn-icono" onClick={alternarTema} aria-label={modoOscuro ? 'Usar tema claro' : 'Usar tema oscuro'} title={modoOscuro ? 'Tema claro' : 'Tema oscuro'}>
          <i className={`bi ${modoOscuro ? 'bi-sun' : 'bi-moon-stars'}`}></i>
        </button>
        <div className="topbar-usuario">
          <span className="avatar" aria-hidden="true">{iniciales(nombre)}</span>
          <span className="topbar-usuario-texto">
            <strong>{nombre}</strong>
            <small>{usuarioActual?.rol}</small>
          </span>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm topbar-salir" onClick={onCerrarSesion}>
          <i className="bi bi-box-arrow-right"></i>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}
