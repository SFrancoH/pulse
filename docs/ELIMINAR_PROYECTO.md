# DEL-01 — Eliminar un proyecto desde Pulse

## Alcance

El botón **Eliminar proyecto** sólo se muestra a los roles `super_admin` y
`empresa_admin`. El servidor vuelve a validar el rol y el acceso a la empresa:
ocultar el botón no es la única protección.

El flujo visible es exactamente:

1. Pulsar **Eliminar proyecto**.
2. En el popup escribir exactamente `ELIMINAR`.
3. Hasta que la palabra coincida, **ACEPTAR** permanece deshabilitado.
4. **Cancelar** y Escape cierran el popup sin ejecutar ninguna eliminación.
5. Al pulsar **ACEPTAR**, Pulse envía una única solicitud de eliminación.

## Qué se elimina

La operación usa `public.eliminar_proyecto_pulse` para ejecutar el borrado dentro
de una sola transacción. Elimina únicamente datos asociados al proyecto autorizado:

- movimientos ligados a las boletas, sólo si existe `movimientos_boletas` con la relación esperada;
- filas de `asignaciones_vendedores` pertenecientes al proyecto;
- filas de `seller_sales_links` pertenecientes al proyecto;
- boletas del proyecto;
- el registro del proyecto.

No elimina la tabla ni modifica su estructura. Tampoco elimina `admin_users`,
vendedores, usuarios de la empresa, la empresa, otros proyectos ni boletas de otros
proyectos. Si PostgreSQL detecta una dependencia o trigger no revisado, la función
aborta antes de confirmar el borrado.

## Protección

- Confirmación exacta `ELIMINAR` en UI y servidor.
- Sólo `super_admin` y `empresa_admin`; el admin de empresa queda limitado a su empresa.
- Verificación de mismo origen cuando el navegador envía `Origin`.
- El `empresa_id` y el proyecto se derivan del acceso autorizado en servidor; no se aceptan desde el body.
- La RPC sólo tiene permiso de ejecución para `service_role`.
- La función SQL no usa `DROP TABLE`, `TRUNCATE` ni altera tablas.

## Dependencia de Supabase

El archivo `supabase/production/20261003_01_project_deletion.sql` ya contiene la
definición v2 de la función. Guardarlo en Git no la instala automáticamente en la
base de datos. Si la RPC no existe en el Supabase productivo, el endpoint responde
503 y no intenta un borrado alternativo no transaccional.

La instalación del SQL define la función y sus permisos; no elimina proyectos por
sí sola. No se debe invocar la función manualmente con un proyecto real como prueba.
