<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pulse: plan de desarrollo y memoria operativa

- Antes de modificar la aplicación, pruebas, migraciones, dependencias o despliegues, leer `docs/PLAN_DESARROLLO_PULSE.md`, especialmente el estado actual y la última entrada de bitácora.
- Respetar el orden del plan. Mientras P00 no esté verificado en producción, la prioridad es desbloquear y publicar la corrección de disponibilidad pendiente del PR #34.
- Actualizar el plan con cada unidad de cambio, decisión relevante, migración, prueba, commit de implementación, integración, despliegue o reversión. Registrar archivos, resultados, SHAs completos reales, PR, deployment/entorno y siguiente acción.
- El flujo autorizado es validación local → integración en main → build de Production en Vercel → verificación en producción. No exigir Preview ni crear otro proyecto Supabase para publicar; el usuario descartó ese entorno el 2026-10-02.
- **Cambio de decisión documentado 2026-10-13 (D00):** consultar `docs/PLAN_RESERVAS_WEBHOOK_ALERTAS.md`. La futura implementación sustituirá el iframe para reservas de Oficina por un único webhook privado por reserva, sin reintentos, con alertas por número y responsable, y comprobantes `comprobante_url`. Las ventas de números asignados a vendedores no usan webhook. **Sólo documentado:** hasta que se implemente, conservar el contrato de formularios que opera hoy, sin cambiar aún código, DB, variables, credenciales ni workflows. No rescatar automáticamente el guard y preparaciones del 2026-10-03.
- La preparación de autenticación de `fcbfd1590e19702a14780ef04db52af59d11c37b` fue retirada y sus instrucciones manuales quedaron canceladas. La nueva especificación D00 **no** reactiva esa preparación. Antes de modificar integraciones, verificar los requisitos nuevos, DDL/usuarios y workflow externo vigente y desarrollar por unidades con pruebas.
- Distinguir implementado, verificado local, integrado en main, desplegado y verificado en producción. No declarar publicado a partir de un commit o de un check de comentarios de Vercel. Si hace falta una operación manual, explicar los pasos y esperar confirmación antes del trabajo dependiente.
- Código, pruebas y actualización inicial del plan deben viajar en el mismo PR. Si hace falta, registrar después el SHA de implementación mediante un commit documental. Los commits sólo documentales no autorregistran recursivamente su propio hash.
- No borrar la bitácora ni guardar secretos o datos reales de compradores en ella. Comprobar el estado externo antes de continuar y dejar los bloqueos con una siguiente acción concreta.

- **Regla de contenido del producto:** nunca mostrar nombres de plataformas/proveedores técnicos externos en la UI, los popups, mensajes, alertas o textos de ayuda de PULSE. Solo documentación técnica, código o configuración restringida pueden nombrarlos.
- En la migración futura, asignar errores de reserva manual solo al usuario que creó la reserva; las reservas públicas al `empresa_admin` designado de la empresa. Una incidencia por boleta, no por grupo; sin reintentos de webhook. No confundir con la alerta general de disponibilidad.
