-- PULSE — D01: diagnóstico de lectura, no modifica registros
-- Ejecutar en SQL Editor de la base productiva antes de instalar D02.
SELECT 'columna_boletas' AS tipo, c.column_name AS objeto,
       c.data_type || ' / ' || coalesce(c.udt_name,'') AS detalle
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.table_name='boletas'
 AND c.column_name IN ('id','numero','empresa_id','proyecto_id','estado','canal','updated_at','comprobante_url','reserva_grupo','oportunidad_creada','oportunidad_error_at','vendedor_user_id','vendedor_nombre')
UNION ALL
SELECT 'columna_usuario', c.column_name,c.data_type||' / '||coalesce(c.udt_name,'')
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.table_name='admin_users'
 AND c.column_name IN ('id','empresa_id','role','estado')
UNION ALL
SELECT 'constraint_usuario', con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con WHERE con.conrelid=to_regclass('public.admin_users')
UNION ALL
SELECT 'funcion', 'eliminar_proyecto_pulse',coalesce(to_regprocedure('public.eliminar_proyecto_pulse(text,text,text,boolean)')::text,'NO INSTALADA')
UNION ALL
SELECT 'tabla', 'empresas',coalesce(to_regclass('public.empresas')::text,'NO EXISTE')
ORDER BY tipo,objeto;

-- NO se muestran compradores, boletas reales ni secretos.
-- Revisar resultado con el DDL disponible antes de aplicar 01.
