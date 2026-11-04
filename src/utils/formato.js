// src/utils/formato.js
// Formateo de moneda, fechas y números para toda la interfaz.

const nf0 = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const moneda = (n) => `C$ ${nf2.format(Number(n) || 0)}`;
export const monedaEntera = (n) => `C$ ${nf0.format(Math.round(Number(n) || 0))}`;
export const numero = (n) => nf0.format(Number(n) || 0);
export const porcentaje = (n, d = 1) => (n === null || n === undefined || Number.isNaN(n) ? '—' : `${Number(n).toFixed(d)}%`);

export const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-NI', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// "YYYY-MM-DD" en hora local (para inputs type="date")
export const aInputFecha = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const inicioDelDia = (yyyyMmDd) => new Date(`${yyyyMmDd}T00:00:00`);
export const finDelDia = (yyyyMmDd) => new Date(`${yyyyMmDd}T23:59:59.999`);
export const esHoy = (iso) => new Date(iso).toDateString() === new Date().toDateString();
export const diasEntre = (isoA, isoB = new Date().toISOString()) =>
  Math.floor((new Date(isoB).getTime() - new Date(isoA).getTime()) / 86400000);

export const saludo = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

// Redondeo de precios (RF-23 / RNF "precios sin decimales")
export const REGLAS_REDONDEO = [
  { valor: '0', label: 'Sin redondeo' },
  { valor: '1', label: 'Entero más cercano' },
  { valor: '5', label: 'Múltiplo de 5' },
  { valor: '10', label: 'Múltiplo de 10' },
  { valor: '50', label: 'Múltiplo de 50' },
];
export const redondear = (precio, regla) => {
  const r = Number(regla);
  const p = Number(precio) || 0;
  if (!r) return Math.round(p * 100) / 100;
  return r === 1 ? Math.round(p) : Math.round(p / r) * r;
};

export const MOTIVOS = {
  compra: 'Recepción de compra',
  venta: 'Venta',
  devolucion_cliente: 'Devolución de cliente',
  devolucion_proveedor: 'Devolución a proveedor',
  perdida: 'Pérdida o daño',
  ajuste: 'Ajuste de inventario',
  ajuste_inicial: 'Existencia inicial',
};
