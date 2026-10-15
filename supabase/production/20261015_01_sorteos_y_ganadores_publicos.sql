-- PULSE: calendario por proyecto con un premio mayor y N anticipados.
-- DDL confirmado 2026-10-15: public.ganadores YA EXISTE.
-- No crear una tabla duplicada, ni modificar ganadores ni sus permisos.
-- El nombre de este archivo se mantiene por continuidad con el PR #43.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS sorteos_config jsonb NULL;

-- Campaña histórica de octubre: fechas antiguas editables sin sobrescribir valores existentes.
UPDATE public.proyectos
SET sorteos_config = jsonb_build_object(
  'premio_mayor', '2026-10-10T00:00:00-05:00',
  'anticipados', jsonb_build_array('2026-09-12T00:00:00-05:00')
)
WHERE id = 'z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre'
  AND sorteos_config IS NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Diagnóstico READ ONLY:
-- SELECT EXISTS (SELECT 1 FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='proyectos'
--     AND column_name='sorteos_config') AS calendario_disponible;
-- SELECT to_regclass('public.ganadores') IS NOT NULL AS ganadores_existentes;
