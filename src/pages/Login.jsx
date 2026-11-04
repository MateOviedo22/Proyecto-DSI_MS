// src/pages/Login.jsx
// Cubre: RF-49 (inicio de sesión), RF-50 (recuperación de contraseña), RNF de seguridad.
import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import Marca from '../components/Marca';

const MAX_INTENTOS = 3;
const SEGUNDOS_BLOQUEO = 30;

function LenteDecorativo() {
  return (
    <svg className="login-lente" viewBox="0 0 400 400" aria-hidden="true">
      <circle cx="200" cy="200" r="190" fill="none" stroke="#4f8cff" strokeOpacity=".18" strokeWidth="2" />
      <circle cx="200" cy="200" r="148" fill="none" stroke="#4f8cff" strokeOpacity=".28" strokeWidth="2" />
      <circle cx="200" cy="200" r="106" fill="none" stroke="#4f8cff" strokeOpacity=".4" strokeWidth="3" />
      <circle cx="200" cy="200" r="64" fill="#2563eb" fillOpacity=".25" stroke="#7fb0ff" strokeOpacity=".6" strokeWidth="3" />
      <circle cx="200" cy="200" r="22" fill="#7fb0ff" fillOpacity=".7" />
      <circle cx="262" cy="138" r="10" fill="#fff" fillOpacity=".55" />
    </svg>
  );
}

export default function Login() {
  const { verificarCredenciales, iniciarSesion, obtenerPreguntaSeguridad, recuperarContrasena } = useData();
  const [modo, setModo] = useState('ingreso'); // ingreso | recuperar
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  // Recuperación
  const [paso, setPaso] = useState(1);
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [exito, setExito] = useState('');

  const segundosRestantes = Math.max(0, Math.ceil((bloqueadoHasta - ahora) / 1000));
  const bloqueado = segundosRestantes > 0;

  useEffect(() => {
    if (!bloqueado) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(t);
  }, [bloqueado]);

  const ingresar = async (e) => {
    e.preventDefault();
    if (bloqueado || cargando) return;
    setCargando(true);
    const res = await verificarCredenciales(usuario, password);
    setCargando(false);
    if (res.ok) {
      iniciarSesion(res.usuario);
      return;
    }
    const n = intentos + 1;
    setPassword('');
    if (n >= MAX_INTENTOS) {
      setIntentos(0);
      setBloqueadoHasta(Date.now() + SEGUNDOS_BLOQUEO * 1000);
      setAhora(Date.now());
      setError('');
    } else {
      setIntentos(n);
      setError(`${res.error} Te quedan ${MAX_INTENTOS - n} intento(s).`);
    }
  };

  const abrirRecuperacion = () => {
    setModo('recuperar'); setPaso(1); setError(''); setExito(''); setRespuesta(''); setNueva(''); setRepetir('');
  };

  const buscarPregunta = (e) => {
    e.preventDefault();
    const p = obtenerPreguntaSeguridad(usuario);
    if (!p) return setError('No encontramos un usuario activo con ese nombre.');
    setPregunta(p); setPaso(2); setError('');
  };

  const restablecer = async (e) => {
    e.preventDefault();
    if (nueva.length < 6) return setError('La nueva contraseña debe tener al menos 6 caracteres.');
    if (nueva !== repetir) return setError('Las contraseñas no coinciden.');
    setCargando(true);
    const res = await recuperarContrasena({ nombreUsuario: usuario, respuestaSeguridad: respuesta, nuevaContrasena: nueva });
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setExito('Contraseña actualizada. Ya puedes iniciar sesión.');
    setModo('ingreso'); setPassword(''); setError('');
  };

  return (
    <div className="login-pagina">
      <div className="login-caja">
        <section className="login-marca">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Marca tamano={44} />
            <h1>MotoMan</h1>
            <p>Gestión moderna de inventario y ventas para tu tienda de cámaras de acción y accesorios.</p>
          </div>
          <ul className="login-puntos">
            <li><i className="bi bi-box-seam"></i>Existencias al día, con alertas de stock bajo</li>
            <li><i className="bi bi-upc-scan"></i>Trazabilidad por lote y número de serie</li>
            <li><i className="bi bi-receipt"></i>Ventas en piso y en línea con factura</li>
          </ul>
          <LenteDecorativo />
        </section>

        <section className="login-form">
          {modo === 'ingreso' ? (
            <form onSubmit={ingresar} noValidate>
              <h2>Iniciar sesión</h2>
              <p className="texto-suave mb-4">Ingresa con tu usuario y contraseña.</p>

              {exito && <div className="alert alert-success" role="status">{exito}</div>}

              <div className="mb-3">
                <label htmlFor="usuario">Usuario</label>
                <input id="usuario" className="form-control" autoComplete="username" autoFocus value={usuario} onChange={(e) => setUsuario(e.target.value)} disabled={bloqueado} required />
              </div>
              <div className="mb-3">
                <label htmlFor="password">Contraseña</label>
                <div className="position-relative">
                  <input id="password" type={verPassword ? 'text' : 'password'} className="form-control pe-5" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={bloqueado} required />
                  <button type="button" className="btn-icono login-ojo" onClick={() => setVerPassword((v) => !v)} aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    <i className={`bi ${verPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>

              {bloqueado && (
                <div className="alert alert-danger" role="alert">
                  Demasiados intentos fallidos. Vuelve a intentarlo en {segundosRestantes} s.
                </div>
              )}
              {error && !bloqueado && <div className="alert alert-danger" role="alert">{error}</div>}

              <button type="submit" className="btn btn-primary btn-lg w-100" disabled={bloqueado || cargando || !usuario || !password}>
                {cargando ? 'Verificando…' : 'Iniciar sesión'}
              </button>
              <div className="text-center mt-3">
                <button type="button" className="login-enlace" onClick={abrirRecuperacion}>¿Olvidaste tu contraseña?</button>
              </div>
            </form>
          ) : (
            <form onSubmit={paso === 1 ? buscarPregunta : restablecer} noValidate>
              <h2>Recuperar contraseña</h2>
              <p className="texto-suave mb-4">{paso === 1 ? 'Escribe tu usuario para ver tu pregunta de seguridad.' : 'Responde tu pregunta y elige una nueva contraseña.'}</p>

              <div className="mb-3">
                <label htmlFor="rec-usuario">Usuario</label>
                <input id="rec-usuario" className="form-control" value={usuario} onChange={(e) => setUsuario(e.target.value)} disabled={paso === 2} autoFocus required />
              </div>

              {paso === 2 && (
                <>
                  <div className="mb-3">
                    <label htmlFor="rec-resp">{pregunta}</label>
                    <input id="rec-resp" className="form-control" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} autoFocus required />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-sm-6">
                      <label htmlFor="rec-nueva">Nueva contraseña</label>
                      <input id="rec-nueva" type="password" className="form-control" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} required />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="rec-rep">Repetir contraseña</label>
                      <input id="rec-rep" type="password" className="form-control" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
                    </div>
                  </div>
                </>
              )}

              {error && <div className="alert alert-danger" role="alert">{error}</div>}

              <button type="submit" className="btn btn-primary btn-lg w-100" disabled={cargando || !usuario}>
                {paso === 1 ? 'Continuar' : cargando ? 'Guardando…' : 'Guardar nueva contraseña'}
              </button>
              <div className="text-center mt-3">
                <button type="button" className="login-enlace" onClick={() => { setModo('ingreso'); setError(''); }}>Volver a iniciar sesión</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
