-- PULSE seller access: additive production schema
-- Fecha: 2026-08-04
-- Requisito: revisar primero 20260804_01_seller_access_preflight.sql.
--
-- Seguridad:
-- - No actualiza ni elimina registros existentes.
-- - Las columnas nuevas son NULL y no tienen DEFAULT.
-- - El cambio de DEFAULT solo afecta inserts futuros.
-- - Las llaves foráneas se agregan NOT VALID: protegen escrituras nuevas
--   sin escanear ni reescribir las filas históricas.
-- - lock_timeout hace que el script falle sin esperar indefinidamente
--   si la tabla está ocupada.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Corrige únicamente el valor predeterminado para inserts futuros.
alter table public.boletas
  alter column estado set default 'Disponible';

-- Identificadores estables para el historial de nuevas asignaciones.
alter table public.asignaciones_vendedores
  add column if not exists vendedor_user_id uuid null;

alter table public.asignaciones_vendedores
  add column if not exists asignado_por_user_id uuid null;

-- La columna boletas.vendedor_user_id ya existe. Se agrega integridad referencial
-- sin validar ni modificar las filas históricas.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boletas_vendedor_user_id_fkey'
      and conrelid = 'public.boletas'::regclass
  ) then
    alter table public.boletas
      add constraint boletas_vendedor_user_id_fkey
      foreign key (vendedor_user_id)
      references public.admin_users(id)
      on delete set null
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asignaciones_vendedor_user_id_fkey'
      and conrelid = 'public.asignaciones_vendedores'::regclass
  ) then
    alter table public.asignaciones_vendedores
      add constraint asignaciones_vendedor_user_id_fkey
      foreign key (vendedor_user_id)
      references public.admin_users(id)
      on delete set null
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asignaciones_asignado_por_user_id_fkey'
      and conrelid = 'public.asignaciones_vendedores'::regclass
  ) then
    alter table public.asignaciones_vendedores
      add constraint asignaciones_asignado_por_user_id_fkey
      foreign key (asignado_por_user_id)
      references public.admin_users(id)
      on delete set null
      not valid;
  end if;
end
$$;

commit;
