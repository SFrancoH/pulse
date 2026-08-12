-- PULSE project public sales token
-- Fecha: 2026-08-12
--
-- Agrega un token unico directamente a proyectos (sin tabla adicional).
-- Los proyectos existentes reciben un token durante esta migracion.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.proyectos
  add column if not exists sales_token text null;

update public.proyectos
set sales_token =
  replace(gen_random_uuid()::text, '-', '') ||
  substring(replace(gen_random_uuid()::text, '-', '') from 1 for 16)
where sales_token is null
   or btrim(sales_token) = '';

create unique index if not exists proyectos_sales_token_key
  on public.proyectos (sales_token);

alter table public.proyectos
  alter column sales_token set not null;

alter table public.proyectos
  alter column sales_token set default (
    replace(gen_random_uuid()::text, '-', '') ||
    substring(replace(gen_random_uuid()::text, '-', '') from 1 for 16)
  );

commit;
