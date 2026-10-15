-- PULSE: premio mayor + N anticipados por proyecto; nuevos ganadores gestionados por empresa.
-- Ejecutar ANTES de desplegar formularios nuevos. No borra ni altera ganadores históricos.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS sorteos_config jsonb NULL;

-- Migrar la campaña histórica a un calendario editable (preservar valores ya configurados).
UPDATE public.proyectos
SET sorteos_config = jsonb_build_object(
  'premio_mayor', '2026-10-10T00:00:00-05:00',
  'anticipados', jsonb_build_array('2026-09-12T00:00:00-05:00')
)
WHERE id = 'z6D7TmXDOdu2At3H4Tqy_sorteo_10_de_octubre'
  AND sorteos_config IS NULL;

-- El esquema de ganadores antiguo no está versionado completamente.
-- Tabla nueva administrable, manteniendo lectura de registros anteriores.
CREATE TABLE IF NOT EXISTS public.pulse_ganadores_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  numero text NOT NULL CHECK (numero ~ '^[0-9]{4}$'),
  fecha date NOT NULL,
  poster_url text NOT NULL,
  video_url text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pulse_ganador_urls_validas CHECK (
    poster_url ~ '^https://[^[:space:]]+$' AND video_url ~ '^https://[^[:space:]]+$'
  )
);

CREATE INDEX IF NOT EXISTS idx_pulse_ganadores_empresa_fecha
ON public.pulse_ganadores_publicos (empresa_id, fecha DESC);

ALTER TABLE public.pulse_ganadores_publicos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pulse_ganadores_publicos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pulse_ganadores_publicos TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Comprobación de solo lectura después de instalar:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='proyectos' AND column_name='sorteos_config';
-- SELECT to_regclass('public.pulse_ganadores_publicos');
