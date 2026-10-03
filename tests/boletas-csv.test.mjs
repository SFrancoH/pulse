import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: (id) => {
      assert.ok(Object.hasOwn(dependencies, id), `Dependencia no simulada: ${id}`);
      return dependencies[id];
    }, Response,
  });
  return exports;
}

const csv = load("lib/boletas-csv.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const HEADERS = "id,empresa_id,proyecto_id,numero,estado,valor_pagado";
const SESSION = { rol: "empresa_admin", empresa_id: "empresa-a", user_id: "admin-a" };

for (const separator of [",", ";"]) {
  test(`CSV de seis columnas con ${separator}, BOM, CRLF y cero conserva sólo los campos incluidos`, () => {
    const parsed = csv.parseCsvBoletas(`\uFEFF${HEADERS.replaceAll(",", separator)}\r\n${[ID, "empresa-a", "proyecto-a", "0007", "Debe", "0"].join(separator)}\r\n`);
    assert.equal(parsed.errores.length, 0);
    assert.equal(parsed.filasLeidas, 1);
    assert.deepEqual(plain(parsed.items), [{ id: ID, empresa_id: "empresa-a", proyecto_id: "proyecto-a", numero: "0007", estado: "Debe", valor_pagado: "0" }]);
  });
}

test("CSV completo conserva aliases anteriores, separadores dentro de comillas, comillas escapadas y saltos de línea", () => {
  const parsed = csv.parseCsvBoletas('numero,estado,canal,nombre_cliente,telefono_cliente,email_cliente,vendedor_nombre,created_at,valor pagago\n7,Abonado,Oficina,"Cliente, con; separadores y ""comillas""\nsegunda línea",3000000000,fixture@example.test,Asesor,2026-10-03,30000');
  assert.equal(parsed.errores.length, 0);
  assert.deepEqual(plain(parsed.items), [{ numero: "0007", estado: "Abonado", canal: "Oficina", nombre: 'Cliente, con; separadores y "comillas"\nsegunda línea', telefono: "3000000000", email: "fixture@example.test", vendedor: "Asesor", fecha_creacion: "2026-10-03", valor_pagado: "30000" }]);
});

test("El orden fijo sin encabezado sigue disponible en la página de actualización", () => {
  const raw = "proyecto-a,7,Abonado,Oficina,Cliente,3000000000,fixture@example.test,Asesor,2026-10-03,30000";
  assert.equal(csv.parseCsvBoletas(raw).items.length, 0);
  assert.deepEqual(plain(csv.parseCsvBoletas(raw, true).items), [{ numero: "0007", estado: "Abonado", canal: "Oficina", nombre: "Cliente", telefono: "3000000000", email: "fixture@example.test", vendedor: "Asesor", fecha_creacion: "2026-10-03", valor_pagado: "30000" }]);
});

for (const raw of ["", "id,estado\nabc,Pagado", "numero,estado,valor_pagado\n7,Pagado", "numero,boleta,estado\n7,7,Pagado", "numero,estado\n10007,Pagado", "numero,estado\nboleta7,Pagado"]) {
  test(`Rechaza un CSV ambiguo antes de enviar filas: ${raw || "vacío"}`, () => {
    const parsed = csv.parseCsvBoletas(raw);
    assert.ok(parsed.errores.length);
    assert.equal(parsed.items.length, 0);
  });
}

test("Comillas sin cerrar o texto después de una comilla cerrada no se acepta", () => {
  assert.throws(() => csv.parseCsvBoletas('numero,nombre\n7,"sin cerrar'), /comillas sin cerrar/);
  assert.throws(() => csv.parseCsvBoletas('numero,nombre\n7,"cliente"otro'), /comillas inválidas/);
});

function harness(session = SESSION) {
  const original = {
    id: ID, empresa_id: "empresa-a", proyecto_id: "proyecto-a", numero: "0007", estado: "Abonado", valor_pagado: 30000,
    nombre_cliente: "Cliente existente", telefono_cliente: "3000000000", email_cliente: "fixture@example.test",
    vendedor_nombre: "Asesor", vendedor_user_id: "vendedor-a", canal: "Vendedores", ciudad_cliente: "Ciudad",
    comprobante_url: "https://example.test/comprobante", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  };
  const rows = [structuredClone(original), { ...original, id: OTHER_ID, empresa_id: "empresa-b", proyecto_id: "proyecto-b" }];
  const requests = [];
  const supabaseAdmin = createClient("https://fixture.supabase.co", "fixture-key", {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      const method = init?.method || "GET";
      const body = init?.body ? JSON.parse(init.body) : null;
      requests.push({ url, method, body });
      const candidates = url.pathname.endsWith("/proyectos")
        ? [{ id: "proyecto-a", empresa_id: "empresa-a", nombre: "Proyecto", slug: "proyecto" }]
        : rows;
      const matches = candidates.filter((row) => [...url.searchParams].every(([field, expression]) => {
        if (field === "select") return true;
        assert.ok(expression.startsWith("eq."), `Filtro no simulado: ${field}=${expression}`);
        return String(row[field]) === expression.slice(3);
      }));
      if (method === "PATCH") matches.forEach((row) => Object.assign(row, body));
      return new Response(JSON.stringify(matches), { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  const auth = load("lib/require-admin.ts", {
    "server-only": {}, "@/lib/admin-auth": { getCurrentAdminSession: async () => session },
    "@/lib/supabase-admin": { supabaseAdmin },
  });
  const { POST } = load("app/api/proyectos/[proyectoId]/actualizar-base-datos/route.ts", {
    "@/lib/require-admin": auth, "@/lib/supabase-admin": { supabaseAdmin }, "@/lib/boletas-csv": csv,
  });
  return {
    original, rows, requests,
    post: (items) => POST(new Request("https://fixture.test/api/proyectos/proyecto-a/actualizar-base-datos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }),
    }), { params: Promise.resolve({ proyectoId: "proyecto-a" }) }),
  };
}

test("Lectura y POST de seis columnas actualizan exclusivamente estado, pago y updated_at de la boleta coincidente", async () => {
  const h = harness();
  const parsed = csv.parseCsvBoletas(`${HEADERS}\n${ID},empresa-a,proyecto-a,7,Pagado,60000`);
  const response = await h.post(parsed.items);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.actualizadas, 1);
  assert.equal(result.omitidas, 0);
  assert.deepEqual(h.rows[0], { ...h.original, estado: "Pagado", valor_pagado: 60000, updated_at: h.rows[0].updated_at });
  assert.notEqual(h.rows[0].updated_at, h.original.updated_at);
  assert.deepEqual(h.rows[1], { ...h.original, id: OTHER_ID, empresa_id: "empresa-b", proyecto_id: "proyecto-b" });
  const patch = h.requests.find((r) => r.method === "PATCH");
  assert.deepEqual(Object.keys(patch.body).sort(), ["estado", "updated_at", "valor_pagado"]);
  for (const [field, value] of Object.entries({ id: ID, empresa_id: "empresa-a", proyecto_id: "proyecto-a", numero: "0007" })) {
    assert.equal(patch.url.searchParams.get(field), `eq.${value}`);
  }
});

for (const zero of [0, "0"]) {
  test(`Un pago cero (${typeof zero}) se guarda sin borrar los campos ausentes`, async () => {
    const h = harness();
    const result = await (await h.post([{ numero: "0007", valor_pagado: zero }])).json();
    assert.equal(result.actualizadas, 1);
    assert.equal(h.rows[0].valor_pagado, 0);
    assert.equal(h.rows[0].estado, h.original.estado);
    assert.equal(h.rows[0].nombre_cliente, h.original.nombre_cliente);
  });
}

for (const change of [{ empresa_id: "empresa-b" }, { proyecto_id: "proyecto-b" }, { empresa_id: "" }, { id: "" }, { id: "inválido" }]) {
  test(`Un identificador ajeno, vacío o inválido impide la mutación: ${JSON.stringify(change)}`, async () => {
    const h = harness();
    const result = await (await h.post([{ numero: "0007", estado: "Pagado", valor_pagado: "60000", ...change }])).json();
    assert.equal(result.actualizadas, 0);
    assert.equal(result.omitidas, 1);
    assert.equal(result.errores.length, 1);
    assert.equal(h.requests.filter((r) => r.method === "PATCH").length, 0);
    assert.deepEqual(h.rows[0], h.original);
  });
}

test("ID existente de otra boleta con el mismo número no cae en actualización sólo por número", async () => {
  const h = harness();
  const result = await (await h.post([{ id: OTHER_ID, empresa_id: "empresa-a", proyecto_id: "proyecto-a", numero: "0007", estado: "Pagado", valor_pagado: "60000" }])).json();
  assert.equal(result.actualizadas, 0);
  assert.equal(result.omitidas, 1);
  assert.deepEqual(result.no_encontradas, ["0007"]);
  assert.deepEqual(h.rows[0], h.original);
  assert.equal(h.rows[1].valor_pagado, 30000);
});

for (const item of [{ numero: "10007", estado: "Pagado" }, { numero: "7", estado: "desconocido", valor_pagado: "60000" }, { numero: "7", estado: "Pagado", valor_pagado: "abc" }, { numero: "7", valor_pagado: -100 }, { numero: "7", estado: "", valor_pagado: "" }]) {
  test(`Rechaza datos inválidos o sin cambios sin registrar una falsa actualización: ${JSON.stringify(item)}`, async () => {
    const h = harness();
    const result = await (await h.post([item])).json();
    assert.equal(result.actualizadas, 0);
    assert.equal(result.omitidas, 1);
    assert.equal(h.requests.filter((r) => r.method === "PATCH").length, 0);
    assert.deepEqual(h.rows[0], h.original);
  });
}

test("CSV antiguo por número sigue actualizando cliente, canal y vendedor cuando se incluyen", async () => {
  const h = harness();
  const parsed = csv.parseCsvBoletas("numero,estado,canal,nombre,telefono,email,vendedor,valor_pagado\n7,abonada,Oficina,Cliente actualizado,3000000001,actualizado@example.test,Oficina,10000");
  const result = await (await h.post(parsed.items)).json();
  assert.equal(result.actualizadas, 1);
  assert.deepEqual(h.rows[0], { ...h.original, estado: "Abonado", canal: "Oficina", nombre_cliente: "Cliente actualizado", telefono_cliente: "3000000001", email_cliente: "actualizado@example.test", vendedor_nombre: "Oficina", valor_pagado: 10000, updated_at: h.rows[0].updated_at });
  assert.equal(h.requests.find((r) => r.method === "PATCH").url.searchParams.has("id"), false);
});

for (const session of [null, { ...SESSION, rol: "vendedor" }, { ...SESSION, empresa_id: "empresa-b" }]) {
  test(`Los permisos actuales continúan rechazando usuarios sin acceso: ${session?.rol || "sin sesión"}/${session?.empresa_id || ""}`, async () => {
    const h = harness(session);
    const response = await h.post([{ numero: "7", estado: "Pagado" }]);
    assert.equal(response.status, session ? 403 : 401);
    assert.equal(h.requests.filter((r) => r.method === "PATCH").length, 0);
  });
}
