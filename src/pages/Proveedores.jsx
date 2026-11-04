// src/pages/Proveedores.jsx
// Cubre: RF-51 (registro de proveedores), RF-52 (consulta con los productos que suministra), RF-53 (actualización).
import { useState, Fragment } from 'react';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

const formularioVacio = { nombre: '', contacto: '', telefono: '', email: '' };

export default function Proveedores() {
  const { proveedores, productos, crearProveedor, editarProveedor, eliminarProveedor } = useData();
  const { notificar, confirmar } = useUi();

  const [formulario, setFormulario] = useState(formularioVacio);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [expandido, setExpandido] = useState(null);

  const productosDe = (proveedorId) => productos.filter((p) => p.proveedorId === proveedorId && p.activo !== false);
  const manejarCambio = (e) => setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const nuevo = () => { setFormulario(formularioVacio); setEditandoId(null); setMostrarForm(true); setError(''); };
  const editar = (p) => {
    setFormulario({ nombre: p.nombre, contacto: p.contacto || '', telefono: p.telefono || '', email: p.email || '' });
    setEditandoId(p.id); setMostrarForm(true); setError('');
  };
  const cancelar = () => { setMostrarForm(false); setFormulario(formularioVacio); setEditandoId(null); setError(''); };

  const manejarEnvio = (e) => {
    e.preventDefault();
    if (!formulario.nombre.trim()) return setError('El nombre del proveedor es obligatorio.');
    if (editandoId) { editarProveedor(editandoId, formulario); notificar('Proveedor actualizado.'); }
    else { crearProveedor(formulario); notificar('Proveedor registrado.'); }
    cancelar();
  };

  const manejarEliminar = async (p) => {
    const ok = await confirmar({ titulo: 'Eliminar proveedor', mensaje: `¿Eliminar a "${p.nombre}"? Esta acción no se puede deshacer.`, confirmarTexto: 'Eliminar', peligro: true });
    if (!ok) return;
    const res = eliminarProveedor(p.id);
    notificar(res.ok ? 'Proveedor eliminado.' : res.error, res.ok ? 'ok' : 'error');
  };

  const listaFiltrada = proveedores.filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div className="container-fluid">
      <PageHeader titulo="Proveedores" descripcion="Datos de contacto y los productos que suministra cada proveedor.">
        {!mostrarForm && <button className="btn btn-primary" onClick={nuevo}><i className="bi bi-plus-lg me-2"></i>Nuevo proveedor</button>}
      </PageHeader>

      {mostrarForm && (
        <form onSubmit={manejarEnvio} className="panel mb-4" noValidate>
          <h2 className="panel-titulo mb-3">{editandoId ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
          <div className="row g-3">
            <div className="col-md-6"><label htmlFor="pv-nombre">Nombre</label><input id="pv-nombre" className="form-control" name="nombre" value={formulario.nombre} onChange={manejarCambio} autoFocus /></div>
            <div className="col-md-6"><label htmlFor="pv-contacto">Persona de contacto</label><input id="pv-contacto" className="form-control" name="contacto" value={formulario.contacto} onChange={manejarCambio} /></div>
            <div className="col-md-6"><label htmlFor="pv-tel">Teléfono</label><input id="pv-tel" className="form-control" name="telefono" value={formulario.telefono} onChange={manejarCambio} /></div>
            <div className="col-md-6"><label htmlFor="pv-mail">Correo</label><input id="pv-mail" type="email" className="form-control" name="email" value={formulario.email} onChange={manejarCambio} /></div>
            {error && <div className="col-12"><div className="alert alert-danger mb-0" role="alert">{error}</div></div>}
            <div className="col-12 text-end">
              <button type="button" className="btn btn-outline-secondary me-2" onClick={cancelar}>Cancelar</button>
              <button type="submit" className="btn btn-primary">{editandoId ? 'Guardar cambios' : 'Guardar proveedor'}</button>
            </div>
          </div>
        </form>
      )}

      <div className="toolbar">
        <div className="campo-icono grow" style={{ maxWidth: 380 }}>
          <i className="bi bi-search"></i>
          <input className="form-control" placeholder="Buscar proveedor…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar proveedor" />
        </div>
      </div>

      <div className="table-responsive bg-white">
        <table className="table table-hover align-middle">
          <thead><tr><th style={{ width: 40 }}></th><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Correo</th><th>Productos</th><th className="text-end">Acciones</th></tr></thead>
          <tbody>
            {listaFiltrada.map((p) => {
              const suministra = productosDe(p.id);
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td>
                      <button className="btn-icono" style={{ width: 28, height: 28, fontSize: '0.9rem' }} onClick={() => setExpandido(expandido === p.id ? null : p.id)} aria-expanded={expandido === p.id} aria-label={`Ver productos de ${p.nombre}`}>
                        <i className={`bi ${expandido === p.id ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                      </button>
                    </td>
                    <td className="fw-semibold">{p.nombre}</td>
                    <td>{p.contacto || '—'}</td>
                    <td>{p.telefono || '—'}</td>
                    <td>{p.email || '—'}</td>
                    <td><span className="badge bg-secondary">{suministra.length} activo(s)</span></td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => editar(p)} aria-label={`Editar ${p.nombre}`}><i className="bi bi-pencil"></i></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => manejarEliminar(p)} aria-label={`Eliminar ${p.nombre}`}><i className="bi bi-trash"></i></button>
                    </td>
                  </tr>
                  {expandido === p.id && (
                    <tr>
                      <td></td>
                      <td colSpan={6} style={{ background: 'var(--mm-surface-2)' }}>
                        {suministra.length === 0 ? <span className="texto-suave">Este proveedor no tiene productos activos asociados.</span> : (
                          <div className="d-flex flex-wrap gap-2 py-1">
                            {suministra.map((x) => <span key={x.id} className="badge bg-primary">{x.nombre}</span>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {listaFiltrada.length === 0 && <tr><td colSpan={7}><EmptyState icono="bi-truck" titulo="No hay proveedores registrados" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
