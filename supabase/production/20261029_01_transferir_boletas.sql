-- PULSE / TB-01: transferencia atómica de boletas entre vendedores y Oficina.
-- Instalar en Supabase Production ANTES de activar el botón; esta migración
-- no transfiere ninguna boleta por sí sola.
begin;
set local lock_timeout = '5s';

do $$
declare
  v record;
begin
  for v in select * from (values
    ('boletas','id'),('boletas','empresa_id'),('boletas','proyecto_id'),
    ('boletas','numero'),('boletas','estado'),('boletas','vendedor_user_id'),
    ('boletas','vendedor_nombre'),('boletas','canal'),('boletas','updated_at'),
    ('admin_users','id'),('admin_users','empresa_id'),('admin_users','role'),
    ('admin_users','estado'),('admin_users','nombre'),('admin_users','email'),
    ('asignaciones_vendedores','empresa_id'),('asignaciones_vendedores','proyecto_id')
  ) as requeridos(tabla,columna)
  loop
    if not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name=v.tabla and column_name=v.columna) then
      raise exception 'TB-01: falta public.%.%; no se instaló.',v.tabla,v.columna;
    end if;
  end loop;
end $$;

create table if not exists public.pulse_transferencias_boletas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  proyecto_id text not null,
  vendedor_origen_user_id uuid not null,
  vendedor_destino_user_id uuid,
  ejecutado_por_user_id uuid not null,
  modo text not null check (modo in ('todas','cantidad','especifica')),
  estados text[] not null,
  cantidad integer not null check (cantidad > 0),
  numeros text[] not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pulse_transferencias_boletas_proyecto_fecha
  on public.pulse_transferencias_boletas (empresa_id,proyecto_id,created_at desc);
alter table public.pulse_transferencias_boletas enable row level security;
revoke all on public.pulse_transferencias_boletas from public,anon,authenticated;
grant select,insert on public.pulse_transferencias_boletas to service_role;

create or replace function public.transferir_boletas_pulse(
  p_empresa_id text,
  p_proyecto_id text,
  p_origen uuid,
  p_destino uuid,
  p_modo text,
  p_cantidad integer,
  p_numero text,
  p_estados text[],
  p_actor uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_nombre text;
  v_ids uuid[];
  v_numeros text[];
  v_total integer;
  v_primero text;
  v_ultimo text;
begin
  if coalesce(pg_catalog.btrim(p_empresa_id),'') = '' or
     coalesce(pg_catalog.btrim(p_proyecto_id),'') = '' or
     p_origen is null or p_actor is null then
    raise exception using errcode='22023', message='Empresa, proyecto, origen y administrador son obligatorios.';
  end if;
  if p_modo not in ('todas','cantidad','especifica') or p_modo is null then
    raise exception using errcode='22023',message='Modalidad de transferencia inválida.';
  end if;
  if p_estados is null or pg_catalog.cardinality(p_estados)=0 or
     exists (select 1 from pg_catalog.unnest(p_estados) s
       where s not in ('Disponible','No disponible','Debe','Abonado','Pagado')) then
    raise exception using errcode='22023',message='Selecciona al menos un estado válido.';
  end if;
  if p_modo='cantidad' and (p_cantidad is null or p_cantidad<1 or p_cantidad>10000) then
    raise exception using errcode='22023',message='La cantidad debe estar entre 1 y 10000.';
  end if;
  if p_modo='especifica' and (p_numero is null or p_numero !~ '^[0-9]{4}$') then
    raise exception using errcode='22023',message='La boleta específica debe tener cuatro dígitos.';
  end if;
  if p_destino is not null and p_destino=p_origen then
    raise exception using errcode='22023',message='Origen y destino no pueden ser el mismo vendedor.';
  end if;

  perform 1 from public.proyectos
    where id=p_proyecto_id and empresa_id=p_empresa_id;
  if not found then
    raise exception using errcode='P0002',message='Proyecto no encontrado en la empresa.';
  end if;
  perform 1 from public.admin_users
    where id=p_actor and role in ('super_admin','empresa_admin')
      and estado='activo' and (role='super_admin' or empresa_id=p_empresa_id);
  if not found then
    raise exception using errcode='42501',message='Administrador no autorizado para esta empresa.';
  end if;
  perform 1 from public.admin_users
    where id=p_origen and empresa_id=p_empresa_id and role='vendedor';
  if not found then
    raise exception using errcode='22023',message='El vendedor de origen no pertenece a la empresa.';
  end if;

  if p_destino is null then
    v_nombre := 'Oficina';
  else
    select coalesce(nullif(pg_catalog.btrim(nombre),''),email) into v_nombre
    from public.admin_users
    where id=p_destino and empresa_id=p_empresa_id and role='vendedor' and estado='activo';
    if v_nombre is null then
      raise exception using errcode='22023',message='El vendedor de destino no está activo o no pertenece a la empresa.';
    end if;
  end if;

  -- Se bloquean exclusivamente las filas seleccionadas. La selección es estable
  -- (números ascendentes), sin LIMIT de PostgREST ni paginación incompleta.
  select pg_catalog.array_agg(t.id) into v_ids
  from (
    select b.id
    from public.boletas b
    where b.empresa_id=p_empresa_id and b.proyecto_id=p_proyecto_id
      and b.vendedor_user_id=p_origen and b.estado=any(p_estados)
      and (p_modo<>'especifica' or b.numero=p_numero)
    order by b.numero,b.id
    limit case when p_modo='cantidad' then p_cantidad
               when p_modo='especifica' then 1 else null end
    for update
  ) t;

  v_total := coalesce(pg_catalog.cardinality(v_ids),0);
  if v_total=0 then
    raise exception using errcode='P0002',message='No hay boletas que coincidan con los filtros.';
  end if;
  if p_modo='cantidad' and v_total<>p_cantidad then
    raise exception using errcode='22023',message='El vendedor no tiene suficientes boletas con los estados seleccionados.';
  end if;

  update public.boletas b
    set vendedor_user_id=p_destino, vendedor_nombre=v_nombre,
        canal=case when p_destino is null then 'Oficina' else 'Vendedores' end,
        updated_at=now()
  where b.id=any(v_ids) and b.empresa_id=p_empresa_id and
        b.proyecto_id=p_proyecto_id and b.vendedor_user_id=p_origen;

  if not found then
    raise exception using errcode='40001',message='La asignación cambió durante la operación; vuelve a consultar.';
  end if;

  select pg_catalog.array_agg(numero order by numero),
         min(numero),max(numero)
    into v_numeros,v_primero,v_ultimo
    from public.boletas where id=any(v_ids)
      and empresa_id=p_empresa_id and proyecto_id=p_proyecto_id
      and vendedor_user_id is not distinct from p_destino;
  if pg_catalog.cardinality(v_numeros) is distinct from v_total then
    raise exception using errcode='40001',message='La transferencia no fue completa; se revirtió.';
  end if;

  -- Conservar el historial existente de asignaciones si el destino es un vendedor.
  if p_destino is not null then
    insert into public.asignaciones_vendedores
      (empresa_id,proyecto_id,vendedor_user_id,asignado_por_user_id,
       vendedor_nombre,numero_desde,numero_hasta,cantidad,boleta_inicial_id)
    values
      (p_empresa_id,p_proyecto_id,p_destino,p_actor,v_nombre,
       v_primero,v_ultimo,v_total,v_ids[1]);
  end if;

  insert into public.pulse_transferencias_boletas
    (empresa_id,proyecto_id,vendedor_origen_user_id,vendedor_destino_user_id,
     ejecutado_por_user_id,modo,estados,cantidad,numeros)
  values
    (p_empresa_id,p_proyecto_id,p_origen,p_destino,p_actor,p_modo,p_estados,v_total,v_numeros);

  -- No modificar estado, valor_pagado, clientes, comprobantes, reserva_grupo
  -- ni pagado_en. Disponibles en Oficina sólo cuando estado='Disponible'.
  return pg_catalog.jsonb_build_object(
    'success',true,'transferidas',v_total,'numeros',pg_catalog.to_jsonb(v_numeros),
    'destino',v_nombre
  );
end;
$$;

revoke execute on function public.transferir_boletas_pulse(
  text,text,uuid,uuid,text,integer,text,text[],uuid) from public,anon,authenticated;
grant execute on function public.transferir_boletas_pulse(
  text,text,uuid,uuid,text,integer,text,text[],uuid) to service_role;
commit;
