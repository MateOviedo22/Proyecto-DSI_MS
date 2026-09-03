// src/data/storage.js
//
// Capa de persistencia temporal basada en localStorage.
// Funciona como una "base de datos" simulada mientras el backend real no
// existe (RF/RNF que dependen de un servidor quedan pendientes hasta esa
// etapa). Cuando exista una API, estas funciones son el único lugar que
// hay que reemplazar por llamadas axios/fetch: los componentes que las
// usan (a través de DataContext) no deberían tener que cambiar.

const PREFIX = "motoman_";

export function getCollection(name) {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`No se pudo leer la colección "${name}" de localStorage:`, e);
    return [];
  }
}

export function saveCollection(name, data) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(data));
  } catch (e) {
    console.error(`No se pudo guardar la colección "${name}" en localStorage:`, e);
  }
}

export function seedIfEmpty(name, seedData) {
  const existing = localStorage.getItem(PREFIX + name);
  if (existing === null) {
    saveCollection(name, seedData);
  }
}

let counter = 0;
export function generateId(prefix = "id") {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}
