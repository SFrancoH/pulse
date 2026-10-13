-- Pruebas de integridad SQL con datos FICTICIOS en PostgreSQL local.
INSERT INTO public.empresas(id,nombre) VALUES ('empresa_prueba','Empresa de prueba');
INSERT INTO public.admin_users(id,empresa_id,role,estado)
VALUES ('00000000-0000-0000-0000-000000000001','empresa_prueba','empresa_admin','activo'),
       ('00000000-0000-0000-0000-000000000002','empresa_prueba','vendedor','activo');
INSERT INTO public.proyectos(id,empresa_id,nombre,slug,precio_boleta)
VALUES ('sorteo_prueba','empresa_prueba','Sorteo ficticio','sorteo-ficticio',60000),
       ('sorteo_vendedor','empresa_prueba','Sorteo asignado','sorteo-asignado',60000);
INSERT INTO public.pulse_empresa_integraciones(empresa_id,responsable_publico_user_id)
VALUES ('empresa_prueba','00000000-0000-0000-0000-000000000001');
INSERT INTO public.boletas(empresa_id,proyecto_id,numero,estado,canal,vendedor_nombre,updated_at,nombre_cliente,telefono_cliente,comprobante_url)
VALUES ('empresa_prueba','sorteo_prueba','0001','No disponible','Reserva temporal','Oficina',now(),'Demo','3000000000','https://ejemplo.invalid/boleta/1'),
       ('empresa_prueba','sorteo_prueba','0002','No disponible','Reserva temporal','Oficina',now(),'Demo','3000000000','https://ejemplo.invalid/boleta/2');
INSERT INTO public.boletas(empresa_id,proyecto_id,numero,estado,canal,vendedor_nombre,vendedor_user_id,updated_at,nombre_cliente,telefono_cliente,comprobante_url)
VALUES ('empresa_prueba','sorteo_vendedor','0003','No disponible','Reserva temporal','Vendedor',
        '00000000-0000-0000-0000-000000000002',now(),'Demo','3000000000','https://ejemplo.invalid/boleta/3');

DO $$
DECLARE resultado jsonb;grupo uuid;alerta uuid;boleta uuid;
BEGIN
 SELECT public.pulse_confirmar_reserva('empresa_prueba','sorteo_prueba',ARRAY['0001','0002'],
 (SELECT b.updated_at FROM public.boletas b WHERE b.proyecto_id='sorteo_prueba' AND b.numero='0001'),
 NULL,'Oficina',NULL,true) INTO resultado;

 IF coalesce((resultado->>'expired')::boolean,true) OR jsonb_array_length(resultado->'confirmadas')<>2 THEN
  RAISE EXCEPTION 'La reserva de oficina no confirmó exactamente 2 números';
 END IF;
 IF (resultado->'confirmadas'->0->>'comprobante_url') IS NULL THEN RAISE EXCEPTION 'Falta comprobante'; END IF;
 grupo := (resultado->>'reserva_grupo')::uuid;
 IF (SELECT count(*) FROM public.pulse_eventos_reserva WHERE reserva_grupo=grupo)<>1 THEN RAISE EXCEPTION 'Evento duplicado'; END IF;
 IF (SELECT count(*) FROM public.pulse_alertas_oportunidades WHERE reserva_grupo=grupo)<>2 THEN RAISE EXCEPTION 'Alertas incompletas'; END IF;
 IF (SELECT count(*) FROM public.pulse_alertas_oportunidades WHERE reserva_grupo=grupo AND responsable_user_id='00000000-0000-0000-0000-000000000001')<>2 THEN
  RAISE EXCEPTION 'Responsable público incorrecto';
 END IF;

 -- Una segunda confirmación nunca puede crear otro evento.
 SELECT public.pulse_confirmar_reserva('empresa_prueba','sorteo_prueba',ARRAY['0001','0002'],
 (SELECT b.updated_at FROM public.boletas b WHERE b.proyecto_id='sorteo_prueba' AND b.numero='0001'),
 NULL,'Oficina',NULL,true) INTO resultado;
 IF coalesce((resultado->>'expired')::boolean,false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'La confirmación duplicada no se rechazó'; END IF;
 IF (SELECT count(*) FROM public.pulse_eventos_reserva WHERE proyecto_id='sorteo_prueba')<>1 THEN RAISE EXCEPTION 'Eventos duplicados'; END IF;

 UPDATE public.pulse_alertas_oportunidades SET estado='pendiente' WHERE reserva_grupo=grupo;
 SELECT id,boleta_id INTO alerta,boleta FROM public.pulse_alertas_oportunidades WHERE reserva_grupo=grupo LIMIT 1;
 IF NOT public.pulse_marcar_alerta_manual(alerta,'empresa_prueba','sorteo_prueba','00000000-0000-0000-0000-000000000001') THEN
  RAISE EXCEPTION 'No se pudo cerrar alerta individual';
 END IF;
 IF (SELECT count(*) FROM public.pulse_alertas_oportunidades WHERE reserva_grupo=grupo AND estado='pendiente')<>1 THEN
  RAISE EXCEPTION 'Se cerró más de una alerta';
 END IF;
 IF (SELECT oportunidad_creada FROM public.boletas WHERE id=boleta) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'El cierre manual no marcó la boleta correspondiente';
 END IF;

 SELECT public.pulse_confirmar_reserva('empresa_prueba','sorteo_vendedor',ARRAY['0003'],
 (SELECT b.updated_at FROM public.boletas b WHERE b.proyecto_id='sorteo_vendedor' AND b.numero='0003'),
 '00000000-0000-0000-0000-000000000002','Vendedores',NULL,false) INTO resultado;
 IF coalesce((resultado->>'expired')::boolean,true) OR jsonb_array_length(resultado->'confirmadas')<>1 THEN
  RAISE EXCEPTION 'La reserva del vendedor no se confirmó';
 END IF;
 IF (SELECT count(*) FROM public.pulse_eventos_reserva WHERE proyecto_id='sorteo_vendedor')<>0 THEN
  RAISE EXCEPTION 'La reserva de vendedor creó un evento';
 END IF;
 IF (SELECT count(*) FROM public.pulse_alertas_oportunidades WHERE proyecto_id='sorteo_vendedor')<>0 THEN
  RAISE EXCEPTION 'La reserva de vendedor creó alertas';
 END IF;

 SELECT public.pulse_eliminar_proyecto_con_reservas('empresa_prueba','sorteo_prueba','ELIMINAR',true) INTO resultado;
 IF (resultado->>'proyectos')::integer<>1 THEN RAISE EXCEPTION 'No se borró el proyecto ficticio'; END IF;
 IF (SELECT count(*) FROM public.pulse_alertas_oportunidades WHERE proyecto_id='sorteo_prueba')<>0
 OR (SELECT count(*) FROM public.pulse_eventos_reserva WHERE proyecto_id='sorteo_prueba')<>0 THEN
  RAISE EXCEPTION 'La eliminación dejó registros huérfanos';
 END IF;
 IF (SELECT count(*) FROM public.admin_users WHERE empresa_id='empresa_prueba')<>2 THEN
  RAISE EXCEPTION 'La eliminación borró usuarios';
 END IF;
 RAISE NOTICE 'Todas las pruebas SQL de reserva se ejecutaron correctamente.';
END;
$$;
