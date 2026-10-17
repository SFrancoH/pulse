# Arquitectura modular: PULSE, AURA y PETS

**Estado:** Fase 1 — solo estructura y documentación. Nombre definitivo: **AURA**, identificador `aura`.

## Objetivo
Evolucionar el SaaS a un monolito modular conservando el comportamiento de PULSE y un único despliegue. `src/core` alojará servicios globales; `src/shared` componentes genéricos; `src/modules/{pulse,aura,pets}` lógica exclusiva de cada familia. Los README actuales son marcadores: **ningún código fue trasladado**.

## Reglas obligatorias para agentes y desarrolladores
1. Antes de editar, declarar familia, alcance, archivos afectados y dependencias.
2. Trabajando en AURA, no tocar código de PULSE o PETS; regla simétrica para todas las familias.
3. Cambios en core/shared solo con autorización específica y análisis de impacto.
4. Lógica de industria exclusivamente en su módulo; no importaciones de implementaciones internas entre familias.
5. Mantener rutas de Next.js en `app/` como adaptadores cuando se extraiga lógica. No cambiar URLs, payloads, query keys o webhooks existentes sin aprobación.
6. Tablas exclusivas para datos sectoriales; no sobrecargar tablas globales. Aislamiento por empresa y políticas DB.
7. Familia principal y módulos habilitados son conceptos distintos; autorización en servidor, nunca solo por UI.
8. SQL, RLS, backfill y rollback se revisan antes de ejecutar. No asumir estructura de Supabase productivo.
9. Pruebas de regresión de PULSE y componentes compartidos antes de desplegar cambios en cualquier familia.
10. Registrar cambios, pruebas efectivamente realizadas, commit, estado de Vercel y riesgos.
11. No modificar secretos, datos reales ni integraciones existentes como efecto colateral.
12. Leer `AGENTS.md` y `docs/PLAN_DESARROLLO_PULSE.md` antes de cada trabajo; prevalecen restricciones operativas vigentes.

## Etapas
- Fase 0: inventario inicial de rutas, tablas y dependencias; completar contra esquema real.
- **Fase 1:** crear carpetas y documentación sin cambiar runtime.
- Fase 2: diseñar SQL de familias, módulos, empresa_modulos y backfill; no ejecutarlo sin autorización.
- Fase 3: selector PULSE/AURA/PETS para super_admin en Crear empresa y validación API; impedir cambios de familia accidentales vía upsert.
- Fase 4: navegación y control de acceso por familia y módulo.
- Fase 5: extraer PULSE progresivamente sin romper enlaces, reservas, vendedores, GHL o Google Sheets.
- Fase 6: desarrollar AURA en directorio propio.
- Fase 7: QA y publicación controlada.

## Pendientes
Confirmar esquema real, RLS, catálogo de módulos, respaldo, y estrategia de integración de PETS. No se afirma que PETS esté integrado.

## QA mínimo
Build/TypeScript, permisos por rol y empresa, proyectos, boletas, reservas, vendedores, enlaces públicos, GHL/Google Sheets y ausencia de acceso entre empresas. Verificar Vercel separadamente de GitHub.

## Bitácora
### 2026-10-09 — Estructura modular inicial
- Autorizado: únicamente estructura de carpetas y documentación en GitHub.
- Implementación: README de core, shared y módulos; este documento.
- Sin modificaciones a TS/TSX, SQL, endpoints, dependencias, Supabase o configuración Vercel.
- Estado: rama de trabajo; sin afirmación de pruebas ni despliegue productivo.
- Siguiente acción: revisión del PR; luego diseño SQL de Fase 2.
