// src/pages/RegistroProducto.jsx
// Cubre: RF-1 (registro de producto), RF-2 (variantes/categorías del producto),
// RF-20 (costo de adquisición y envío), RF-21 (costo total), RF-22 (margen de
// ganancia), RF-23 (redondeo de precio), RF-51..53 (selección de proveedor real).
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';

const REGLAS_REDONDEO = [
  { valor: '0', label: 'Sin redondeo' },
  { valor: '1', label: 'Entero más cercano' },
  { valor: '5', label: 'Múltiplo de 5' },
  { valor: '10', label: 'Múltiplo de 10' },
  { valor: '50', label: 'Múltiplo de 50' },
];

const formularioVacio = {
  nombre: '',
  descripcion: '',
  categoria: '',
  proveedorId: '',
  costo: '',
  costoEnvio: '',
  precio: '',
  stockMinimo: '',
  cantidadInicial: '',
  esElectronico: false,
};

export default function RegistroProducto() {
  const { id } = useParams();
  const esEdicion = Boolean(id);
  const navigate = useNavigate();
  const { productos, proveedores, categoriasExistentes, crearProducto, editarProducto } = useData();

  const [formulario, setFormulario] = useState(formularioVacio);
  const [variantes, setVariantes] = useState([]); // {id?, tipo, valor, stockActual, stockInicial}
  const [reglaRedondeo, setReglaRedondeo] = useState('0');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useEffect(() => {
    if (esEdicion) {
      const producto = productos.find((p) => p.id === id);
      if (!producto) return;
      setFormulario({
        nombre: producto.nombre || '',
        descripcion: producto.descripcion || '',
        categoria: producto.categoria || '',
        proveedorId: producto.proveedorId || '',
        costo: producto.costo ?? '',
        costoEnvio: producto.costoEnvio ?? '',
        precio: producto.precio ?? '',
        stockMinimo: producto.stockMinimo ?? '',
        cantidadInicial: '',
        esElectronico: Boolean(producto.esElectronico),
      });
      setVariantes(producto.variantes || []);
    }
  }, [esEdicion, id, productos.length]);

  const manejarCambio = (e) => {
    const { name, value, type, checked } = e.target;
    setFormulario((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // ---------------- Variantes (RF-2) ----------------
  const agregarVariante = () => {
    setVariantes((prev) => [...prev, { tipo: '', valor: '', stockInicial: '' }]);
  };

  const cambiarVariante = (index, campo, valor) => {
    setVariantes((prev) => prev.map((v, i) => (i === index ? { ...v, [campo]: valor } : v)));
  };

  const quitarVariante = (index) => {
    setVariantes((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------------- Cálculos derivados (RF-21, RF-22) ----------------
  const costoTotal = (Number(formulario.costo) || 0) + (Number(formulario.costoEnvio) || 0);
  const margen =
    costoTotal > 0 && formulario.precio !== ''
      ? (((Number(formulario.precio) || 0) - costoTotal) / costoTotal) * 100
      : null;

  // ---------------- Redondeo de precio (RF-23) ----------------
  const aplicarRedondeo = () => {
    const regla = Number(reglaRedondeo);
    if (!regla || formulario.precio === '') return;
    const precioActual = Number(formulario.precio);
    const redondeado = regla === 1 ? Math.round(precioActual) : Math.round(precioActual / regla) * regla;
    setFormulario((prev) => ({ ...prev, precio: redondeado }));
  };

  const manejarEnvio = (e) => {
    e.preventDefault();
    const { nombre, precio, costo } = formulario;

    if (!nombre || precio === '' || costo === '') {
      setError('Nombre, precio y costo son obligatorios.');
      setExito('');
      return;
    }
    if (Number(precio) <= 0 || Number(costo) <= 0) {
      setError('El precio y el costo deben ser mayores que cero.');
      setExito('');
      return;
    }
    for (const v of variantes) {
      if (!v.tipo || !v.valor) {
        setError('Cada variante necesita tipo y valor (ej. Modelo: GoPro Hero 12).');
        setExito('');
        return;
      }
    }

    const variantesFinales = variantes.map((v) => {
      if (v.id) return v; // variante ya existente: el stock solo cambia por movimientos de inventario
      return {
        id: `var_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        tipo: v.tipo,
        valor: v.valor,
        stockActual: Number(v.stockInicial || 0),
      };
    });

    const datos = {
      nombre: formulario.nombre,
      descripcion: formulario.descripcion,
      categoria: formulario.categoria,
      proveedorId: formulario.proveedorId || null,
      costo: Number(formulario.costo),
      costoEnvio: Number(formulario.costoEnvio || 0),
      precio: Number(formulario.precio),
      stockMinimo: Number(formulario.stockMinimo || 0),
      esElectronico: formulario.esElectronico,
      variantes: variantesFinales,
    };

    if (esEdicion) {
      editarProducto(id, datos);
      setExito('Producto actualizado correctamente.');
    } else {
      crearProducto({ ...datos, cantidadInicial: Number(formulario.cantidadInicial || 0) });
      setExito('Producto registrado correctamente.');
      setFormulario(formularioVacio);
      setVariantes([]);
    }
    setError('');
    setTimeout(() => navigate('/productos'), 700);
  };

  return (
    <div className="container p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>{esEdicion ? 'Editar Producto' : 'Registrar Producto'}</h2>
        <Link to="/productos" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left me-1"></i>Volver al catálogo
        </Link>
      </div>

      <form onSubmit={manejarEnvio} className="row g-3 bg-light p-4 rounded shadow-sm">
        <div className="col-md-6">
          <label>Nombre</label>
          <input type="text" className="form-control" name="nombre" value={formulario.nombre} onChange={manejarCambio} />
        </div>
        <div className="col-md-6">
          <label>Categoría</label>
          <input
            type="text"
            className="form-control"
            name="categoria"
            list="lista-categorias"
            value={formulario.categoria}
            onChange={manejarCambio}
            placeholder="Ej. Cámaras, Trípodes, Micrófonos..."
          />
          <datalist id="lista-categorias">
            {categoriasExistentes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="col-md-6">
          <label>Proveedor</label>
          <select className="form-select" name="proveedorId" value={formulario.proveedorId} onChange={manejarCambio}>
            <option value="">-- Sin asignar --</option>
            {proveedores.filter((p) => p.activo !== false).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          {proveedores.length === 0 && (
            <div className="form-text">
              No hay proveedores registrados. <Link to="/proveedores">Registrar uno</Link>
            </div>
          )}
        </div>
        <div className="col-md-6 d-flex align-items-end">
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="esElectronico"
              name="esElectronico"
              checked={formulario.esElectronico}
              onChange={manejarCambio}
            />
            <label className="form-check-label" htmlFor="esElectronico">
              Es un producto electrónico (requiere prueba al recibirlo)
            </label>
          </div>
        </div>

        <div className="col-12"><hr className="my-1" /><strong>Costos y precio</strong></div>

        <div className="col-md-3">
          <label>Costo de adquisición</label>
          <input type="number" step="0.01" className="form-control" name="costo" value={formulario.costo} onChange={manejarCambio} />
        </div>
        <div className="col-md-3">
          <label>Costo de envío</label>
          <input type="number" step="0.01" className="form-control" name="costoEnvio" value={formulario.costoEnvio} onChange={manejarCambio} />
        </div>
        <div className="col-md-3">
          <label>Costo total</label>
          <input type="text" className="form-control" value={costoTotal.toFixed(2)} disabled />
        </div>
        <div className="col-md-3">
          <label>Margen sobre costo</label>
          <input type="text" className="form-control" value={margen === null ? '—' : `${margen.toFixed(1)}%`} disabled />
        </div>

        <div className="col-md-4">
          <label>Precio de venta</label>
          <input type="number" step="0.01" className="form-control" name="precio" value={formulario.precio} onChange={manejarCambio} />
        </div>
        <div className="col-md-4">
          <label>Redondear precio a</label>
          <select className="form-select" value={reglaRedondeo} onChange={(e) => setReglaRedondeo(e.target.value)}>
            {REGLAS_REDONDEO.map((r) => (
              <option key={r.valor} value={r.valor}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4 d-flex align-items-end">
          <button type="button" className="btn btn-outline-secondary w-100" onClick={aplicarRedondeo}>
            Aplicar redondeo
          </button>
        </div>

        <div className="col-12"><hr className="my-1" /><strong>Inventario</strong></div>

        {!esEdicion && (
          <div className="col-md-4">
            <label>Cantidad inicial en stock</label>
            <input
              type="number"
              className="form-control"
              name="cantidadInicial"
              value={formulario.cantidadInicial}
              onChange={manejarCambio}
              disabled={variantes.length > 0}
            />
            {variantes.length > 0 && (
              <div className="form-text">El stock se define por variante más abajo.</div>
            )}
          </div>
        )}
        <div className="col-md-4">
          <label>Stock mínimo (para alertas)</label>
          <input type="number" className="form-control" name="stockMinimo" value={formulario.stockMinimo} onChange={manejarCambio} />
        </div>

        <div className="col-12">
          <label className="d-block">Descripción</label>
          <textarea className="form-control" name="descripcion" value={formulario.descripcion} onChange={manejarCambio} />
        </div>

        <div className="col-12">
          <hr className="my-1" />
          <div className="d-flex justify-content-between align-items-center">
            <strong>Variantes del producto (opcional)</strong>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={agregarVariante}>
              <i className="bi bi-plus-lg me-1"></i>Agregar variante
            </button>
          </div>
          <div className="form-text mb-2">
            Ej. distintos modelos de batería, colores o tamaños. Si el producto no tiene variantes, déjalo vacío.
          </div>

          {variantes.map((v, index) => (
            <div className="row g-2 align-items-center mb-2" key={v.id || `nueva-${index}`}>
              <div className="col-md-3">
                <input
                  className="form-control form-control-sm"
                  placeholder="Tipo (ej. Modelo)"
                  value={v.tipo}
                  onChange={(e) => cambiarVariante(index, 'tipo', e.target.value)}
                  disabled={Boolean(v.id)}
                />
              </div>
              <div className="col-md-4">
                <input
                  className="form-control form-control-sm"
                  placeholder="Valor (ej. GoPro Hero 12)"
                  value={v.valor}
                  onChange={(e) => cambiarVariante(index, 'valor', e.target.value)}
                  disabled={Boolean(v.id)}
                />
              </div>
              <div className="col-md-3">
                {v.id ? (
                  <span className="text-muted small">
                    Stock actual: <strong>{v.stockActual}</strong> (gestionar desde Inventario)
                  </span>
                ) : (
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="Stock inicial"
                    value={v.stockInicial}
                    onChange={(e) => cambiarVariante(index, 'stockInicial', e.target.value)}
                  />
                )}
              </div>
              <div className="col-md-2 text-end">
                {!v.id && (
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => quitarVariante(index)}>
                    <i className="bi bi-trash"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {exito && <div className="alert alert-success">{exito}</div>}

        <div className="col-12 text-end">
          <button type="submit" className="btn btn-success">
            {esEdicion ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
