-- TB-01: prueba con datos ficticios. Todo se revierte al terminar.
\set ON_ERROR_STOP on
begin;
do $$
declare
  v_admin uuid := '00000000-0000-4000-8000-000000000301';
  v_origen uuid := '00000000-0000-4000-8000-000000000302';
  v_destino uuid := '00000000-0000-4000-8000-000000000303';
  v_externo uuid := '00000000-0000-4000-8000-000000000304';
  v_empresa text := 'tb-01-test-empresa';
  v_proyecto text := 'tb-01-test-proyecto';
  v_resultado jsonb;
  v_errores integer := 0;
begin
  insert into public.admin_users (id,empresa_id,role,estado,nombre,email) values
    (v_admin,v_empresa,'empresa_admin','activo','Administradora','admin@example.invalid'),
    (v_origen,v_empresa,'vendedor','inactivo','Origen','origen@example.invalid'),
    (v_destino,v_empresa,'vendedor','activo','Destino','destino@example.invalid'),
    (v_externo,'tb-01-otra-empresa','vendedor','activo','Externo','externo@example.invalid');
  insert into public.proyectos (id,empresa_id,nombre,slug)
    values (v_proyecto,v_empresa,'Proyecto prueba','tb-01-test');
  insert into public.boletas
    (empresa_id,proyecto_id,numero,estado,vendedor_user_id,vendedor_nombre,canal,
     nombre_cliente,valor_pagado)
    values
      (v_empresa,v_proyecto,'0001','Disponible',v_origen,'Origen','Vendedores',null,0),
      (v_empresa,v_proyecto,'0002','Debe',v_origen,'Origen','Vendedores','Cliente ficticio',0),
      (v_empresa,v_proyecto,'0003','Abonado',v_origen,'Origen','Vendedores','Cliente ficticio',200),
      (v_empresa,v_proyecto,'0004','No disponible',v_origen,'Origen','Vendedores','Cliente ficticio',0),
      (v_empresa,v_proyecto,'0005','Pagado',v_origen,'Origen','Vendedores','Cliente ficticio',1000);

  -- Cantidad significa dos boletas, no un intervalo numérico.
  v_resultado := public.transferir_boletas_pulse(v_empresa,v_proyecto,v_origen,
    v_destino,'cantidad',2,null,array['Disponible','Debe'],v_admin);
  if (v_resultado->>'transferidas')::int <> 2 or
     (select count(*) from public.boletas where proyecto_id=v_proyecto
       and vendedor_user_id=v_destino) <> 2 then
    raise exception 'TB-01: fallo transferencia por cantidad';
  end if;
  if (select count(*) from public.boletas where proyecto_id=v_proyecto
       and vendedor_user_id=v_destino and numero in ('0001','0002')
       and vendedor_nombre='Destino' and canal='Vendedores') <> 2 then
    raise exception 'TB-01: no se actualizó correctamente el propietario';
  end if;

  -- Una cantidad superior al saldo no debe transferir nada.
  begin
    perform public.transferir_boletas_pulse(v_empresa,v_proyecto,v_origen,v_destino,
      'cantidad',99,null,array['Abonado'],v_admin);
    raise exception 'TB-01: se admitió transferencia incompleta';
  exception when sqlstate '22023' then
    v_errores := v_errores+1;
  end;

  -- La boleta pagada pasa a Oficina sin deshacer el pago ni reabrir su venta.
  v_resultado := public.transferir_boletas_pulse(v_empresa,v_proyecto,v_origen,
    null,'especifica',null,'0005',array['Pagado'],v_admin);
  if (v_resultado->>'transferidas')::int <> 1 or not exists(
    select 1 from public.boletas where proyecto_id=v_proyecto and numero='0005'
      and vendedor_user_id is null and vendedor_nombre='Oficina' and canal='Oficina'
      and estado='Pagado' and nombre_cliente='Cliente ficticio' and valor_pagado=1000
  ) then
    raise exception 'TB-01: no se conservó el pago al transferir a Oficina';
  end if;

  v_resultado := public.transferir_boletas_pulse(v_empresa,v_proyecto,v_origen,
    null,'todas',null,null,array['No disponible','Abonado'],v_admin);
  if (v_resultado->>'transferidas')::int <> 2 or
     (select count(*) from public.boletas where proyecto_id=v_proyecto
       and vendedor_user_id is null) <> 3 then
    raise exception 'TB-01: fallo transferencia de todos los estados filtrados';
  end if;

  begin
    perform public.transferir_boletas_pulse(v_empresa,v_proyecto,v_destino,v_externo,
      'todas',null,null,array['Disponible'],v_admin);
    raise exception 'TB-01: se admitió vendedor de otra empresa';
  exception when sqlstate '22023' then
    v_errores := v_errores+1;
  end;

  if v_errores <> 2 or
     (select count(*) from public.pulse_transferencias_boletas
       where proyecto_id=v_proyecto) <> 3 or
     (select count(*) from public.asignaciones_vendedores
       where proyecto_id=v_proyecto and vendedor_user_id=v_destino) <> 1 or
     (select count(*) from public.boletas
       where proyecto_id=v_proyecto and vendedor_user_id=v_origen) <> 0 then
    raise exception 'TB-01: falló historial, seguridad o liberación de origen';
  end if;

  raise notice 'TB-01: OK — cantidad, todos, específica, estados, auditoría, aislamiento y transacción';
end;
$$;
rollback;
