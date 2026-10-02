# P01: preparar la autorización de webhooks de boletas

Estado de esta entrega: guard y validación disponibles, sin activar todavía en las rutas. `actualizar-boleta` y `reservar-boleta` conservan su contrato actual hasta recibir confirmación de la configuración de Vercel/GHL. Las pruebas locales del guard no significan que esas rutas ya estén protegidas en producción.

## Contrato que se activará

| Remitente | Autorización | Ámbito |
| --- | --- | --- |
| Administrador del panel | Sesión vigente; `super_admin` o administrador de la empresa del proyecto | Proyecto autorizado mediante `requireProjectManagerAccess` |
| Workflow externo | Header `Authorization: Bearer <credencial_del_proyecto>` | Un único proyecto configurado en el servidor; empresa obtenida de `proyectos` |
| Anónimo, vendedor con sólo su sesión o credencial de otro proyecto | Rechazado | Sin lectura/escritura de boletas |

No usar el token público de ventas, el ID del proyecto, `empresa_id`, la llave privada de Supabase ni el secreto de sesión como credencial. Una credencial distinta para cada proyecto. No ponerla en URLs, formularios, JavaScript del navegador, tickets de soporte, Git o mensajes de chat.

El registro inicial utiliza una variable privada de Production; evita una migración de DB durante este cierre urgente. Se trasladará a un registro persistente de integraciones con hashes, scopes, rotación/revocación y eventos en P06. Este mecanismo inicial no acredita firma del cuerpo, protección contra replay ni entrega idempotente.

## Procedimiento manual antes de activar las rutas

1. **Inventariar los workflows.** En GHL, abrir la ubicación/subcuenta que vende el proyecto → Automation/Automations → Workflows. Revisar todas las acciones que llaman URLs terminadas en `/actualizar-boleta` o `/reservar-boleta`. Incluir copias, workflows de pagos, abonos y reservas. Anotar sólo el ID de proyecto y la acción; no copiar compradores ni secretos. El repositorio muestra esas URLs en Crear proyecto, pero no contiene la configuración real de GHL.
2. **Obtener el ID exacto.** Copiarlo entre `/api/proyectos/` y `/actualizar-boleta` o `/reservar-boleta` en la URL de la acción. También aparece entre `/admin/proyectos/` y la siguiente barra en el panel. El nombre comercial del sorteo no reemplaza ese ID.
3. **Crear una credencial privada por proyecto.** En un gestor de contraseñas, generar 48 caracteres aleatorios usando letras y números. El código admite 32–128 caracteres de `A-Z`, `a-z`, `0-9`, `_` y `-`. Guardarla allí con el nombre del proyecto. No reutilizar claves de otro proyecto ni claves existentes de Supabase/login.
4. **Configurar Vercel.** Abrir el proyecto Pulse → Settings → Environment Variables. Crear o editar **`PULSE_PROJECT_WEBHOOK_KEYS`**, sólo para **Production**, como JSON válido. Sustituir los marcadores por el ID y la credencial creados. No usar el prefijo `NEXT_PUBLIC_`. Conservar las entradas existentes si hay varios proyectos.

   ```json
   {"ID_EXACTO_DEL_PROYECTO":"CREDENCIAL_ALEATORIA_DE_48_CARACTERES"}
   ```

   Para varios proyectos, usar un único objeto con una entrada por ID y credenciales distintas:

   ```json
   {
     "ID_EXACTO_PROYECTO_A":"CREDENCIAL_ALEATORIA_EXCLUSIVA_A",
     "ID_EXACTO_PROYECTO_B":"CREDENCIAL_ALEATORIA_EXCLUSIVA_B"
   }
   ```

   Los valores de ejemplo son marcadores, no claves utilizables. Guardar la variable. No hace falta crear Preview ni otro Supabase. La variable se aplicará al deployment nuevo de main que active la protección.
5. **Configurar GHL.** En cada acción identificada, usar la autorización **Bearer Token** de Custom Webhook y guardar la credencial del proyecto como una clave privada de GHL. Si el editor admite headers directamente, añadir `Authorization` con valor `Bearer ` seguido de la credencial; debe existir un único header Authorization. Mantener método POST, URL y mapeo actual del cuerpo. Guardar/publicar los cambios del workflow. La documentación oficial permite Bearer y headers personalizados; no se ha comprobado qué modalidad tiene activada esta cuenta. Si la acción actual no ofrece estos campos, no comprar/activar otro producto ni reemplazar la acción a ciegas: informar de la limitación y mantener pendiente la activación.
6. **Revisar el stock de vendedor.** Si `/reservar-boleta` se usa para números asignados a vendedores, el workflow debe enviar `vendedor_id` o `vendedor_user_id` con el ID estable del vendedor. La página `/p/[token]` ya envía `vendedor_id` al formulario; confirmar que GHL lo almacena y lo reenvía. No inferir identidad por el nombre. Si falta el ID, comunicarlo antes de publicar el guard de reserva. El scope de Oficina exige boletas sin vendedor asignado y `vendedor_nombre=Oficina`; el scope de vendedor exigirá coincidencia del ID y la empresa. No cambiar datos reales para ensayar esta comprobación.
7. **Confirmar por chat.** Indicar que la variable de Production está guardada, que todas las acciones de esas dos rutas envían Bearer y si hay reservas de vendedor con su ID. No enviar la clave ni capturas con su valor. Si no existen workflows que llamen a estas rutas, confirmarlo explícitamente: la protección puede activarse para sesiones del panel sin crear una integración artificial.

**Pausa obligatoria:** esperar esa confirmación antes de conectar el guard a las rutas y publicar el cambio de contrato. La configuración manual puede añadirse antes: el código legado no consume el header y seguirá operando. El rechazo de anónimos sólo se declara efectivo después de activar el guard y verificar el nuevo deployment.

## Activación por el desarrollador después de confirmar

1. Reconciliar HEAD de main y esta memoria; no reutilizar un parche contra una base obsoleta.
2. Conectar `requireProjectWebhookAccess` al inicio de ambos POST, antes de leer el body/consultar boletas. Filtrar escrituras por ID de proyecto y empresa autorizados, ambos derivados en servidor. Si el body contiene otra `empresa_id`, rechazarlo.
3. Usar la validación común de número, estado y monto. Eliminar `received_payload`, `received_keys` y mensajes crudos de DB. Las respuestas privadas llevan `Cache-Control: no-store`. Registrar los cambios de contrato: los números mal formados no se truncan, estados desconocidos se rechazan y montos negativos/invalidos no se convierten en otro importe.
4. En reserva, mantener `estado=Disponible` y el predicado que excluye nombre/teléfono/abono en el UPDATE; limitarlo al pool Oficina o al stock del vendedor comprobado. No usar `vendedor_nombre` recibido como identidad/permiso. Validar la compatibilidad de la integración que informa pagos: una reserva temporal confirmada ya no está Disponible y no debe tratarse como otra reserva directa.
5. Probar handlers completos con fixtures: anónimo, proyecto/empresa ajenos, rol vendedor sin facultad, credencial revocada, monto inválido, stock ocupado, seller scope y requests legítimos. El harness usa el SDK Supabase con transporte simulado; no certifica SQL real, RLS ni concurrencia.
6. Publicar por main, comprobar build de Production y registrar SHAs/deployment. Verificar en producción rechazos sin credencial y una llamada legítima en un proyecto/boleta de prueba controlados; no efectuar PoCs de escritura sobre compradores reales.
7. Cerrar P01-01/02 sólo tras verificar el contrato activo. Continuar P01-03 con `oportunidades-ghl` y su autenticación/idempotencia; ni esa ruta ni `/api/ghl-reserva` se corrigen por la mera existencia de este guard.

## Rotación y fallos

- Una credencial borrada o reemplazada en `PULSE_PROJECT_WEBHOOK_KEYS` se revoca al desplegar la nueva configuración; cambiar la variable no modifica deployments ya existentes. Preparar la nueva credencial en GHL y desplegar de forma coordinada. No prometer revocación instantánea ni mantener un bypass anónimo.
- 401: falta/valor/formato de credencial inválido o proyecto sin credencial configurada. No compartir secretos al investigar.
- 403: sesión sin rol/empresa autorizados, origen de navegador ajeno o discrepancia del tenant del payload cuando se active esa comprobación.
- 503: JSON de configuración inválido, credenciales repetidas/débiles o fallo al verificar el proyecto. El guard falla cerrado y no imprime valores.
- No revertir la autorización a anónima como reparación rutinaria de un workflow. Mantener la protección y corregir su credencial/configuración.

## Fuentes oficiales consultadas el 2026-10-02

- [HighLevel: Custom Webhook, autenticación y headers](https://help.gohighlevel.com/support/solutions/articles/155000003305/).
- [HighLevel: almacenamiento de claves privadas en Custom Webhook](https://help.gohighlevel.com/support/solutions/articles/155000005047-custom-webhook-action-secure-credential-management).
- Guías instaladas de Next.js 16.2.4: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y referencia `route.md`. Se mantiene `params` asíncrono y APIs Request/Response.
