-- PULSE / DEL-01: instalar la operación atómica de eliminación de proyectos.
-- SUSPENDIDO 2026-10-03: producción no cumple movimientos_boletas.boleta_id.
-- Ejecutar primero 20261003_00_project_deletion_preflight.sql y revisar resultados.
-- Este instalador debe adaptarse al catálogo real antes de volver a usarlo.
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
    ('movimientos_boletas', 'boleta_id'),
    ('asignaciones_vendedores', 'empresa_id'), ('asignaciones_vendedores', 'proyecto_id'),
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
  v_movimientos bigint;
  v_asignaciones bigint;
  v_enlaces bigint;
  v_proyectos bigint;
begin
  if p_aceptado is distinct from true or p_confirmacion is distinct from 'ELIMINAR'
     or coalesce(pg_catalog.btrim(p_empresa_id), '') = ''
     or coalesce(pg_catalog.btrim(p_proyecto_id), '') = '' then
    raise exception using errcode = '22023', message = 'Se requiere aceptación y confirmación exacta ELIMINAR.';
  end if;

  -- Las tablas se bloquean sólo durante esta transacción para evitar que los
  -- DELETE y las comprobaciones de alcance se crucen con escrituras en curso.
  -- Las lecturas permanecen permitidas; lock_timeout aborta si no se obtiene el lock.
  lock table public.proyectos, public.boletas, public.movimientos_boletas,
    public.asignaciones_vendedores, public.seller_sales_links in share row exclusive mode;

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
      and c.confrelid in ('public.proyectos'::regclass, 'public.boletas'::regclass,
        'public.movimientos_boletas'::regclass, 'public.asignaciones_vendedores'::regclass,
        'public.seller_sales_links'::regclass)
      and c.conrelid not in ('public.proyectos'::regclass, 'public.boletas'::regclass,
        'public.movimientos_boletas'::regclass, 'public.asignaciones_vendedores'::regclass,
        'public.seller_sales_links'::regclass)
  ) then
    raise exception using errcode = '23503', message = 'Existen dependencias adicionales; revisar antes de eliminar.';
  end if;

  if exists (select 1 from public.boletas where proyecto_id = p_proyecto_id and empresa_id is distinct from p_empresa_id)
     or exists (select 1 from public.asignaciones_vendedores where proyecto_id = p_proyecto_id and empresa_id is distinct from p_empresa_id)
     or exists (select 1 from public.seller_sales_links where proyecto_id = p_proyecto_id and empresa_id is distinct from p_empresa_id) then
    raise exception using errcode = '23514', message = 'Existen registros de otra empresa asociados al proyecto; no se eliminó nada.';
  end if;

  delete from public.movimientos_boletas m using public.boletas b
  where m.boleta_id::text = b.id::text
    and b.empresa_id = p_empresa_id and b.proyecto_id = p_proyecto_id;
  get diagnostics v_movimientos = row_count;

  delete from public.asignaciones_vendedores
  where empresa_id = p_empresa_id and proyecto_id = p_proyecto_id;
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
select
  pg_catalog.to_regprocedure('public.eliminar_proyecto_pulse(text,text,text,boolean)') is not null as instalada,
  pg_catalog.has_function_privilege('service_role', 'public.eliminar_proyecto_pulse(text,text,text,boolean)', 'EXECUTE') as servidor_permitido,
  pg_catalog.has_function_privilege('anon', 'public.eliminar_proyecto_pulse(text,text,text,boolean)', 'EXECUTE') as anon_permitido,
  pg_catalog.has_function_privilege('authenticated', 'public.eliminar_proyecto_pulse(text,text,text,boolean)', 'EXECUTE') as authenticated_permitido,
  (select count(*) from pg_catalog.pg_constraint c
    where c.contype = 'f'
      and c.confrelid in ('public.proyectos'::regclass, 'public.boletas'::regclass,
        'public.movimientos_boletas'::regclass, 'public.asignaciones_vendedores'::regclass,
        'public.seller_sales_links'::regclass)
      and c.conrelid not in ('public.proyectos'::regclass, 'public.boletas'::regclass,
        'public.movimientos_boletas'::regclass, 'public.asignaciones_vendedores'::regclass,
        'public.seller_sales_links'::regclass)) as dependencias_adicionales;
