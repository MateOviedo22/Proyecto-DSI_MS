// src/components/FacturaModal.jsx
// Cubre: RF-34 (factura con el precio registrado). Se imprime con el navegador (Ctrl+P / "Imprimir").
import Modal from './Modal';
import { useData } from '../context/DataContext';
import { moneda, fechaHora } from '../utils/formato';

export default function FacturaModal({ venta, onCerrar }) {
  const { config } = useData();
  if (!venta) return null;

  // Datos del emisor guardados en la factura al emitirla; si no vienen (historial), los de la configuración.
  const emisor = venta.emisor
    ? { nombre: venta.emisor.nombre, razon: venta.emisor.razon_social, ruc: venta.emisor.ruc, direccion: venta.emisor.direccion, telefono: venta.emisor.telefono }
    : { nombre: config.nombreEmpresa, razon: config.razonSocial, ruc: config.ruc, direccion: config.direccion, telefono: config.telefono };

  return (
    <Modal
      abierto={Boolean(venta)}
      onCerrar={onCerrar}
      titulo={`Factura ${venta.numeroFactura}`}
      tamano="md"
      pie={
        <>
          <button type="button" className="btn btn-outline-secondary no-imprimir" onClick={onCerrar}>Cerrar</button>
          <button type="button" className="btn btn-primary no-imprimir" onClick={() => window.print()}>
            <i className="bi bi-printer me-2"></i>Imprimir
          </button>
        </>
      }
    >
      <div className="factura imprimible">
        <div className="d-flex justify-content-between flex-wrap gap-2">
          <div>
            <h3>{emisor.nombre}</h3>
            <div>{emisor.razon}</div>
            {emisor.ruc && <div>RUC: {emisor.ruc}</div>}
            {emisor.direccion && <div>{emisor.direccion}</div>}
            {emisor.telefono && <div>Tel. {emisor.telefono}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: '1.05rem' }}>{venta.numeroFactura}</strong>
            <div>{fechaHora(venta.fecha)}</div>
            <div>{venta.canal === 'piso' ? 'Venta en piso' : 'Venta en línea'}</div>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div><strong>Cliente:</strong> {venta.cliente}</div>
          <div><strong>Método de pago:</strong> {venta.metodoPago}</div>
          {venta.vendedor && <div><strong>Atendió:</strong> {venta.vendedor}</div>}
        </div>

        <table>
          <thead>
            <tr><th>Descripción</th><th className="der">Cant.</th><th className="der">Precio</th><th className="der">Importe</th></tr>
          </thead>
          <tbody>
            {venta.items.map((it, i) => (
              <tr key={i}>
                <td>
                  {it.nombre}{it.varianteValor ? ` — ${it.varianteValor}` : ''}
                  {it.numeroSerie && <div style={{ color: '#5a6b82', fontSize: '0.8rem' }}>N.º de serie: {it.numeroSerie}</div>}
                </td>
                <td className="der">{it.cantidad}</td>
                <td className="der">{moneda(it.precioUnitario)}</td>
                <td className="der">{moneda(it.cantidad * it.precioUnitario)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="total"><span>Total</span><span>{moneda(venta.total)}</span></div>
        <div className="pie">{config.pieFactura}</div>
      </div>
    </Modal>
  );
}
