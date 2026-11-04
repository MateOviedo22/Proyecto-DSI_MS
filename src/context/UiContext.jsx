// src/context/UiContext.jsx
// Avisos (toasts) y diálogos de confirmación reutilizables. Sustituyen a alert() y confirm().
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import Modal from '../components/Modal';

const UiContext = createContext(null);

const ICONOS = { ok: 'bi-check-circle-fill', error: 'bi-exclamation-octagon-fill', aviso: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialogo, setDialogo] = useState(null);
  const contador = useRef(0);

  const notificar = useCallback((mensaje, tipo = 'ok') => {
    contador.current += 1;
    const id = contador.current;
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  // confirmar({ titulo, mensaje, confirmarTexto, peligro }) -> Promise<boolean>
  const confirmar = useCallback(
    (opciones) => new Promise((resolve) => setDialogo({ ...opciones, resolve })),
    []
  );

  const cerrarDialogo = (resultado) => {
    dialogo?.resolve(resultado);
    setDialogo(null);
  };

  return (
    <UiContext.Provider value={{ notificar, confirmar }}>
      {children}

      <div className="mm-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`mm-toast mm-toast-${t.tipo}`}>
            <i className={`bi ${ICONOS[t.tipo] || ICONOS.info}`} aria-hidden="true"></i>
            <span>{t.mensaje}</span>
            <button type="button" className="mm-toast-cerrar" aria-label="Cerrar aviso" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        ))}
      </div>

      <Modal
        abierto={Boolean(dialogo)}
        onCerrar={() => cerrarDialogo(false)}
        titulo={dialogo?.titulo || 'Confirmar acción'}
        tamano="sm"
        pie={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => cerrarDialogo(false)}>
              Cancelar
            </button>
            <button type="button" className={`btn ${dialogo?.peligro ? 'btn-danger' : 'btn-primary'}`} onClick={() => cerrarDialogo(true)}>
              {dialogo?.confirmarTexto || 'Confirmar'}
            </button>
          </>
        }
      >
        <p className="mb-0">{dialogo?.mensaje}</p>
      </Modal>
    </UiContext.Provider>
  );
}

export const useUi = () => useContext(UiContext);
