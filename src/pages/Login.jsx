
import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { iniciarSesion as iniciarSesionAPI } from '../api/auth';
import Marca from '../components/Marca';

const MAX_INTENTOS = 3;
const SEGUNDOS_BLOQUEO = 30;
const CLAVE_BLOQUEO = 'mm_bloqueo';

// El bloqueo se conserva aunque se recargue la página.
const leerBloqueo = () => {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE_BLOQUEO));
    return {
      intentos: Number(b?.intentos) || 0,
      hasta: Number(b?.hasta) || 0,
    };
  } catch {
    return { intentos: 0, hasta: 0 };
  }
};

const guardarBloqueo = (intentos, hasta) => {
  localStorage.setItem(
    CLAVE_BLOQUEO,
    JSON.stringify({ intentos, hasta })
  );
};

const limpiarBloqueo = () => {
  localStorage.removeItem(CLAVE_BLOQUEO);
};

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
  const { iniciarSesion } = useData();

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);

  const [intentos, setIntentos] = useState(() => leerBloqueo().intentos);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(() => leerBloqueo().hasta);
  const [ahora, setAhora] = useState(Date.now());

  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const segundosRestantes = Math.max(
    0,
    Math.ceil((bloqueadoHasta - ahora) / 1000)
  );

  const bloqueado = segundosRestantes > 0;

  useEffect(() => {
    if (!bloqueado) return undefined;

    const intervalo = setInterval(() => {
      setAhora(Date.now());
    }, 500);

    return () => clearInterval(intervalo);
  }, [bloqueado]);

  // Si el bloqueo termina, se limpia el registro de intentos.
  useEffect(() => {
    if (bloqueadoHasta && segundosRestantes === 0) {
      limpiarBloqueo();
      setIntentos(0);
      setBloqueadoHasta(0);
    }
  }, [bloqueadoHasta, segundosRestantes]);

  const ingresar = async (e) => {
    e.preventDefault();

    if (bloqueado || cargando) return;

    if (!usuario.trim() || !password) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }

    setCargando(true);
    setError('');

    try {
      // 1. Solicitar autenticación al backend.
      const respuesta = await iniciarSesionAPI({
        username: usuario.trim(),
        password,
      });

      // 2. Comprobar que el backend devolvió el usuario.
      if (!respuesta?.usuario) {
        throw new Error(
          'El servidor no devolvió los datos del usuario.'
        );
      }

      // 3. Limpiar el registro de intentos fallidos.
      limpiarBloqueo();
      setIntentos(0);
      setBloqueadoHasta(0);
      setPassword('');

      // 4. Actualizar la sesión global de React.
      iniciarSesion(respuesta.usuario);

      // La aplicación puede detectar usuarioActual y mostrar el sistema.
    } catch (err) {
      const mensaje =
        err.response?.data?.error ||
        err.response?.data?.mensaje ||
        err.response?.data?.message ||
        err.message ||
        'No fue posible iniciar sesión.';

      // Si el servidor no respondió no es una contraseña incorrecta: no cuenta como intento.
      if (err.red) {
        setError(err.message);
        return;
      }

      const nuevoIntento = intentos + 1;

      setPassword('');

      if (nuevoIntento >= MAX_INTENTOS) {
        const hasta = Date.now() + SEGUNDOS_BLOQUEO * 1000;

        setIntentos(0);
        setBloqueadoHasta(hasta);
        guardarBloqueo(0, hasta);
        setAhora(Date.now());
        setError('');
      } else {
        setIntentos(nuevoIntento);
        guardarBloqueo(nuevoIntento, 0);

        setError(
          `${mensaje} Te quedan ${MAX_INTENTOS - nuevoIntento} intento(s).`
        );
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-pagina">
      <div className="login-caja">
        <section className="login-marca">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Marca alto={190} className="login-logo" />
            <p>
              Gestión moderna de inventario y ventas para tu tienda
              de cámaras de acción y accesorios.
            </p>
          </div>

          <ul className="login-puntos">
            <li>
              <i className="bi bi-box-seam"></i>
              Existencias al día, con alertas de stock bajo
            </li>
            <li>
              <i className="bi bi-upc-scan"></i>
              Trazabilidad por lote y número de serie
            </li>
            <li>
              <i className="bi bi-receipt"></i>
              Ventas en piso y en línea con factura
            </li>
          </ul>

          <LenteDecorativo />
        </section>

        <section className="login-form">
          <form onSubmit={ingresar} noValidate>
            <h2>Iniciar sesión</h2>

            <p className="texto-suave mb-4">
              Ingresa con tu usuario y contraseña.
            </p>

            <div className="mb-3">
              <label htmlFor="usuario">Usuario</label>

              <input
                id="usuario"
                type="text"
                className="form-control"
                autoComplete="username"
                autoFocus
                value={usuario}
                onChange={(e) => {
                  setUsuario(e.target.value);
                  setError('');
                }}
                disabled={bloqueado || cargando}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password">Contraseña</label>

              <div className="position-relative">
                <input
                  id="password"
                  type={verPassword ? 'text' : 'password'}
                  className="form-control pe-5"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  disabled={bloqueado || cargando}
                  required
                />

                <button
                  type="button"
                  className="btn-icono login-ojo"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={
                    verPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  disabled={cargando}
                >
                  <i
                    className={`bi ${
                      verPassword ? 'bi-eye-slash' : 'bi-eye'
                    }`}
                  ></i>
                </button>
              </div>
            </div>

            {bloqueado && (
              <div className="alert alert-danger" role="alert">
                Demasiados intentos fallidos. Vuelve a intentarlo en{' '}
                {segundosRestantes} s.
              </div>
            )}

            {error && !bloqueado && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg w-100"
              disabled={
                bloqueado ||
                cargando ||
                !usuario.trim() ||
                !password
              }
            >
              {cargando ? 'Verificando…' : 'Iniciar sesión'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
