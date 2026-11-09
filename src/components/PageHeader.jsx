// src/components/PageHeader.jsx
export default function PageHeader({ titulo, descripcion, children }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{titulo}</h1>
        {descripcion && <p className="page-desc">{descripcion}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}
