// src/components/Marca.jsx
// Logo de MotoMan · Moto Adictos de Nicaragua. El archivo está en public/logo-motoman.png
// (PNG con fondo transparente, que se ve bien sobre el azul del menú y sobre el blanco).
// `alto` es la altura en píxeles; el ancho se calcula solo para no deformar la imagen.
export default function Marca({ alto, tamano = 56, className = '' }) {
  const altura = alto || tamano;
  return (
    <img
      src={`${process.env.PUBLIC_URL}/logo-motoman.png`}
      alt="MotoMan · Moto Adictos de Nicaragua"
      style={{ height: altura, width: 'auto' }}
      className={`marca-logo ${className}`.trim()}
      draggable="false"
    />
  );
}
