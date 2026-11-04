// src/components/AlertasPanel.jsx
// Campana de alertas de inventario (RF-8, RF-9): productos agotados y con stock bajo.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

export default function AlertasPanel() {
  const { alertas, tienePermiso } = useData();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => ref.current && !ref.current.contains(e.target) && setAbierto(false);
    const esc = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  if (!tienePermiso('productos')) return null;
  const agotados = alertas.filter((a) => a.tipo === 'agotado').length;

  return (
    <div className="alertas" ref={ref}>
      <button type="button" className="btn-icono" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-label={`Alertas de inventario: ${alertas.length}`} title="Alertas de inventario">
        <i className="bi bi-bell"></i>
        {alertas.length > 0 && <span className={`alertas-contador ${agotados ? 'critico' : ''}`}>{alertas.length}</span>}
      </button>

      {abierto && (
        <div className="alertas-panel" role="dialog" aria-label="Alertas de inventario">
          <div className="alertas-cabecera">
            <strong>Alertas de inventario</strong>
            <span className="texto-suave">{alertas.length === 0 ? 'Todo en orden' : `${alertas.length} producto(s)`}</span>
          </div>
          {alertas.length === 0 ? (
            <div className="alertas-vacio">
              <i className="bi bi-check2-circle"></i>
              No hay productos agotados ni por debajo del mínimo.
            </div>
          ) : (
            <ul className="alertas-lista">
              {alertas.slice(0, 7).map((a) => (
                <li key={a.producto.id}>
                  <span className={`punto punto-${a.tipo === 'agotado' ? 'danger' : 'warn'}`}></span>
                  <div>
                    <div className="alertas-nombre">{a.producto.nombre}</div>
                    <div className="texto-suave">
                      {a.tipo === 'agotado' ? 'Agotado' : `${a.stock} en existencia`} · mínimo {a.minimo}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {alertas.length > 7 && <div className="alertas-mas">y {alertas.length - 7} más…</div>}
          <button
            type="button"
            className="btn btn-sm btn-outline-primary w-100 mt-2"
            onClick={() => {
              setAbierto(false);
              navigate('/productos?filtro=alertas');
            }}
          >
            Ver en el catálogo
          </button>
        </div>
      )}
    </div>
  );
}
