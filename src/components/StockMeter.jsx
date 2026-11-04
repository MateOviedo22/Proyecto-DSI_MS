// src/components/StockMeter.jsx
// Medidor de existencias: muestra el stock actual frente al mínimo (marca) y al nivel objetivo.
// Es el indicador visual del estado del inventario (RNF "Visibilidad del estado del inventario").
export default function StockMeter({ stock, minimo, objetivo, compacto = false }) {
  const tope = Math.max(objetivo || 0, minimo * 2, stock, 1);
  const pct = Math.min(100, (stock / tope) * 100);
  const marca = Math.min(100, (minimo / tope) * 100);
  const estado = stock === 0 ? 'agotado' : stock <= minimo ? 'bajo' : 'ok';
  const texto = stock === 0 ? 'Agotado' : stock <= minimo ? 'Stock bajo' : 'Disponible';

  return (
    <div className={`stock-meter ${compacto ? 'compacto' : ''}`} title={`${stock} en existencia · mínimo ${minimo}${objetivo ? ` · objetivo ${objetivo}` : ''}`}>
      <div className="stock-meter-num">
        <strong>{stock}</strong>
        {!compacto && <span className={`stock-meter-estado est-${estado}`}>{texto}</span>}
      </div>
      <div className="stock-meter-barra" role="img" aria-label={`${texto}: ${stock} unidades, mínimo ${minimo}`}>
        <div className={`stock-meter-relleno est-${estado}`} style={{ width: `${pct}%` }}></div>
        <div className="stock-meter-marca" style={{ left: `${marca}%` }}></div>
      </div>
    </div>
  );
}
