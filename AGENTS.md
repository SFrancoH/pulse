<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pulse: plan de desarrollo y memoria operativa

- Antes de modificar la aplicación, pruebas, migraciones, dependencias o despliegues, leer `docs/PLAN_DESARROLLO_PULSE.md`, especialmente el estado actual y la última entrada de bitácora.
- Respetar el orden del plan. Mientras P00 no esté verificado en producción, la prioridad es desbloquear y publicar la corrección de disponibilidad pendiente del PR #34.
- Actualizar el plan con cada unidad de cambio, decisión relevante, migración, prueba, commit de implementación, integración, despliegue o reversión. Registrar archivos, resultados, SHAs completos reales, PR, deployment/entorno y siguiente acción.
- El flujo autorizado es validación local → integración en main → build de Production en Vercel → verificación en producción. No exigir Preview ni crear otro proyecto Supabase para publicar; el usuario descartó ese entorno el 2026-10-02.
- Distinguir implementado, verificado local, integrado en main, desplegado y verificado en producción. No declarar publicado a partir de un commit o de un check de comentarios de Vercel. Si hace falta una operación manual, explicar los pasos y esperar confirmación antes del trabajo dependiente.
- Código, pruebas y actualización inicial del plan deben viajar en el mismo PR. Si hace falta, registrar después el SHA de implementación mediante un commit documental. Los commits sólo documentales no autorregistran recursivamente su propio hash.
- No borrar la bitácora ni guardar secretos o datos reales de compradores en ella. Comprobar el estado externo antes de continuar y dejar los bloqueos con una siguiente acción concreta.
