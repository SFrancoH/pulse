# Activación controlada de reservas PULSE — actualización 2026-10-14

**Estado:** código V2 integrado en `main` mediante PR #37 y #38; **activación y funcionamiento real no verificados**. La compilación Vercel del commit `74ef22b66207ef9386a127c38ad5891e707bb98b` reportó `success`, sin acreditar por ello la ruta productiva ni el flujo de negocio.

### Evidencia y estado de preparación

| Elemento | Estado al 2026-10-14 |
| --- | --- |
| Código reservas V2, permisos, webhook y alertas | Fusionado en `main`, flag de activación separado |
| Modelo por empresa | `public.empresas.webhook_reservas_url_cifrada` y `responsable_reservas_publicas_user_id`; no crear tabla extra |
| Esquema de empresas ampliado por el usuario | `modulos_activos text[]` y `tipo_empresa text` con CHECK de productos, preservando `apps_script_url`; no se creó lógica de autorizaciones de módulos |
| Preflight y migración Supabase | **Usuario reporta** SQL ejecutado y 6/6 verificaciones de presencia `true`; sin prueba independiente del comportamiento de la RPC en su proyecto |
| Secretos Vercel `PULSE_WEBHOOK_ENCRYPTION_KEY`, `PULSE_CALLBACK_SECRET` | **Usuario confirma** guardados; no son visibles/validados desde GitHub |
| Webhook GHL, mapeo y workflow | **Usuario confirma** configuración completa; no se han comprobado entregas ni callbacks individuales reales |
| `PULSE_RESERVAS_V2=enabled` | No existe evidencia de que esté activado. **No activarlo aún.** |
| Pruebas E2E con reservas controladas | **Pendientes** |
| Estado de despliegue productivo | Vercel reportó build exitoso del merge #38; falta verificar dominio y flag del entorno Production |

No almacenar URLs de webhooks, tokens, secretos o datos de compradores en el repositorio ni en capturas compartidas.

> **Advertencia:** El flag V2 es global al despliegue, no por empresa. Activarlo en Production puede modificar simultáneamente todas las páginas de reserva de Oficina. Hacerlo únicamente tras confirmar integración y con ventana de prueba supervisada, con rollback disponible.

## Dependencias obligatorias

1. Hacer respaldo de Supabase y consultar el DDL real de `admin_users` (tipo/constraint de `role`), `empresas`, `boletas` y la función `eliminar_proyecto_pulse`. El repositorio carece del DDL completo de usuarios; **no es seguro ejecutar la migración sin esa revisión**.
2. El SQL incorpora `pulse_eliminar_proyecto_con_reservas` para eliminar incidencias/eventos dentro de la misma transacción que `eliminar_proyecto_pulse`. Verificar que ambas RPC sean compatibles con la base real antes de activar V2.
3. Ejecutar **primero** el diagnóstico de lectura `supabase/production/20261013_00_reservas_preflight.sql`; con su resultado verificar columnas, constraints y roles. Aplicar después `supabase/production/20261013_01_reservas_webhook_alertas.sql` sobre la base actual. El script prepara tablas/funciones y no envía webhooks; no modifica automáticamente las constraints del rol de usuario.
4. Configurar en Vercel **Production** `PULSE_WEBHOOK_ENCRYPTION_KEY` (32 bytes en base64, valor secreto) y `PULSE_CALLBACK_SECRET` (valor aleatorio único). No usar `NEXT_PUBLIC_`; no copiar los valores a GitHub.
5. En la configuración privada de cada empresa guardar su URL HTTPS en la página de integración; configurar quién es el `empresa_admin` responsable de reservas públicas.
6. Modificar el workflow receptor: un evento por reserva con pares `consecutivo_i` y `comprobante_url_i`; una oportunidad por boleta; enviar confirmación autenticada **por número** con `reserva_grupo`, empresa, proyecto y número a `POST /api/integraciones/oportunidades/confirmar`, con secreto Bearer. Una recepción HTTP 2xx sin confirmación no significa oportunidad creada.
7. Validar extremo a extremo con empresa/proyecto descartables sin compradores reales: una reserva de 3 números produce un único POST y tres oportunidades; error en 1 genera solo 1 alerta; confirmación manual no reintenta.
8. Probar que super_admin/empresa_admin/oficina_admin/vendedor acceden solo a sus operaciones; comprobar rol `oficina_admin` según DDL real antes de crearlo.
9. Una vez que `main` incorpore la rama, verificar el build Production conservando **apagado** `PULSE_RESERVAS_V2` (no definirla o poner otro valor). Las páginas de venta, callbacks, creación de proyectos y formulario anteriores se conservan mientras no se habilite la nueva función. **Solo después** de verificar pasos 1–8, configurar `PULSE_RESERVAS_V2=enabled` en Production, publicar y validar con reservas de prueba.

## Rollback

Conservar la información de reservas y alertas. Si es preciso detener V2, retirar `PULSE_RESERVAS_V2=enabled` y publicar el despliegue anterior/compatible; no eliminar tablas ni `comprobante_url` automáticamente. Una reserva ya confirmada nunca se vuelve a ejecutar por rollback.

## Riesgos conocidos

- Envío a lo sumo una vez: una falla/timeout de red puede haber sido recibida; hay que verificar manualmente antes de crear la oportunidad para evitar duplicados.
- Falta el inventario real de constraints/roles de Supabase, lo que impide certificar el SQL en producción desde GitHub.
- La función de borrado de proyecto anterior debe reconciliarse con las nuevas entidades antes del despliegue.
- Los enlaces de boleta muestran datos del titular en la vista pública; minimizar teléfono antes de publicar masivamente.

La migración incorpora la RPC `pulse_eliminar_proyecto_con_reservas` para eliminar eventos/alertas dentro de la misma transacción de `eliminar_proyecto_pulse`. Validar ambas antes de desplegar. El nuevo endpoint de borrado requiere la función envolvente.

## Configuración consolidada en `public.empresas`

La integración utiliza las columnas `webhook_reservas_url_cifrada` (TEXT, URL privada cifrada) y `responsable_reservas_publicas_user_id` (UUID, administrador principal) dentro de `public.empresas`. **No** se crea `pulse_empresa_integraciones`. La tabla de empresas conserva `apps_script_url` intacta. Este cambio debe instalarse antes de activar V2 y su acceso debe seguir siendo exclusivamente por el backend autorizado; no exponer estas columnas en rutas públicas.


## Plan de pruebas extremo a extremo (sin compradores reales)

**Preparación y condiciones para la prueba:** confirmar el despliegue Production que sirve el dominio real, que `PULSE_RESERVAS_V2` está deshabilitado hasta la ventana acordada, y que el webhook cifrado y el responsable público corresponden a la empresa de prueba. Confirmar que la configuración de GHL incluye el callback autenticado individual a `POST /api/integraciones/oportunidades/confirmar` y que puede localizar una oportunidad existente para evitar duplicados. No publicar secretos ni direcciones privadas en evidencias.

1. **Regresión con flag apagado:** comprobar que compra pública Oficina, administración y ventas por vendedor conservan el formulario/flujo anterior. No generar reservas reales por esta prueba.
2. **Activación temporal supervisada:** configurar `PULSE_RESERVAS_V2=enabled` **solo con autorización explícita** y nuevo despliegue Production, preferiblemente en ventana sin tráfico activo. La activación afecta globalmente a las empresas.
3. **Reserva Oficina de tres números ficticios:** verificar en `boletas` estado `Debe`, `reserva_grupo` común, tres `comprobante_url` auténticas; un único registro en `pulse_eventos_reserva` y como máximo un POST al receptor. En GHL: un contacto y **tres oportunidades únicas** asociadas, una por número. Verificar tres callbacks de `estado=creada`, `boletas.oportunidad_creada=true` y tres alertas `confirmada_automatica`.
4. **Reserva pública de Oficina:** confirmar que la alerta, si falta una oportunidad, solo se asigna al `empresa_admin` designado en `empresas.responsable_reservas_publicas_user_id`.
5. **Fallos parciales:** en escenario descartable, simular una oportunidad sin crear, revisar que solo esa boleta genere `pendiente`; las demás permanecen confirmadas. No reintentar el webhook; comprobar manualmente la existencia antes de crearla y usar **Marcar como creada**.
6. **Vendedor con inventario asignado:** verificar que su reserva no crea `pulse_eventos_reserva`, no envía webhook y no genera alertas de oportunidades, pero sí conserva el comprobante.
7. **Idempotencia y permisos:** confirmar que doble clic/recarga no duplican eventos ni oportunidades; que `super_admin`, `empresa_admin`, `oficina_admin` y `vendedor` no ven información fuera de su acceso; nunca probar borrado sobre proyectos reales.
8. **Cierre:** recoger IDs de eventos ficticios, estados y resultado (sin secretos ni PII), verificar Vercel Production en dominio y registrar resultado en `docs/PLAN_DESARROLLO_PULSE.md`. Si alguna prueba falla, retirar `PULSE_RESERVAS_V2=enabled` y redeplegar; mantener intactas tablas y reservas.

**Contrato exacto de callback individual, autenticado con `Authorization: Bearer <PULSE_CALLBACK_SECRET>`:** `empresa_id`, `proyecto_id`, `reserva_grupo`, `numero` (cuatro dígitos, conservar ceros iniciales), `estado` (`creada` o `fallida`). Este endpoint no deduce una oportunidad creada de un HTTP 2xx del Inbound Webhook. No marcar `creada` antes de comprobarla en GHL.
