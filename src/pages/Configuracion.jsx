import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, useT } from '../context/LanguageContext';

export default function Configuracion() {
  const { modoOscuro, alternarTema } = useTheme();
  const { idioma, setIdioma } = useLanguage();
  const t = useT();

  const [config, setConfig] = useState({
    nombreEmpresa: 'MotoMan',
    umbralStock: 5,
    alertasEmail: true,
    mostrarEstadisticas: true,
    diaCorte: 'Lunes',
  });

  const manejarCambio = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig({ ...config, [name]: type === 'checkbox' ? checked : value });
  };

  const guardar = () => {
    alert('Configuración actualizada');
    console.log(config);
    // Futuro: axios.post('/api/configuracion', config);
  };

  return (
    <div className="container p-4">
      <h2>{t('configuracion')} del Sistema</h2>

      {/* Tema e idioma: se aplican al instante en toda la aplicación */}
      <div className="row g-3 bg-body-tertiary p-4 rounded shadow-sm mb-3">
        <div className="col-md-6">
          <label className="d-block mb-1">{t('tema')}</label>
          <div className="btn-group" role="group">
            <button type="button" className={`btn ${!modoOscuro ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => modoOscuro && alternarTema()}>
              <i className="bi bi-sun me-1"></i>{t('modoClaro')}
            </button>
            <button type="button" className={`btn ${modoOscuro ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => !modoOscuro && alternarTema()}>
              <i className="bi bi-moon-stars me-1"></i>{t('modoOscuro')}
            </button>
          </div>
        </div>
        <div className="col-md-6">
          <label className="d-block mb-1">{t('idioma')}</label>
          <div className="btn-group" role="group">
            <button type="button" className={`btn ${idioma === 'es' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setIdioma('es')}>Español</button>
            <button type="button" className={`btn ${idioma === 'en' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setIdioma('en')}>English</button>
          </div>
        </div>
      </div>

      <form className="row g-3 bg-body-tertiary p-4 rounded shadow-sm">
        <div className="col-md-6">
          <label>Nombre de la empresa</label>
          <input className="form-control" name="nombreEmpresa" value={config.nombreEmpresa} onChange={manejarCambio} />
        </div>

        <div className="col-md-3">
          <label>Umbral mínimo de stock (por defecto)</label>
          <input type="number" className="form-control" name="umbralStock" value={config.umbralStock} onChange={manejarCambio} />
        </div>

        <div className="col-md-3">
          <label>Día de corte de reportes</label>
          <select className="form-select" name="diaCorte" value={config.diaCorte} onChange={manejarCambio}>
            <option>Lunes</option>
            <option>Miércoles</option>
            <option>Viernes</option>
          </select>
        </div>

        <div className="col-12">
          <div className="form-check">
            <input className="form-check-input" type="checkbox" name="alertasEmail" checked={config.alertasEmail} onChange={manejarCambio} />
            <label className="form-check-label">Habilitar alertas por correo</label>
          </div>

          <div className="form-check mt-2">
            <input className="form-check-input" type="checkbox" name="mostrarEstadisticas" checked={config.mostrarEstadisticas} onChange={manejarCambio} />
            <label className="form-check-label">Mostrar gráficas en dashboard</label>
          </div>
        </div>

        <div className="col-12 text-end">
          <button type="button" className="btn btn-primary" onClick={guardar}>Guardar cambios</button>
        </div>
      </form>
    </div>
  );
}
