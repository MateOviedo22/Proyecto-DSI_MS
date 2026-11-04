// src/utils/exportar.js
// Descarga de datos desde el navegador (CSV compatible con Excel y JSON).

export function descargarArchivo(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const celda = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// filas: array de arrays (la primera fila son los encabezados)
export function descargarCSV(nombre, filas) {
  const csv = filas.map((f) => f.map(celda).join(',')).join('\r\n');
  descargarArchivo(nombre, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
}
