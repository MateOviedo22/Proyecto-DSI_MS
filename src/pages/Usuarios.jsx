// src/pages/Usuarios.jsx
// Cubre: RF-47 (registro de usuarios), RF-48 (roles y permisos), RNF de seguridad (almacenamiento seguro de contraseñas).
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { ROLES, MODULOS, PERMISOS_POR_DEFECTO } from '../utils/permisos';

const vacio = { nombreUsuario: '', email: '', rol: 'Vendedor', password: '' };
const MIN_PASSWORD = 8; // el servidor exige al menos 8 caracteres

export default function Usuarios() {
  const [tab, setTab] = useState('usuarios');
  return (
    <div className="container-fluid">
      <PageHeader titulo="Usuarios y roles" descripcion="Administra quién entra al sistema y a qué módulos puede acceder.">
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'usuarios'} className={tab === 'usuarios' ? 'activo' : ''} onClick={() => setTab('usuarios')}>Usuarios</button>
          <button type="button" role="tab" aria-selected={tab === 'roles'} className={tab === 'roles' ? 'activo' : ''} onClick={() => setTab('roles')}>Roles y permisos</button>
        </div>
      </PageHeader>
      {tab === 'usuarios' ? <ListaUsuarios /> : <MatrizPermisos />}
    </div>
  );
}

function ListaUsuarios() {
  const { usuarios, usuarioActual, crearUsuario, editarUsuario, cambiarPasswordUsuario, darDeBajaUsuario, reactivarUsuario } = useData();
  const { notificar, confirmar } = useUi();
  const [modal, setModal] = useState(null); // { tipo: 'nuevo' | 'editar' | 'password', usuario? }
  const [form, setForm] = useState(vacio);
  const [nuevaPass, setNuevaPass] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const cerrar = () => { setModal(null); setError(''); setNuevaPass(''); };

  const abrirNuevo = () => { setForm(vacio); setModal({ tipo: 'nuevo' }); };
  const abrirEditar = (u) => { setForm({ ...vacio, nombreUsuario: u.nombreUsuario, email: u.email || '', rol: u.rol }); setModal({ tipo: 'editar', usuario: u }); };

  // 201 (creado) · 400 (datos inválidos) · 409 (usuario o correo repetido) · 403 (solo el Administrador)
  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    let res;
    if (modal.tipo === 'nuevo') {
      if (!form.nombreUsuario.trim()) return setError('El nombre de usuario es obligatorio.');
      if (form.password.length < MIN_PASSWORD) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      setGuardando(true);
      res = await crearUsuario(form);
    } else if (modal.tipo === 'editar') {
      setGuardando(true);
      res = await editarUsuario(modal.usuario.id, { rol: form.rol, email: form.email });
    } else {
      if (nuevaPass.length < MIN_PASSWORD) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      setGuardando(true);
      res = await cambiarPasswordUsuario(modal.usuario.id, nuevaPass);
    }
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    notificar(modal.tipo === 'nuevo' ? 'Usuario creado.' : modal.tipo === 'editar' ? 'Usuario actualizado.' : 'Contraseña restablecida.');
    cerrar();
  };

  const desactivar = async (u) => {
    const ok = await confirmar({ titulo: 'Desactivar usuario', mensaje: `${u.nombreUsuario} ya no podrá iniciar sesión. Su historial se conserva.`, confirmarTexto: 'Desactivar', peligro: true });
    if (!ok) return;
    const res = await darDeBajaUsuario(u.id);
    notificar(res.ok ? 'Usuario desactivado.' : res.error, res.ok ? 'ok' : 'error');
  };

  const reactivar = async (u) => {
    const res = await reactivarUsuario(u.id);
    notificar(res.ok ? 'Usuario reactivado.' : res.error, res.ok ? 'ok' : 'error');
  };

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}><i className="bi bi-person-plus me-2"></i>Nuevo usuario</button>
      </div>

      <div className="table-responsive bg-white">
        <table className="table table-hover align-middle">
          <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo === false ? 'text-muted' : ''}>
                <td className="fw-semibold">{u.nombreUsuario}{String(u.id) === String(usuarioActual?.id) && <span className="badge bg-primary ms-2">Tú</span>}</td>
                <td>{u.email || '—'}</td>
                <td><span className={`badge ${u.rol === 'Administrador' ? 'bg-primary' : u.rol === 'Vendedor' ? 'bg-info' : 'bg-warning'}`}>{u.rol}</span></td>
                <td>{u.activo === false ? <span className="badge bg-secondary">Inactivo</span> : <span className="badge bg-success">Activo</span>}</td>
                <td className="text-end text-nowrap">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrirEditar(u)} aria-label={`Editar ${u.nombreUsuario}`}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ tipo: 'password', usuario: u })} aria-label={`Restablecer contraseña de ${u.nombreUsuario}`} title="Restablecer contraseña"><i className="bi bi-key"></i></button>
                  {u.activo === false
                    ? <button className="btn btn-sm btn-outline-success" onClick={() => reactivar(u)}>Reactivar</button>
                    : <button className="btn btn-sm btn-outline-danger" onClick={() => desactivar(u)} aria-label={`Desactivar ${u.nombreUsuario}`}><i className="bi bi-person-slash"></i></button>}
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && <tr><td colSpan={5}><EmptyState icono="bi-people" titulo="No hay usuarios" /></td></tr>}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={Boolean(modal)}
        onCerrar={cerrar}
        titulo={modal?.tipo === 'nuevo' ? 'Nuevo usuario' : modal?.tipo === 'editar' ? 'Editar usuario' : `Restablecer contraseña de ${modal?.usuario?.nombreUsuario || ''}`}
        tamano="md"
        pie={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={cerrar}>Cancelar</button>
            <button type="submit" form="form-usuario" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <form id="form-usuario" onSubmit={guardar} className="row g-3" noValidate>
          {modal?.tipo === 'password' ? (
            <div className="col-12">
              <label htmlFor="u-pass2">Nueva contraseña</label>
              <input id="u-pass2" type="password" className="form-control" autoComplete="new-password" value={nuevaPass} onChange={(e) => setNuevaPass(e.target.value)} autoFocus />
              <div className="form-text">Mínimo {MIN_PASSWORD} caracteres. El servidor la guarda cifrada; nadie puede leerla después.</div>
            </div>
          ) : (
            <>
              <div className="col-md-6">
                <label htmlFor="u-user">Nombre de usuario</label>
                <input id="u-user" name="nombreUsuario" className="form-control" value={form.nombreUsuario} onChange={cambiar} disabled={modal?.tipo === 'editar'} autoComplete="off" autoFocus />
              </div>
              <div className="col-md-6">
                <label htmlFor="u-mail">Correo (opcional)</label>
                <input id="u-mail" name="email" type="email" className="form-control" value={form.email} onChange={cambiar} autoComplete="off" />
              </div>
              <div className="col-12">
                <label htmlFor="u-rol">Rol</label>
                <select id="u-rol" name="rol" className="form-select" value={form.rol} onChange={cambiar}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              </div>
              {modal?.tipo === 'nuevo' && (
                <div className="col-12">
                  <label htmlFor="u-pass">Contraseña</label>
                  <input id="u-pass" name="password" type="password" className="form-control" autoComplete="new-password" value={form.password} onChange={cambiar} />
                  <div className="form-text">Mínimo {MIN_PASSWORD} caracteres. Si la olvida, un administrador puede restablecerla.</div>
                </div>
              )}
            </>
          )}
          {error && <div className="col-12"><div className="alert alert-danger mb-0" role="alert">{error}</div></div>}
        </form>
      </Modal>
    </>
  );
}

function MatrizPermisos() {
  const { config, actualizarConfig } = useData();
  const { notificar } = useUi();
  const [permisos, setPermisos] = useState(() => JSON.parse(JSON.stringify(config.permisos)));
  const cambiado = JSON.stringify(permisos) !== JSON.stringify(config.permisos);

  const alternar = (rol, modulo) =>
    setPermisos((p) => ({ ...p, [rol]: p[rol]?.includes(modulo) ? p[rol].filter((m) => m !== modulo) : [...(p[rol] || []), modulo] }));

  const guardar = () => {
    actualizarConfig({ permisos }, 'Permisos por rol actualizados');
    notificar('Permisos guardados. Se aplican de inmediato.');
  };

  return (
    <section className="panel">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h2 className="panel-titulo">Permisos por rol</h2>
          <p className="panel-sub">Define qué módulos se muestran en el menú de cada rol. El servidor aplica además sus propios permisos por rol: ocultar un módulo aquí no reemplaza esa protección.</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setPermisos(JSON.parse(JSON.stringify(PERMISOS_POR_DEFECTO)))}>Restablecer valores</button>
          <button type="button" className="btn btn-primary" disabled={!cambiado} onClick={guardar}>Guardar cambios</button>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table matriz align-middle">
          <thead><tr><th>Módulo</th>{ROLES.map((r) => <th key={r}>{r}</th>)}</tr></thead>
          <tbody>
            {MODULOS.map((m) => (
              <tr key={m.id}>
                <td>{m.label}</td>
                {ROLES.map((r) => (
                  <td key={r}>
                    <input type="checkbox" className="form-check-input" checked={r === 'Administrador' || Boolean(permisos[r]?.includes(m.id))} disabled={r === 'Administrador'} onChange={() => alternar(r, m.id)} aria-label={`${m.label} para ${r}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
