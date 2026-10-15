# Activar fechas de sorteos y administración de ganadores en PULSE

## Alcance

Un calendario por proyecto, con un premio mayor obligatorio y hasta 100 anticipados configurables, fecha y hora de Colombia. Cuentas regresivas debajo del flyer y antes de los números de venta. Ganadores pertenecientes a la empresa, no a vendedores ni a otros proyectos; permanecen en todas las páginas de esa empresa.

## Orden obligatorio

1. Hacer respaldo de Supabase. En el proyecto de producción, abrir **SQL Editor**.
2. Ejecutar `supabase/production/20261015_01_sorteos_y_ganadores_publicos.sql`. Es una migración idempotente que agrega `proyectos.sorteos_config`, crea `pulse_ganadores_publicos` y preserva la tabla histórica `ganadores`. La campaña antigua de octubre se completa con las fechas conocidas solo si no estaba configurada. No modifica boletas ni operaciones de pago/reserva.
3. Ejecutar comprobaciones de solo lectura:

```sql
SELECT EXISTS (
 SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='proyectos' AND column_name='sorteos_config'
) AS calendario_disponible;
SELECT to_regclass('public.pulse_ganadores_publicos') IS NOT NULL AS tabla_ganadores_disponible;
```

Ambos resultados deben ser `true`. Si fallan, **no publicar** los formularios nuevos. Compartir solo las respuestas true/false (sin datos de compradores).

4. Con esos resultados confirmados, fusionar el PR de esta unidad en `main`. CI y Vercel Production deben finalizar correctamente. No usar Preview ni otra instancia de Supabase.
5. En PULSE, entrar como super_admin / empresa_admin. En la creación del proyecto indicar fecha y hora del **premio mayor**. Usar **+ Agregar anticipado** para cada sorteo adicional. Después del alta, configurar o corregir fechas con el botón **Configurar premio mayor y anticipados** de la tarjeta del proyecto.
6. En el encabezado de cada empresa pulsar **Agregar ganadores**. Completar fecha, número de cuatro dígitos, URL HTTPS del flyer y URL HTTPS directa a video. Se puede editar o eliminar los ganadores creados en este panel. Los históricos de `ganadores` se siguen mostrando pero no se reescriben desde esta nueva administración.
7. Comprobar con proyectos y datos ficticios que (a) 1 mayor + 3 anticipados produce 4 tarjetas, (b) cada contador cambia segundo a segundo, (c) el bloque aparece tras el flyer y antes de los consecutivos en los tres canales, (d) un proyecto viejo sin fecha muestra "Fecha por anunciar", (e) los ganadores de una empresa no aparecen en otras. No generar nuevas reservas reales para validar esta función.

## Precauciones

- No activar/desactivar `PULSE_RESERVAS_V2`: esta unidad es independiente de la integración GHL.
- La hora se introduce en zona Colombia (UTC−05:00), no UTC. Los anticipados deben ocurrir antes del premio mayor.
- Se usan URL HTTPS directas al contenido; enlaces a páginas genéricas de video podrían no funcionar en el reproductor HTML5.
- Sin migración, las páginas de venta actuales tienen respaldo para no fallar, pero la creación/configuración de calendarios nuevos no estará disponible.
- Reversión de código sin borrar los datos de calendarios ni ganadores.
