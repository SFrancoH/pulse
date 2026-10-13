# PULSE — Plan aprobado para reservas, webhooks, alertas individuales y boleta virtual

> **Estado:** especificación documentada; **NO IMPLEMENTADA**. Fecha: 2026-10-13 (America/Bogota).
>
> **Alcance de este commit:** únicamente archivos Markdown. No modificar aplicación, esquemas/datos de Supabase, variables Vercel, credenciales, configuración externa ni workflows hasta iniciar otra unidad de implementación.
>
> **Prioridad contractual:** esta decisión nueva del usuario sustituye, **para la futura implementación aquí descrita**, la elección anterior de formularios de compra. El sistema desplegado continúa operando con el contrato anterior hasta que haya migración, pruebas y activación verificadas. Los cambios se desarrollarán por unidades comprobables y nunca con una sustitución parcial que rompa ventas.
>
> **Higiene:** no incluir URLs privadas de webhooks, tokens, secretos ni datos reales de compradores en documentación, commits, tests, logs o respuestas públicas.

## 1. Resultado de negocio y reglas innegociables

1. El comprador o asesor selecciona de 1 a 10 números, diligencia nombre, teléfono y ciudad, retiene durante 60 segundos y confirma; Supabase es la fuente de verdad de disponibilidad/estado.
2. Se elimina el segundo formulario embebido en las experiencias activas de venta; la confirmación ocurre dentro de PULSE.
3. **Reserva de Oficina manual y página pública de Oficina:** emitir **un solo POST saliente por grupo de reserva confirmado** hacia el webhook privado de la empresa. Ni reintentos automáticos, ni botones para reintentar, ni envíos repetidos tras refrescar o doble clic.
4. **Venta de números asignados a vendedor (enlace `/p/[token]`):** interactúa solo con Supabase; por ahora **no** ejecuta webhook saliente y **no** genera alertas de creación de oportunidades. Sí muestra enlaces de boletas virtuales.
5. **Una oportunidad por cada número reservado.** Una sola solicitud de integración puede transportar de 1 a 10 pares número/URL, pero el proceso remoto debe crear/confirmar cada oportunidad individualmente, sin duplicados.
6. Si una oportunidad no se confirma, mantener la boleta en `Debe` y abrir **una alerta por boleta pendiente**; nunca deshacer reservas por fallo de integración.
7. No anunciar como “creada” una oportunidad porque el endpoint de destino contestó HTTP 2xx: eso demuestra recepción, no procesamiento. Marcar como creada solo tras confirmación verificable del workflow o confirmación manual del responsable.
8. Las alertas de creación manual son **privadas por usuario responsable**, no globales para todos los administradores. Las reservas de visitantes no autenticados se asignan al `empresa_admin` principal de su empresa.
9. Al confirmar una reserva, mostrar para cada boleta los botones **Ver boleta** y **Copiar boleta virtual**, usando exclusivamente `boletas.comprobante_url` ya almacenada.
10. La interfaz final **no debe mencionar marcas/plataformas técnicas externas** en botones, mensajes, popups, alertas ni guías. Los nombres técnicos se permiten solo en código, documentación interna y configuración restringida.
11. Mantener separada la alerta actual de **nueva reserva/cambio de disponibilidad**: no es una incidencia de integración y puede seguir protegiendo la página administrativa.

## 2. Inventario verificado en el repositorio antes de implementar

| Situación actual en `main` | Fuente |
| --- | --- |
| Vista administrativa usa `ProyectoVentaReservaClient` y origen `Creacion Manual` | `app/admin/proyectos/[proyectoId]/ventas/page.tsx` |
| Vista pública Oficina usa el mismo componente y origen `Oficina` | `app/o/[token]/page.tsx` |
| Vista de vendedor con números asignados usa el mismo componente, origen `Vendedores` | `app/p/[token]/page.tsx` |
| El componente solicita datos, hace `hold` por 60 s, `confirm` y abre iframe del formulario | `components/ProyectoVentaReservaClient.tsx` |
| Confirmación individual por número: pasa `No disponible` → `Debe`; devuelve únicamente números, no URLs | `lib/temporary-reservations.ts` |
| Admin y Oficina usan seguimiento de oportunidades; vendedores no lo usan | Rutas `reserva-temporal` respectivas |
| Seguimiento actual guarda `oportunidad_creada`, `reserva_grupo`, `oportunidad_error_at` en `boletas` | `lib/temporary-reservations.ts` y fixture de esquema |
| Alertas actuales son por grupo, sin propietario; demora de una hora y consulta cada cinco minutos | `app/api/admin/proyectos/[proyectoId]/oportunidades-pendientes/route.ts`; `components/OpportunityErrorRecovery.tsx` |
| El botón de recuperación abre un formulario de URL fija dentro del frontend | `components/OpportunityErrorRecovery.tsx` |
| Roles actuales: `super_admin`, `empresa_admin`, `vendedor`; `oficina_admin` aún no existe | `lib/auth-token.ts`, `lib/require-admin.ts`, `lib/admin-auth.ts` |
| Enlaces de comprobante ya se guardan al crear cada boleta, usando su UUID | `app/api/crear-proyecto/route.ts` |
| La boleta pública se consulta por IDs de empresa/proyecto/boleta, no por consecutivo | `app/api/public/boleta/route.ts` |
| `formulario_compra_url` se almacena a nivel **proyecto** y llega al cliente | `app/api/crear-proyecto/route.ts` y vistas de venta |
| Los endpoints existentes `reservar-boleta` y `actualizar-boleta` reciben información entrante desde automatizaciones y son distintos del nuevo POST saliente | `app/api/proyectos/[proyectoId]/*` |
| Parte del funcionamiento de confirmación de oportunidades entrantes está en `/api/proyectos/[proyectoId]/oportunidades-ghl` | Handler existente; requiere endurecimiento de autenticación y correlación |

**Consecuencia:** cambiar solo la URL del formulario no sirve: se filtraría al navegador, faltaría la automatización del POST server-to-server y el seguimiento carecería de destinatario individual.

## 3. Flujos objetivo por actor

### 3.1 Administrador de Oficina autenticado

1. Cargar únicamente inventario de Oficina: `vendedor_nombre = Oficina` y `vendedor_user_id IS NULL`, con estado verdaderamente disponible.
2. Seleccionar 1–10 boletas e introducir nombre, teléfono y ciudad; validar desde servidor.
3. `hold` mantiene el bloqueo temporal 60 segundos; `cancel` o caducidad devuelve los números según reglas actuales.
4. `confirm` valida el `hold_token` y estado; guarda datos del comprador, canal `Creacion Manual` y **`creado_por_user_id` derivado de sesión validada**.
5. Confirmar en DB y generar un evento de salida por reserva con identificador único y lista definitiva de boletas. Obtener cada `comprobante_url` del mismo registro confirmado.
6. Mostrar popup exitoso inmediatamente con boletas confirmadas y sus URLs, sin iframe.
7. Despachar **una sola vez** el webhook privado de la empresa. No bloquear ni revertir la reserva si entrega/procesamiento fallan.
8. Si hay boletas sin oportunidad confirmada, crear una alerta **por número** con `responsable_user_id = creado_por_user_id`; solo su sesión puede ver y marcar como creada sus alertas.

### 3.2 Visitante de página pública Oficina

Mismos pasos de reserva y URLs. No existe un usuario que inicie la reserva: `creado_por_user_id = NULL`, `canal = Oficina`. El webhook se envía una sola vez con datos de las boletas confirmadas. Las alertas pendientes se asignan al `empresa_admin` responsable de ventas públicas de **esa empresa**, definido en configuración.

### 3.3 Vendedor con números asignados (enlace público `/p/[token]`)

Mismos datos, retención, validación de pertenencia y estado `Debe`, manteniendo `vendedor_user_id` de la asignación; popup y comprobantes por boleta. **No generar evento de integración, no llamar webhook y no generar oportunidades ni alertas de oportunidades.** Conservar sincronización interna que corresponda; no extender disponibilidad a números ajenos.

### 3.4 Reglas de reserva multiboleta

- Confirmar solo el conjunto efectivamente reservado, nunca números rechazados/expirados.
- Cada número tiene un `id`, `numero` y `comprobante_url` propio.
- Envío externo: **una ejecución por reserva**, aun si contiene 10 boletas.
- Creación/confirmación remota: **una oportunidad por boleta**; soportar resultado parcial (p. ej., 2 de 3 confirmadas = una alerta pendiente), mediante correlación por `reserva_grupo` + `boleta_id`/`numero`.
- Evitar nuevas confirmaciones y nuevos webhooks por doble clic, reenvío HTTP, recarga o carrera entre pestañas.
- La interfaz nunca debe declarar éxito de una boleta que el servidor no confirmó.

## 4. Contrato privado de envío (solo Oficina)

### 4.1 Configuración por empresa

- Registrar el webhook privado en **Crear empresa** y permitir cambio posterior exclusivamente a perfiles administrativos autorizados (preferiblemente solo `super_admin`).
- Persistir URL cifrada en `empresas.webhook_reservas_url_cifrada`; la clave de cifrado será un secreto **server-only** en Vercel (p. ej. `PULSE_WEBHOOK_ENCRYPTION_KEY`, sin prefijo `NEXT_PUBLIC_`).
- No almacenar la URL confidencial en `formulario_compra_url`, ni incorporarla a SSR props, HTML, JS cliente, respuestas API, logs, documentación o URLs de navegación.
- Mostrar solo “Integración configurada/no configurada” y fecha de actualización; controlar modificación, revocación y acceso.
- Validar esquema `https`, host autorizado, redirects y salida de red para evitar SSRF; permitir rotación sin crear un deployment por cada empresa.
- Empresa sin integración: jamás inventar URL, jamás perder reserva; marcar evento como **no entregado/configuración pendiente** y crear alertas individuales destinadas al responsable público/autor manual según corresponda.

### 4.2 Payload por grupo de reserva

Ejemplo ficticio, sin webhooks ni datos reales:

```json
{
  "evento": "reserva_confirmada",
  "evento_id": "uuid-evento",
  "reserva_grupo": "uuid-grupo",
  "empresa_id": "empresa-demo",
  "proyecto_id": "proyecto-demo",
  "nombre_proyecto": "Sorteo de prueba",
  "first_name": "Cliente Demo",
  "phone": "+573001234567",
  "city": "Bogota",
  "canal": "Creacion Manual",
  "responsable_user_id": "uuid-asesor",
  "consecutivo_1": "0045",
  "comprobante_url_1": "https://ejemplo.invalid/boleta/0045",
  "consecutivo_2": "1250",
  "comprobante_url_2": "https://ejemplo.invalid/boleta/1250",
  "cantidad_boletas": 2,
  "valor_a_pagar": 120000
}
```

Reglas:
- Nombres de los pares: `consecutivo_1`…`consecutivo_10` y `comprobante_url_1`…`comprobante_url_10`. Cada URL se obtiene de `boletas.comprobante_url` del número correspondiente, no se construye a partir del consecutivo.
- Completar vacíos/omitir hasta 10 según contrato del workflow receptor validado durante implementación; no inventar números.
- El `valor_a_pagar` debe corresponder al precio vigente de las boletas confirmadas; capturar valor de reserva para evitar discrepancias por futuros cambios de precio.
- Incluir teléfono normalizado, nombre, ciudad, empresa, proyecto, origen, identificador de grupo/evento y usuario responsable cuando exista; campos opcionales (correo, fecha) solo si están registrados.
- **No** enviar identificador de vendedor asignado desde la ruta `/p/[token]`, porque esa ruta no emite webhook.
- El workflow receptor debe localizar/crear contacto, crear **una oportunidad por número** e informar a PULSE el estado por boleta. Este procesamiento externo **no se modifica durante la etapa de documentación**.

### 4.3 Entrega exactamente una vez a nivel de intento

- Requisito operativo: **como máximo una solicitud de envío por evento de reserva** desde PULSE. No programar retries, cron de reenvío, botones “Reintentar”, reintentos silenciosos de librerías ni reentrega por recarga.
- Persistir identificador único del evento, estado `pendiente_envio / intento_iniciado / recibido / entrega_fallida / resultado_desconocido`, marca temporal y metadatos mínimos sin exponer URL secreta.
- Registrar la reclamación del intento **antes** del POST y protegerla con unicidad/transición atómica; un worker no puede repetirlo al reiniciar. Si proceso/timeout cae después de empezar envío, registrar estado incierto y derivar a verificación manual, nunca reemitir.
- Diferenciar **envío recibido** (HTTP satisfactorio) de **oportunidad creada** (acuse por número). Un resultado desconocido no autoriza otro envío.
- Cualquier fallback manual es únicamente **crear oportunidad en Contactos y marcar alerta**, no volver a activar la integración.

## 5. Confirmación de oportunidades, errores y alertas

### 5.1 Identidad y cardinalidad

- **Una alerta por boleta sin oportunidad confirmada**. Ejemplo: tres fallos de tres números = tres alertas; tres números del mismo grupo sin confirmar = tres alertas; fallos técnicos repetidos del **mismo número/reserva** no crean alertas duplicadas.
- Clave única de incidencia: `empresa_id + proyecto_id + reserva_grupo + boleta_id` (o clave equivalente garantizada por DB).
- Si llegan confirmaciones parciales, cerrar solo los números confirmados.
- Conservación de histórico: `pendiente`, `creada_manual`, `confirmada_automatica`, motivo y marcas temporales. Nunca eliminar registro de auditoría por cerrar alerta.
- Verificar autenticidad, tenant, proyecto, evento, número/boleta y resultado en webhook entrante de confirmación; prohibido confiar en el nombre del cliente para determinar a qué reserva pertenece.
- Si no hay confirmación de procesamiento, aplicar umbral configurable de detección (legacy: 60 minutos) antes de declarar alerta por **falta de confirmación**, no por fallo probado. El polling solo consulta BD y **no reenvía** solicitudes.

### 5.2 Reglas de propiedad/visibilidad

| Origen | Integración saliente | Responsable de alerta | Quién puede resolver |
| --- | --- | --- | --- |
| Oficina, administrador autenticado | Sí, una vez por reserva | Su `user_id` de sesión | Ese usuario |
| Oficina, `empresa_admin` vendiendo desde sesión | Sí, una vez por reserva | Ese mismo `empresa_admin` | Ese usuario |
| Oficina, visitante público `/o/[token]` | Sí, una vez por reserva | `empresa_admin` designado para reservas públicas de la empresa | Ese usuario |
| Vendedor asignado `/p/[token]` | No | No aplica | No aplica |

- No mostrar todas las incidencias a todos los administradores ni a usuarios de otra empresa/proyecto.
- Para diferenciar empleados que venden stock de Oficina de los vendedores con boletas asignadas, **propuesta de nuevo rol `oficina_admin`**. Incorporar a los guards, sesión firmada, creación de usuarios, navegación y permisos. Revisar restricciones reales de `admin_users.role` antes de migrar; **no cambiar roles existentes ni reclasificar usuarios automáticamente**.
- `empresa_admin` permanece responsable principal por empresa; agregar `responsable_reservas_publicas_user_id` en configuración de empresa (debe referirse a un `empresa_admin` activo de la misma empresa).
- Si hay exactamente uno y se declara explícitamente como responsable, usarlo. Si falta o hay ambigüedad, dejar la incidencia en cola interna de **asignación pendiente** para gestión restringida del `super_admin`; no filtrarla a todos ni dejarla invisible. La reserva no se revierte.
- Filtrar por `responsable_user_id = session.user_id` y `empresa_id = session.empresa_id` **en la API**; la UI sola no representa autorización.
- Endpoint de marcar creada: mismo origen cuando proceda, sesión y usuario/tenant validado, operación individual idempotente; registrar `resuelto_por_user_id`, `resuelto_at`. No dispara webhook, no cambia `boletas.estado`.
- `super_admin` global puede acceder a una vista de soporte/auditoría específica por autorización expresa; no mostrarle indistintamente los popups de venta de otros usuarios.

### 5.3 Texto visible EXACTO de la alerta

**Título:** Oportunidad pendiente de creación

**Descripción:** La reserva se registró correctamente en la web, pero no se ha creado la oportunidad.

**Acción requerida:** Busca al usuario En contactos y crea la oportunidad de forma manual, recuerda que es una oportunidad por numero reservado

**Pasos operativos visibles:**
1. Ve a **Contactos**.
2. Busca el contacto por teléfono o por los datos de la reserva; comprueba si la oportunidad de **ese número** ya existe.
3. Si no existe, crea manualmente la oportunidad del número indicado.
4. Regresa a **PULSE** y selecciona **Marcar como creada**.

**Datos disponibles en cada alerta:** nombre, teléfono, ciudad, correo si existe, empresa, proyecto, número individual, precio/valor correspondiente, canal, asesor responsable, fecha, ID/referencia de reserva y **URL de boleta virtual** (con Ver/Copiar cuando exista). No mezclar una alerta con todos los números: se entrega ficha por número.

**Estado/acciones:** `Pendiente` → `Creada`; `Copiar datos`, `Ver boleta`, `Copiar boleta virtual`, `Marcar como creada`. El aviso persiste al cerrar la ventana o recargar; cuando el servidor confirme su cierre desaparece del contador activo. No afirmar éxito antes de ese acuse.

## 6. Popup de reserva exitosa

**Título sugerido:** ¡Reserva realizada correctamente!

**Descripción:** La reserva se registró correctamente y los datos del cliente quedaron guardados.

- Mostrar nombre del cliente y lista de números **confirmados**; estado de cada uno = `Debe`.
- Por cada número: `Boleta N.º XXXX`, botón **Ver boleta** (abre en pestaña nueva) y botón **Copiar boleta virtual** (copia únicamente la URL almacenada).
- Si son 1–10 números, mostrar 1–10 tarjetas/botones independientes; no confundir URL de grupo con URL individual.
- Si falta `comprobante_url`, conservar el éxito de reserva, deshabilitar acciones de esa boleta y mostrar “Enlace de boleta no disponible”; registrar incidencia técnica sin inventar URL.
- No mostrar nombres de proveedores, ni estados técnicos del webhook en el popup; la gestión de oportunidades ocurre en alertas del responsable.
- En el regreso del endpoint `confirm`, devolver lista estructurada de `{boleta_id, numero, comprobante_url}`. El backend debe leer el campo de las filas efectivamente confirmadas, nunca aceptar URL enviada por navegador.
- Las tarjetas funcionan tanto para administradores como para Oficina pública y vendedores asignados. Revisar exposición de datos personales en la página virtual: actualmente muestra teléfono completo; plantear enmascararlo antes de difusión masiva.

## 7. Modelo de datos previsto (**diseño, NO SQL aplicado**)

| Entidad | Campos/constraints deseados |
| --- | --- |
| `empresas_integraciones` (nueva o equivalente) | `empresa_id` único; `webhook_reservas_url_cifrada`; estado; configuración/rotación; auditoría de configuración; sin lecturas públicas |
| `empresas` / configuración de empresa | `responsable_reservas_publicas_user_id` validado contra `admin_users` activo/`empresa_admin` de misma empresa |
| `boletas` / reserva | Agregar registro autor de reserva de Oficina `creado_por_user_id`; preservar `vendedor_user_id` como dueño de stock, **no** usarlo para atribuir reserva de Oficina; conservar `comprobante_url` y `reserva_grupo` |
| `reserva_eventos_integracion` | `evento_id` único, `empresa_id`, `proyecto_id`, `reserva_grupo` único por intento, estado/fecha de único intento, resultado de recepción y correlación |
| `alertas_oportunidades` | `id`, `empresa_id`, `proyecto_id`, `reserva_grupo`, `boleta_id`, `responsable_user_id`, `estado`, `motivo`, `created_at`, `resuelto_at`, `resuelto_por_user_id`; índice único por oportunidad del número/reserva |
| `admin_users` / autorización | Evaluar soporte para `oficina_admin` en CHECK/enum y acceso por proyecto/empresa; mantener `super_admin` global, `empresa_admin` de compañía y `vendedor` asignado |

**Criterios antes de generar SQL:** consultar DDL real de producción (roles, tablas, índices, FK, RLS, triggers y `boletas`); preparar migración idempotente con preflight, instalación, validación y reversión. El fixture `tests/fixtures/project-deletion-schema.sql` **no** acredita por sí solo el esquema real. Revisar impacto de tablas nuevas en `eliminar_proyecto_pulse`: un proyecto eliminado debe manejar/historizar con seguridad eventos/alertas asociados, sin romper FK ni exponer datos de otros proyectos.

**Atomicidad:** las reservas multiboleta y registro de evento deben quedar consistentes: no confirmar algunos números, crear múltiples envíos o perder trazabilidad ante excepción. Especificar la operación transaccional/RPC tras contrastar el esquema real; no afirmar que el loop actual cumple atomicidad.

## 8. Inventario de archivos a modificar en etapas FUTURAS

| Grupo | Archivos y alcance |
| --- | --- |
| Contrato, memoria | `docs/PLAN_RESERVAS_WEBHOOK_ALERTAS.md`, `docs/PLAN_DESARROLLO_PULSE.md` y `AGENTS.md` (este paso documental) |
| SQL / test de migración | Nueva migración `supabase/production/AAAA..._reservas_integracion_alertas.sql`, preflight y pruebas aisladas; revisar `eliminar_proyecto_pulse` |
| Integración segura | Nuevo helper servidor `lib/reservation-webhook.ts` (nombre orientativo), almacenamiento/cifrado, evento de entrega única, callback de oportunidad por número |
| Confirmación reserva | `lib/temporary-reservations.ts`, `app/api/admin/proyectos/[proyectoId]/reserva-temporal/route.ts`, `app/api/public/project-sales/[token]/reserva-temporal/route.ts`, `app/api/public/sales-links/[token]/reserva-temporal/route.ts` |
| Interfaz de ventas | `components/ProyectoVentaReservaClient.tsx`, `app/admin/proyectos/[proyectoId]/ventas/page.tsx`, `app/o/[token]/page.tsx`, `app/p/[token]/page.tsx`, `lib/project-sales-links.ts` |
| Empresa / proyectos | `app/admin/crear-empresa/page.tsx`, `app/api/crear-empresa/route.ts`; API administrativa de integración; `app/admin/crear-proyecto/page.tsx`, `app/admin/page.tsx`, `app/api/crear-proyecto/route.ts` |
| Autorización / usuarios | `lib/auth-token.ts`, `lib/admin-auth.ts`, `lib/require-admin.ts`, `app/api/admin/crear-usuario/route.ts`, controles de menú, acceso para `oficina_admin` y configuración de responsable público |
| Alertas / resolución | `components/OpportunityErrorRecovery.tsx`, `app/api/admin/proyectos/[proyectoId]/oportunidades-pendientes/route.ts`, nuevo POST para `Marcar como creada`, endpoint/callback de confirmación |
| Entradas existentes | `app/api/proyectos/[proyectoId]/oportunidades-ghl/route.ts`; preservar/analizar por separado `reservar-boleta`, `actualizar-boleta` y `api/ghl-reserva` usados desde flujos distintos, sin romperlos |
| Consulta de boleta | `app/api/public/boleta/route.ts`, `app/boleta/BoletaClient.tsx` para privacidad; revisar configuración de base URL multiempresa |
| Código legacy | `components/ProyectoVentaClient.tsx` contiene iframe/formulario; confirmar usos reales y retirar/adaptar sin dejar rutas vivas obsoletas |
| Pruebas | Casos unitarios/integración de reservas/roles/alertas/salida 1×/URLs/PDF-no aplica; pruebas E2E controladas en entorno autorizado |

## 9. Plan de ejecución posterior, por unidades

| Etapa | Entrega verificable | Estado |
| --- | --- | --- |
| D00 | Especificación y memoria Markdown acordadas | **Esta unidad: documentación** |
| D01 | Inventario SQL/usuarios/workflows externos; confirmar rol de Oficina y responsable público; contrato de confirmación por boleta | Pendiente |
| D02 | Migración DB con preflight/rollback, roles/permisos y tests | Pendiente |
| D03 | Servicio privado/configuración por empresa, evento de un solo intento, callback seguro e idempotencia | Pendiente |
| D04 | Reservas de Oficina/admin; popup de éxito y URLs; vendedores sin webhook | Pendiente |
| D05 | Alertas individuales, propietarios, visibilidad y cierre manual | Pendiente |
| D06 | Retirada del formulario de compra de todas las interfaces/creación de proyecto y limpieza legacy | Pendiente |
| D07 | Validación de escenarios, configuración externa, despliegue Production y verificación real; monitoreo y rollback | Pendiente |

**No ejecutar fases D01–D07 dentro del trabajo exclusivamente documental.** Antes de cada etapa, refrescar rama, DDL y configuración real; elaborar pruebas y actualizar memoria. El corte del formulario se realiza solo cuando envío/control manual, pantalla nueva y retorno de confirmación estén preparados. Despliegue según plan vigente (sin exigir Preview ni Supabase alternativo).

## 10. Criterios de aceptación obligatorios

- [ ] Administrador de Oficina A falla una boleta: solo A tiene una alerta; B/C/D no la ven ni acceden por API.
- [ ] Tres boletas sin oportunidad: tres alertas independientes; al cerrar una quedan dos.
- [ ] Una reserva de tres números dispara solo **un** POST externo; se pueden confirmar parcialmente las oportunidades por número.
- [ ] Múltiples eventos técnicos del mismo número/reserva no producen alertas duplicadas.
- [ ] Cliente de página pública genera alerta solo para el `empresa_admin` designado de su empresa; otras empresas no acceden.
- [ ] Vendedor asignado completa reserva, obtiene comprobante virtual y **no** llama webhook ni genera alertas.
- [ ] Popup muestra URL correcta del `comprobante_url` real de cada boleta confirmada, con **Ver boleta** y **Copiar boleta virtual**; maneja 1–10 números y URL ausente.
- [ ] Payload tiene pares correctos `consecutivo_i` / `comprobante_url_i` hasta 10; se comprueba que el destino procesa una oportunidad por número.
- [ ] Doble clic, refresh, crash y timeout no provocan segundo POST: pasar a verificación manual ante estado incierto.
- [ ] HTTP 2xx sin callback de procesamiento no marca como creada la oportunidad; alerta tras el período configurado.
- [ ] `Marcar como creada` solo por responsable autorizado, sin reenvío externo ni cambio de estado de boleta; deja historial.
- [ ] Ninguna URL privada de webhook o secreto llega a frontend, GitHub público, salida de API ni logs.
- [ ] Ningún texto de UI muestra el nombre de un proveedor técnico externo.
- [ ] La alerta de nueva reserva/actualización sigue funcionando.
- [ ] Los endpoints entrantes existentes, la sincronización de Google Sheets y las consultas por empresa/proyecto no tienen regresiones.
- [ ] Se prueban casos multiempresa, permisos por usuario, URLs incorrectas y responsabilidad pública no configurada.
- [ ] Evidencia de validación local, commit, build Production y verificación en sitio anotadas por separado en la memoria.

## 11. Riesgos y pendientes de validación antes de implementación

1. **Esquema real:** el rol `oficina_admin` no existe en la unión de tipos ni en flujo de creación; comprobar constraints de `admin_users.role`.
2. **Responsable público:** identificar exactamente qué `empresa_admin` activo recibirá las reservas anónimas; no inferir desde el primer usuario que devuelve una consulta.
3. **Callback individual:** confirmar que la automatización receptora entrega resultado confiable por cada número, no solo el grupo. El nombre de handler actual es legacy y no es prueba del contrato externo vigente.
4. **Costo/ejecuciones:** un único POST por reserva desde PULSE. La ejecución de pasos internos en el receptor para crear 1–10 oportunidades es externa; validar su configuración/coste antes de migrar, sin afirmar que 1 POST cuesta siempre una ejecución total.
5. **Entrega incierta:** no existe garantía universal de “exactamente una entrega” en red; se exige **a lo sumo un intento de PULSE** y recuperación manual ante ambigüedad.
6. **Privacidad:** los links de comprobante permiten abrir una vista pública con teléfono actual del titular. Evaluar enmascaramiento y controles antes de amplificar distribución.
7. **Multiempresa:** `PUBLIC_BOLETA_BASE_URL` actualmente tiene valor por defecto ligado a una empresa; asegurar URLs correctas para empresas nuevas sin reconstruir `comprobante_url` en reserva.
8. **Integridad y borrado:** los registros nuevos deben preservar políticas multiempresa y compatibilidad con eliminación de proyecto; auditar FK y triggers antes de D02.
9. **Despliegue seguro:** conservar operación previa hasta cambio coordinado; prever reversión sin pérdidas ni duplicados de oportunidades, y no ejecutar envíos reales de prueba a compradores.

## 12. Cierre de esta unidad

**Implementado en D00:** solo el diseño y su referencia en la memoria operativa, sin mutaciones de producto. La futura implementación requerirá cambiar código, base de datos y automatizaciones externas según D01–D07.

**Siguiente acción concreta:** iniciar D01 cuando se solicite: comprobar DDL actual, usuarios/roles, responsable `empresa_admin` por empresa y formato de callback por número; de ahí preparar cambios con pruebas sin romper venta actual.

### Decisión actualizada 2026-10-13 — configuración consolidada en empresas

Se reutiliza `public.empresas` y no se crea una cuarta entidad ni la antigua tabla propuesta `pulse_empresa_integraciones`. Se agregan `webhook_reservas_url_cifrada TEXT` y `responsable_reservas_publicas_user_id UUID`, manteniendo `apps_script_url` intacta. Este criterio sustituye la sugerencia inicial de una tabla separada; las consultas del servidor y la migración se adaptaron antes de instalarse en producción.
