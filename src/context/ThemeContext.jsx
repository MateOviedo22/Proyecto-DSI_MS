// src/context/ThemeContext.jsx
// Tema claro/oscuro. Se guarda en localStorage y se aplica con data-bs-theme (Bootstrap 5.3).
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext({ modoOscuro: false, alternarTema: () => {}, setModoOscuro: () => {} });

const leerTemaInicial = () => {
  const guardado = localStorage.getItem('motoman_tema');
  if (guardado) return guardado === 'oscuro';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

export function ThemeProvider({ children }) {
  const [modoOscuro, setModoOscuro] = useState(leerTemaInicial);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', modoOscuro ? 'dark' : 'light');
    localStorage.setItem('motoman_tema', modoOscuro ? 'oscuro' : 'claro');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', modoOscuro ? '#0B1320' : '#F3F5F9');
  }, [modoOscuro]);

  const alternarTema = useCallback(() => setModoOscuro((v) => !v), []);

  return <ThemeContext.Provider value={{ modoOscuro, alternarTema, setModoOscuro }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
