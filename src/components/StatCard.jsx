// src/components/StatCard.jsx
// Indicador numérico del panel. `tono`: primary | ok | warn | danger | info
export default function StatCard({ titulo, valor, detalle, icono, tono = 'primary', onClick }) {
  const Etiqueta = onClick ? 'button' : 'div';
  return (
    <Etiqueta type={onClick ? 'button' : undefined} className={`stat-card stat-${tono} ${onClick ? 'stat-click' : ''}`} onClick={onClick}>
      <span className="stat-icono" aria-hidden="true">
        <i className={`bi ${icono}`}></i>
      </span>
      <span className="stat-cuerpo">
        <span className="stat-titulo">{titulo}</span>
        <span className="stat-valor">{valor}</span>
        {detalle && <span className="stat-detalle">{detalle}</span>}
      </span>
    </Etiqueta>
  );
}
