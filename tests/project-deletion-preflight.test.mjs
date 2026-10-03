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

const diagnosis = await fs.readFile("supabase/production/20261003_00_project_deletion_preflight.sql", "utf8");
const installer = await fs.readFile("supabase/production/20261003_01_project_deletion.sql", "utf8");

async function database(t, withMovements) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create table public.proyectos(id text primary key, empresa_id text);
    create table public.boletas(id text primary key, empresa_id text, proyecto_id text references public.proyectos(id), nombre_cliente text);
    create table public.asignaciones_vendedores(id text primary key, empresa_id text, proyecto_id text);
    create table public.seller_sales_links(id text primary key, empresa_id text, proyecto_id text);
    insert into public.proyectos values ('proyecto-a','empresa-a');
    insert into public.boletas values ('boleta-a','empresa-a','proyecto-a','cliente-ficticio-no-exportar');
  `);
  if (withMovements) await db.exec("create table public.movimientos_boletas(id text primary key, numero text); insert into public.movimientos_boletas values ('movimiento-a','0001');");
  return db;
}

async function snapshot(db) {
  const names = (await db.query("select tablename from pg_catalog.pg_tables where schemaname = 'public' order by tablename")).rows;
  const result = {};
  for (const { tablename } of names) {
    const quoted = `"${tablename.replaceAll('"', '""')}"`;
    result[tablename] = (await db.query(`select * from public.${quoted} order by id`)).rows;
  }
  return result;
}

for (const withMovements of [true, false]) {
  test(`Diagnóstico sin escrituras cuando ${withMovements ? "la columna boleta_id falta" : "la tabla movimientos_boletas falta"}`, { skip: !PGlite }, async (t) => {
    const db = await database(t, withMovements);
    const before = await snapshot(db);
    await assert.rejects(db.exec(installer), (error) => error.code === "P0001" && error.message.includes("falta public.movimientos_boletas.boleta_id"));
    await db.exec("rollback");
    assert.deepEqual(await snapshot(db), before);
    assert.equal((await db.query("select to_regprocedure('public.eliminar_proyecto_pulse(text,text,text,boolean)') as funcion")).rows[0].funcion, null);

    await db.exec("begin read only");
    const report = (await db.query(diagnosis)).rows;
    await db.exec("rollback");
    const movements = report.find((row) => row.tipo === "TABLA" && row.objeto === "public.movimientos_boletas");
    if (withMovements) {
      assert.match(movements.detalle, /id text.*numero text/);
      assert.doesNotMatch(movements.detalle, /boleta_id/);
    } else assert.equal(movements.detalle, "NO EXISTE");
    assert.equal(report.find((row) => row.tipo === "FUNCION").detalle, "NO INSTALADA");
    assert.equal(report.filter((row) => row.tipo === "TABLA").length, 5);
    assert.doesNotMatch(JSON.stringify(report), /cliente-ficticio-no-exportar/);
    assert.deepEqual(await snapshot(db), before);
  });
}

test("Diagnóstico descubre otras tablas, claves, cascadas y triggers sin ejecutar ni exportar registros", { skip: !PGlite }, async (t) => {
  const db = await database(t, true);
  await db.exec(`
    create table public.historial_boletas(id text primary key, boleta_id text references public.boletas(id) on delete cascade);
    create table public.datos_adicionales(id text primary key, proyecto_id text references public.proyectos(id) on delete cascade);
    insert into public.historial_boletas values ('historial-a','boleta-a');
    insert into public.datos_adicionales values ('dato-a','proyecto-a');
    create function public.rechazar_borrado() returns trigger language plpgsql as $$begin raise exception 'NO ejecutar el trigger'; end$$;
    create trigger proteger_proyecto before delete on public.proyectos for each row execute function public.rechazar_borrado();
  `);
  const before = await snapshot(db);
  await db.exec("begin read only");
  const report = (await db.query(diagnosis)).rows;
  await db.exec("rollback");
  assert(report.some((row) => row.tipo === "TABLA" && row.objeto === "public.historial_boletas"));
  assert(report.some((row) => row.tipo === "TABLA" && row.objeto === "public.datos_adicionales"));
  assert(report.some((row) => row.tipo === "RELACION" && row.objeto.startsWith("public.historial_boletas.") && /ON DELETE CASCADE/.test(row.detalle)));
  assert(report.some((row) => row.tipo === "CLAVE" && row.objeto === "public.boletas.boletas_pkey"));
  assert(report.some((row) => row.tipo === "TRIGGER" && row.objeto === "public.proyectos.proteger_proyecto" && row.detalle.includes("public.rechazar_borrado")));
  assert.doesNotMatch(JSON.stringify(report), /cliente-ficticio-no-exportar|historial-a|dato-a/);
  assert.deepEqual(await snapshot(db), before);
});
