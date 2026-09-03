// src/pages/IngresoInventario.jsx
// Cubre: RF-5 (actualización automática de existencias), RF-6 (entradas),
// RF-7 (salidas por ajuste/pérdida/devolución — las salidas por venta se
// registran automáticamente desde el módulo de Ventas), vista previa de RF-46
// (movimientos recientes).
import { useState } from 'react';
import { useData } from '../context/DataContext';

const MOTIVOS_ENTRADA = [
  { valor: 'compra', label: 'Recepción de compra' },
  { valor: 'devolucion_cliente', label: 'Devolución de cliente' },
  { valor: 'ajuste', label: 'Ajuste de inventario' },
];

const MOTIVOS_SALIDA = [
  { valor: 'perdida', label: 'Pérdida o daño' },
  { valor: 'devolucion_proveedor', label: 'Devolución a proveedor' },
  { valor: 'ajuste', label: 'Ajuste de inventario' },
];

export default function IngresoInventario() {
  const { productos, movimientos, registrarMovimiento } = useData();

  const [productoId, setProductoId] = useState('');
  const [varianteId, setVarianteId] = useState('');
  const [tipo, setTipo] = useState('entrada');
  const [motivo, setMotivo] = useState(MOTIVOS_ENTRADA[0].valor);
  const [cantidad, setCantidad] = useState('');
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const productosActivos = productos.filter((p) => p.activo !== false);
  const productoSeleccionado = productosActivos.find((p) => p.id === productoId);
  const tieneVariantes = productoSeleccionado?.variantes?.length > 0;

  const cambiarTipo = (nuevoTipo) => {
    setTipo(nuevoTipo);
    setMotivo(nuevoTipo === 'entrada' ? MOTIVOS_ENTRADA[0].valor : MOTIVOS_SALIDA[0].valor);
  };

  const manejarEnvio = (e) => {
    e.preventDefault();
    if (!productoId || !cantidad) {
      setError('Selecciona un producto y una cantidad.');
      setExito('');
      return;
    }
    if (tieneVariantes && !varianteId) {
      setError('Este producto tiene variantes: selecciona cuál.');
      setExito('');
      return;
    }
    if (Number(cantidad) <= 0) {
      setError('La cantidad debe ser mayor que cero.');
      setExito('');
      return;
    }

    const res = registrarMovimiento({
      productoId,
      varianteId: tieneVariantes ? varianteId : null,
      tipo,
      motivo,
      cantidad,
      comentario,
    });

    if (!res.ok) {
      setError(res.error);
      setExito('');
      return;
    }

    setError('');
    setExito('Movimiento registrado y stock actualizado.');
    setCantidad('');
    setComentario('');
  };

  const nombreProducto = (id) => productos.find((p) => p.id === id)?.nombre || '(producto eliminado)';
  const nombreVariante = (prodId, varId) => {
    if (!varId) return '';
    const prod = productos.find((p) => p.id === prodId);
    const v = prod?.variantes?.find((v) => v.id === varId);
    return v ? ` — ${v.tipo}: ${v.valor}` : '';
  };

  return (
    <div className="container p-4">
      <h2>Movimientos de Inventario</h2>

      <form onSubmit={manejarEnvio} className="row g-3 bg-light p-4 rounded shadow-sm mb-4">
        <div className="col-md-4">
          <label>Tipo de movimiento</label>
          <div className="btn-group d-flex" role="group">
            <button
              type="button"
              className={`btn ${tipo === 'entrada' ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => cambiarTipo('entrada')}
            >
              Entrada
            </button>
            <button
              type="button"
              className={`btn ${tipo === 'salida' ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => cambiarTipo('salida')}
            >
              Salida
            </button>
          </div>
        </div>

        <div className="col-md-4">
          <label>Producto</label>
          <select
            className="form-select"
            value={productoId}
            onChange={(e) => { setProductoId(e.target.value); setVarianteId(''); }}
          >
            <option value="">-- Seleccionar producto --</option>
            {productosActivos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        {tieneVariantes && (
          <div className="col-md-4">
            <label>Variante</label>
            <select className="form-select" value={varianteId} onChange={(e) => setVarianteId(e.target.value)}>
              <option value="">-- Seleccionar variante --</option>
              {productoSeleccionado.variantes.map((v) => (
                <option key={v.id} value={v.id}>{v.tipo}: {v.valor} (stock: {v.stockActual})</option>
              ))}
            </select>
          </div>
        )}

        <div className="col-md-4">
          <label>Motivo</label>
          <select className="form-select" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {(tipo === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA).map((m) => (
              <option key={m.valor} value={m.valor}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <label>Cantidad</label>
          <input type="number" className="form-control" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </div>
        <div className="col-md-5">
          <label>Comentario (opcional)</label>
          <input className="form-control" value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </div>

        {error && <div className="alert alert-danger mb-0">{error}</div>}
        {exito && <div className="alert alert-success mb-0">{exito}</div>}

        <div className="col-12 text-end">
          <button className="btn btn-success">Registrar movimiento</button>
        </div>
      </form>

      <h5>Movimientos recientes</h5>
      <div className="table-responsive bg-white rounded shadow-sm">
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light">
            <tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Motivo</th><th>Cantidad</th><th>Comentario</th></tr>
          </thead>
          <tbody>
            {movimientos.slice(0, 10).map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.fecha).toLocaleString('es-NI')}</td>
                <td>{nombreProducto(m.productoId)}{nombreVariante(m.productoId, m.varianteId)}</td>
                <td>
                  <span className={`badge ${m.tipo === 'entrada' ? 'bg-success' : 'bg-danger'}`}>
                    {m.tipo}
                  </span>
                </td>
                <td>{m.motivo}</td>
                <td>{m.cantidad}</td>
                <td className="text-muted">{m.comentario}</td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted py-3">Sin movimientos registrados todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
