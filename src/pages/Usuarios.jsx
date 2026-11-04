// src/pages/Usuarios.jsx
// Cubre: RF-47 (registro de usuarios), RF-48 (roles y permisos), RNF de seguridad (almacenamiento seguro de contraseñas).
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { ROLES, MODULOS, PERMISOS_POR_DEFECTO } from '../utils/permisos';

const vacio = { nombreCompleto: '', nombreUsuario: '', rol: 'Vendedor', password: '', preguntaSeguridad: '', respuestaSeguridad: '' };
const PREGUNTAS = ['¿Cuál es el nombre de tu primera mascota?', '¿En qué ciudad naciste?', '¿Cómo se llama tu mejor amigo de la infancia?', '¿Cuál es tu marca de cámara favorita?'];

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
  const abrirEditar = (u) => { setForm({ ...vacio, nombreCompleto: u.nombreCompleto || '', nombreUsuario: u.nombreUsuario, rol: u.rol }); setModal({ tipo: 'editar', usuario: u }); };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    if (modal.tipo === 'nuevo') {
      if (!form.nombreUsuario.trim()) return setError('El nombre de usuario es obligatorio.');
      if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
      if (!form.preguntaSeguridad || !form.respuestaSeguridad.trim()) return setError('Define la pregunta y la respuesta de seguridad para recuperar la contraseña.');
      setGuardando(true);
      const res = await crearUsuario(form);
      setGuardando(false);
      if (!res.ok) return setError(res.error);
      notificar('Usuario creado.');
    } else if (modal.tipo === 'editar') {
      const res = editarUsuario(modal.usuario.id, { nombreCompleto: form.nombreCompleto, rol: form.rol });
      if (!res.ok) return setError(res.error);
      notificar('Usuario actualizado.');
    } else {
      if (nuevaPass.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
      await cambiarPasswordUsuario(modal.usuario.id, nuevaPass);
      notificar('Contraseña restablecida.');
    }
    cerrar();
  };

  const desactivar = async (u) => {
    const ok = await confirmar({ titulo: 'Desactivar usuario', mensaje: `${u.nombreUsuario} ya no podrá iniciar sesión. Su historial se conserva.`, confirmarTexto: 'Desactivar', peligro: true });
    if (!ok) return;
    const res = darDeBajaUsuario(u.id);
    notificar(res.ok ? 'Usuario desactivado.' : res.error, res.ok ? 'ok' : 'error');
  };

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}><i className="bi bi-person-plus me-2"></i>Nuevo usuario</button>
      </div>

      <div className="table-responsive bg-white">
        <table className="table table-hover align-middle">
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo === false ? 'text-muted' : ''}>
                <td className="fw-semibold">{u.nombreCompleto || '—'}{u.id === usuarioActual?.id && <span className="badge bg-primary ms-2">Tú</span>}</td>
                <td>{u.nombreUsuario}</td>
                <td><span className={`badge ${u.rol === 'Administrador' ? 'bg-primary' : u.rol === 'Vendedor' ? 'bg-info' : 'bg-warning'}`}>{u.rol}</span></td>
                <td>{u.activo === false ? <span className="badge bg-secondary">Inactivo</span> : <span className="badge bg-success">Activo</span>}</td>
                <td className="text-end text-nowrap">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrirEditar(u)} aria-label={`Editar ${u.nombreUsuario}`}><i className="bi bi-pencil"></i></button>
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ tipo: 'password', usuario: u })} aria-label={`Restablecer contraseña de ${u.nombreUsuario}`} title="Restablecer contraseña"><i className="bi bi-key"></i></button>
                  {u.activo === false
                    ? <button className="btn btn-sm btn-outline-success" onClick={() => { reactivarUsuario(u.id); notificar('Usuario reactivado.'); }}>Reactivar</button>
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
              <div className="form-text">Mínimo 6 caracteres. Se guarda cifrada con hash y salt.</div>
            </div>
          ) : (
            <>
              <div className="col-md-6">
                <label htmlFor="u-nombre">Nombre completo</label>
                <input id="u-nombre" name="nombreCompleto" className="form-control" value={form.nombreCompleto} onChange={cambiar} autoFocus />
              </div>
              <div className="col-md-6">
                <label htmlFor="u-user">Nombre de usuario</label>
                <input id="u-user" name="nombreUsuario" className="form-control" value={form.nombreUsuario} onChange={cambiar} disabled={modal?.tipo === 'editar'} autoComplete="off" />
              </div>
              <div className="col-12">
                <label htmlFor="u-rol">Rol</label>
                <select id="u-rol" name="rol" className="form-select" value={form.rol} onChange={cambiar}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              </div>
              {modal?.tipo === 'nuevo' && (
                <>
                  <div className="col-12">
                    <label htmlFor="u-pass">Contraseña</label>
                    <input id="u-pass" name="password" type="password" className="form-control" autoComplete="new-password" value={form.password} onChange={cambiar} />
                  </div>
                  <div className="col-12">
                    <label htmlFor="u-preg">Pregunta de seguridad</label>
                    <select id="u-preg" name="preguntaSeguridad" className="form-select" value={form.preguntaSeguridad} onChange={cambiar}>
                      <option value="">Elige una pregunta</option>{PREGUNTAS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-12">
                    <label htmlFor="u-resp">Respuesta</label>
                    <input id="u-resp" name="respuestaSeguridad" className="form-control" value={form.respuestaSeguridad} onChange={cambiar} autoComplete="off" />
                    <div className="form-text">Sirve para recuperar la contraseña desde la pantalla de inicio de sesión.</div>
                  </div>
                </>
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
          <p className="panel-sub">Marca los módulos a los que puede entrar cada rol. El Administrador siempre tiene acceso completo.</p>
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
