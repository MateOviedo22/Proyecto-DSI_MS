// src/utils/passwordHash.js
//
// Hashing de contraseñas usando la Web Crypto API (SHA-256 + salt aleatorio
// por usuario). Esto evita guardar contraseñas en texto plano en
// localStorage, que era el problema de seguridad señalado en la auditoría
// (incumplía RNF-14).
//
// Importante: esto sigue siendo hashing hecho en el navegador, sin backend.
// Es una mejora real frente a texto plano, pero NO sustituye un hashing
// del lado del servidor con bcrypt/argon2 y sus rondas de costo — eso debe
// hacerse cuando exista el backend.

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generarSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashConSalt(texto, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

export async function verificarConSalt(texto, salt, hashEsperado) {
  const hash = await hashConSalt(texto, salt);
  return hash === hashEsperado;
}
