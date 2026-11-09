// src/data/storage.js
//
// Capa de persistencia temporal basada en localStorage.
// Funciona como una "base de datos" simulada mientras el backend real no
// existe. Cuando exista una API, estas funciones son el único lugar que
// hay que reemplazar por llamadas axios/fetch: los componentes que las
// usan (a través de DataContext) no deberían tener que cambiar.

const PREFIX = 'motoman_';
const CLAVES_NO_RESPALDABLES = ['sesion', 'tema', 'sidebar'];

export function getCollection(name) {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`No se pudo leer la colección "${name}" de localStorage:`, e);
    return [];
  }
}

export function getObject(name, fallback = {}) {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch (e) {
    console.error(`No se pudo leer "${name}" de localStorage:`, e);
    return fallback;
  }
}

export function saveCollection(name, data) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(data));
  } catch (e) {
    console.error(`No se pudo guardar "${name}" en localStorage:`, e);
  }
}

export function seedIfEmpty(name, seedData) {
  if (localStorage.getItem(PREFIX + name) === null) saveCollection(name, seedData);
}

let counter = 0;
export function generateId(prefix = 'id') {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}

// ---------------------------------------------------------------
// Respaldo y recuperación (RNF "Respaldo y recuperación")
// ---------------------------------------------------------------
export function exportarTodo() {
  const datos = {};
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .map((k) => k.slice(PREFIX.length))
    .filter((k) => !CLAVES_NO_RESPALDABLES.includes(k))
    .forEach((k) => {
      try {
        datos[k] = JSON.parse(localStorage.getItem(PREFIX + k));
      } catch {
        /* se omite una clave corrupta */
      }
    });
  return { sistema: 'MotoMan', version: 1, generado: new Date().toISOString(), datos };
}

export function importarTodo(respaldo) {
  if (!respaldo || respaldo.sistema !== 'MotoMan' || typeof respaldo.datos !== 'object') {
    return { ok: false, error: 'El archivo no es un respaldo válido de MotoMan.' };
  }
  const requeridas = ['productos', 'proveedores', 'usuarios'];
  if (!requeridas.every((k) => Array.isArray(respaldo.datos[k]))) {
    return { ok: false, error: 'El respaldo está incompleto (faltan productos, proveedores o usuarios).' };
  }
  Object.entries(respaldo.datos).forEach(([k, v]) => {
    if (!CLAVES_NO_RESPALDABLES.includes(k)) saveCollection(k, v);
  });
  return { ok: true };
}