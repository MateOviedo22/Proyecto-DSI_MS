// src/components/EmptyState.jsx
export default function EmptyState({ icono = 'bi-inbox', titulo, children }) {
  return (
    <div className="empty-state">
      <i className={`bi ${icono}`} aria-hidden="true"></i>
      <div className="empty-titulo">{titulo}</div>
      {children && <div className="empty-texto">{children}</div>}
    </div>
  );
}
