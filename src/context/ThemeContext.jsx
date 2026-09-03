// src/context/ThemeContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [modoOscuro, setModoOscuro] = useState(() => localStorage.getItem('motoman_tema') === 'oscuro');

  useEffect(() => {
    // Bootstrap 5.3+ aplica automáticamente estilos oscuros a la mayoría de
    // sus componentes (tarjetas, tablas, formularios, navs) con este atributo.
    document.documentElement.setAttribute('data-bs-theme', modoOscuro ? 'dark' : 'light');
    localStorage.setItem('motoman_tema', modoOscuro ? 'oscuro' : 'claro');
  }, [modoOscuro]);

  const alternarTema = () => setModoOscuro((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ modoOscuro, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
