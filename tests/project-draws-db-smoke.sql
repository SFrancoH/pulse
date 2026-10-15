-- Test fixture aislado de la migración 20261015: no usar en producción.
DO $$
DECLARE
  uid uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='proyectos' AND column_name='sorteos_config'
  ) THEN RAISE EXCEPTION 'Falta calendario en proyectos'; END IF;

  INSERT INTO public.pulse_ganadores_publicos (empresa_id, numero, fecha, poster_url, video_url)
  VALUES ('empresa-ejemplo-a','0045','2026-12-01','https://example.com/flyer.jpg','https://example.com/entrega.mp4')
  RETURNING id INTO uid;

  IF (SELECT count(*) FROM public.pulse_ganadores_publicos WHERE empresa_id='empresa-ejemplo-a') <> 1 THEN
    RAISE EXCEPTION 'No guardó ganador de empresa A';
  END IF;
  IF (SELECT count(*) FROM public.pulse_ganadores_publicos WHERE empresa_id='empresa-ejemplo-b') <> 0 THEN
    RAISE EXCEPTION 'Fuga de ganador entre empresas';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.pulse_ganadores_publicos'::regclass) THEN
    RAISE EXCEPTION 'RLS no activo para ganadores';
  END IF;
  IF has_table_privilege('anon','public.pulse_ganadores_publicos','SELECT') THEN
    RAISE EXCEPTION 'anon no debe poder leer ganadores';
  END IF;
  DELETE FROM public.pulse_ganadores_publicos WHERE id=uid AND empresa_id='empresa-ejemplo-a';
END $$;
