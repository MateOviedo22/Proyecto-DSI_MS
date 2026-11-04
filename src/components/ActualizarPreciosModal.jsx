// src/components/ActualizarPreciosModal.jsx
// Cubre: RF-22 (margen), RF-23 (redondeo) y RNF "Simplicidad en la actualización de precios":
// permite cambiar precios por porcentaje o por margen objetivo, con vista previa y redondeo.
import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import { REGLAS_REDONDEO, redondear, moneda, porcentaje } from '../utils/formato';

export default function ActualizarPreciosModal({ abierto, onCerrar, seleccionados }) {
  const { productos, categoriasExistentes, actualizarPrecios, costoTotalDeProducto, config } = useData();
  const { notificar } = useUi();

  const [alcance, setAlcance] = useState(seleccionados.length > 0 ? 'seleccion' : 'todos');
  const [categoria, setCategoria] = useState('');
  const [modo, setModo] = useState('porcentaje'); // porcentaje | margen
  const [direccion, setDireccion] = useState('subir');
  const [valor, setValor] = useState('');
  const [regla, setRegla] = useState(config.reglaRedondeo || '0');

  const activos = productos.filter((p) => p.activo !== false);
  const afectados = useMemo(() => {
    if (alcance === 'seleccion') return activos.filter((p) => seleccionados.includes(p.id));
    if (alcance === 'categoria') return activos.filter((p) => p.categoria === categoria);
    return activos;
  }, [alcance, categoria, activos, seleccionados]);

  const v = Number(valor);
  const valido = valor !== '' && v > 0 && afectados.length > 0 && (alcance !== 'categoria' || categoria);

  const vista = afectados.map((p) => {
    let nuevo = Number(p.precio);
    if (valido) {
      if (modo === 'porcentaje') nuevo = Number(p.precio) * (1 + (direccion === 'subir' ? v : -v) / 100);
      else nuevo = costoTotalDeProducto(p) * (1 + v / 100);
      nuevo = Math.max(1, redondear(nuevo, regla));
    }
    const costo = costoTotalDeProducto(p);
    return { p, antes: Number(p.precio), nuevo, margen: costo ? ((nuevo - costo) / costo) * 100 : null };
  });

  const aplicar = () => {
    const cambios = vista.filter((x) => x.nuevo !== x.antes).map((x) => ({ id: x.p.id, precio: x.nuevo }));
    if (cambios.length === 0) return notificar('Los precios no cambian con esos valores.', 'info');
    const detalle = modo === 'porcentaje' ? `${direccion === 'subir' ? '+' : '−'}${v}% a ${cambios.length} producto(s)` : `Margen ${v}% a ${cambios.length} producto(s)`;
    actualizarPrecios(cambios, detalle);
    notificar(`Precios actualizados en ${cambios.length} producto(s).`);
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
          <button type="button" className="btn btn-primary" disabled={!valido} onClick={aplicar}>Aplicar a {afectados.length} producto(s)</button>
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
      {afectados.length === 0 ? (
        <div className="texto-suave">No hay productos para actualizar con ese alcance.</div>
      ) : (
        <div className="table-responsive border" style={{ maxHeight: 280 }}>
          <table className="table table-sm mb-0">
            <thead><tr><th>Producto</th><th className="text-end">Precio actual</th><th className="text-end">Precio nuevo</th><th className="text-end">Margen</th></tr></thead>
            <tbody>
              {vista.map(({ p, antes, nuevo, margen }) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td className="text-end">{moneda(antes)}</td>
                  <td className={`text-end fw-semibold ${valido && nuevo !== antes ? (nuevo > antes ? 'est-ok' : 'est-agotado') : ''}`}>{moneda(nuevo)}</td>
                  <td className="text-end">{porcentaje(margen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
