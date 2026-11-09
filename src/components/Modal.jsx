// src/components/Modal.jsx
// Modal accesible sin depender del JavaScript de Bootstrap: cierra con Esc o clic fuera.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ abierto, onCerrar, titulo, children, pie, tamano = 'md', claseExtra = '' }) {
  const dialogoRef = useRef(null);
  // onCerrar suele ser una función nueva en cada render del padre. Si fuera dependencia del efecto,
  // el modal volvería a tomar el foco con cada tecla escrita y los campos solo aceptarían un carácter.
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return undefined;
    const previo = document.activeElement;
    const alTeclear = (e) => e.key === 'Escape' && cerrarRef.current();
    document.addEventListener('keydown', alTeclear);
    document.body.classList.add('mm-modal-abierto');
    // Foco inicial: el primer campo con autoFocus si existe; si no, el propio diálogo.
    if (!dialogoRef.current?.contains(document.activeElement)) dialogoRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.classList.remove('mm-modal-abierto');
      previo?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;

  const ancho = { sm: 440, md: 600, lg: 820, xl: 1040 }[tamano] || 600;

  return createPortal(
    <div className="mm-modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        className={`mm-modal ${claseExtra}`}
        style={{ maxWidth: ancho }}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={dialogoRef}
      >
        <div className="mm-modal-cabecera">
          <h5 className="mb-0">{titulo}</h5>
          <button type="button" className="btn-icono" onClick={onCerrar} aria-label="Cerrar">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="mm-modal-cuerpo">{children}</div>
        {pie && <div className="mm-modal-pie">{pie}</div>}
      </div>
    </div>,
    document.body
  );
}
