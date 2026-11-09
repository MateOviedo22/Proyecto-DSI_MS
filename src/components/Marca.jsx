// src/components/Marca.jsx
// Isotipo de MotoMan: un lente de cámara de acción dentro de un cuadrado redondeado.
export default function Marca({ tamano = 36 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 48 48" role="img" aria-label="MotoMan" className="marca-svg">
      <rect width="48" height="48" rx="12" fill="#2563EB" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="3" />
      <circle cx="24" cy="24" r="8" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="3.2" fill="#fff" />
      <circle cx="35.5" cy="12.5" r="2" fill="#7FB0FF" />
    </svg>
  );
}
