// src/utils/graficos.js
// Registro único de Chart.js y paleta que respeta el tema claro/oscuro.
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend, Filler);

export const paleta = (oscuro) => ({
  texto: oscuro ? '#94a5bc' : '#5a6b82',
  rejilla: oscuro ? 'rgba(148,165,188,.14)' : 'rgba(90,107,130,.14)',
  piso: oscuro ? '#4f8cff' : '#2563eb',
  linea: oscuro ? '#2dd4bf' : '#0d9488',
  ok: oscuro ? '#34d399' : '#0b8f63',
  warn: oscuro ? '#fbbf24' : '#d68a00',
  danger: oscuro ? '#f87171' : '#cf3535',
  serie: oscuro
    ? ['#4f8cff', '#2dd4bf', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c', '#94a3b8']
    : ['#2563eb', '#0d9488', '#d68a00', '#db2777', '#7c3aed', '#ea580c', '#64748b'],
});

export const opcionesEjes = (oscuro, { apilado = false, moneda = false, horizontal = false } = {}) => {
  const c = paleta(oscuro);
  const formato = (v) => (moneda ? `C$ ${Number(v).toLocaleString('es-NI')}` : v);
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { position: 'bottom', labels: { color: c.texto, usePointStyle: true, boxWidth: 8, font: { family: 'Figtree, system-ui, sans-serif' } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label ? `${ctx.dataset.label}: ` : ''}${moneda ? formato(ctx.parsed[horizontal ? 'x' : 'y']) : ctx.parsed[horizontal ? 'x' : 'y']}` } },
    },
    scales: {
      x: { stacked: apilado, grid: { display: horizontal, color: c.rejilla }, ticks: { color: c.texto, ...(horizontal ? { callback: (v) => formato(v) } : {}) }, border: { display: false } },
      y: { stacked: apilado, beginAtZero: true, grid: { display: !horizontal, color: c.rejilla }, ticks: { color: c.texto, ...(horizontal ? {} : { callback: (v) => formato(v) }) }, border: { display: false } },
    },
  };
};

export const opcionesDona = (oscuro) => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '64%',
  plugins: { legend: { position: 'bottom', labels: { color: paleta(oscuro).texto, usePointStyle: true, boxWidth: 8 } } },
});
