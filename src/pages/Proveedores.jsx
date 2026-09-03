// src/pages/Proveedores.jsx
// Cubre: RF-51 (registro de proveedores), RF-52 (consulta), RF-53 (actualización).
import { useState } from 'react';
import { useData } from '../context/DataContext';

const formularioVacio = { nombre: '', contacto: '', telefono: '', email: '' };

export default function Proveedores() {
  const { proveedores, productos, crearProveedor, editarProveedor, eliminarProveedor } = useData();

  const [formulario, setFormulario] = useState(formularioVacio);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const productosDe = (proveedorId) => productos.filter((p) => p.proveedorId === proveedorId && p.activo !== false);

  const manejarCambio = (e) => setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const nuevo = () => {
    setFormulario(formularioVacio);
    setEditandoId(null);
    setMostrarForm(true);
    setError('');
  };

  const editar = (proveedor) => {
    setFormulario({
      nombre: proveedor.nombre,
      contacto: proveedor.contacto || '',
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
    });
    setEditandoId(proveedor.id);
    setMostrarForm(true);
    setError('');
  };

  const cancelar = () => {
    setMostrarForm(false);
    setFormulario(formularioVacio);
    setEditandoId(null);
    setError('');
  };

  const manejarEnvio = (e) => {
    e.preventDefault();
    if (!formulario.nombre.trim()) {
      setError('El nombre del proveedor es obligatorio.');
      return;
    }
    if (editandoId) {
      editarProveedor(editandoId, formulario);
    } else {
      crearProveedor(formulario);
    }
    cancelar();
  };

  const manejarEliminar = (proveedor) => {
    if (!window.confirm(`¿Eliminar al proveedor "${proveedor.nombre}"?`)) return;
    const res = eliminarProveedor(proveedor.id);
    if (!res.ok) alert(res.error);
  };

  const listaFiltrada = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <div className="container p-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 className="mb-0">Proveedores</h2>
        {!mostrarForm && (
          <button className="btn btn-primary" onClick={nuevo}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo proveedor
          </button>
        )}
      </div>

      {mostrarForm && (
        <form onSubmit={manejarEnvio} className="row g-3 bg-light p-4 rounded shadow-sm mb-4">
          <div className="col-md-6">
            <label>Nombre</label>
            <input className="form-control" name="nombre" value={formulario.nombre} onChange={manejarCambio} />
          </div>
          <div className="col-md-6">
            <label>Persona de contacto</label>
            <input className="form-control" name="contacto" value={formulario.contacto} onChange={manejarCambio} />
          </div>
          <div className="col-md-6">
            <label>Teléfono</label>
            <input className="form-control" name="telefono" value={formulario.telefono} onChange={manejarCambio} />
          </div>
          <div className="col-md-6">
            <label>Correo</label>
            <input type="email" className="form-control" name="email" value={formulario.email} onChange={manejarCambio} />
          </div>
          {error && <div className="alert alert-danger mb-0">{error}</div>}
          <div className="col-12 text-end">
            <button type="button" className="btn btn-outline-secondary me-2" onClick={cancelar}>Cancelar</button>
            <button type="submit" className="btn btn-success">{editandoId ? 'Guardar cambios' : 'Guardar'}</button>
          </div>
        </form>
      )}

      <input
        className="form-control mb-3"
        style={{ maxWidth: 320 }}
        placeholder="Buscar proveedor..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="table-responsive bg-white rounded shadow-sm">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Nombre</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th>Correo</th>
              <th>Productos activos</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((p) => (
              <tr key={p.id}>
                <td className="fw-semibold">{p.nombre}</td>
                <td>{p.contacto || '—'}</td>
                <td>{p.telefono || '—'}</td>
                <td>{p.email || '—'}</td>
                <td>{productosDe(p.id).length}</td>
                <td className="text-end">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => editar(p)}>
                    <i className="bi bi-pencil"></i>
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => manejarEliminar(p)}>
                    <i className="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
            {listaFiltrada.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted py-4">No hay proveedores registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
