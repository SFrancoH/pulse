import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let PGlite;
try { ({ PGlite } = require("@electric-sql/pglite")); }
catch {
  if (process.env.PULSE_TEST_MODULES) {
    try { ({ PGlite } = createRequire(path.join(process.env.PULSE_TEST_MODULES, "package.json"))("@electric-sql/pglite")); } catch { /* herramienta de pruebas opcional */ }
  }
}

const schema = await fs.readFile("tests/fixtures/project-deletion-schema.sql", "utf8");
const installer = await fs.readFile("supabase/production/20261003_01_project_deletion.sql", "utf8");
const tables = ["empresas", "admin_users", "clientes", "ganadores", "proyectos", "boletas", "asignaciones_vendedores", "seller_sales_links"];
async function database(t, mode) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.empresas(id text primary key);
    create table public.admin_users(id uuid primary key, empresa_id text references public.empresas(id));
    create table public.clientes(id text primary key, empresa_id text references public.empresas(id));
    create table public.ganadores(id text primary key, empresa_id text references public.empresas(id));
  `);
  await db.exec(schema);
  await db.exec(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables in schema public to service_role;
    insert into public.empresas values ('empresa-a'),('empresa-b');
    insert into public.admin_users values ('10000000-0000-4000-8000-000000000001','empresa-a'),('10000000-0000-4000-8000-000000000002','empresa-b');
    insert into public.clientes values ('cliente-a','empresa-a'),('cliente-b','empresa-b');
    insert into public.ganadores values ('ganador-a','empresa-a'),('ganador-b','empresa-b');
    insert into public.proyectos(id,empresa_id,nombre) values ('proyecto-a','empresa-a','Elegido'),('proyecto-a2','empresa-a','Conservar'),('proyecto-b','empresa-b','Otra empresa');
    insert into public.boletas(id,empresa_id,proyecto_id,numero,estado,valor_pagado,vendedor_user_id) values
      ('00000000-0000-4000-8000-000000000001','empresa-a','proyecto-a','0001','Abonado',12000,'10000000-0000-4000-8000-000000000001'),
      ('00000000-0000-4000-8000-000000000002','empresa-a','proyecto-a','0002','Disponible',0,null),
      ('00000000-0000-4000-8000-000000000003','empresa-a','proyecto-a2','0001','Pagado',60000,'10000000-0000-4000-8000-000000000001'),
      ('00000000-0000-4000-8000-000000000004','empresa-b','proyecto-b','0001','Debe',0,'10000000-0000-4000-8000-000000000002');
    insert into public.asignaciones_vendedores(empresa_id,proyecto_id,boleta_inicial_id,vendedor_user_id,asignado_por_user_id) values
      ('empresa-a','proyecto-a','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
      ('empresa-a','proyecto-a2','00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',null),
      ('empresa-b','proyecto-b','00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002',null);
    insert into public.seller_sales_links(empresa_id,proyecto_id,vendedor_user_id,token) values
      ('empresa-a','proyecto-a','10000000-0000-4000-8000-000000000001','fixture-a'),
      ('empresa-a','proyecto-a2','10000000-0000-4000-8000-000000000001','fixture-a2'),
      ('empresa-b','proyecto-b','10000000-0000-4000-8000-000000000002','fixture-b');
  `);
  if (mode !== "ausente") {
    const column = mode === "uuid" ? "boleta_id uuid references public.boletas(id)"
      : mode === "text" ? "boleta_id text" : "numero text";
    await db.exec(`create table public.movimientos_boletas(id text primary key, ${column}); grant all on public.movimientos_boletas to service_role;`);
    await db.exec("insert into public.movimientos_boletas values ('m1','00000000-0000-4000-8000-000000000001'),('m2','00000000-0000-4000-8000-000000000002'),('m3','00000000-0000-4000-8000-000000000003'),('m4','00000000-0000-4000-8000-000000000004');");
  }
  return db;
}
async function snapshot(db, mode) {
  const state = {};
  for (const name of [...tables, ...(mode === "ausente" ? [] : ["movimientos_boletas"])]) state[name] = (await db.query(`select * from public.${name} order by id`)).rows;
  return state;
}
const remove = (db) => db.query("select public.eliminar_proyecto_pulse($1,$2,$3,$4) as resultado", ["empresa-a", "proyecto-a", "ELIMINAR", true]);

for (const mode of ["ausente", "uuid", "text"]) {
  test(`DDL aportado: movimientos ${mode}, aislamiento y rollback`, { skip: !PGlite }, async (t) => {
    const db = await database(t, mode);
    const before = await snapshot(db, mode);
    const result = (await db.exec(installer)).at(-1).rows[0];
    assert.equal(result.instalada, true);
    assert.equal(result.servidor_permitido, true);
    assert.equal(result.anon_permitido, false);
    assert.equal(result.authenticated_permitido, false);
    assert.equal(result.movimientos, mode === "ausente" ? "no_existe" : "por_boleta_id");
    assert.equal(Number(result.dependencias_adicionales), 0);
    assert.equal(Number(result.triggers_por_revisar), 0);
    assert.deepEqual(await snapshot(db, mode), before);

    await t.test("El servidor elimina sólo el proyecto elegido, sin borrar usuarios referenciados ni otros números iguales", async () => {
      await db.exec("begin; set role service_role;");
      try {
        assert.deepEqual((await remove(db)).rows[0].resultado, { empresa_id: "empresa-a", proyecto_id: "proyecto-a", proyectos: 1, boletas: 2, movimientos: mode === "ausente" ? 0 : 2, asignaciones: 1, enlaces: 1 });
        const after = await snapshot(db, mode);
        for (const name of ["empresas", "admin_users", "clientes", "ganadores"]) assert.deepEqual(after[name], before[name]);
        assert.deepEqual(after.proyectos, before.proyectos.filter((row) => row.id !== "proyecto-a"));
        for (const name of ["boletas", "asignaciones_vendedores", "seller_sales_links"]) assert.deepEqual(after[name], before[name].filter((row) => row.proyecto_id !== "proyecto-a"));
        if (mode !== "ausente") assert.deepEqual(after.movimientos_boletas, before.movimientos_boletas.filter((row) => ["m3", "m4"].includes(row.id)));
      } finally { await db.exec("rollback"); }
      assert.deepEqual(await snapshot(db, mode), before);
    });
    await t.test("Una restricción al último DELETE revierte todos los borrados anteriores", async () => {
      await db.exec("begin; alter table public.proyectos add column padre_id text references public.proyectos(id); update public.proyectos set padre_id='proyecto-a' where id='proyecto-a2';");
      try { await assert.rejects(remove(db), (error) => error.code === "23503"); }
      finally { await db.exec("rollback"); }
      assert.deepEqual(await snapshot(db, mode), before);
    });
    await db.exec(installer);
    assert.deepEqual(await snapshot(db, mode), before);
  });
}

test("Una tabla de movimientos existente con relación desconocida bloquea la instalación, sin cambiar filas", { skip: !PGlite }, async (t) => {
  const db = await database(t, "desconocida");
  const before = await snapshot(db, "desconocida");
  await assert.rejects(db.exec(installer), (error) => error.code === "P0001" && error.message.includes("movimientos_boletas existe"));
  await db.exec("rollback");
  assert.deepEqual(await snapshot(db, "desconocida"), before);
  assert.equal((await db.query("select to_regprocedure('public.eliminar_proyecto_pulse(text,text,text,boolean)') as f")).rows[0].f, null);
});

test("Cambios de esquema posteriores no permiten ignorar movimientos ni cascadas dentro de las tablas conocidas", { skip: !PGlite }, async (t) => {
  const db = await database(t, "ausente");
  await db.exec(installer);
  const before = await snapshot(db, "ausente");
  for (const change of [
    "create table public.movimientos_boletas(id text primary key, numero text);",
    "alter table public.proyectos add column padre_id text references public.proyectos(id) on delete cascade; update public.proyectos set padre_id='proyecto-a' where id='proyecto-a2';",
  ]) {
    await db.exec("begin");
    await db.exec(change);
    try { await assert.rejects(remove(db), (error) => error.code === "23503"); }
    finally { await db.exec("rollback"); }
    assert.deepEqual(await snapshot(db, "ausente"), before);
  }
});

test("Asignaciones con campos NULL del DDL real sólo se borran si el proyecto o boleta inicial prueba su relación", { skip: !PGlite }, async (t) => {
  const db = await database(t, "ausente");
  await db.exec(installer);
  await db.exec(`insert into public.asignaciones_vendedores(empresa_id,proyecto_id,boleta_inicial_id) values
    (null,'proyecto-a',null),
    (null,null,'00000000-0000-4000-8000-000000000001'),
    (null,null,'00000000-0000-4000-8000-000000000003'),
    (null,null,null);`);
  const before = await snapshot(db, "ausente");
  await db.exec("begin; set role service_role;");
  try {
    assert.equal((await remove(db)).rows[0].resultado.asignaciones, 3);
    const after = await snapshot(db, "ausente");
    assert.deepEqual(after.asignaciones_vendedores, before.asignaciones_vendedores.filter((a) => a.proyecto_id !== "proyecto-a" && a.boleta_inicial_id !== "00000000-0000-4000-8000-000000000001"));
    assert.deepEqual(after.admin_users, before.admin_users);
  } finally { await db.exec("rollback"); }
  assert.deepEqual(await snapshot(db, "ausente"), before);
});

for (const row of [
  "('empresa-b','proyecto-a',null)",
  "('empresa-a','proyecto-a2','00000000-0000-4000-8000-000000000001')",
  "('empresa-a','proyecto-a','00000000-0000-4000-8000-000000000003')",
]) {
  test(`Asignaciones contradictorias abortan sin borrar otro proyecto: ${row}`, { skip: !PGlite }, async (t) => {
    const db = await database(t, "ausente");
    await db.exec(installer);
    const before = await snapshot(db, "ausente");
    await db.exec("begin");
    await db.exec("insert into public.asignaciones_vendedores(empresa_id,proyecto_id,boleta_inicial_id) values " + row);
    try { await assert.rejects(remove(db), (error) => error.code === "23514"); }
    finally { await db.exec("rollback"); }
    assert.deepEqual(await snapshot(db, "ausente"), before);
  });
}
