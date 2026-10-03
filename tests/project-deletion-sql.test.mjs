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
    try { ({ PGlite } = createRequire(path.join(process.env.PULSE_TEST_MODULES, "package.json"))("@electric-sql/pglite")); } catch { /* dependencia de pruebas opcional */ }
  }
}

test("Función de eliminación en PostgreSQL local (PGlite), sin datos productivos", { skip: !PGlite }, async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.empresas(id text primary key);
    create table public.admin_users(id text primary key, empresa_id text references public.empresas(id));
    create table public.clientes(id text primary key, empresa_id text references public.empresas(id));
    create table public.ganadores(id text primary key, empresa_id text references public.empresas(id));
    create table public.proyectos(id text primary key, empresa_id text references public.empresas(id));
    create table public.boletas(id uuid primary key, empresa_id text, proyecto_id text references public.proyectos(id));
    create table public.movimientos_boletas(id text primary key, boleta_id uuid references public.boletas(id));
    create table public.asignaciones_vendedores(id text primary key, empresa_id text, proyecto_id text references public.proyectos(id), boleta_inicial_id uuid references public.boletas(id));
    create table public.seller_sales_links(id text primary key, empresa_id text, proyecto_id text references public.proyectos(id));
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables in schema public to service_role;
    insert into public.empresas values ('empresa-a'),('empresa-b');
    insert into public.admin_users values ('admin-a','empresa-a'),('admin-b','empresa-b');
    insert into public.clientes values ('cliente-a','empresa-a'),('cliente-b','empresa-b');
    insert into public.ganadores values ('ganador-a','empresa-a'),('ganador-b','empresa-b');
    insert into public.proyectos values ('proyecto-a','empresa-a'),('proyecto-a2','empresa-a'),('proyecto-b','empresa-b');
    insert into public.boletas values
      ('00000000-0000-4000-8000-000000000001','empresa-a','proyecto-a'),
      ('00000000-0000-4000-8000-000000000002','empresa-a','proyecto-a'),
      ('00000000-0000-4000-8000-000000000003','empresa-a','proyecto-a2'),
      ('00000000-0000-4000-8000-000000000004','empresa-b','proyecto-b');
    insert into public.movimientos_boletas values
      ('m1','00000000-0000-4000-8000-000000000001'),('m2','00000000-0000-4000-8000-000000000002'),
      ('m3','00000000-0000-4000-8000-000000000003'),('m4','00000000-0000-4000-8000-000000000004');
    insert into public.asignaciones_vendedores values
      ('a1','empresa-a','proyecto-a','00000000-0000-4000-8000-000000000001'),
      ('a2','empresa-a','proyecto-a2','00000000-0000-4000-8000-000000000003'),
      ('a3','empresa-b','proyecto-b','00000000-0000-4000-8000-000000000004');
    insert into public.seller_sales_links values ('l1','empresa-a','proyecto-a'),('l2','empresa-a','proyecto-a2'),('l3','empresa-b','proyecto-b');
  `);
  const migration = await fs.readFile("supabase/production/20261003_01_project_deletion.sql", "utf8");
  await db.exec(migration);
  const tables = ["empresas", "admin_users", "clientes", "ganadores", "proyectos", "boletas", "movimientos_boletas", "asignaciones_vendedores", "seller_sales_links"];
  async function snapshot() {
    const result = {};
    for (const table of tables) result[table] = (await db.query(`select * from public.${table} order by id`)).rows;
    return result;
  }
  const before = await snapshot();
  async function isolated(name, fn) {
    await t.test(name, async () => {
      await db.exec("begin");
      try { await fn(); } finally { await db.exec("rollback"); }
    });
  }
  const remove = (empresa = "empresa-a", project = "proyecto-a", word = "ELIMINAR", accepted = true) => db.query("select public.eliminar_proyecto_pulse($1,$2,$3,$4) as resultado", [empresa, project, word, accepted]);

  await isolated("Instalar la función no cambia ninguna fila y puede repetirse", async () => {
    assert.deepEqual(await snapshot(), before);
    // La instalación contiene BEGIN/COMMIT: se comprueba la reejecución después de los tests.
    const privileges = (await db.query("select has_function_privilege('anon','public.eliminar_proyecto_pulse(text,text,text,boolean)','execute') as anon, has_function_privilege('authenticated','public.eliminar_proyecto_pulse(text,text,text,boolean)','execute') as authenticated, has_function_privilege('service_role','public.eliminar_proyecto_pulse(text,text,text,boolean)','execute') as server")).rows[0];
    assert.deepEqual(privileges, { anon: false, authenticated: false, server: true });
  });

  await isolated("Elimina todos los registros del proyecto elegido y conserva otras empresas/proyectos y datos compartidos", async () => {
    await db.exec("set role service_role");
    const result = (await remove()).rows[0].resultado;
    assert.deepEqual(result, { empresa_id: "empresa-a", proyecto_id: "proyecto-a", proyectos: 1, boletas: 2, movimientos: 2, asignaciones: 1, enlaces: 1 });
    const after = await snapshot();
    for (const shared of ["empresas", "admin_users", "clientes", "ganadores"]) assert.deepEqual(after[shared], before[shared]);
    assert.deepEqual(after.proyectos, before.proyectos.filter((p) => p.id !== "proyecto-a"));
    assert.deepEqual(after.boletas, before.boletas.filter((b) => b.proyecto_id !== "proyecto-a"));
    assert.deepEqual(after.movimientos_boletas, before.movimientos_boletas.filter((m) => !["m1", "m2"].includes(m.id)));
    for (const table of ["asignaciones_vendedores", "seller_sales_links"]) assert.deepEqual(after[table], before[table].filter((row) => row.proyecto_id !== "proyecto-a"));
  });

  for (const role of ["anon", "authenticated"]) {
    await isolated(`La base de datos bloquea directamente el rol ${role}`, async () => {
      await db.exec(`set role ${role}`);
      await assert.rejects(remove(), (error) => error.code === "42501");
    });
  }

  for (const args of [["empresa-b", "proyecto-a", "ELIMINAR", true], ["empresa-a", "proyecto-a", "eliminar", true], ["empresa-a", "proyecto-a", "ELIMINAR", false], ["empresa-a", "proyecto-a", "ELIMINAR", null]]) {
    await isolated(`La función valida el alcance y la confirmación: ${JSON.stringify(args)}`, async () => {
      await assert.rejects(remove(...args), (error) => ["P0002", "22023"].includes(error.code));
    });
    assert.deepEqual(await snapshot(), before);
  }

  await isolated("Un error al borrar el proyecto revierte los DELETE anteriores de todos sus hijos", async () => {
    await db.exec("alter table public.proyectos add column proyecto_padre_id text references public.proyectos(id); update public.proyectos set proyecto_padre_id='proyecto-a' where id='proyecto-a2';");
    await assert.rejects(remove(), (error) => error.code === "23503");
  });
  assert.deepEqual(await snapshot(), before);

  await isolated("Un trigger de DELETE sin revisar se bloquea antes de invocarlo", async () => {
    await db.exec(`create function public.test_reject_delete() returns trigger language plpgsql as $$begin raise exception 'No ejecutar trigger'; end$$;
      create trigger test_reject_delete before delete on public.proyectos for each row execute function public.test_reject_delete();`);
    await assert.rejects(remove(), (error) => error.code === "23503" && error.message.includes("triggers"));
  });
  assert.deepEqual(await snapshot(), before);

  await isolated("Una referencia externa con CASCADE impide borrar silenciosamente datos no previstos", async () => {
    await db.exec("create table public.dependencia_extra(id text, proyecto_id text references public.proyectos(id) on delete cascade); insert into public.dependencia_extra values ('extra','proyecto-a');");
    await assert.rejects(remove(), (error) => error.code === "23503");
  });
  assert.deepEqual(await snapshot(), before);

  await isolated("Datos cruzados de otra empresa abortan toda la operación", async () => {
    await db.exec("insert into public.boletas values ('00000000-0000-4000-8000-000000000099','empresa-b','proyecto-a')");
    await assert.rejects(remove(), (error) => error.code === "23514");
  });
  assert.deepEqual(await snapshot(), before);

  await db.exec(migration);
  assert.deepEqual(await snapshot(), before);
});
