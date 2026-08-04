-- PULSE seller access: production preflight (READ ONLY)
-- Fecha: 2026-08-04
-- Este archivo no modifica datos ni esquema.
-- Ejecutar y revisar todos los resultados antes de aplicar 02_schema.sql.

-- 1. Estados actuales. Todos deben usar la capitalización definida por el CHECK.
select estado, count(*) as cantidad
from public.boletas
group by estado
order by estado;

-- 2. Referencias de vendedor que no existen en admin_users.
select
  count(*) as vendedores_huerfanos
from public.boletas b
left join public.admin_users u on u.id = b.vendedor_user_id
where b.vendedor_user_id is not null
  and u.id is null;

-- Detalle limitado para diagnóstico. Debe regresar cero filas.
select
  b.id,
  b.empresa_id,
  b.proyecto_id,
  b.numero,
  b.vendedor_user_id,
  b.vendedor_nombre
from public.boletas b
left join public.admin_users u on u.id = b.vendedor_user_id
where b.vendedor_user_id is not null
  and u.id is null
order by b.created_at desc
limit 100;

-- 3. Boletas cuyo vendedor pertenece a otra empresa. Debe regresar cero filas.
select
  b.id,
  b.empresa_id as empresa_boleta,
  u.empresa_id as empresa_vendedor,
  b.proyecto_id,
  b.numero,
  b.vendedor_user_id
from public.boletas b
join public.admin_users u on u.id = b.vendedor_user_id
where b.empresa_id is distinct from u.empresa_id
order by b.created_at desc
limit 100;

-- 4. Boletas que apuntan a proyectos inexistentes. Debe regresar cero filas.
select
  b.proyecto_id,
  count(*) as cantidad
from public.boletas b
left join public.proyectos p on p.id = b.proyecto_id
where p.id is null
group by b.proyecto_id
order by cantidad desc;

-- 5. Proyectos que apuntan a empresas inexistentes. Debe regresar cero filas.
select
  p.id as proyecto_id,
  p.empresa_id
from public.proyectos p
left join public.empresas e on e.id = p.empresa_id
where p.empresa_id is not null
  and e.id is null
order by p.created_at desc;

-- 6. Resumen de asignaciones activas por vendedor y proyecto.
select
  b.empresa_id,
  b.proyecto_id,
  b.vendedor_user_id,
  u.email,
  u.nombre,
  count(*) as numeros_asignados
from public.boletas b
join public.admin_users u on u.id = b.vendedor_user_id
where b.vendedor_user_id is not null
group by b.empresa_id, b.proyecto_id, b.vendedor_user_id, u.email, u.nombre
order by b.empresa_id, b.proyecto_id, u.nombre;

-- 7. Tamaño de tablas para planear la creación de índices.
select
  relname as tabla,
  n_live_tup as filas_estimadas
from pg_stat_user_tables
where schemaname = 'public'
  and relname in ('admin_users', 'boletas', 'asignaciones_vendedores', 'proyectos', 'empresas')
order by relname;
