<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pulse: plan de desarrollo y memoria operativa

## Consulta aleatoria y liberación de boletas GHL — contrato 2026-10-17

- `GET /api/integraciones/boletas/numeros-aleatorios`: URL fija, `empresa_id`, `proyecto_id`, `cantidad` (máx. 150) en QUERY PARAMETERS. Autenticación Bearer `PULSE_CALLBACK_SECRET`, aislamiento de empresa/proyecto y filtros estrictos de disponibilidad Oficina. **Por defecto responde únicamente `text/plain`**, con números separados por coma y espacio, bloques **consecutivos de hasta 50** separados por ` | `, sin barra final: 150 números = 3 bloques y 2 barras. Para el split de GHL usar el campo `data` si la plataforma envuelve su respuesta en un objeto. `GET?formato=json` conserva el contrato anterior de JSON (`numeros`, `grupos`, `numeros_texto`) y `POST` conserva JSON por defecto y acepta Custom Data; ambos pueden pedir `formato=texto` expresamente. No cambiar la lectura ni los datos de reserva/liberación y mantener los tests de contrato.
- `POST /api/integraciones/boletas/actualizar` con `estado: Disponible`: liberar una reserva no abonada del proyecto especificado, sin exigir `valor_pagado`; si se envía, exigir cero. Borrar datos de ocupación y restablecer pool Oficina sin borrar `comprobante_url`, bloquear liberación de boletas pagadas/abonadas/con saldo o asignadas a vendedores, filtros de concurrencia en la escritura, y no sincronizar Sheets que carece de contexto de empresa/proyecto. Para estados distintos, conservar el contrato de pagos y validación del total.
- Rutas heredadas `/api/proyectos/[proyectoId]/numeros-aleatorios` y `/api/proyectos/[proyectoId]/actualizar-boleta` continúan por compatibilidad, la segunda bajo interruptor de retiro; no cambiar rutas de reservas, callback de oportunidades ni activar V2. Mantener pruebas ejecutables de parsing, Bearer, aislamiento empresa/proyecto y guardas.
- Ver `docs/WEBHOOK_UNICO_ACTUALIZAR_BOLETAS_GHL.md` y registro M-034 del plan.

## Regla de actualización de boletas desde GHL — URL fija

- Endpoint actual para actualizar saldos: `POST /api/integraciones/boletas/actualizar`, **el ID del proyecto viaja en el cuerpo** como `proyecto_id`, siempre junto con `empresa_id` y `numero`. No generar URLs distintas por proyecto para esta integración.
- **Authorization: Bearer** obligatorio con el secreto privado `PULSE_CALLBACK_SECRET`; conservar la compatibilidad de JSON plano, `customData`, `custom_data`, `custom_fields`, claves prefijadas y mezcla de formatos.
- El saldo recibido `valor_pagado` es el **total acumulado** que sustituye el valor anterior; nunca sumar automáticamente un pago ni aceptar un importe inválido como `0`. Exigir estado válido y coincidencia exacta de empresa, proyecto y número. Pruebas ejecutables de formato, monto, autenticación y filtros antes del merge.
- La ruta heredada `/api/proyectos/[proyectoId]/actualizar-boleta` está **pendiente de retiro tras actualizar GHL**; es no autenticada y no debe mantenerse indefinidamente. No cortarla sin verificar el reemplazo de todos los workflows, pero tampoco considerarla segura.
- El sincronizador heredado de Google Sheets usa solo número y no es seguro para múltiples proyectos. La nueva ruta de actualización no lo llama hasta que la integración externa acepte empresa y proyecto. Ver `docs/WEBHOOK_UNICO_ACTUALIZAR_BOLETAS_GHL.md`.


## Regla estricta e inmutable: compatibilidad de webhooks entrantes GHL

- **Prohibido regresar a una lectura exclusiva de JSON raíz.** Todo endpoint que reciba confirmaciones/eventos de GHL debe conservar compatibilidad con los campos en JSON plano y dentro de `customData` / `custom_data` (también `custom_fields` y claves prefijadas cuando existan), incluso cuando parte de los datos llegue en raíz y parte en Custom Data. La estructura concreta del payload no debe romper el contrato de negocio.
- El callback de oportunidades `POST /api/integraciones/oportunidades/confirmar` usa la extracción compartida `lib/ghl-callback-payload.ts`. Preservar los campos `empresa_id`, `proyecto_id`, `reserva_grupo`, `numero` (alias histórico `consecutivo_1`) y `estado` (`creada`/`fallida`, sin dependencia de mayúsculas). **No eliminar alias o formatos previamente aceptados** sin migración explícita de los workflows y aprobación del usuario.
- La flexibilidad de lectura **nunca elimina seguridad o validación**: conservar el header `Authorization: Bearer`, coincidencia de empresa/proyecto/grupo/número/canal, cuatro dígitos exactos del número, respuesta `400` con nombres de `campos_invalidos` (sin reflejar valores sensibles), y respuesta `401` ante credenciales inválidas. No registrar tokens, datos personales o cuerpos completos del webhook.
- **Protección obligatoria contra regresiones:** antes de fusionar cambios en webhooks GHL, su parser, flujos de reserva o integración, ejecutar `node --test tests/reservas-contract.test.mjs` y `npx tsc --noEmit`. Los tests deben ejecutar **realmente** los casos de parsing JSON raíz, `customData`, `custom_data`, mezcla de fuentes, alias, valores nulos/ausentes y formatos inválidos; no basta con tests que solo inspeccionen texto. Adicionalmente, verificar que la ruta conserve autenticación Bearer y filtros de acceso; idealmente con tests de ejecución aislada. Si llega un formato nuevo de GHL, agregar un fixture anonimizado **antes** de adaptarlo. No modificar la URL estable del callback ni el secreto por un cambio de estructura.
- Estas reglas deben revisarse en toda futura refactorización del endpoint, la librería de recepción y el workflow externo. Ver también `docs/ACTIVAR_RESERVAS_WEBHOOK_ALERTAS.md`.



- Antes de modificar la aplicación, pruebas, migraciones, dependencias o despliegues, leer `docs/PLAN_DESARROLLO_PULSE.md`, especialmente el estado actual y la última entrada de bitácora.
- Respetar el orden del plan. Mientras P00 no esté verificado en producción, la prioridad es desbloquear y publicar la corrección de disponibilidad pendiente del PR #34.
- Actualizar el plan con cada unidad de cambio, decisión relevante, migración, prueba, commit de implementación, integración, despliegue o reversión. Registrar archivos, resultados, SHAs completos reales, PR, deployment/entorno y siguiente acción.
- El flujo autorizado es validación local → integración en main → build de Production en Vercel → verificación en producción. No exigir Preview ni crear otro proyecto Supabase para publicar; el usuario descartó ese entorno el 2026-10-02.
- **Reservas V2 — estado al 2026-10-14:** las implementaciones de los PR #37 y #38 están fusionadas en `main`, con configuración por empresa en `public.empresas` (no crear `pulse_empresa_integraciones`). `PULSE_RESERVAS_V2=enabled` controla la activación global del flujo. **Usuario informa** que ejecutó el SQL de migración en Supabase, comprobó seis resultados `true`, configuró los dos secretos de Vercel y completó webhook/workflow GHL. Son declaraciones del usuario, **no** pruebas de integración extremo a extremo ni certificación del entorno. El flujo V2 no debe declararse activo ni activarse automáticamente. Seguir `docs/ACTIVAR_RESERVAS_WEBHOOK_ALERTAS.md` antes de la activación controlada. El diseño histórico se conserva en `docs/PLAN_RESERVAS_WEBHOOK_ALERTAS.md` y la cronología en el plan principal.
- La preparación de autenticación de `fcbfd1590e19702a14780ef04db52af59d11c37b` fue retirada y sus instrucciones manuales quedaron canceladas. La nueva especificación D00 **no** reactiva esa preparación. Antes de modificar integraciones, verificar los requisitos nuevos, DDL/usuarios y workflow externo vigente y desarrollar por unidades con pruebas.
- Distinguir implementado, verificado local, integrado en main, desplegado y verificado en producción. No declarar publicado a partir de un commit o de un check de comentarios de Vercel. Si hace falta una operación manual, explicar los pasos y esperar confirmación antes del trabajo dependiente.
- Código, pruebas y actualización inicial del plan deben viajar en el mismo PR. Si hace falta, registrar después el SHA de implementación mediante un commit documental. Los commits sólo documentales no autorregistran recursivamente su propio hash.
- No borrar la bitácora ni guardar secretos o datos reales de compradores en ella. Comprobar el estado externo antes de continuar y dejar los bloqueos con una siguiente acción concreta.

- **Regla de contenido del producto:** nunca mostrar nombres de plataformas/proveedores técnicos externos en la UI, los popups, mensajes, alertas o textos de ayuda de PULSE. Solo documentación técnica, código o configuración restringida pueden nombrarlos.
- En la migración futura, asignar errores de reserva manual solo al usuario que creó la reserva; las reservas públicas al `empresa_admin` designado de la empresa. Una incidencia por boleta, no por grupo; sin reintentos de webhook. No confundir con la alerta general de disponibilidad.
