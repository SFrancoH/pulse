-- Fixture PostgreSQL de CI; no ejecutar en Supabase Production.
DO $$
DECLARE uid uuid; config jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='proyectos'
      AND column_name='sorteos_config'
  ) THEN RAISE EXCEPTION 'Falta proyectos.sorteos_config'; END IF;

  INSERT INTO public.ganadores (empresa_id,numero,fecha,poster_url,video_url)
  VALUES ('empresa-ejemplo-a','0045','2026-12-01',
          'https://example.com/flyer.jpg','https://example.com/entrega.mp4')
  RETURNING id INTO uid;

  IF (SELECT count(*) FROM public.ganadores WHERE empresa_id='empresa-ejemplo-a' AND id=uid)<>1 THEN
    RAISE EXCEPTION 'No guardó ganador en la tabla existente';
  END IF;
  IF (SELECT count(*) FROM public.ganadores WHERE empresa_id='empresa-ejemplo-b' AND id=uid)<>0 THEN
    RAISE EXCEPTION 'El filtro por empresa expuso ganador ajeno';
  END IF;

  UPDATE public.proyectos
  SET sorteos_config='{"premio_mayor":"2026-12-31T20:00:00-05:00","anticipados":["2026-10-20T10:00:00-05:00","2026-11-20T10:00:00-05:00","2026-12-20T10:00:00-05:00"]}'::jsonb
  WHERE id='sorteo_vendedor' AND empresa_id='empresa_prueba';

  SELECT sorteos_config INTO config FROM public.proyectos WHERE id='sorteo_vendedor';
  IF jsonb_array_length(config->'anticipados')<>3 THEN
    RAISE EXCEPTION 'No persistió tres anticipados';
  END IF;

  DELETE FROM public.ganadores WHERE id=uid AND empresa_id='empresa-ejemplo-a';
END $$;
