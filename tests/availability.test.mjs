import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'node:crypto';

function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (id) => {
      assert.ok(Object.hasOwn(dependencies, id), "Dependencia inesperada: " + id);
      return dependencies[id];
    },
    Response, URL, Math, ...globals,
  });
  return exports;
}
const { BOLETA_LIBRE_FILTER } = load('lib/boleta-availability.ts');
function split(expression) {
  let depth = 0, start = 0;
  const parts = [];
  for (let i = 0; i < expression.length; i++) {
    if (expression[i] === '(') depth++;
    if (expression[i] === ')') depth--;
    if (expression[i] === ',' && depth === 0) { parts.push(expression.slice(start, i)); start = i + 1; }
  }
  parts.push(expression.slice(start));
  return parts;
}
function matches(expression, row) {
  if (expression.startsWith('and(')) return split(expression.slice(4, -1)).every((x) => matches(x, row));
  if (expression.startsWith('or(')) return split(expression.slice(3, -1)).some((x) => matches(x, row));
  const [field, operator, ...tail] = expression.split('.');
  const value = tail.join('.');
  if (operator === 'is') return row[field] == null;
  if (operator === 'eq') return String(row[field]) === (value === '""' ? '' : value);
  if (operator === 'lt') return row[field] != null && row[field] < value;
  throw new Error(expression);
}
const base = { empresa_id: 'empresa', proyecto_id: 'proyecto', vendedor_nombre: 'Oficina', vendedor_user_id: null, estado: 'Disponible', nombre_cliente: null, telefono_cliente: null, valor_pagado: 0 };
const rows = [
  { ...base, id: 'free', numero: '0100' },
  { ...base, id: 'empty', numero: '0101', nombre_cliente: '', telefono_cliente: '', valor_pagado: null },
  { ...base, id: 'name', numero: '0102', nombre_cliente: 'Cliente' },
  { ...base, id: 'phone', numero: '0103', telefono_cliente: '3001234567' },
  { ...base, id: 'payment', numero: '0104', valor_pagado: 30000 },
  { ...base, id: 'paid', numero: '0105', estado: 'Abonado' },
  { ...base, id: 'seller', numero: '0106', vendedor_nombre: 'Vendedor', vendedor_user_id: 'seller' },
];
function client(fixtures = rows) {
  return createClient('https://test.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://test.supabase.co');
    let data = fixtures.filter((row) => [...url.searchParams].every(([field, expr]) => {
      if (field === 'or') return split(expr.slice(1, -1)).some((x) => matches(x, row));
      if (['select', 'order', 'offset', 'limit'].includes(field)) return true;
      if (expr.startsWith('in.')) return expr.slice(4, -1).split(',').includes(row[field]);
      if (expr.startsWith('like.') || expr.startsWith('ilike.')) return new RegExp('^' + expr.split('.').slice(1).join('.').replaceAll('%', '.*') + '$').test(row[field]);
      return matches(`${field}.${expr}`, row);
    }));
    const count = data.length;
    data = data.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 1000));
    if (init?.method === "PATCH") {
      const changes = JSON.parse(init.body);
      for (const row of data) Object.assign(row, changes);
    }
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Content-Range': `0-${data.length - 1}/${count}` } });
  } } });
}
function route(seller = false, db = client(), liberar = async () => []) {
  return load(`app/api/public/${seller ? 'sales-links' : 'project-sales'}/[token]/boletas/route.ts`, {
    '@/lib/boleta-availability': { BOLETA_LIBRE_FILTER },
    '@/lib/supabase-admin': { supabaseAdmin: db },
    '@/lib/temporary-reservations': { liberarReservasTemporalesExpiradas: liberar },
    '@/lib/project-sales-links': { getActiveProjectSalesLink: async () => ({ id: 'proyecto', empresa_id: 'empresa' }) },
    '@/lib/seller-sales-links': { getActiveSellerSalesLink: async () => ({ proyecto_id: 'proyecto', empresa_id: 'empresa', vendedor_user_id: 'seller' }) },
  }).GET;
}
for (const query of ['', '?contiene=01', '?numero=0102', '?numero=0103', '?numero=0104']) {
  test(`Office excludes customer data, payments and seller assignments: ${query || 'page'}`, async () => {
    const response = await route()(new Request('https://test/boletas' + query), { params: Promise.resolve({ token: 'token' }) });
    const result = await response.json();
    assert.equal(result.success, true);
    assert.deepEqual(result.boletas.map((x) => x.id).sort(), query.includes('numero=') ? [] : ['empty', 'free']);
    if (!query) assert.equal(result.total, 2);
  });
}
test('Seller link retains its own free tickets and does not advertise occupied office tickets', async () => {
  const get = route(true);
  const page = await (await get(new Request('https://test/boletas'), { params: Promise.resolve({ token: 'token' }) })).json();
  assert.deepEqual(page.boletas.map((x) => x.id), ['seller']);
  const search = await (await get(new Request('https://test/boletas?numero=0102'), { params: Promise.resolve({ token: 'token' }) })).json();
  assert.equal(search.search_status, 'not_found');
});
function temporary(db) {
  return load('lib/temporary-reservations.ts', {
    'server-only': {},
    crypto,
    '@/lib/boleta-availability': { BOLETA_LIBRE_FILTER },
    '@/lib/supabase-admin': { supabaseAdmin: db },
  });
}
test('Temporary hold refuses tickets with customer data or payments even with Disponible state', async () => {
  const holds = temporary(client());
  const result = await holds.retenerBoletasTemporales({ empresaId: 'empresa', proyectoId: 'proyecto', vendedorUserId: null }, ['0102', '0103', '0104', '0106'], { firstName: 'Nuevo cliente', phone: '3000000000', city: 'Bogotá' });
  assert.deepEqual(Array.from(result.reservadas), []);
  assert.deepEqual(Array.from(result.noDisponibles), ['0102', '0103', '0104', '0106']);
});

const scope = { empresaId: 'empresa', proyectoId: 'proyecto', vendedorUserId: null };
const customer = { firstName: 'Comprador de prueba', phone: '3000000000', city: 'Bogotá' };

test('Panel: aparta varias boletas y las confirma en Supabase sin servicios externos', async () => {
  const tickets = [{ ...rows[0] }, { ...rows[1] }];
  const db = client(tickets);
  const holds = temporary(db);
  const { POST } = load('app/api/admin/proyectos/[proyectoId]/reserva-temporal/route.ts', {
    '@/lib/temporary-reservations': holds,
    '@/lib/confirmar-reserva-pulse': { confirmarReservaPulse: () => assert.fail('V2 está apagada en esta prueba') },
    '@/lib/require-admin': {
      requireProjectSalesAccess: async () => ({ proyecto: { empresa_id: 'empresa' }, session: { user_id: 'admin' } }),
    },
  }, { process: { env: {} } });
  async function post(body) {
    const res = await POST(new Request('https://test/reserva-temporal', {
      method: 'POST',
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ proyectoId: 'proyecto' }) });
    assert.equal(res.status, 200);
    return res.json();
  }
  const data = await post({ action: 'hold', numeros: ['0100', '0101'], first_name: customer.firstName, phone: customer.phone, city: customer.city });
  assert.equal(data.success, true);
  assert.deepEqual(data.reservadas, ['0100', '0101']);
  assert.deepEqual(tickets.map((t) => t.estado), ['No disponible', 'No disponible']);
  const result = await post({ action: 'confirm', numeros: data.reservadas, hold_token: data.holdToken });
  assert.equal(result.success, true);
  assert.deepEqual(result.confirmadas, ['0100', '0101']);
  assert.deepEqual(tickets.map((t) => [t.estado, t.canal, t.nombre_cliente, t.oportunidad_creada]), [
    ['Debe', 'Creacion Manual', customer.firstName, false],
    ['Debe', 'Creacion Manual', customer.firstName, false],
  ]);
});

test('Oficina: cancelar libera y el listado vuelve a mostrar las reservas vencidas sin servicios externos', async () => {
  const old = new Date(Date.now() - 65_000).toISOString();
  const tickets = [
    { ...rows[0] },
    { ...rows[1] },
    { ...rows[5] },
  ];
  const db = client(tickets);
  const holds = temporary(db);
  const hold = await holds.retenerBoletasTemporales(scope, ['0100'], customer);

  const released = await holds.cancelarReservaTemporal(scope, ['0100'], hold.holdToken);
  assert.deepEqual(Array.from(released), ['0100']);
  assert.equal(tickets[0].nombre_cliente, null);

  Object.assign(tickets[1], { estado: 'No disponible', canal: 'Reserva temporal', nombre_cliente: customer.firstName, updated_at: old });
  const get = route(false, db, holds.liberarReservasTemporalesExpiradas);
  const response = await get(new Request('https://test/boletas'), { params: Promise.resolve({ token: 'token' }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.boletas.map((b) => b.numero).sort(), ['0100', '0101']);
  assert.equal(tickets[1].nombre_cliente, null);
  assert.equal(tickets[2].estado, 'Abonado');
});

test('Reservas V2 conserva el resultado de la RPC y la notificación GHL de Oficina', async () => {
  const calls = [];
  const library = load('lib/confirmar-reserva-pulse.ts', {
    'server-only': {},
    '@/lib/supabase-admin': { supabaseAdmin: { rpc: async (name) => {
      calls.push(name);
      return { data: { expired: false, reserva_grupo: 'grupo', confirmadas: [{ boleta_id: 'id', numero: '0100', comprobante_url: null }] } };
    } } },
    '@/lib/reservation-webhook': { enviarReservaUnaVez: async (...args) => calls.push(args) },
    '@/lib/temporary-reservations': { cancelarReservaTemporal: () => assert.fail('La reserva no está vencida') },
  });
  const result = await library.confirmarReservaPulse({
    ...scope, numeros: ['0100'], holdToken: 'token', canal: 'Oficina', integrar: true,
  });
  assert.equal(result.expired, false);
  assert.deepEqual(Array.from(result.confirmadas), ['0100']);
  assert.deepEqual(calls, ['pulse_confirmar_reserva', ['empresa', 'proyecto', 'grupo']]);
});
