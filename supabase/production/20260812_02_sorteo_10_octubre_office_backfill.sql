-- PULSE: correccion puntual Sorteo 10 de octubre
-- Proyecto: z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre
-- Fecha: 2026-08-12
--
-- 1) Marca como Oficina las boletas sin vendedor real.
-- 2) Devuelve a Disponible SOLO las boletas asignadas a vendedores que hoy
--    estan en No disponible. No toca Debe, Abonado ni Pagado.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

update public.boletas
set
  vendedor_nombre = 'Oficina',
  updated_at = now()
where proyecto_id = 'z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre'
  and vendedor_user_id is null
  and (
    vendedor_nombre is null
    or btrim(vendedor_nombre) = ''
    or lower(btrim(vendedor_nombre)) in ('vacio', 'oficina')
  );

update public.boletas
set
  estado = 'Disponible',
  updated_at = now()
where proyecto_id = 'z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre'
  and vendedor_user_id is not null
  and lower(btrim(coalesce(estado, ''))) = 'no disponible';

commit;

-- Verificacion: distribucion por estado y asignacion.
select
  estado,
  coalesce(vendedor_nombre, '<NULL>') as vendedor_nombre,
  count(*) as cantidad
from public.boletas
where proyecto_id = 'z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre'
group by estado, coalesce(vendedor_nombre, '<NULL>')
order by vendedor_nombre, estado;

-- Verificacion: no deberian quedar boletas de vendedor en No disponible
-- por el simple hecho de estar asignadas.
select count(*) as vendedores_aun_no_disponibles
from public.boletas
where proyecto_id = 'z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre'
  and vendedor_user_id is not null
  and lower(btrim(coalesce(estado, ''))) = 'no disponible';
