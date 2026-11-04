import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { TextEncoder } from 'util';

global.TextEncoder = TextEncoder;
global.IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
window.print = jest.fn();

jest.mock('react-chartjs-2', () => ({ Bar: () => <div data-chart="bar" />, Doughnut: () => <div data-chart="doughnut" /> }));
jest.mock('chart.js', () => ({ Chart: { register: () => {} }, CategoryScale: {}, LinearScale: {}, BarElement: {}, ArcElement: {}, LineElement: {}, PointElement: {}, Tooltip: {}, Legend: {}, Filler: {} }));

const App = require('./App').default;

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const setValue = (el, value) => {
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const byText = (sel, txt) => Array.from(document.querySelectorAll(sel)).find((e) => e.textContent.trim().includes(txt));

let container, root;
beforeAll(async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<App />); });
});

const irA = async (ruta) => {
  await act(async () => { window.history.pushState({}, '', ruta); window.dispatchEvent(new PopStateEvent('popstate')); });
  await tick();
};

test('login incorrecto y correcto', async () => {
  expect(container.textContent).toContain('Iniciar sesión');
  const u = document.querySelector('#usuario'); const p = document.querySelector('#password');
  await act(async () => { setValue(u, 'admin'); setValue(p, 'mala'); });
  await act(async () => { click(byText('button', 'Iniciar sesión')); });
  await tick();
  expect(container.textContent).toContain('incorrectos');
  await act(async () => { setValue(document.querySelector('#password'), 'admin123'); });
  await act(async () => { click(byText('button[type=submit]', 'Iniciar sesión')); });
  await tick(); await tick();
  expect(container.textContent).toContain('Ventas de hoy');
  expect(container.textContent).toContain('Administrador');
});

test('todas las pantallas renderizan sin errores para el administrador', async () => {
  const errores = [];
  const spy = jest.spyOn(console, 'error').mockImplementation((...a) => errores.push(a.join(' ')));
  for (const ruta of ['/productos', '/productos?filtro=alertas', '/registrar-producto', '/productos/editar/prod_3', '/proveedores', '/compras', '/ingresar-inventario', '/registrar-venta', '/garantias', '/reportes', '/usuarios', '/configuracion', '/']) {
    await irA(ruta);
    expect(container.querySelector('.app-main').textContent.length).toBeGreaterThan(20);
  }
  spy.mockRestore();
  expect(errores).toEqual([]);
});

test('flujo: recibir compra con serie, vender, garantía, devolución y reportes', async () => {
  // 1. Compra de 2 cámaras con serie
  await irA('/compras');
  await act(async () => { click(byText('button.nav-link', 'Órdenes de compra')); });
  await act(async () => { click(byText('button', 'Nueva orden de compra')); });
  const selects = () => Array.from(container.querySelectorAll('form select'));
  await act(async () => { setValue(selects()[0], 'prov_2'); });
  await act(async () => { setValue(container.querySelectorAll('form select')[1], 'prod_1'); });
  const nums = Array.from(container.querySelectorAll('form input[type=number]'));
  await act(async () => { setValue(nums[1], '2'); setValue(nums[2], '6500'); });
  await act(async () => { click(byText('button', 'Registrar orden de compra')); });
  await tick();
  await act(async () => { click(byText('button', 'Recibir mercadería')); });
  const ta = container.querySelector('textarea');
  await act(async () => { setValue(ta, 'SN-100\nSN-200'); });
  await act(async () => { click(byText('button', 'Confirmar recepción')); });
  await tick();
  expect(JSON.parse(localStorage.getItem('motoman_numerosSerie')).length).toBe(2);
  expect(JSON.parse(localStorage.getItem('motoman_productos')).find((p) => p.id === 'prod_1').stockActual).toBe(10);

  // 2. Venta en línea de la cámara (elige serie) + trípode
  await irA('/registrar-venta');
  await act(async () => { click(byText('button.producto-tile', 'Cámara GoPro Hero 12')); });
  await act(async () => { click(byText('button.producto-tile', 'Trípode flexible Octopus')); });
  await act(async () => { click(byText('.seg button', 'En línea')); });
  expect(container.textContent).toContain('N.º de serie SN-100');
  await act(async () => { click(byText('button', 'Cobrar y emitir factura')); });
  await tick();
  let ventas = JSON.parse(localStorage.getItem('motoman_ventas'));
  expect(ventas.length).toBe(1);
  expect(ventas[0].numeroFactura).toBe('FAC-000001');
  expect(ventas[0].canal).toBe('linea');
  expect(ventas[0].total).toBe(9800 + 350);
  const prods = JSON.parse(localStorage.getItem('motoman_productos'));
  expect(prods.find((p) => p.id === 'prod_1').stockActual).toBe(9);
  expect(prods.find((p) => p.id === 'prod_2').stockActual).toBe(1);
  expect(JSON.parse(localStorage.getItem('motoman_numerosSerie')).find((s) => s.numero === 'SN-100').ventaId).toBe(ventas[0].id);
  expect(document.body.textContent).toContain('Factura FAC-000001');

  // 3. Garantía por serie
  await irA('/garantias');
  await act(async () => { setValue(container.querySelector('input[aria-label="Número de serie"]'), 'SN-100'); });
  await act(async () => { click(byText('button', 'Verificar')); });
  expect(container.textContent).toContain('Dentro de garantía');
  await act(async () => { setValue(container.querySelector('#g-desc'), 'No enciende'); });
  await act(async () => { click(byText('button', 'Registrar garantía')); });
  expect(JSON.parse(localStorage.getItem('motoman_garantias')).length).toBe(1);

  // 4. Devolución del trípode
  await act(async () => { click(byText('.seg button', 'Devoluciones')); });
  await act(async () => { setValue(container.querySelector('#d-venta'), ventas[0].id); });
  await act(async () => { setValue(container.querySelector('#d-linea'), 'prod_2|'); });
  await act(async () => { setValue(container.querySelector('#d-mot'), 'Defecto de fábrica'); });
  await act(async () => { click(byText('button', 'Registrar devolución')); });
  expect(JSON.parse(localStorage.getItem('motoman_devoluciones')).length).toBe(1);
  expect(JSON.parse(localStorage.getItem('motoman_productos')).find((p) => p.id === 'prod_2').stockActual).toBe(2);

  // 5. Reportes con datos reales
  await irA('/reportes');
  expect(container.textContent).toContain('Ventas netas');
  for (const t of ['Más vendidos', 'Categorías y variantes', 'Canales', 'Costos y ganancias', 'Inventario', 'Movimientos']) {
    await act(async () => { click(byText('button.nav-link', t)); });
    expect(container.querySelector('.imprimible').textContent.length).toBeGreaterThan(30);
  }
  await act(async () => { click(byText('button.nav-link', 'Costos y ganancias')); });
  // ingreso neto = 9800 (trípode devuelto), costo 6650 → ganancia 3150
  expect(container.textContent).toContain('C$ 9,800');
  expect(JSON.parse(localStorage.getItem('motoman_auditoria')).length).toBeGreaterThan(5);
});

test('permisos: el vendedor no ve usuarios ni configuración', async () => {
  await act(async () => { click(byText('button', 'Cerrar sesión')); });
  await tick();
  expect(container.textContent).toContain('Iniciar sesión');
  await act(async () => { setValue(document.querySelector('#usuario'), 'vendedor'); setValue(document.querySelector('#password'), 'venta123'); });
  await act(async () => { click(byText('button[type=submit]', 'Iniciar sesión')); });
  await tick(); await tick();
  const nav = container.querySelector('.sidebar').textContent;
  expect(nav).toContain('Ventas y facturación');
  expect(nav).not.toContain('Usuarios y roles');
  expect(nav).not.toContain('Reportes');
  await irA('/usuarios');
  expect(container.textContent).toContain('No tienes acceso');
});
