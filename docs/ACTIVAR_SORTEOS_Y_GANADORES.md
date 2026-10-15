# Activar fechas de sorteos y administración de ganadores en PULSE

## Alcance

- Un calendario por proyecto, con un premio mayor obligatorio y hasta 100 anticipados configurables, fecha y hora de Colombia.
- Contadores debajo del flyer y antes de los números de venta en los tres canales.
- Ganadores existentes y nuevos en la tabla **ya existente** `public.ganadores`, asociados a `empresa_id`.
- `public.proyectos` ya existe: se agregará una columna `sorteos_config jsonb` para el calendario. **No** volver a ejecutar `CREATE TABLE proyectos` o `CREATE TABLE ganadores`.

## Esquemas confirmados por el usuario el 2026-10-15

- `public.proyectos`: `id text` PK, `empresa_id text` nullable, `sales_token`, `flyer_url`; todavía sin `sorteos_config`.
- `public.ganadores`: `id uuid` PK, `empresa_id text NOT NULL`, `proyecto_id text` nullable, `numero text`, `fecha date`, `video_url text`, `poster_url text` nullable, `activo bool`, `orden integer`, `created_at` y `updated_at`.
- No alterar constraints, RLS ni datos de ganadores en la migración. La API del panel protege por sesión admin/empresa y usa el `empresa_id` autorizado.

## Orden obligatorio

1. Hacer respaldo y seleccionar el Supabase Production correcto. Abrir SQL Editor.
2. Ejecutar **solo** `supabase/production/20261015_01_sorteos_y_ganadores_publicos.sql`. El nombre de archivo se conservó por continuidad con el PR #43, pero su contenido actualizado **solo agrega `proyectos.sorteos_config`** e inicializa (si faltan) las fechas conocidas de la campaña de octubre; no crea ni modifica ganadores.
3. Ejecutar las consultas de solo lectura:

```sql
SELECT EXISTS (
 SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='proyectos'
   AND column_name='sorteos_config'
) AS calendario_disponible;

SELECT to_regclass('public.ganadores') IS NOT NULL
  AS ganadores_existentes;
```

Ambas respuestas deben ser `true`. La segunda ya debería ser `true` según el DDL aportado. Si `calendario_disponible` permanece `false`, no fusionar el PR.

4. Tras confirmación del usuario, revisar CI y fusionar el PR #43 a `main`; verificar el build Vercel Production. No utilizar Preview ni otra base.
5. En PULSE, crear un proyecto indicando fecha y hora obligatoria del **premio mayor**, y opcionalmente **+ Agregar anticipado** tantas veces como necesites. Se pueden editar las fechas después con **Configurar premio mayor y anticipados** en la tarjeta.
6. En el encabezado de la empresa, **Agregar ganadores**; registrar fecha, número de cuatro dígitos, enlace HTTPS del flyer y URL HTTPS del video. Los nuevos registros se crean en la tabla `ganadores` con `empresa_id` de la ruta autorizada, `proyecto_id=NULL`. El panel también muestra los históricos de la misma empresa y permite editarlos o eliminarlos.
7. Validar con datos ficticios que: (a) uno mayor + tres anticipados produce cuatro tarjetas; (b) los contadores cambian cada segundo; (c) el bloque se ve después del flyer en los tres canales; (d) un proyecto previo sin fechas muestra «Fecha por anunciar»; (e) una empresa no ve ganadores de otra. No generar reservas reales para probarlo.

## Precauciones

- No tocar `PULSE_RESERVAS_V2`, webhooks de GHL, secretos ni estados de boletas.
- Hora en Colombia, UTC−05:00; cada anticipado ocurre antes del premio mayor.
- El reproductor público necesita enlaces HTTPS directos a videos compatibles.
- Sin instalar la migración, el nuevo formulario de proyecto fallaría al guardar: **no fusionar**.
- En un rollback de código, conservar los nuevos datos y no eliminar la columna.
