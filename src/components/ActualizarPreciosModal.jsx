// src/components/ActualizarPreciosModal.jsx
// Cubre: RF-22 (margen), RF-23 (redondeo) y RNF "Simplicidad en la actualización de precios".
// La vista previa y la aplicación las calcula el servidor: así el redondeo y el margen son los mismos
// en toda la aplicación, y el cambio queda registrado en el historial de precios.
import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import { REGLAS_REDONDEO, moneda, porcentaje } from '../utils/formato';

export default function ActualizarPreciosModal({ abierto, onCerrar, seleccionados }) {
  const { categoriasExistentes, previsualizarPrecios, aplicarPreciosMasivo, productos, config } = useData();
  const { notificar } = useUi();

  const [alcance, setAlcance] = useState(seleccionados.length > 0 ? 'seleccion' : 'todos');
  const [categoria, setCategoria] = useState('');
  const [modo, setModo] = useState('porcentaje'); // porcentaje | margen
  const [direccion, setDireccion] = useState('subir');
  const [valor, setValor] = useState('');
  const [regla, setRegla] = useState(config.reglaRedondeo || '0');
  const [vista, setVista] = useState([]);
  const [errorVista, setErrorVista] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const secuencia = useRef(0);

  const categoriaId = productos.find((p) => p.categoria === categoria)?.categoriaId;
  const listoParaCalcular = Number(valor) > 0 && (alcance !== 'categoria' || categoriaId) && (alcance !== 'seleccion' || seleccionados.length > 0);

  const parametros = () => ({
    modo,
    valor: Number(valor),
    direccion,
    redondeo: Number(regla),
    ...(alcance === 'seleccion' ? { producto_ids: seleccionados.map(Number) } : alcance === 'categoria' ? { categoria_id: categoriaId } : { todos: true }),
  });

  // Cada cambio de parámetros pide una vista previa al servidor (sin modificar nada).
  useEffect(() => {
    if (!abierto || !listoParaCalcular) {
      setVista([]);
      setErrorVista('');
      return undefined;
    }
    const mia = ++secuencia.current;
    const temporizador = setTimeout(async () => {
      const res = await previsualizarPrecios(parametros());
      if (mia !== secuencia.current) return; // llegó una respuesta más nueva
      if (res.ok) { setVista(res.datos.cambios); setErrorVista(''); } else { setVista([]); setErrorVista(res.error); }
    }, 300);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line
  }, [abierto, alcance, categoria, modo, direccion, valor, regla, seleccionados]);

  const aplicar = async () => {
    setAplicando(true);
    const res = await aplicarPreciosMasivo(parametros());
    setAplicando(false);
    if (!res.ok) return setErrorVista(res.error);
    const cambiados = res.datos.cambios.filter((c) => c.precio_anterior !== c.precio_nuevo).length;
    notificar(`Precios actualizados en ${cambiados} producto(s).`);
    setValor('');
    onCerrar();
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Actualizar precios"
      tamano="lg"
      pie={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!listoParaCalcular || vista.length === 0 || aplicando} onClick={aplicar}>
            {aplicando ? 'Aplicando…' : `Aplicar a ${vista.length} producto(s)`}
          </button>
        </>
      }
    >
      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor="ap-alcance">Aplicar a</label>
          <select id="ap-alcance" className="form-select" value={alcance} onChange={(e) => setAlcance(e.target.value)}>
            <option value="seleccion" disabled={seleccionados.length === 0}>Productos seleccionados ({seleccionados.length})</option>
            <option value="categoria">Una categoría</option>
            <option value="todos">Todos los productos activos</option>
          </select>
        </div>
        {alcance === 'categoria' && (
          <div className="col-md-6">
            <label htmlFor="ap-cat">Categoría</label>
            <select id="ap-cat" className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Elige una categoría</option>
              {categoriasExistentes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        <div className="col-12">
          <div className="seg">
            <button type="button" className={modo === 'porcentaje' ? 'activo' : ''} onClick={() => setModo('porcentaje')}>Cambiar por porcentaje</button>
            <button type="button" className={modo === 'margen' ? 'activo' : ''} onClick={() => setModo('margen')}>Fijar margen sobre el costo</button>
          </div>
        </div>

        {modo === 'porcentaje' && (
          <div className="col-md-4">
            <label htmlFor="ap-dir">Tipo de cambio</label>
            <select id="ap-dir" className="form-select" value={direccion} onChange={(e) => setDireccion(e.target.value)}>
              <option value="subir">Aumentar</option>
              <option value="bajar">Disminuir</option>
            </select>
          </div>
        )}
        <div className="col-md-4">
          <label htmlFor="ap-valor">{modo === 'porcentaje' ? 'Porcentaje (%)' : 'Margen deseado (%)'}</label>
          <input id="ap-valor" type="number" min="0" step="0.5" className="form-control" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej. 10" />
        </div>
        <div className="col-md-4">
          <label htmlFor="ap-regla">Redondeo del precio</label>
          <select id="ap-regla" className="form-select" value={regla} onChange={(e) => setRegla(e.target.value)}>
            {REGLAS_REDONDEO.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
          </select>
        </div>
      </div>

      <h6 className="mt-4 mb-2">Vista previa</h6>
      {errorVista && <div className="alert alert-warning" role="alert">{errorVista}</div>}
      {!listoParaCalcular ? (
        <div className="texto-suave">Indica el alcance y el valor para ver cómo quedarían los precios.</div>
      ) : vista.length > 0 ? (
        <div className="table-responsive border" style={{ maxHeight: 280 }}>
          <table className="table table-sm mb-0">
            <thead><tr><th>Producto</th><th className="text-end">Precio actual</th><th className="text-end">Precio nuevo</th><th className="text-end">Margen</th></tr></thead>
            <tbody>
              {vista.map((f) => (
                <tr key={f.producto_id}>
                  <td>{f.nombre}</td>
                  <td className="text-end">{moneda(f.precio_anterior)}</td>
                  <td className={`text-end fw-semibold ${Number(f.precio_nuevo) > Number(f.precio_anterior) ? 'est-ok' : Number(f.precio_nuevo) < Number(f.precio_anterior) ? 'est-agotado' : ''}`}>{moneda(f.precio_nuevo)}</td>
                  <td className="text-end">{f.margen_resultante === null ? '—' : porcentaje(Number(f.margen_resultante))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Modal>
  );
}
