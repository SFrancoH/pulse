import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const KEY_A = 'fixture_project_a_000000000000000000000000';
export const KEY_B = 'fixture_project_b_000000000000000000000000';
export const PROJECT_KEYS = JSON.stringify({ project_a: KEY_A, project_b: KEY_B });

function split(expression) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < expression.length; i++) {
    if (expression[i] === '(') depth++;
    if (expression[i] === ')') depth--;
    if (expression[i] === ',' && depth === 0) {
      parts.push(expression.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(expression.slice(start));
  return parts;
}

function matches(expression, row) {
  if (expression.startsWith('and(')) return split(expression.slice(4, -1)).every((part) => matches(part, row));
  if (expression.startsWith('or(')) return split(expression.slice(3, -1)).some((part) => matches(part, row));
  const [field, operator, ...tail] = expression.split('.');
  const value = tail.join('.');
  if (operator === 'is' && value === 'null') return row[field] == null;
  if (operator === 'eq') return String(row[field]) === (value === '""' ? '' : value);
  throw new Error(`Unsupported fixture filter: ${operator}`);
}

export function webhookHarness({ session = null, keys = PROJECT_KEYS, seed = {}, failTable } = {}) {
  const records = structuredClone({
    proyectos: [
      { id: 'project_a', empresa_id: 'company_a', estado: 'activo' },
      { id: 'project_b', empresa_id: 'company_b', estado: 'activo' },
    ],
    boletas: [],
    admin_users: [],
    ...seed,
  });
  const queries = [], syncs = [], logs = [];
  const client = createClient('https://fixture.supabase.test', 'fixture_service_key', {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const table = url.pathname.split('/').at(-1);
      const method = init?.method || 'GET';
      queries.push({ table, method, url });
      if (table === failTable) {
        return Response.json({ message: 'fixture_private_database_error', code: 'fixture_error' }, { status: 500 });
      }
      const rows = (records[table] || []).filter((row) => [...url.searchParams].every(([field, value]) => {
        if (['select', 'limit', 'order'].includes(field)) return true;
        if (field === 'or') return split(value.slice(1, -1)).some((part) => matches(part, row));
        return matches(`${field}.${value}`, row);
      }));
      if (method === 'PATCH') {
        const changes = JSON.parse(init.body);
        for (const row of rows) Object.assign(row, changes);
      }
      return Response.json(rows);
    } },
  });
  const modules = new Map();
  const dependencies = {
    'server-only': {},
    'node:crypto': crypto,
    '@/lib/supabase-admin': { supabaseAdmin: client },
    '@/lib/admin-auth': { getCurrentAdminSession: async () => session },
    '@/lib/google-sheets-sync': { sincronizarDisponibilidadGoogleSheet: async (...args) => { syncs.push(args); } },
  };
  function load(relativePath) {
    if (modules.has(relativePath)) return modules.get(relativePath);
    const exports = {};
    modules.set(relativePath, exports);
    const code = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      exports, Response, Request, URL, URLSearchParams, Buffer, Date,
      process: { env: { PULSE_PROJECT_WEBHOOK_KEYS: keys } },
      console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
      require: (id) => {
        if (Object.hasOwn(dependencies, id)) return dependencies[id];
        if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`);
        throw new Error(`Missing fixture dependency: ${id}`);
      },
    }, { filename: relativePath });
    return exports;
  }
  return { load, records, queries, syncs, logs };
}

export function webhookRequest({ project = 'project_a', key, body = {}, headers = {} } = {}) {
  return new Request(`https://pulse.fixture.test/api/proyectos/${project}/actualizar-boleta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}), ...headers },
    body: JSON.stringify(body),
  });
}
