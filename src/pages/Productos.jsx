// src/pages/Productos.jsx
// Cubre: RF-3 (consulta/búsqueda), RF-4 (consulta de existencias),
// RF-8/RF-9 (bajo stock / agotados), RF-24 (consulta de costo/precio/margen),
// RNF-2 (visibilidad del estado del inventario).
import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';

const FILTROS = [
  { valor: 'todos', label: 'Todos los activos' },
  { valor: 'bajo', label: 'Bajo stock mínimo' },
  { valor: 'agotados', label: 'Agotados' },
  { valor: 'inactivos', label: 'Dados de baja' },
];

function badgeEstado(producto, ctx) {
  if (producto.activo === false) return <span className="badge bg-secondary">Inactivo</span>;
  if (ctx.estaAgotado(producto)) return <span className="badge bg-danger">Agotado</span>;
  if (ctx.estaBajoStock(producto)) return <span className="badge bg-warning text-dark">Stock bajo</span>;
  return <span className="badge bg-success">Disponible</span>;
}

export default function Productos() {
  const ctx = useData();
  const { proveedores, categoriasExistentes, buscarProductos, darDeBajaProducto, reactivarProducto, crearPendienteCompra } = ctx;

  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [expandido, setExpandido] = useState(null);

  const nombreProveedor = (id) => proveedores.find((p) => p.id === id)?.nombre || '—';

  let resultados = buscarProductos(texto, categoria);
  if (filtro === 'bajo') resultados = resultados.filter((p) => p.activo !== false && ctx.estaBajoStock(p));
  else if (filtro === 'agotados') resultados = resultados.filter((p) => p.activo !== false && ctx.estaAgotado(p));
  else if (filtro === 'inactivos') resultados = resultados.filter((p) => p.activo === false);
  else resultados = resultados.filter((p) => p.activo !== false);

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 className="mb-0">Catálogo de Productos</h2>
        <Link to="/registrar-producto" className="btn btn-primary">
          <i className="bi bi-plus-lg me-1"></i>Nuevo producto
        </Link>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <input
            className="form-control"
            placeholder="Buscar por nombre..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <select className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categoriasExistentes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <select className="form-select" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-responsive bg-white rounded shadow-sm">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th></th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Proveedor</th>
              <th>Precio</th>
              <th>Existencias</th>
              <th>Estado</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((p) => {
              const tieneVariantes = p.variantes && p.variantes.length > 0;
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td>
                      {tieneVariantes && (
                        <button
                          className="btn btn-sm btn-link p-0"
                          onClick={() => setExpandido(expandido === p.id ? null : p.id)}
                          title="Ver variantes"
                        >
                          <i className={`bi ${expandido === p.id ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="fw-semibold">{p.nombre}</div>
                      {p.esElectronico && <span className="text-muted small">Electrónico</span>}
                    </td>
                    <td>{p.categoria || '—'}</td>
                    <td>{nombreProveedor(p.proveedorId)}</td>
                    <td>
                      C$ {Number(p.precio).toFixed(2)}
                      <div className="text-muted small">costo total C$ {ctx.costoTotalDeProducto(p).toFixed(2)}</div>
                    </td>
                    <td>{ctx.stockDeProducto(p)}{tieneVariantes ? ' (total)' : ''}</td>
                    <td>{badgeEstado(p, ctx)}</td>
                    <td className="text-end">
                      <Link to={`/productos/editar/${p.id}`} className="btn btn-sm btn-outline-primary me-1">
                        <i className="bi bi-pencil"></i>
                      </Link>
                      {p.activo !== false && (ctx.estaBajoStock(p) || ctx.estaAgotado(p)) && (
                        <button
                          className="btn btn-sm btn-outline-warning me-1"
                          title="Agregar a pendientes de compra"
                          onClick={() => {
                            const faltante = Math.max(1, Number(p.stockMinimo || 0) - ctx.stockDeProducto(p));
                            crearPendienteCompra({
                              productoId: p.id,
                              cantidadRequerida: faltante,
                              prioridad: ctx.estaAgotado(p) ? 'alta' : 'media',
                            });
                            alert(`"${p.nombre}" agregado a pendientes de compra.`);
                          }}
                        >
                          <i className="bi bi-cart-plus"></i>
                        </button>
                      )}
                      {p.activo === false ? (
                        <button className="btn btn-sm btn-outline-success" onClick={() => reactivarProducto(p.id)}>
                          Reactivar
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => {
                            if (window.confirm(`¿Dar de baja "${p.nombre}"?`)) darDeBajaProducto(p.id);
                          }}
                        >
                          Dar de baja
                        </button>
                      )}
                    </td>
                  </tr>
                  {tieneVariantes && expandido === p.id && (
                    <tr>
                      <td></td>
                      <td colSpan={7}>
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr><th>Tipo</th><th>Valor</th><th>Existencias</th></tr>
                          </thead>
                          <tbody>
                            {p.variantes.map((v) => (
                              <tr key={v.id}>
                                <td>{v.tipo}</td>
                                <td>{v.valor}</td>
                                <td>
                                  {v.stockActual}
                                  {Number(v.stockActual) <= Number(p.stockMinimo || 0) && (
                                    <span className="badge bg-warning text-dark ms-2">bajo</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {resultados.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-4">
                  No se encontraron productos con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
