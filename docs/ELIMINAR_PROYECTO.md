# DEL-01 — Eliminar un proyecto desde Pulse

La interfaz y las rutas están preparadas. Se activarán en main después de que el
usuario confirme la instalación de la función SQL. El código no requiere otra
cuenta, proyecto Supabase, Preview ni cambios en GHL.

## Estado actual: instalación suspendida por diferencia de esquema

El usuario ejecutó el instalador el 2026-10-03 y recibió:

```text
DEL-01: falta public.movimientos_boletas.boleta_id; no se instaló la eliminación.
```

La validación falló antes de CREATE OR REPLACE FUNCTION. En este intento no se
creó/reemplazó la función ni se ejecutaron los DELETE. El mismo mensaje aparece
si falta la tabla completa o si existe sin esa columna: aún hay que distinguirlo.
La referencia boleta_id proviene del insert en app/api/ghl-reserva/route.ts;
el código del webhook no acredita el esquema productivo. Los tests SQL anteriores
usaron fixtures con esa columna, por lo que no certifican compatibilidad real.

### Paso manual actual: consultar el esquema, sin modificarlo

1. En la base Supabase actual de Pulse, abrir **SQL Editor → New query**.
2. Copiar el contenido completo de
   `supabase/production/20261003_00_project_deletion_preflight.sql`, pegar y pulsar
   **Run**. Es un único SELECT sobre catálogos: no lee filas de compradores ni
   modifica datos, tablas o funciones; tampoco llama al borrado.
3. Compartir la tabla de resultados con las columnas **tipo, objeto, detalle**.
   Se puede copiar o exportar como CSV desde el resultado. Incluye nombres/tipos
   de columnas, claves/relaciones y nombres de triggers, sin datos de boletas.
4. Esperar la revisión y el SQL adaptado. El botón no se activa hasta instalar
   correctamente la versión corregida y confirmar su verificación.

No repetir el instalador 01 mientras figure suspendido. La operación debe
adaptarse a las relaciones existentes; no cambiar el esquema operativo para
satisfacer el supuesto anterior.

## Instalación posterior, una sola vez (pendiente de SQL corregido)

1. Abrir **Supabase Dashboard** y seleccionar la base que usa Pulse en producción.
2. Entrar en **SQL Editor** y crear una consulta nueva.
3. Abrir `supabase/production/20261003_01_project_deletion.sql`, copiar su contenido
   completo y pegarlo en esa consulta.
4. Pulsar **Run**. Este archivo define la función y sus permisos; no la invoca,
   no elimina registros y no cambia las tablas existentes.
5. Comprobar la última tabla de resultados:

   | instalada | servidor_permitido | anon_permitido | authenticated_permitido | dependencias_adicionales |
   | --- | --- | --- | --- | --- |
   | true | true | false | false | 0 |

6. Confirmar ese resultado para activar el código ya probado en main. Si aparece
   un error o una dependencia adicional, compartir sólo el mensaje o el número;
   revisar esa relación antes de activar. No compartir credenciales ni boletas.

No ejecutar una llamada a `public.eliminar_proyecto_pulse(...)` para probar la
instalación: esa llamada sí borraría los datos del proyecto elegido.

## Uso después de la activación

1. Recargar el panel y abrir **Eliminar proyecto** en la ficha correspondiente.
   Sólo super_admin y empresa_admin pueden hacerlo; empresa_admin sólo dentro de
   su empresa. El servidor comprueba los mismos permisos.
2. Leer el aviso y pulsar **Acepto haber leído el mensaje**.
3. Opcionalmente pulsar **Descargar backup CSV**. Incluye todas las columnas de las
   boletas de ese proyecto y empresa, también cuando hay más de 1.000 filas.
4. Escribir exactamente `ELIMINAR` y pulsar **Aceptar y eliminar**.
5. La ficha desaparece después de que el servidor confirme el borrado. **Cancelar**
   o Escape cierran la ventana antes de la confirmación final; están disponibles
   sin descargar ni escribir nada. Al confirmar se cierra la ventana y comienza
   la operación definitiva.

## Datos incluidos y límites

- Elimina movimientos de las boletas, asignaciones de vendedores, enlaces de
  venta del vendedor, boletas y el proyecto elegido, en una sola transacción.
- Conserva empresa, usuarios, clientes y ganadores compartidos, otros proyectos y
  otras empresas. Los enlaces de Oficina dejan de resolver al quitar el proyecto.
- El CSV es una copia de boletas; no incluye el proyecto, movimientos,
  asignaciones ni otros datos. No es un restore automático de toda la base.
- La exportación conserva los valores y escapa comillas/separadores/saltos de
  línea. Es CSV UTF-8 con BOM y punto y coma. Null y vacío se exportan como celda
  vacía; abrir/importar CSV en Excel puede convertir tipos como los ceros iniciales.
- La exportación es paginada por ID, no un snapshot transaccional de la DB. Si se
  detecta un cambio de cantidad durante la lectura se rechaza el archivo; cambios
  simultáneos de valores con la misma cantidad no se detectan. No cambiar boletas
  de ese proyecto mientras se obtiene la copia que se quiera conservar.
- Una dependencia de FK no prevista o registros cruzados entre empresas abortan
  el borrado. No se ocultan errores ni se sigue borrando parcialmente.
- La transacción toma locks de escritura en las cinco tablas durante el borrado;
  las lecturas siguen disponibles. `lock_timeout=5s` hace fallar sin borrar nada
  si no se obtienen. No se agregan constraints ni triggers a escritores existentes;
  sin FK de proyecto, escrituras antiguas en vuelo que se ejecuten después de
  terminar podrían crear huérfanos. La integridad referencial global sigue en P04.
- Eliminar filas permite reutilizar espacio mediante el mantenimiento de
  PostgreSQL; no garantiza que disminuya inmediatamente el tamaño físico/medido
  en Supabase. No se ejecuta VACUUM FULL, TRUNCATE ni compactación global.

## Verificación local realizada

`node --test tests/project-deletion.test.mjs`: permisos/confirmación en servidor,
filtros empresa/proyecto, exportación completa, errores SQL/transporte sin falsa
confirmación. SDK Supabase real con transporte y sesión de fixtures.

`tests/project-deletion-sql.test.mjs`: SQL real en PGlite local, aislamiento por
empresa/proyecto, preservación de datos compartidos, privilegios, validación,
instalación sin cambios y rollback de todos los DELETE si falla el último paso.
Necesita `@electric-sql/pglite` como dependencia de pruebas; puede resolverse
mediante `PULSE_TEST_MODULES` sin añadirla a producción.

`tests/project-deletion-ui.test.mjs`: Chromium/Playwright con API ficticia. Prueba
roles, gates, Cancelar/Escape/reapertura, descarga opcional, espera durante descarga
y errores. Requiere Playwright/Chromium; `PULSE_CHROMIUM_EXECUTABLE` permite un
ejecutable local y el entorno Codex puede usar su Playwright ya instalado.

También TypeScript y lint acotado. Estas pruebas no acreditan el catálogo, RLS,
triggers, PostgREST, carga/concurrencia ni el resultado de una eliminación en la
base productiva. No se han borrado datos reales para probar esta función.

`tests/project-deletion-preflight.test.mjs`: 3/3 pruebas PGlite. Reproduce el
rechazo del instalador con columna o tabla ausente, verifica que no se instala la
función ni cambian filas y ejecuta el diagnóstico en transacciones READ ONLY.
Comprueba columnas, otras tablas relacionadas, claves, CASCADE y triggers sin
ejecutarlos ni exportar registros. Lint del test sin errores. Para correrlo:
`PULSE_TEST_MODULES=<node_modules_de_pruebas> node --test tests/project-deletion-preflight.test.mjs`.

## Reversión

Antes de la activación, la función instalada puede quedar sin utilizar. Si se
detecta una regresión después de activar, revertir el commit de aplicación de
DEL-01. Revertir código no recupera proyectos ni registros ya eliminados.

Referencias técnicas:
[Funciones y permisos de Supabase](https://supabase.com/docs/guides/database/functions),
[errores y rollback de PostgreSQL](https://www.postgresql.org/docs/17/plpgsql-control-structures.html),
[reutilización de espacio y VACUUM](https://www.postgresql.org/docs/17/routine-vacuuming.html).
