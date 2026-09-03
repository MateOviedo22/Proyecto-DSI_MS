// src/pages/Usuarios.jsx
// Cubre: RF-47 (registro de usuarios), RF-48 (gestión de roles y permisos).
// Solo accesible para el rol Administrador (ver App.js). Las contraseñas
// nunca se muestran ni se guardan en texto plano (src/utils/passwordHash.js).
import { useState } from 'react';
import { useData } from '../context/DataContext';

const formularioVacio = {
  nombreUsuario: '', nombreCompleto: '', rol: 'Vendedor', password: '',
  preguntaSeguridad: '', respuestaSeguridad: '',
};

export default function Usuarios() {
  const { usuarios, ROLES_DISPONIBLES, crearUsuario, editarUsuario, cambiarPasswordUsuario, darDeBajaUsuario, reactivarUsuario, usuarioActual } = useData();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [reseteando, setReseteando] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState('');

  const manejarCambio = (e) => setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const manejarEnvio = async (e) => {
    e.preventDefault();
    if (!formulario.nombreUsuario || !formulario.password) {
      setError('Nombre de usuario y contraseña son obligatorios.');
      return;
    }
    if (formulario.password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    const res = await crearUsuario(formulario);
    if (!res.ok) { setError(res.error); return; }
    setExito('Usuario creado correctamente.');
    setError('');
    setFormulario(formularioVacio);
    setMostrarForm(false);
  };

  const cambiarRol = (id, rol) => editarUsuario(id, { rol });

  const confirmarReset = async (id) => {
    if (nuevaPassword.length < 4) { setError('La nueva contraseña debe tener al menos 4 caracteres.'); return; }
    await cambiarPasswordUsuario(id, nuevaPassword);
    setReseteando(null);
    setNuevaPassword('');
    setExito('Contraseña restablecida.');
    setError('');
  };

  return (
    <div className="container p-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 className="mb-0">Usuarios y Roles</h2>
        {!mostrarForm && (
          <button className="btn btn-primary" onClick={() => { setMostrarForm(true); setError(''); setExito(''); }}>
            <i className="bi bi-person-plus me-1"></i>Nuevo usuario
          </button>
        )}
      </div>

      {exito && <div className="alert alert-success">{exito}</div>}

      {mostrarForm && (
        <form onSubmit={manejarEnvio} className="row g-3 bg-light p-4 rounded shadow-sm mb-4">
          <div className="col-md-4">
            <label>Nombre de usuario</label>
            <input className="form-control" name="nombreUsuario" value={formulario.nombreUsuario} onChange={manejarCambio} />
          </div>
          <div className="col-md-4">
            <label>Nombre completo</label>
            <input className="form-control" name="nombreCompleto" value={formulario.nombreCompleto} onChange={manejarCambio} />
          </div>
          <div className="col-md-4">
            <label>Rol</label>
            <select className="form-select" name="rol" value={formulario.rol} onChange={manejarCambio}>
              {ROLES_DISPONIBLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <label>Contraseña</label>
            <input type="password" className="form-control" name="password" value={formulario.password} onChange={manejarCambio} />
          </div>
          <div className="col-md-4">
            <label>Pregunta de seguridad</label>
            <input className="form-control" name="preguntaSeguridad" value={formulario.preguntaSeguridad} onChange={manejarCambio} placeholder="Para recuperar la contraseña" />
          </div>
          <div className="col-md-4">
            <label>Respuesta</label>
            <input className="form-control" name="respuestaSeguridad" value={formulario.respuestaSeguridad} onChange={manejarCambio} />
          </div>
          {error && <div className="alert alert-danger mb-0">{error}</div>}
          <div className="col-12 text-end">
            <button type="button" className="btn btn-outline-secondary me-2" onClick={() => setMostrarForm(false)}>Cancelar</button>
            <button className="btn btn-success">Guardar</button>
          </div>
        </form>
      )}

      <div className="table-responsive bg-white rounded shadow-sm">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th className="text-end">Acciones</th></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="fw-semibold">{u.nombreUsuario}</td>
                <td>{u.nombreCompleto || '—'}</td>
                <td>
                  <select className="form-select form-select-sm" style={{ width: 190 }} value={u.rol} onChange={(e) => cambiarRol(u.id, e.target.value)} disabled={u.id === usuarioActual.id}>
                    {ROLES_DISPONIBLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u.activo === false ? <span className="badge bg-secondary">Inactivo</span> : <span className="badge bg-success">Activo</span>}</td>
                <td className="text-end">
                  {reseteando === u.id ? (
                    <div className="input-group input-group-sm" style={{ maxWidth: 260, marginLeft: 'auto' }}>
                      <input type="password" className="form-control" placeholder="Nueva contraseña" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} />
                      <button className="btn btn-success" onClick={() => confirmarReset(u.id)}>OK</button>
                      <button className="btn btn-outline-secondary" onClick={() => setReseteando(null)}>x</button>
                    </div>
                  ) : (
                    <>
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => { setReseteando(u.id); setNuevaPassword(''); }}>
                        Restablecer contraseña
                      </button>
                      {u.id !== usuarioActual.id && (
                        u.activo === false ? (
                          <button className="btn btn-sm btn-outline-success" onClick={() => reactivarUsuario(u.id)}>Reactivar</button>
                        ) : (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => darDeBajaUsuario(u.id)}>Dar de baja</button>
                        )
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted small mt-2">
        Nota: no se puede cambiar tu propio rol ni darte de baja a ti mismo mientras tienes la sesión abierta.
      </p>
    </div>
  );
}
