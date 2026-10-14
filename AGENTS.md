<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pulse: plan de desarrollo y memoria operativa

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
