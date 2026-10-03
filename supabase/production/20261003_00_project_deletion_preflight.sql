-- PULSE / DEL-01: diagnóstico del esquema antes de instalar la eliminación.
-- SOLO LECTURA: una consulta SELECT sobre catálogos; no consulta filas de clientes,
-- no modifica datos/tablas/funciones y no llama a eliminar_proyecto_pulse.
-- Ejecutar en SQL Editor y compartir la tabla de resultados (tipo, objeto, detalle).

with objetivos(nombre) as (
  values ('proyectos'), ('boletas'), ('movimientos_boletas'),
    ('asignaciones_vendedores'), ('seller_sales_links')
), relevantes as (
  select c.oid, c.relname, c.relkind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and (
      c.relname in (select nombre from objetivos)
      or c.relname ~ '(boleta|movimiento|proyecto)'
      or exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
          and a.attname in ('proyecto_id', 'project_id', 'boleta_id', 'ticket_id')
      )
    )
), nombres as (
  select nombre from objetivos
  union
  select relname from relevantes
), reporte as (
  select
    'TABLA'::text as tipo,
    'public.' || nombres.nombre as objeto,
    case when r.oid is null then 'NO EXISTE'
      else 'tipo=' || r.relkind::text || '; columnas: ' || coalesce((
        select pg_catalog.string_agg(
          pg_catalog.quote_ident(a.attname) || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod)
            || case when a.attnotnull then ' NOT NULL' else '' end,
          ', ' order by a.attnum
        )
        from pg_catalog.pg_attribute a
        where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
      ), '(sin columnas)')
    end as detalle
  from nombres
  left join relevantes r on r.relname = nombres.nombre

  union all

  select
    case when con.contype = 'f' then 'RELACION' else 'CLAVE' end,
    pg_catalog.format('%I.%I.%I', n.nspname, c.relname, con.conname),
    pg_catalog.pg_get_constraintdef(con.oid, true)
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where con.contype in ('f', 'p', 'u')
    and (con.conrelid in (select oid from relevantes)
      or (con.contype = 'f' and con.confrelid in (select oid from relevantes)))

  union all

  select
    'TRIGGER',
    pg_catalog.format('%I.%I.%I', n.nspname, c.relname, t.tgname),
    pg_catalog.format('función=%I.%I; habilitado=%s', fn.nspname, p.proname, t.tgenabled)
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_proc p on p.oid = t.tgfoid
  join pg_catalog.pg_namespace fn on fn.oid = p.pronamespace
  where not t.tgisinternal and t.tgrelid in (select oid from relevantes)

  union all

  select
    'FUNCION', 'public.eliminar_proyecto_pulse(text,text,text,boolean)',
    case when pg_catalog.to_regprocedure('public.eliminar_proyecto_pulse(text,text,text,boolean)') is null
      then 'NO INSTALADA' else 'EXISTE; esta consulta NO la ejecuta' end
)
select tipo, objeto, detalle
from reporte
order by case tipo when 'TABLA' then 1 when 'RELACION' then 2 when 'CLAVE' then 3
  when 'TRIGGER' then 4 else 5 end, objeto;
