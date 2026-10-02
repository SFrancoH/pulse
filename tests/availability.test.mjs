import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'node:crypto';

function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: (id) => dependencies[id], Response, URL, Math });
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
function client() {
  return createClient('https://test.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async (input) => {
    const url = new URL(input);
    let data = rows.filter((row) => [...url.searchParams].every(([field, expr]) => {
      if (field === 'or') return split(expr.slice(1, -1)).some((x) => matches(x, row));
      if (['select', 'order', 'offset', 'limit'].includes(field)) return true;
      if (expr.startsWith('in.')) return expr.slice(4, -1).split(',').includes(row[field]);
      if (expr.startsWith('like.') || expr.startsWith('ilike.')) return new RegExp('^' + expr.split('.').slice(1).join('.').replaceAll('%', '.*') + '$').test(row[field]);
      return matches(`${field}.${expr}`, row);
    }));
    const count = data.length;
    data = data.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 1000));
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Content-Range': `0-${data.length - 1}/${count}` } });
  } } });
}
function route(seller = false) {
  return load(`app/api/public/${seller ? 'sales-links' : 'project-sales'}/[token]/boletas/route.ts`, {
    '@/lib/boleta-availability': { BOLETA_LIBRE_FILTER },
    '@/lib/supabase-admin': { supabaseAdmin: client() },
    '@/lib/temporary-reservations': { liberarReservasTemporalesExpiradas: async () => [] },
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
test('Temporary hold refuses tickets with customer data or payments even with Disponible state', async () => {
  const holds = load('lib/temporary-reservations.ts', {
    'server-only': {},
    crypto,
    '@/lib/boleta-availability': { BOLETA_LIBRE_FILTER },
    '@/lib/supabase-admin': { supabaseAdmin: client() },
    '@/lib/google-sheets-sync': { sincronizarDisponibilidadesGoogleSheet: async () => {} },
  });
  const result = await holds.retenerBoletasTemporales({ empresaId: 'empresa', proyectoId: 'proyecto', vendedorUserId: null }, ['0102', '0103', '0104', '0106'], { firstName: 'Nuevo cliente', phone: '3000000000', city: 'Bogotá' });
  assert.deepEqual(Array.from(result.reservadas), []);
  assert.deepEqual(Array.from(result.noDisponibles), ['0102', '0103', '0104', '0106']);
});
