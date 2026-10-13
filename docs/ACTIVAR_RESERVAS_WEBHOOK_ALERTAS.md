# Preparación para activar reservas PULSE — 2026-10-13

**Estado: código en rama de implementación, no desplegado.** No ejecutar migraciones hasta verificar los puntos siguientes.

## Dependencias obligatorias

1. Hacer respaldo de Supabase y consultar el DDL real de `admin_users` (tipo/constraint de `role`), `empresas`, `boletas` y la función `eliminar_proyecto_pulse`. El repositorio carece del DDL completo de usuarios; **no es seguro ejecutar la migración sin esa revisión**.
2. Revisar las tablas nuevas de oportunidades en la lógica de eliminación del proyecto. Se proponen sin FK con proyectos/boletas para no romper el borrado existente; antes del despliegue agregar limpieza transaccional a `eliminar_proyecto_pulse` o definir una política de retención consistente.
3. Ejecutar en SQL Editor de la **base actual** `supabase/production/20261013_01_reservas_webhook_alertas.sql` después de validar su compatibilidad. El script crea tablas/función y agrega columna, pero no envía webhooks.
4. Configurar en Vercel **Production** `PULSE_WEBHOOK_ENCRYPTION_KEY` (32 bytes en base64, valor secreto) y `PULSE_CALLBACK_SECRET` (valor aleatorio único). No usar `NEXT_PUBLIC_`; no copiar los valores a GitHub.
5. En la configuración privada de cada empresa guardar su URL HTTPS en la página de integración; configurar quién es el `empresa_admin` responsable de reservas públicas.
6. Modificar el workflow receptor: un evento por reserva con pares `consecutivo_i` y `comprobante_url_i`; una oportunidad por boleta; enviar confirmación autenticada **por número** con `reserva_grupo`, empresa, proyecto y número a `POST /api/integraciones/oportunidades/confirmar`, con secreto Bearer. Una recepción HTTP 2xx sin confirmación no significa oportunidad creada.
7. Validar extremo a extremo con empresa/proyecto descartables sin compradores reales: una reserva de 3 números produce un único POST y tres oportunidades; error en 1 genera solo 1 alerta; confirmación manual no reintenta.
8. Probar que super_admin/empresa_admin/oficina_admin/vendedor acceden solo a sus operaciones; comprobar rol `oficina_admin` según DDL real antes de crearlo.
9. Integrar rama en `main` y revisar **build Production** solamente cuando las dependencias anteriores estén verificadas.

## Rollback

Conservar la información de reservas y alertas. Si es preciso detener la nueva entrega, revertir el cambio de aplicación a la revisión previa; no eliminar tablas ni `comprobante_url` automáticamente. Una reserva ya confirmada nunca se vuelve a ejecutar por rollback.

## Riesgos conocidos

- Envío a lo sumo una vez: una falla/timeout de red puede haber sido recibida; hay que verificar manualmente antes de crear la oportunidad para evitar duplicados.
- Falta el inventario real de constraints/roles de Supabase, lo que impide certificar el SQL en producción desde GitHub.
- La función de borrado de proyecto anterior debe reconciliarse con las nuevas entidades antes del despliegue.
- Los enlaces de boleta muestran datos del titular en la vista pública; minimizar teléfono antes de publicar masivamente.

La migración incorpora la RPC `pulse_eliminar_proyecto_con_reservas` para eliminar eventos/alertas dentro de la misma transacción de `eliminar_proyecto_pulse`. Validar ambas antes de desplegar. El nuevo endpoint de borrado requiere la función envolvente.
