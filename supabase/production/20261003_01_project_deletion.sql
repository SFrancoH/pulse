-- PULSE / DEL-01: instalar la operación atómica de eliminación de proyectos.
-- Versión 2: cuatro tablas confirmadas por el usuario el 2026-10-03.
-- movimientos_boletas sólo se incluye si existe y tiene boleta_id.
-- Si hay una relación/triggers de DELETE sin revisar, el borrado se bloquea.
-- Ejecutar este archivo NO elimina proyectos ni boletas: sólo define una función.
-- La función se invoca posteriormente desde Pulse, con sesión admin y confirmación.
-- No ejecutar SELECT public.eliminar_proyecto_pulse(...) durante la instalación.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- El esquema base no está completamente versionado. Fallar antes de instalar
-- si las relaciones conocidas no coinciden; no alterar tablas ni sus constraints.
do $$
declare
  requerido record;
begin
  for requerido in select * from (values
    ('proyectos', 'id'), ('proyectos', 'empresa_id'),
    ('boletas', 'id'), ('boletas', 'empresa_id'), ('boletas', 'proyecto_id'),
    ('asignaciones_vendedores', 'empresa_id'), ('asignaciones_vendedores', 'proyecto_id'),
    ('asignaciones_vendedores', 'boleta_inicial_id'),
    ('seller_sales_links', 'empresa_id'), ('seller_sales_links', 'proyecto_id')
  ) as campos(tabla, columna)
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = requerido.tabla and column_name = requerido.columna
    ) then
      raise exception 'DEL-01: falta public.%.%; no se instaló la eliminación.', requerido.tabla, requerido.columna;
    end if;
  end loop;

  if pg_catalog.to_regclass('public.movimientos_boletas') is not null and not exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = pg_catalog.to_regclass('public.movimientos_boletas')
      and a.attname = 'boleta_id' and a.attnum > 0 and not a.attisdropped
      and a.atttypid in ('uuid'::regtype, 'text'::regtype, 'varchar'::regtype)
  ) then
    raise exception 'DEL-01: public.movimientos_boletas existe, pero necesita boleta_id de tipo uuid/text/varchar. Comparte su definición o ejecuta el diagnóstico 00; no se instaló la eliminación.';
  end if;
end
$$;

create or replace function public.eliminar_proyecto_pulse(
  p_empresa_id text,
  p_proyecto_id text,
  p_confirmacion text,
  p_aceptado boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_boletas bigint;
  v_movimientos bigint := 0;
  v_asignaciones bigint;
  v_enlaces bigint;
  v_proyectos bigint;
  v_movimientos_tabla regclass;
  v_tablas oid[];
begin
  if p_aceptado is distinct from true or p_confirmacion is distinct from 'ELIMINAR'
     or coalesce(pg_catalog.btrim(p_empresa_id), '') = ''
     or coalesce(pg_catalog.btrim(p_proyecto_id), '') = '' then
    raise exception using errcode = '22023', message = 'Se requiere aceptación y confirmación exacta ELIMINAR.';
  end if;

  -- Las tablas se bloquean sólo durante esta transacción para evitar que los
  -- DELETE y las comprobaciones de alcance se crucen con escrituras en curso.
  -- Las lecturas permanecen permitidas; lock_timeout aborta si no se obtiene el lock.
  lock table public.proyectos, public.boletas,
    public.asignaciones_vendedores, public.seller_sales_links in share row exclusive mode;

  v_tablas := array['public.proyectos'::regclass::oid, 'public.boletas'::regclass::oid,
    'public.asignaciones_vendedores'::regclass::oid, 'public.seller_sales_links'::regclass::oid];
  v_movimientos_tabla := pg_catalog.to_regclass('public.movimientos_boletas');
  if v_movimientos_tabla is not null then
    execute 'lock table public.movimientos_boletas in share row exclusive mode';
    if not exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = v_movimientos_tabla
        and a.attname = 'boleta_id' and a.attnum > 0 and not a.attisdropped
        and a.atttypid in ('uuid'::regtype, 'text'::regtype, 'varchar'::regtype)
    ) then
      raise exception using errcode = '23503', message = 'La relación de movimientos_boletas debe revisarse antes de eliminar.';
    end if;
    v_tablas := pg_catalog.array_append(v_tablas, v_movimientos_tabla::oid);
  end if;

  perform 1 from public.proyectos
  where id = p_proyecto_id and empresa_id = p_empresa_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Proyecto no encontrado en la empresa autorizada.';
  end if;

  -- No permitir que un FK/cascade desconocido elimine datos de otra tabla.
  -- También protege contra una migración futura no incluida en esta operación.
  if exists (
    select 1 from pg_catalog.pg_constraint c
    where c.contype = 'f'
      and c.confrelid = any(v_tablas)
      and (not (c.conrelid = any(v_tablas)) or c.confdeltype not in ('a', 'r'))
  ) then
    raise exception using errcode = '23503', message = 'Existen dependencias adicionales; revisar antes de eliminar.';
  end if;

  -- Un trigger propio de DELETE puede modificar otras tablas. Revisarlo antes
  -- de permitir una operación cuyo alcance debe limitarse a este proyecto.
  if exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = any(v_tablas) and not t.tgisinternal
      and t.tgenabled <> 'D' and (t.tgtype::integer & 8) = 8
  ) then
    raise exception using errcode = '23503', message = 'Existen triggers de eliminación sin revisar; no se eliminó nada.';
  end if;

  if exists (select 1 from public.boletas where proyecto_id = p_proyecto_id and empresa_id is distinct from p_empresa_id)
     or exists (
       select 1 from public.asignaciones_vendedores a
       left join public.boletas b on b.id = a.boleta_inicial_id
       where (a.proyecto_id = p_proyecto_id or (b.empresa_id = p_empresa_id and b.proyecto_id = p_proyecto_id))
         and ((a.empresa_id is not null and a.empresa_id is distinct from p_empresa_id)
           or (a.proyecto_id is not null and a.proyecto_id is distinct from p_proyecto_id)
           or (b.id is not null and (b.empresa_id is distinct from p_empresa_id or b.proyecto_id is distinct from p_proyecto_id)))
     )
     or exists (select 1 from public.seller_sales_links where proyecto_id = p_proyecto_id and empresa_id is distinct from p_empresa_id) then
    raise exception using errcode = '23514', message = 'Existen registros de otra empresa asociados al proyecto; no se eliminó nada.';
  end if;

  if v_movimientos_tabla is not null then
    -- SQL dinámico de texto constante: permite que la tabla no exista sin
    -- resolver una referencia inválida. Empresa/proyecto son parámetros.
    execute 'delete from public.movimientos_boletas m using public.boletas b
      where m.boleta_id::text = b.id::text
        and b.empresa_id = $1 and b.proyecto_id = $2'
      using p_empresa_id, p_proyecto_id;
    get diagnostics v_movimientos = row_count;
  end if;

  -- El DDL confirmado admite NULL en el historial de asignaciones. La propiedad
  -- se prueba mediante el proyecto único o la boleta inicial autorizada.
  delete from public.asignaciones_vendedores a
  where (a.empresa_id = p_empresa_id or a.empresa_id is null)
    and (a.proyecto_id = p_proyecto_id or (a.proyecto_id is null and exists (
      select 1 from public.boletas b where b.id = a.boleta_inicial_id
        and b.empresa_id = p_empresa_id and b.proyecto_id = p_proyecto_id
    )));
  get diagnostics v_asignaciones = row_count;

  delete from public.seller_sales_links
  where empresa_id = p_empresa_id and proyecto_id = p_proyecto_id;
  get diagnostics v_enlaces = row_count;

  delete from public.boletas
  where empresa_id = p_empresa_id and proyecto_id = p_proyecto_id;
  get diagnostics v_boletas = row_count;

  delete from public.proyectos
  where empresa_id = p_empresa_id and id = p_proyecto_id;
  get diagnostics v_proyectos = row_count;
  if v_proyectos <> 1 then
    raise exception using errcode = 'P0002', message = 'No se pudo confirmar la eliminación del proyecto.';
  end if;

  return pg_catalog.jsonb_build_object(
    'empresa_id', p_empresa_id, 'proyecto_id', p_proyecto_id,
    'proyectos', v_proyectos, 'boletas', v_boletas, 'movimientos', v_movimientos,
    'asignaciones', v_asignaciones, 'enlaces', v_enlaces
  );
  -- Sin handler que oculte excepciones: cualquier error revierte todo el borrado.
end
$$;

revoke all on function public.eliminar_proyecto_pulse(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.eliminar_proyecto_pulse(text, text, text, boolean) to service_role;

notify pgrst, 'reload schema';
commit;

-- Verificación de instalación/privilegios. Estas consultas NO invocan el borrado.
with tablas as (
  select r::oid as oid from pg_catalog.unnest(array[
    pg_catalog.to_regclass('public.proyectos'), pg_catalog.to_regclass('public.boletas'),
    pg_catalog.to_regclass('public.asignaciones_vendedores'), pg_catalog.to_regclass('public.seller_sales_links'),
    pg_catalog.to_regclass('public.movimientos_boletas')
  ]) r where r is not null
)
select
  pg_catalog.to_regprocedure('public.eliminar_proyecto_pulse(text,text,text,boolean)') is not null as instalada,
  pg_catalog.has_function_privilege('service_role', 'public.eliminar_proyecto_pulse(text,text,text,boolean)', 'EXECUTE') as servidor_permitido,
  pg_catalog.has_function_privilege('anon', 'public.eliminar_proyecto_pulse(text,text,text,boolean)', 'EXECUTE') as anon_permitido,
  pg_catalog.has_function_privilege('authenticated', 'public.eliminar_proyecto_pulse(text,text,text,boolean)', 'EXECUTE') as authenticated_permitido,
  case when pg_catalog.to_regclass('public.movimientos_boletas') is null
    then 'no_existe' else 'por_boleta_id' end as movimientos,
  (select count(*) from pg_catalog.pg_constraint c
    where c.contype = 'f'
      and c.confrelid in (select oid from tablas)
      and (c.conrelid not in (select oid from tablas) or c.confdeltype not in ('a', 'r'))) as dependencias_adicionales,
  (select count(*) from pg_catalog.pg_trigger t
    where t.tgrelid in (select oid from tablas) and not t.tgisinternal
      and t.tgenabled <> 'D' and (t.tgtype::integer & 8) = 8) as triggers_por_revisar;
