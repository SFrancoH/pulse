# URL única para actualizar boletas desde GHL

## Objetivo
Todas las empresas y proyectos comparten el **mismo** endpoint:

`POST https://pulse-sand-omega.vercel.app/api/integraciones/boletas/actualizar`

El ID del proyecto **no va en la URL**, sino en `proyecto_id`, junto con `empresa_id` y `numero` en CUSTOM DATA de GHL. No se crea una ruta por sorteo.

## Configuración de la acción Webhook de GHL

- **Method**: POST
- **URL**: `https://pulse-sand-omega.vercel.app/api/integraciones/boletas/actualizar`
- **Headers**: `Authorization: Bearer <PULSE_CALLBACK_SECRET>` y `Content-Type: application/json`. Reutilizar el secreto ya configurado para callbacks de PULSE en Vercel y Custom Values de GHL. Nunca publicarlo en el repositorio.
- **CUSTOM DATA** (usar tokens GHL):
  - `empresa_id`: Custom Values → Empresa Id de la oportunidad
  - `proyecto_id`: ID real del proyecto de la boleta. Si hay varios sorteos activos simultáneamente en la misma subcuenta de GHL, usar un **campo de la oportunidad** que almacene ese ID; no un Custom Value global que cambie al crear otro proyecto
  - `numero`: Opportunity → Custom Fields → Consecutivo
  - `estado`: `Abonado` o `Pagado` (se aceptan también `Debe`, `Disponible`, `No disponible`)
  - `valor_pagado`: **total acumulado pagado** para esa boleta, NO el último abono ni el precio de la oportunidad si no representa los pagos. Se sobrescribe, no se suma; reenvíos con el mismo total son idempotentes a nivel valor.
  - Opcionales: `nombre_cliente`, `telefono_cliente`, `email_cliente`, `canal`, `metodo_pago`, `comprobante_url`.
- Compatibilidad estricta: JSON plano, objetos `customData`, `custom_data`, `custom_fields`, claves prefijadas y mezclas, con el mismo comportamiento de entrada establecido por `AGENTS.md`.
- El número acepta de uno a cuatro dígitos y se normaliza a cuatro. Se rechazan otros caracteres y números de más de cuatro dígitos.
- El importe acepta número JSON o texto monetario COP: `30000`, `30.000`, `30,000`, `30000.00`. Si falta o es inválido → HTTP 400 y sin actualizar. No hay suma automática.

## Respuestas e interpretación

- `200`: boleta actualizada; devuelve `boleta.valor_pagado`, `empresa_id`, `proyecto_id`, `numero` y `modo_valor:"total_acumulado"`.
- `400`: nombres de `campos_invalidos`, nunca token ni información personal.
- `401`: falta o no coincide `Authorization: Bearer` con `PULSE_CALLBACK_SECRET` de Production.
- `404`: no existe esa combinación exacta de empresa/proyecto/número. No se actualiza otro sorteo.
- `500`: error de escritura u operación; no se divulgan datos internos.

## Plan de transición y seguridad

1. Publicar esta ruta y verificar Vercel Production.
2. Cambiar la URL de las acciones de GHL a la URL única; conservar headers y CUSTOM DATA. Comprobar primero con una boleta de prueba.
3. Comprobar en Supabase mediante consulta de solo lectura el registro exacto y sus `updated_at`, `valor_pagado`, `estado`.
4. Actualizar los workflows restantes y verificar que ninguna llamada siga al endpoint heredado `/api/proyectos/[proyectoId]/actualizar-boleta`.
5. **Retirar la ruta heredada no autenticada** tras la migración: configurar en Vercel Production `PULSE_LEGACY_BOLETA_UPDATE_DISABLED=true` y **redeploy**. La ruta antigua devolverá HTTP 410, sin modificar los datos. No activar este interruptor antes de confirmar que todos los workflows dejaron de usarla. Mientras no se active, el endpoint viejo **continúa siendo un riesgo de seguridad**, aunque la ruta nueva sea segura.
6. El antiguo sincronizador de Google Sheets solo identifica `numero`, no `empresa_id` ni `proyecto_id`. **Esta ruta nueva no lo invoca** para evitar cambios cruzados entre sorteos. La disponibilidad se actualiza en Supabase; cualquier sincronización externa por proyecto debe diseñarse por separado antes de utilizar el endpoint para liberar números.

La URL de confirmación de **oportunidad creada** `/api/integraciones/oportunidades/confirmar` es distinta y no se modifica. No se requieren SQL, nuevas variables ni activación de `PULSE_RESERVAS_V2`.
