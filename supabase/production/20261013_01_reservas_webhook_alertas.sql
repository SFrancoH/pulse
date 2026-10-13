-- PULSE / etapa D02 — preparación estructural de reservas y oportunidades
-- APLICACIÓN MANUAL: no se ejecuta al guardar en GitHub.
-- PRECONDICIONES: backup; comprobar DDL real admin_users/boletas y función de eliminación.
-- No contiene URLs de integración ni datos de compradores.
BEGIN;

ALTER TABLE public.boletas
  ADD COLUMN IF NOT EXISTS creado_por_user_id uuid NULL;

-- Tabla privada: configuración de integración por empresa (solo service_role).
CREATE TABLE IF NOT EXISTS public.pulse_empresa_integraciones (
  empresa_id text PRIMARY KEY,
  webhook_url_cifrada text NULL,
  responsable_publico_user_id uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pulse_eventos_reserva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  proyecto_id text NOT NULL,
  reserva_grupo uuid NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  intento_iniciado_at timestamptz NULL,
  respuesta_at timestamptz NULL,
  motivo text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pulse_eventos_reserva_unico UNIQUE (empresa_id, proyecto_id, reserva_grupo),
  CONSTRAINT pulse_eventos_reserva_estado_check CHECK
    (estado IN ('pendiente','enviando','recibido','fallido','incierto'))
);
CREATE INDEX IF NOT EXISTS idx_pulse_eventos_proyecto
  ON public.pulse_eventos_reserva (empresa_id, proyecto_id, created_at);

CREATE TABLE IF NOT EXISTS public.pulse_alertas_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  proyecto_id text NOT NULL,
  boleta_id uuid NOT NULL,
  reserva_grupo uuid NOT NULL,
  responsable_user_id uuid NULL,
  estado text NOT NULL DEFAULT 'esperando',
  motivo text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resuelto_at timestamptz NULL,
  resuelto_por_user_id uuid NULL,
  CONSTRAINT pulse_alerta_boleta_grupo_unica UNIQUE (boleta_id, reserva_grupo),
  CONSTRAINT pulse_alerta_estado_check CHECK
    (estado IN ('esperando','pendiente','creada_manual','confirmada_automatica'))
);
CREATE INDEX IF NOT EXISTS idx_pulse_alertas_responsable
  ON public.pulse_alertas_oportunidades (empresa_id, responsable_user_id, estado, created_at);

-- Las tablas quedan inaccesibles a anon/authenticated incluso si el esquema public está expuesto.
ALTER TABLE public.pulse_empresa_integraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_eventos_reserva ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_alertas_oportunidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pulse_empresa_integraciones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pulse_eventos_reserva FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pulse_alertas_oportunidades FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pulse_empresa_integraciones TO service_role;
GRANT ALL ON public.pulse_eventos_reserva TO service_role;
GRANT ALL ON public.pulse_alertas_oportunidades TO service_role;

-- El esquema admin_users no está versionado en el repositorio: revisar primero si hay
-- un CHECK/enum en role antes de permitir el nuevo valor 'oficina_admin'.
-- NO se eliminan constraints desconocidos ni se alteran usuarios automáticamente.

CREATE OR REPLACE FUNCTION public.pulse_confirmar_reserva(
  p_empresa_id text,
  p_proyecto_id text,
  p_numeros text[],
  p_hold_token timestamptz,
  p_vendedor_user_id uuid,
  p_canal text,
  p_usuario_id uuid,
  p_con_integracion boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grupo uuid := gen_random_uuid();
  v_registros integer;
  v_resultado jsonb;
  v_responsable uuid;
BEGIN
  IF p_empresa_id IS NULL OR p_proyecto_id IS NULL OR p_hold_token IS NULL
     OR p_canal NOT IN ('Oficina', 'Creacion Manual', 'Vendedores')
     OR cardinality(p_numeros) < 1 OR cardinality(p_numeros) > 10
     OR (SELECT count(DISTINCT n) FROM unnest(p_numeros) AS n) <> cardinality(p_numeros)
     OR EXISTS (SELECT 1 FROM unnest(p_numeros) AS n WHERE n !~ '^[0-9]{4}$')
     OR (p_con_integracion AND (p_canal = 'Vendedores' OR p_vendedor_user_id IS NOT NULL))
     OR (NOT p_con_integracion AND p_canal <> 'Vendedores')
  THEN
    RAISE EXCEPTION 'Reserva inválida' USING ERRCODE = '22023';
  END IF;

  IF clock_timestamp() >= p_hold_token + interval '60 seconds' THEN
    RETURN jsonb_build_object('expired', true, 'confirmadas', '[]'::jsonb);
  END IF;

  -- Bloquear todo el lote antes de modificar; evitar medias reservas.
  PERFORM 1 FROM public.boletas b
  WHERE b.empresa_id = p_empresa_id AND b.proyecto_id = p_proyecto_id
    AND b.numero = ANY(p_numeros)
  ORDER BY b.numero FOR UPDATE;

  SELECT count(*) INTO v_registros
    FROM public.boletas b
   WHERE b.empresa_id = p_empresa_id AND b.proyecto_id = p_proyecto_id
     AND b.numero = ANY(p_numeros) AND b.estado = 'No disponible'
     AND b.canal = 'Reserva temporal' AND b.updated_at = p_hold_token
     AND b.vendedor_user_id IS NOT DISTINCT FROM p_vendedor_user_id
     AND (p_vendedor_user_id IS NOT NULL OR b.vendedor_nombre = 'Oficina');

  IF v_registros <> cardinality(p_numeros) THEN
    RETURN jsonb_build_object('expired', true, 'confirmadas', '[]'::jsonb);
  END IF;

  -- La responsable de reservas públicas debe ser una empresa_admin activa de esta empresa.
  IF p_con_integracion AND p_usuario_id IS NULL THEN
    SELECT i.responsable_publico_user_id INTO v_responsable
      FROM public.pulse_empresa_integraciones i
     WHERE i.empresa_id = p_empresa_id;
    IF v_responsable IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.admin_users u WHERE u.id = v_responsable
        AND u.empresa_id = p_empresa_id AND u.role = 'empresa_admin'
        AND u.estado = 'activo'
    ) THEN
      v_responsable := NULL;
    END IF;
  ELSE
    v_responsable := p_usuario_id;
  END IF;

  WITH modificadas AS (
    UPDATE public.boletas b SET
      estado = 'Debe',
      canal = p_canal,
      created_at = b.created_at,
      updated_at = clock_timestamp(),
      creado_por_user_id = p_usuario_id,
      reserva_grupo = CASE WHEN p_con_integracion THEN v_grupo ELSE b.reserva_grupo END,
      oportunidad_creada = CASE WHEN p_con_integracion THEN false ELSE b.oportunidad_creada END,
      oportunidad_error_at = NULL
    WHERE b.empresa_id = p_empresa_id AND b.proyecto_id = p_proyecto_id
      AND b.numero = ANY(p_numeros) AND b.updated_at = p_hold_token
      AND b.estado = 'No disponible' AND b.canal = 'Reserva temporal'
    RETURNING b.id, b.numero, b.comprobante_url
  )
  SELECT jsonb_agg(jsonb_build_object('boleta_id', id,'numero',numero,
                                     'comprobante_url',comprobante_url) ORDER BY numero)
    INTO v_resultado FROM modificadas;

  IF jsonb_array_length(coalesce(v_resultado,'[]'::jsonb)) <> cardinality(p_numeros) THEN
    RAISE EXCEPTION 'Reserva modificada durante confirmación' USING ERRCODE = '40001';
  END IF;

  IF p_con_integracion THEN
    INSERT INTO public.pulse_eventos_reserva (empresa_id,proyecto_id,reserva_grupo)
    VALUES (p_empresa_id,p_proyecto_id,v_grupo);
    INSERT INTO public.pulse_alertas_oportunidades (
      empresa_id,proyecto_id,boleta_id,reserva_grupo,responsable_user_id
    )
    SELECT p_empresa_id,p_proyecto_id,b.id,v_grupo,v_responsable
      FROM public.boletas b WHERE b.empresa_id = p_empresa_id
        AND b.proyecto_id = p_proyecto_id AND b.numero = ANY(p_numeros);
  END IF;

  RETURN jsonb_build_object('expired',false,'reserva_grupo', CASE WHEN p_con_integracion THEN v_grupo ELSE NULL END,
                             'confirmadas',v_resultado);
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_confirmar_reserva(text,text,text[],timestamptz,uuid,text,uuid,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_confirmar_reserva(text,text,text[],timestamptz,uuid,text,uuid,boolean)
  TO service_role;
COMMIT;

-- POST-APLICACIÓN: verificar existencia/privilegios; no ejecutar reservas reales de prueba.
-- Antes de instalar en producción validar el borrado de proyecto con las tablas pulse_*.
