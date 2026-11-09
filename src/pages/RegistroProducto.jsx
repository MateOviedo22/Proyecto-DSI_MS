// src/pages/RegistroProducto.jsx
// Cubre: RF-1 (registro de producto), RF-20/21 (costo con envío proporcional), RF-22 (margen),
// RF-23 (redondeo), RF-27 (producto con número de serie), RF-38 (días de garantía) y RF-51..53 (proveedor).
// El costo, el margen y el redondeo se calculan en el servidor: C = C_adq + E/n y P = redondeo[C x (1 + m)].
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import { calcularPrecio } from '../api/precios';
import { describirError } from '../api/errores';
import { REGLAS_REDONDEO, moneda } from '../utils/formato';

const formularioVacio = {
  nombre: '',
  sku: '',
  descripcion: '',
  categoria: '',
  proveedorId: '',
  requiereSerie: false,
  diasGarantia: '',
  precio: '',
  stockMinimo: '',
  stockObjetivo: '',
  cantidadInicial: '',
};

const calculadoraVacia = { costo: '', envio: '', unidades: '1', margen: '', redondeo: '10' };

// Propone un SKU a partir del nombre: "Cámara GoPro Hero 12" -> "CAM-GOP-HER"
const sugerirSku = (nombre) =>
  nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((p) => p.slice(0, 3).toUpperCase())
    .join('-');

export default function RegistroProducto() {
  const { id } = useParams();
  const esEdicion = Boolean(id);
  const navigate = useNavigate();
  const { productos, proveedores, categoriasExistentes, crearProducto, editarProducto, config } = useData();
  const { notificar } = useUi();

  const [formulario, setFormulario] = useState(formularioVacio);
  const [calc, setCalc] = useState({ ...calculadoraVacia, redondeo: config.reglaRedondeo || '10' });
  const [resultadoCalc, setResultadoCalc] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!esEdicion) return;
    const producto = productos.find((p) => p.id === id);
    if (!producto) return;
    setFormulario({
      nombre: producto.nombre || '',
      sku: producto.sku || '',
      descripcion: producto.descripcion || '',
      categoria: producto.categoria || '',
      proveedorId: producto.proveedorId || '',
      requiereSerie: Boolean(producto.requiereSerie),
      diasGarantia: producto.diasGarantia ?? '',
      precio: producto.precio ?? '',
      stockMinimo: producto.stockMinimo ?? '',
      stockObjetivo: producto.stockObjetivo ?? '',
      cantidadInicial: '',
    });
  }, [esEdicion, id, productos]);

  const manejarCambio = (e) => {
    const { name, value, type, checked } = e.target;
    setFormulario((prev) => {
      const siguiente = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'requiereSerie' && checked && prev.diasGarantia === '') siguiente.diasGarantia = String(config.diasGarantia || 15);
      return siguiente;
    });
  };

  const cambiarCalc = (e) => {
    setCalc((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setResultadoCalc(null);
  };

  // C = C_adq + E/n y P = redondeo[C x (1 + m)], calculados por el servidor (una sola fórmula para todo el sistema)
  const calcularEnServidor = async () => {
    setError('');
    try {
      const r = await calcularPrecio({
        costo_adquisicion: Number(calc.costo || 0),
        costo_envio_total: Number(calc.envio || 0),
        unidades: Number(calc.unidades || 1),
        margen: calc.margen === '' ? null : Number(calc.margen),
        redondeo: Number(calc.redondeo || 0),
      });
      setResultadoCalc(r);
    } catch (e) {
      setError(describirError(e).mensaje);
    }
  };

  const manejarEnvio = async (e) => {
    e.preventDefault();
    const { nombre, sku, precio, categoria } = formulario;

    if (!nombre.trim() || !sku.trim() || !categoria.trim() || precio === '') {
      return setError('Nombre, SKU, categoría y precio de venta son obligatorios.');
    }
    if (Number(precio) <= 0) return setError('El precio de venta debe ser mayor que cero.');
    if (formulario.requiereSerie && (formulario.diasGarantia === '' || Number(formulario.diasGarantia) < 0)) {
      return setError('Indica los días de garantía de este producto con número de serie.');
    }

    const datos = {
      ...formulario,
      diasGarantia: formulario.requiereSerie ? Number(formulario.diasGarantia) : null,
      // Las cámaras con número de serie entran al inventario por una compra con sus series (no por stock inicial).
      cantidadInicial: esEdicion || formulario.requiereSerie ? undefined : Number(formulario.cantidadInicial || 0),
    };

    setGuardando(true);
    setError('');
    const res = esEdicion ? await editarProducto(id, datos) : await crearProducto(datos);
    setGuardando(false);

    if (!res.ok) return setError(res.error); // 400 / 409 (SKU repetido) / 403 se muestran aquí
    notificar(esEdicion ? 'Producto actualizado correctamente.' : 'Producto registrado correctamente.');
    navigate('/productos');
  };

  return (
    <div className="container-fluid">
      <PageHeader titulo={esEdicion ? 'Editar producto' : 'Registrar producto'} descripcion="Datos, precio, niveles de existencias y control por número de serie.">
        <Link to="/productos" className="btn btn-outline-secondary"><i className="bi bi-arrow-left me-2"></i>Volver al catálogo</Link>
      </PageHeader>

      <form onSubmit={manejarEnvio} className="row g-3 panel m-0" noValidate>
        <div className="col-md-6">
          <label htmlFor="p-nombre">Nombre</label>
          <input id="p-nombre" type="text" className="form-control" name="nombre" value={formulario.nombre} onChange={manejarCambio} autoFocus />
        </div>
        <div className="col-md-6">
          <label htmlFor="p-sku">SKU (código único)</label>
          <div className="input-group">
            <input id="p-sku" type="text" className="form-control" name="sku" value={formulario.sku} onChange={manejarCambio} placeholder="Ej. GP-H12" />
            <button type="button" className="btn btn-outline-secondary" onClick={() => setFormulario((f) => ({ ...f, sku: sugerirSku(f.nombre) }))} disabled={!formulario.nombre.trim()}>
              Sugerir
            </button>
          </div>
        </div>

        <div className="col-md-6">
          <label htmlFor="p-cat">Categoría</label>
          <input id="p-cat" type="text" className="form-control" name="categoria" list="lista-categorias" value={formulario.categoria} onChange={manejarCambio} placeholder="Ej. Cámaras, Trípodes, Micrófonos…" />
          <datalist id="lista-categorias">
            {categoriasExistentes.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="col-md-6">
          <label htmlFor="p-prov">Proveedor principal</label>
          <select id="p-prov" className="form-select" name="proveedorId" value={formulario.proveedorId} onChange={manejarCambio}>
            <option value="">-- Sin asignar --</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {proveedores.length === 0 && <div className="form-text">No hay proveedores registrados. <Link to="/proveedores">Registrar uno</Link></div>}
        </div>

        <div className="col-md-6">
          <div className="form-check mt-2">
            <input type="checkbox" className="form-check-input" id="requiereSerie" name="requiereSerie" checked={formulario.requiereSerie} onChange={manejarCambio} disabled={esEdicion && productos.find((p) => p.id === id)?.unidadesSerie > 0} />
            <label className="form-check-label" htmlFor="requiereSerie">Requiere número de serie (cámaras y equipos con garantía)</label>
          </div>
          <div className="form-text">Cada unidad se registra con su serie al recibir la compra y se asocia a la venta.</div>
        </div>
        {formulario.requiereSerie && (
          <div className="col-md-3">
            <label htmlFor="p-garantia">Días de garantía</label>
            <input id="p-garantia" type="number" min="0" className="form-control" name="diasGarantia" value={formulario.diasGarantia} onChange={manejarCambio} />
          </div>
        )}

        <div className="col-12"><hr className="my-1" /><h5 className="mt-2 mb-0">Precio de venta</h5></div>

        <div className="col-12">
          <div className="border p-3" style={{ background: 'var(--mm-surface-2)' }}>
            <div className="fw-semibold mb-1">Calculadora de costo y precio</div>
            <div className="texto-suave mb-3">
              Costo total = adquisición + envío ÷ unidades. Precio = costo × (1 + margen), con redondeo. El cálculo lo hace el servidor.
            </div>
            <div className="row g-2">
              <div className="col-6 col-md-2"><label htmlFor="c-costo">Costo de adquisición</label><input id="c-costo" type="number" step="0.01" min="0" className="form-control" name="costo" value={calc.costo} onChange={cambiarCalc} /></div>
              <div className="col-6 col-md-2"><label htmlFor="c-envio">Envío de la compra</label><input id="c-envio" type="number" step="0.01" min="0" className="form-control" name="envio" value={calc.envio} onChange={cambiarCalc} /></div>
              <div className="col-6 col-md-2"><label htmlFor="c-uni">Unidades</label><input id="c-uni" type="number" min="1" className="form-control" name="unidades" value={calc.unidades} onChange={cambiarCalc} /></div>
              <div className="col-6 col-md-2"><label htmlFor="c-mar">Margen (%)</label><input id="c-mar" type="number" step="0.5" min="0" className="form-control" name="margen" value={calc.margen} onChange={cambiarCalc} /></div>
              <div className="col-6 col-md-2">
                <label htmlFor="c-red">Redondeo</label>
                <select id="c-red" className="form-select" name="redondeo" value={calc.redondeo} onChange={cambiarCalc}>
                  {REGLAS_REDONDEO.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-2 d-flex align-items-end">
                <button type="button" className="btn btn-outline-primary w-100" onClick={calcularEnServidor} disabled={calc.costo === ''}>Calcular</button>
              </div>
            </div>
            {resultadoCalc && (
              <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
                <span>Costo unitario total: <strong>{moneda(resultadoCalc.costo_unitario_total)}</strong> <span className="texto-suave">(envío por unidad {moneda(resultadoCalc.costo_envio_unitario)})</span></span>
                {resultadoCalc.precio_sugerido && (
                  <>
                    <span>Precio sugerido: <strong>{moneda(resultadoCalc.precio_sugerido)}</strong></span>
                    <button type="button" className="btn btn-sm btn-success" onClick={() => setFormulario((f) => ({ ...f, precio: resultadoCalc.precio_sugerido }))}>Usar este precio</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="col-md-4">
          <label htmlFor="p-precio">Precio de venta (C$)</label>
          <input id="p-precio" type="number" step="0.01" min="0" className="form-control" name="precio" value={formulario.precio} onChange={manejarCambio} />
          <div className="form-text">El costo real y el margen se calculan a partir de las compras recibidas.</div>
        </div>

        <div className="col-12"><hr className="my-1" /><h5 className="mt-2 mb-0">Inventario</h5></div>

        {!esEdicion && !formulario.requiereSerie && (
          <div className="col-md-4">
            <label htmlFor="p-inicial">Cantidad inicial en stock</label>
            <input id="p-inicial" type="number" min="0" className="form-control" name="cantidadInicial" value={formulario.cantidadInicial} onChange={manejarCambio} />
          </div>
        )}
        {!esEdicion && formulario.requiereSerie && (
          <div className="col-md-4"><div className="alert alert-info mb-0">El stock de este producto se registra al <strong>recibir una compra</strong>, anotando el número de serie de cada unidad.</div></div>
        )}
        <div className="col-md-4">
          <label htmlFor="p-min">Stock mínimo (para alertas)</label>
          <input id="p-min" type="number" min="0" className="form-control" name="stockMinimo" value={formulario.stockMinimo} onChange={manejarCambio} />
          <div className="form-text">Avisa cuando la existencia llega a esta cantidad o menos.</div>
        </div>
        <div className="col-md-4">
          <label htmlFor="p-obj">Nivel de respaldo (stock objetivo)</label>
          <input id="p-obj" type="number" min="0" className="form-control" name="stockObjetivo" value={formulario.stockObjetivo} onChange={manejarCambio} />
          <div className="form-text">Cantidad ideal para no quedarte sin existencias; se usa al sugerir compras.</div>
        </div>

        <div className="col-12">
          <label htmlFor="p-desc" className="d-block">Descripción</label>
          <textarea id="p-desc" className="form-control" name="descripcion" value={formulario.descripcion} onChange={manejarCambio} />
        </div>

        <div className="col-12">
          <div className="texto-suave"><i className="bi bi-info-circle me-1"></i>Si el producto tiene variantes (por ejemplo, baterías para distintos modelos), registra cada variante como un producto aparte.</div>
        </div>

        {error && <div className="col-12"><div className="alert alert-danger mb-0" role="alert">{error}</div></div>}

        <div className="col-12 text-end">
          <button type="submit" className="btn btn-success" disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
