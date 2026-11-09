// src/pages/Configuracion.jsx
// Cubre: RF-8 (umbral de alertas), RF-23 (redondeo por defecto), RF-38 (período de garantía),
// RNF de respaldo y recuperación, RNF de auditoría y trazabilidad.
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useUi } from '../context/UiContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { REGLAS_REDONDEO, fechaHora } from '../utils/formato';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'reglas', label: 'Reglas del negocio' },
  { id: 'respaldo', label: 'Respaldo' },
  { id: 'auditoria', label: 'Auditoría' },
];

export default function Configuracion() {
  const [tab, setTab] = useState('general');
  return (
    <div className="container-fluid">
      <PageHeader titulo="Configuración" descripcion="Datos de la empresa, reglas de inventario, respaldos y registro de operaciones." />
      <ul className="nav nav-tabs mb-4" role="tablist">
        {TABS.map((t) => (
          <li className="nav-item" key={t.id}><button type="button" role="tab" aria-selected={tab === t.id} className={`nav-link ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button></li>
        ))}
      </ul>
      {tab === 'general' && <General />}
      {tab === 'reglas' && <Reglas />}
      {tab === 'respaldo' && <Respaldo />}
      {tab === 'auditoria' && <Auditoria />}
    </div>
  );
}

function useFormConfig() {
  const { config, actualizarConfig } = useData();
  const { notificar } = useUi();
  const [form, setForm] = useState(config);
  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : type === 'number' ? value : value }));
  };
  const guardar = (campos, detalle) => (e) => {
    e.preventDefault();
    const cambios = {};
    campos.forEach((c) => { cambios[c] = typeof config[c] === 'number' ? Number(form[c]) : form[c]; });
    actualizarConfig(cambios, detalle);
    notificar('Configuración guardada.');
  };
  return { form, cambiar, guardar };
}

function General() {
  const { form, cambiar, guardar } = useFormConfig();
  const { modoOscuro, setModoOscuro } = useTheme();
  return (
    <div className="reporte-grid">
      <form className="panel col-8x" onSubmit={guardar(['nombreEmpresa', 'razonSocial', 'ruc', 'direccion', 'telefono', 'pieFactura'], 'Datos de empresa y factura')}>
        <h2 className="panel-titulo">Empresa y factura</h2>
        <p className="panel-sub">Estos datos aparecen en el encabezado de cada factura.</p>
        <div className="row g-3">
          <div className="col-md-6"><label htmlFor="c-nombre">Nombre comercial</label><input id="c-nombre" name="nombreEmpresa" className="form-control" value={form.nombreEmpresa} onChange={cambiar} /></div>
          <div className="col-md-6"><label htmlFor="c-razon">Razón social</label><input id="c-razon" name="razonSocial" className="form-control" value={form.razonSocial} onChange={cambiar} /></div>
          <div className="col-md-4"><label htmlFor="c-ruc">RUC</label><input id="c-ruc" name="ruc" className="form-control" value={form.ruc} onChange={cambiar} /></div>
          <div className="col-md-4"><label htmlFor="c-tel">Teléfono</label><input id="c-tel" name="telefono" className="form-control" value={form.telefono} onChange={cambiar} /></div>
          <div className="col-md-4"><label htmlFor="c-dir">Dirección</label><input id="c-dir" name="direccion" className="form-control" value={form.direccion} onChange={cambiar} /></div>
          <div className="col-12"><label htmlFor="c-pie">Mensaje al pie de la factura</label><textarea id="c-pie" name="pieFactura" rows={2} className="form-control" value={form.pieFactura} onChange={cambiar} /></div>
        </div>
        <div className="text-end mt-3"><button className="btn btn-primary">Guardar cambios</button></div>
      </form>

      <section className="panel col-4x">
        <h2 className="panel-titulo">Apariencia</h2>
        <p className="panel-sub">Se guarda en este navegador.</p>
        <div className="seg seg-completo mb-3">
          <button type="button" className={!modoOscuro ? 'activo' : ''} onClick={() => setModoOscuro(false)}><i className="bi bi-sun me-2"></i>Claro</button>
          <button type="button" className={modoOscuro ? 'activo' : ''} onClick={() => setModoOscuro(true)}><i className="bi bi-moon-stars me-2"></i>Oscuro</button>
        </div>
        <form onSubmit={guardar(['mostrarGraficas'], 'Preferencia de gráficas del inicio')}>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" role="switch" id="c-graf" name="mostrarGraficas" checked={form.mostrarGraficas} onChange={cambiar} />
            <label className="form-check-label" htmlFor="c-graf">Mostrar gráficas en el inicio</label>
          </div>
          <button className="btn btn-outline-primary btn-sm mt-3">Guardar</button>
        </form>
      </section>
    </div>
  );
}

function Reglas() {
  const { form, cambiar, guardar } = useFormConfig();
  return (
    <form className="panel" onSubmit={guardar(['umbralStock', 'diasGarantia', 'umbralAltaRotacion', 'ventanaRotacionDias', 'reglaRedondeo'], 'Reglas del negocio')}>
      <h2 className="panel-titulo">Reglas del negocio</h2>
      <p className="panel-sub">Controlan las alertas de stock, la garantía de las cámaras y el redondeo de precios.</p>
      <div className="row g-3">
        <div className="col-md-4">
          <label htmlFor="r-umbral">Mínimo de stock por defecto</label>
          <input id="r-umbral" name="umbralStock" type="number" min="0" className="form-control" value={form.umbralStock} onChange={cambiar} />
          <div className="form-text">Se usa en productos que no tienen un mínimo propio.</div>
        </div>
        <div className="col-md-4">
          <label htmlFor="r-garantia">Período de garantía (días)</label>
          <input id="r-garantia" name="diasGarantia" type="number" min="1" className="form-control" value={form.diasGarantia} onChange={cambiar} />
          <div className="form-text">Valor sugerido al registrar productos con número de serie. Cada producto guarda sus propios días de garantía y el servidor aplica esos.</div>
        </div>
        <div className="col-md-4">
          <label htmlFor="r-redondeo">Redondeo de precios sugerido</label>
          <select id="r-redondeo" name="reglaRedondeo" className="form-select" value={form.reglaRedondeo} onChange={cambiar}>{REGLAS_REDONDEO.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}</select>
        </div>
        <div className="col-md-4">
          <label htmlFor="r-rot">Unidades para alta rotación</label>
          <input id="r-rot" name="umbralAltaRotacion" type="number" min="0" className="form-control" value={form.umbralAltaRotacion} onChange={cambiar} />
        </div>
        <div className="col-md-4">
          <label htmlFor="r-vent">Ventana de rotación (días)</label>
          <input id="r-vent" name="ventanaRotacionDias" type="number" min="1" className="form-control" value={form.ventanaRotacionDias} onChange={cambiar} />
          <div className="form-text">Útil para temporadas altas como diciembre.</div>
        </div>
      </div>
      <div className="text-end mt-3"><button className="btn btn-primary">Guardar cambios</button></div>
    </form>
  );
}

function Respaldo() {
  return (
    <div className="reporte-grid">
      <section className="panel col-6x">
        <h2 className="panel-titulo">Respaldo en el servidor</h2>
        <p className="panel-sub">Los datos del sistema viven en PostgreSQL, no en este navegador. El respaldo se hace desde el servidor.</p>
        <p className="mb-2">Crear un respaldo (en la máquina del servidor):</p>
        <pre className="border p-2 small mb-0" style={{ background: 'var(--mm-surface-2)', overflowX: 'auto' }}><code>pg_dump -U postgres -Fc motoman &gt; motoman-respaldo.dump</code></pre>
      </section>
      <section className="panel col-6x">
        <h2 className="panel-titulo">Restaurar desde un respaldo</h2>
        <p className="panel-sub">Recupera la información a partir de un archivo generado antes. Reemplaza los datos actuales.</p>
        <pre className="border p-2 small mb-0" style={{ background: 'var(--mm-surface-2)', overflowX: 'auto' }}><code>pg_restore -U postgres -d motoman --clean motoman-respaldo.dump</code></pre>
      </section>
    </div>
  );
}

function Auditoria() {
  const { auditoria } = useData();
  const [texto, setTexto] = useState('');
  const [modulo, setModulo] = useState('');
  const modulos = Array.from(new Set(auditoria.map((a) => a.modulo))).sort();
  const lista = auditoria.filter((a) => (!modulo || a.modulo === modulo) && (!texto.trim() || `${a.usuario} ${a.accion} ${a.detalle}`.toLowerCase().includes(texto.trim().toLowerCase())));

  return (
    <>
      <div className="alert alert-info" role="status">Este registro corresponde a la actividad de esta sesión en este navegador. El historial permanente de movimientos de inventario, compras y ventas está en el servidor.</div>
      <div className="toolbar">
        <div className="campo-icono grow"><i className="bi bi-search"></i><input className="form-control" placeholder="Buscar por usuario, acción o detalle…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar en la auditoría" /></div>
        <select className="form-select" style={{ maxWidth: 220 }} value={modulo} onChange={(e) => setModulo(e.target.value)} aria-label="Módulo">
          <option value="">Todos los módulos</option>{modulos.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div className="table-responsive bg-white">
        <table className="table table-sm table-hover align-middle">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Módulo</th><th>Operación</th><th>Detalle</th></tr></thead>
          <tbody>
            {lista.slice(0, 300).map((a) => (
              <tr key={a.id}><td className="text-nowrap">{fechaHora(a.fecha)}</td><td className="fw-semibold">{a.usuario}</td><td>{a.modulo}</td><td>{a.accion}</td><td className="texto-suave">{a.detalle}</td></tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={5}><EmptyState icono="bi-journal-text" titulo="Sin operaciones registradas" /></td></tr>}
          </tbody>
        </table>
        {lista.length > 300 && <div className="texto-suave p-2">Se muestran las 300 más recientes de {lista.length}.</div>}
      </div>
    </>
  );
}
