-- PULSE seller access: production indexes
-- Fecha: 2026-08-04
-- Ejecutar DESPUÉS de 20260804_02_seller_access_schema.sql.
--
-- CREATE INDEX CONCURRENTLY evita bloquear las escrituras normales durante
-- la construcción del índice. Este archivo NO debe ejecutarse dentro de BEGIN/COMMIT.

set lock_timeout = '5s';
set statement_timeout = '0';

create index concurrently if not exists idx_boletas_vendedor_proyecto_numero
  on public.boletas (vendedor_user_id, proyecto_id, numero);

create index concurrently if not exists idx_asignaciones_vendedor_proyecto
  on public.asignaciones_vendedores (vendedor_user_id, proyecto_id);

create index concurrently if not exists idx_asignaciones_proyecto_created_at
  on public.asignaciones_vendedores (proyecto_id, created_at);

create index concurrently if not exists idx_admin_users_empresa_role_estado
  on public.admin_users (empresa_id, role, estado);

reset statement_timeout;
reset lock_timeout;
