// src/pages/Login.jsx
// Cubre: RF-49 (inicio de sesión con credenciales, contra hash real vía
// DataContext.verificarCredenciales), RF-50 (recuperación de contraseña
// mediante pregunta de seguridad, ya que no hay backend/correo todavía).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, useT } from '../context/LanguageContext';
import './Login.css';

export default function Login() {
  const { verificarCredenciales, iniciarSesion, obtenerPreguntaSeguridad, recuperarContrasena } = useData();
  const { modoOscuro, alternarTema } = useTheme();
  const { idioma, setIdioma } = useLanguage();
  const t = useT();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [intentos, setIntentos] = useState(0);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const [modoRecuperar, setModoRecuperar] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    const res = await verificarCredenciales(username, password);
    setCargando(false);

    if (res.ok) {
      setError('');
      iniciarSesion(res.usuario);
      navigate('/', { replace: true });
    } else {
      const nuevosIntentos = intentos + 1;
      setIntentos(nuevosIntentos);
      setError(nuevosIntentos >= 3 ? 'Acceso bloqueado por exceso de intentos' : res.error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-top-controls">
        <button className="login-icon-btn" onClick={alternarTema} title={t('tema')}>
          <i className={`bi ${modoOscuro ? 'bi-sun' : 'bi-moon-stars'}`}></i>
        </button>
        <button className="login-icon-btn" onClick={() => setIdioma(idioma === 'es' ? 'en' : 'es')} title={t('idioma')}>
          {idioma === 'es' ? 'EN' : 'ES'}
        </button>
      </div>

      <div className="login-box">
        <div className="left-panel">
          <h2>MotoMan</h2>
          <p>{t('eslogan')}</p>
        </div>

        <div className="right-panel">
          {modoRecuperar ? (
            <RecuperarContrasena
              obtenerPreguntaSeguridad={obtenerPreguntaSeguridad}
              recuperarContrasena={recuperarContrasena}
              onListo={() => setModoRecuperar(false)}
            />
          ) : (
            <form onSubmit={handleLogin}>
              <input
                type="text"
                placeholder={t('usuario')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={intentos >= 3 || cargando}
                required
              />
              <input
                type="password"
                placeholder={t('contrasena')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={intentos >= 3 || cargando}
                required
              />
              {error && <small className="text-danger d-block mb-2">{error}</small>}
              <button type="submit" className="btn btn-primary w-100 mt-2" disabled={intentos >= 3 || cargando}>
                {cargando ? '...' : t('login')}
              </button>
              <button
                type="button"
                className="btn btn-link btn-sm w-100 mt-2 login-link"
                onClick={() => setModoRecuperar(true)}
              >
                {t('olvidasteContrasena')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function RecuperarContrasena({ obtenerPreguntaSeguridad, recuperarContrasena, onListo }) {
  const [paso, setPaso] = useState(1);
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const buscarPregunta = (e) => {
    e.preventDefault();
    const p = obtenerPreguntaSeguridad(nombreUsuario);
    if (!p) { setError('No existe ese usuario.'); return; }
    setPregunta(p);
    setError('');
    setPaso(2);
  };

  const confirmar = async (e) => {
    e.preventDefault();
    const res = await recuperarContrasena({ nombreUsuario, respuestaSeguridad: respuesta, nuevaContrasena });
    if (!res.ok) { setError(res.error); return; }
    setMensaje('Contraseña actualizada. Ya puedes iniciar sesión.');
    setError('');
    setTimeout(onListo, 1200);
  };

  if (mensaje) return <div className="alert alert-success">{mensaje}</div>;

  return (
    <div>
      <h6 className="mb-3">Recuperar contraseña</h6>
      {paso === 1 && (
        <form onSubmit={buscarPregunta}>
          <input placeholder="Usuario" value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} required />
          {error && <small className="text-danger d-block mb-2">{error}</small>}
          <button className="btn btn-primary w-100 mt-2">Continuar</button>
        </form>
      )}
      {paso === 2 && (
        <form onSubmit={confirmar}>
          <div className="small text-muted mb-2">{pregunta}</div>
          <input placeholder="Respuesta" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} required />
          <input type="password" placeholder="Nueva contraseña" value={nuevaContrasena} onChange={(e) => setNuevaContrasena(e.target.value)} required minLength={4} />
          {error && <small className="text-danger d-block mb-2">{error}</small>}
          <button className="btn btn-primary w-100 mt-2">Actualizar contraseña</button>
        </form>
      )}
      <button className="btn btn-link btn-sm w-100 mt-2 login-link" onClick={onListo}>Cancelar</button>
    </div>
  );
}
