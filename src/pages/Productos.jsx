// src/pages/Productos.jsx
// Cubre: RF-3 (consulta/búsqueda), RF-4 (existencias por producto y categoría), RF-8/RF-9 (bajo stock / agotados),
// RF-10 (alta rotación), RF-24 (costo, precio y margen), RNF (visibilidad del estado del inventario, precios por porcentaje).
import { useState, Fragment } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import StockMeter from '../components/StockMeter';
import EmptyState from '../components/EmptyState';
import ActualizarPreciosModal from '../components/ActualizarPreciosModal';
import { moneda, porcentaje, numero } from '../utils/formato';

const FILTROS = [
  { valor: 'todos', label: 'Todos los activos' },
  { valor: 'alertas', label: 'Con alerta (bajo o agotado)' },
  { valor: 'bajo', label: 'Stock bajo' },
  { valor: 'agotados', label: 'Agotados' },
  { valor: 'rotacion', label: 'Alta rotación' },
  { valor: 'inactivos', label: 'Dados de baja' },
];

export default function Productos() {
  const ctx = useData();
  const { proveedores, categoriasExistentes, buscarProductos, darDeBajaProducto, reactivarProducto, crearPendienteCompra, pendientesCompra, productos, tienePermiso } = ctx;
  const { notificar, confirmar } = useUi();
  const [params, setParams] = useSearchParams();

  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [expandido, setExpandido] = useState(null);
  const [seleccion, setSeleccion] = useState([]);
  const [modalPrecios, setModalPrecios] = useState(false);

  const filtro = FILTROS.some((f) => f.valor === params.get('filtro')) ? params.get('filtro') : 'todos';
  const setFiltro = (v) => setParams(v === 'todos' ? {} : { filtro: v });

  const puedeGestionar = tienePermiso('productos_gestion');
  const verCostos = tienePermiso('costos');
  const nombreProveedor = (id) => proveedores.find((p) => p.id === id)?.nombre || '—';

  let resultados = buscarProductos(texto, categoria);
  const activo = (p) => p.activo !== false;
  if (filtro === 'alertas') resultados = resultados.filter((p) => activo(p) && (ctx.estaAgotado(p) || ctx.estaBajoStock(p)));
  else if (filtro === 'bajo') resultados = resultados.filter((p) => activo(p) && ctx.estaBajoStock(p));
  else if (filtro === 'agotados') resultados = resultados.filter((p) => activo(p) && ctx.estaAgotado(p));
  else if (filtro === 'rotacion') resultados = resultados.filter((p) => activo(p) && ctx.esAltaRotacion(p));
  else if (filtro === 'inactivos') resultados = resultados.filter((p) => !activo(p));
  else resultados = resultados.filter(activo);

  // Existencias por categoría (RF-4)
  const porCategoria = categoriasExistentes.map((c) => {
    const lista = productos.filter((p) => activo(p) && p.categoria === c);
    return { categoria: c, productos: lista.length, unidades: lista.reduce((s, p) => s + ctx.stockDeProducto(p), 0) };
  });

  const alternarSeleccion = (id) => setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const todosSeleccionados = resultados.length > 0 && resultados.every((p) => seleccion.includes(p.id));
  const alternarTodos = () => setSeleccion(todosSeleccionados ? [] : resultados.map((p) => p.id));

  const agregarPendiente = (p) => {
    if (pendientesCompra.some((x) => x.productoId === p.id && !x.atendido)) return notificar(`"${p.nombre}" ya está en pendientes de compra.`, 'info');
    crearPendienteCompra({ productoId: p.id, cantidadRequerida: ctx.cantidadSugeridaReposicion(p), prioridad: ctx.estaAgotado(p) ? 'alta' : 'media' });
    notificar(`"${p.nombre}" agregado a pendientes de compra.`);
  };

  const baja = async (p) => {
    const ok = await confirmar({ titulo: 'Dar de baja el producto', mensaje: `"${p.nombre}" dejará de aparecer en ventas y compras. Podrás reactivarlo después.`, confirmarTexto: 'Dar de baja', peligro: true });
    if (!ok) return;
    const res = await darDeBajaProducto(p.id);
    notificar(res.ok ? 'Producto dado de baja.' : res.error, res.ok ? 'ok' : 'error');
  };

  const columnas = 6 + (puedeGestionar ? 1 : 0) + 1;

  return (
    <div className="container-fluid">
      <PageHeader titulo="Catálogo de productos" descripcion="Consulta existencias, precios y estado de cada producto y sus variantes.">
        {puedeGestionar && (
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setModalPrecios(true)}>
              <i className="bi bi-percent me-2"></i>Actualizar precios{seleccion.length > 0 ? ` (${seleccion.length})` : ''}
            </button>
            <Link to="/registrar-producto" className="btn btn-primary"><i className="bi bi-plus-lg me-2"></i>Nuevo producto</Link>
          </>
        )}
      </PageHeader>

      {porCategoria.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-3" aria-label="Existencias por categoría">
          {porCategoria.map((c) => (
            <button
              key={c.categoria}
              type="button"
              className={`btn btn-sm ${categoria === c.categoria ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setCategoria(categoria === c.categoria ? '' : c.categoria)}
            >
              {c.categoria} <span className="opacity-75">· {numero(c.unidades)} uds.</span>
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <div className="campo-icono grow">
          <i className="bi bi-search"></i>
          <input className="form-control" placeholder="Buscar por nombre o categoría…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar productos" />
        </div>
        <select className="form-select" style={{ maxWidth: 220 }} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categoriasExistentes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 240 }} value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Estado">
          {FILTROS.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
        </select>
      </div>

      <div className="table-responsive bg-white">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              {puedeGestionar && (
                <th style={{ width: 40 }}>
                  <input type="checkbox" className="form-check-input" checked={todosSeleccionados} onChange={alternarTodos} aria-label="Seleccionar todos" />
                </th>
              )}
              <th>Producto</th>
              <th>Categoría</th>
              <th>Proveedor</th>
              <th className="text-end">Precio</th>
              <th style={{ minWidth: 150 }}>Existencias</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((p) => {
              const tieneVariantes = p.variantes && p.variantes.length > 0;
              const stock = ctx.stockDeProducto(p);
              const minimo = ctx.minimoDeProducto(p);
              const objetivo = ctx.objetivoDeProducto(p);
              const margen = ctx.margenDeProducto(p);
              return (
                <Fragment key={p.id}>
                  <tr className={p.activo === false ? 'text-muted' : ''}>
                    {puedeGestionar && (
                      <td>
                        <input type="checkbox" className="form-check-input" checked={seleccion.includes(p.id)} onChange={() => alternarSeleccion(p.id)} aria-label={`Seleccionar ${p.nombre}`} />
                      </td>
                    )}
                    <td>
                      <div className="d-flex align-items-start gap-2">
                        {tieneVariantes && (
                          <button className="btn-icono" style={{ width: 26, height: 26, fontSize: '0.9rem' }} onClick={() => setExpandido(expandido === p.id ? null : p.id)} aria-expanded={expandido === p.id} aria-label="Ver variantes">
                            <i className={`bi ${expandido === p.id ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                          </button>
                        )}
                        <div>
                          <div className="fw-semibold">{p.nombre}</div>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            {p.activo === false && <span className="badge bg-secondary">Dado de baja</span>}
                            {p.requiereSerie && <span className="badge bg-info"><i className="bi bi-upc-scan me-1"></i>N.º de serie · {p.unidadesSerie} en stock</span>}
                            {p.sku && <span className="badge bg-secondary">{p.sku}</span>}
                            {tieneVariantes && <span className="badge bg-secondary">{p.variantes.length} variantes</span>}
                            {ctx.esAltaRotacion(p) && <span className="badge bg-success"><i className="bi bi-graph-up-arrow me-1"></i>Alta rotación</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{p.categoria || '—'}</td>
                    <td>{nombreProveedor(p.proveedorId)}</td>
                    <td className="text-end">
                      <div className="fw-semibold">{moneda(p.precio)}</div>
                      {verCostos && (p.tieneCosto
                        ? <><div className="texto-suave">costo {moneda(ctx.costoTotalDeProducto(p))}</div><div className="texto-suave">margen {porcentaje(margen, 0)}</div></>
                        : <div className="texto-suave">sin costo (aún no se recibe una compra)</div>)}
                    </td>
                    <td>{p.activo === false ? <span className="texto-suave">{stock} uds.</span> : <StockMeter stock={stock} minimo={minimo} objetivo={objetivo} />}</td>
                    <td className="text-end text-nowrap">
                      {p.activo !== false && (ctx.estaBajoStock(p) || ctx.estaAgotado(p)) && tienePermiso('compras') && (
                        <button className="btn btn-sm btn-outline-warning me-1" title="Agregar a pendientes de compra" aria-label={`Agregar ${p.nombre} a pendientes de compra`} onClick={() => agregarPendiente(p)}>
                          <i className="bi bi-cart-plus"></i>
                        </button>
                      )}
                      {puedeGestionar && (
                        <>
                          <Link to={`/productos/editar/${p.id}`} className="btn btn-sm btn-outline-primary me-1" aria-label={`Editar ${p.nombre}`}><i className="bi bi-pencil"></i></Link>
                          {p.activo === false ? (
                            <button className="btn btn-sm btn-outline-success" onClick={async () => { const res = await reactivarProducto(p.id); notificar(res.ok ? 'Producto reactivado.' : res.error, res.ok ? 'ok' : 'error'); }}>Reactivar</button>
                          ) : (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => baja(p)} aria-label={`Dar de baja ${p.nombre}`}><i className="bi bi-archive"></i></button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                  {tieneVariantes && expandido === p.id && (
                    <tr>
                      <td colSpan={columnas} style={{ background: 'var(--mm-surface-2)' }}>
                        <div className="d-grid gap-2 py-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
                          {p.variantes.map((v) => (
                            <div key={v.id} className="border p-2 bg-white" style={{ background: 'var(--mm-surface)' }}>
                              <div className="texto-suave">{v.tipo}</div>
                              <div className="fw-semibold mb-1">{v.valor}</div>
                              <StockMeter stock={Number(v.stockActual)} minimo={minimo} objetivo={objetivo} compacto />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {resultados.length === 0 && (
              <tr><td colSpan={columnas}><EmptyState icono="bi-search" titulo="No se encontraron productos">Prueba con otra búsqueda o cambia los filtros.</EmptyState></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalPrecios && <ActualizarPreciosModal abierto={modalPrecios} onCerrar={() => { setModalPrecios(false); setSeleccion([]); }} seleccionados={seleccion} />}
    </div>
  );
}
