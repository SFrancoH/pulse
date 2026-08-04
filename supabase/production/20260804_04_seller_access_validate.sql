-- PULSE seller access: validate foreign keys
-- Fecha: 2026-08-04
-- Ejecutar solo después de:
-- 1) revisar el preflight,
-- 2) aplicar el esquema,
-- 3) confirmar que las consultas de huérfanos regresan cero filas.
--
-- VALIDATE CONSTRAINT comprueba datos existentes; no los modifica.

set lock_timeout = '5s';
set statement_timeout = '10min';

alter table public.boletas
  validate constraint boletas_vendedor_user_id_fkey;

alter table public.asignaciones_vendedores
  validate constraint asignaciones_vendedor_user_id_fkey;

alter table public.asignaciones_vendedores
  validate constraint asignaciones_asignado_por_user_id_fkey;

reset statement_timeout;
reset lock_timeout;
