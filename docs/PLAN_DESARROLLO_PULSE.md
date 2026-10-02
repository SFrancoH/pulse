# Plan de desarrollo y memoria de Pulse

> Documento operativo: leerlo antes de modificar Pulse y actualizarlo con cada cambio funcional, migración, prueba relevante, commit de implementación, integración, despliegue o reversión.
>
> **Prioridad inicial: desbloquear el build, integrar la corrección de disponibilidad del PR #34 y verificarla en producción.** Las demás fases se ejecutan en el orden de este documento.

## 1. Estado actual: empezar a leer aquí

| Campo | Estado registrado |
| --- | --- |
| Repositorio | [SFrancoH/pulse](https://github.com/SFrancoH/pulse) |
| Creación y última revisión de esta versión | 2026-10-02, zona horaria America/Bogota |
| Fuente | Auditoría técnica integral de Pulse, 2026-10-02, 31 páginas; hallazgos F01–F22 |
| Versión auditada | `23dfededd0bbb19bd9372e53cc04d594f50811ce` |
| Último `main` verificado | `23dfededd0bbb19bd9372e53cc04d594f50811ce` |
| Último commit de corrección conocido | `b3a00c764c1d4a8011574ac71b2fac16e06fa749` |
| Rama de esa corrección | `fix/exclude-occupied-tickets` |
| PR de corrección | [#34 — Excluir boletas con cliente o abonos de la disponibilidad](https://github.com/SFrancoH/pulse/pull/34) |
| Estado del PR #34 | Abierto, no integrado; 1 commit por delante de `main`, 0 por detrás en la consulta realizada |
| Estado de integración de GitHub | `mergeable=true`; `mergeable_state=unstable` |
| Estado real del build del PR | **Vercel: failure**; no confundirlo con el check de comentarios de preview |
| Check `Vercel Preview Comments` | Success: sólo confirma que no hay comentarios pendientes; no confirma un build correcto |
| Check `Supabase Preview` | Skipped: no detectó cambios en el directorio `supabase` |
| Deployment fallido identificado | `dpl_8GDk9mWaeq1TaZavqSc31qriNKNQ` |
| SHA y dominio efectivo de producción | **Pendientes de verificación en Vercel y en el dominio servido** |
| Fase activa | `P00` — publicar y verificar la corrección pendiente |
| Última evidencia recibida | Log de Vercel aportado por el usuario el 2026-10-02 a las 15:23 America/Bogota |
| Paso siguiente | `P00-03` — corregir las variables de Supabase del entorno que construye la rama y generar un nuevo deployment |
| Bloqueo actual | En ese build no estaba disponible la URL de Supabase; configuración del entorno de Vercel y nuevo deployment pendientes |
| Cambios de aplicación realizados al crear este plan | Ninguno; se creó la documentación y la regla de mantenimiento de la memoria |

**Conclusión comprobada:** el commit de corrección existe en GitHub, pero todavía no pertenece a `main`; además, el build de su rama falló porque `lib/supabase-admin.ts` no encontró ni `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_URL`. El módulo lanza un error al importarse desde `/api/admin/bootstrap`, durante la recopilación de rutas. La instalación, la compilación y TypeScript habían terminado correctamente. El SHA que atiende producción sigue sin verificarse.

**Separar los problemas:** la desalineación de `package.json`/`package-lock.json` encontrada en la auditoría continúa como tarea de reproducibilidad en P02; no explica el error fatal de este log. Los avisos de install scripts de `sharp@0.34.5` y `unrs-resolver@1.11.1` tampoco detuvieron este build. No se ha demostrado que falten variables en producción: se debe verificar el alcance de variables del deployment concreto, normalmente Preview para esta rama.

### 1.1 Evidencia que permite retomar sin volver a investigar desde cero

- [Estado combinado del commit de corrección](https://api.github.com/repos/SFrancoH/pulse/commits/b3a00c764c1d4a8011574ac71b2fac16e06fa749/status).
- [Checks del mismo commit](https://api.github.com/repos/SFrancoH/pulse/commits/b3a00c764c1d4a8011574ac71b2fac16e06fa749/check-runs).
- [Comparación `main` auditado → corrección](https://github.com/SFrancoH/pulse/compare/23dfededd0bbb19bd9372e53cc04d594f50811ce...b3a00c764c1d4a8011574ac71b2fac16e06fa749).
- [Deployment de Vercel con error](https://vercel.com/soy-sebastian-franco-s-projects/pulse/8GDk9mWaeq1TaZavqSc31qriNKNQ).
- Log aportado por el usuario: resumen y error conservados en P00 y registro M-002; confirma rama `fix/exclude-occupied-tickets` y commit abreviado `b3a00c7`.
- [Validación de Supabase en el commit exacto](https://github.com/SFrancoH/pulse/blob/b3a00c764c1d4a8011574ac71b2fac16e06fa749/lib/supabase-admin.ts).
- Pruebas de la rama de corrección: `tests/availability.test.mjs`, siete pruebas registradas en el trabajo previo; repetirlas sobre el HEAD que realmente se vaya a publicar.
- Auditoría: `auditoria-pulse.pdf`; paquete: `evidencias-auditoria-pulse.zip`. Los runs de auditoría son locales, usan datos ficticios y no certifican producción.

## 2. Cómo mantener esta memoria

### 2.1 Estados permitidos

| Estado | Significado |
| --- | --- |
| Pendiente | Todavía no se ha trabajado en la tarea |
| En curso | Existe una unidad de trabajo activa, con alcance y commit base registrados |
| Bloqueado | Falta un dato, acceso, decisión o falla técnica concreta, documentados |
| Implementado | Hay cambios de código; aún no se ha acreditado su funcionamiento |
| Verificado local | Las pruebas necesarias pasan sobre un SHA/árbol identificado |
| Preview verificado | El build y el comportamiento requerido se comprobaron en preview |
| Integrado en main | El commit está en el historial de `main`; no significa desplegado |
| Desplegado en producción | El proveedor confirma SHA, entorno y deployment de producción |
| Verificado en producción | Se comprobó el comportamiento en el dominio que usan los usuarios |
| Revertido | Se deshizo un cambio; registrar tanto el commit original como la reversión |

Una tarea funcional que exige publicación sólo se marca `[x]` cuando alcanza **Verificado en producción**. Las tareas de análisis/documentación pueden cerrarse con su evidencia correspondiente. Los estados intermedios se conservan en la bitácora.

### 2.2 Protocolo obligatorio para cada cambio

1. **Antes de editar:** leer este documento, comprobar el HEAD remoto y el estado del PR/deployment relevante. Actualizar el panel de la sección 1 si la realidad cambió. Registrar ID de tarea, rama, commit base, objetivo y archivos previstos.
2. **Durante el trabajo:** limitar cada unidad a un problema comprobable. Actualizar la tarea y registrar decisiones, cambios de alcance o bloqueos al producirse. Las pruebas de regresión acompañan a cada corrección; no se posponen todas a la última fase.
3. **Antes del commit de implementación:** actualizar aquí qué cambió, qué se probó, resultado, archivos, riesgos materiales y siguiente paso. Código, pruebas y esa actualización inicial del plan deben viajar en el mismo PR.
4. **Después del commit:** añadir el SHA completo real del commit de implementación, no un hash abreviado supuesto. Cuando sea necesario, hacer un commit documental posterior que registre ese SHA.
5. **Antes de integrar:** revisar los checks del HEAD exacto. Un check verde de comentarios no sustituye al build. Registrar el PR y sus dependencias.
6. **Después de integrar:** registrar SHA de implementación y SHA de merge/squash por separado. Confirmar que `main` contiene el cambio y actualizar el panel.
7. **Después de desplegar:** registrar deployment ID, entorno, SHA publicado, dominio/alias observado, fecha y pruebas en producción. Si el deployment falla, cambiar a Bloqueado y conservar el error real.
8. **Al cerrar una sesión de trabajo:** dejar la fase y tarea activas, lo ya implementado, lo aún no publicado, bloqueos y una siguiente acción concreta. No dejar sólo “continuar mañana”.

**Evitar la circularidad del hash:** un archivo no puede contener el SHA del mismo commit que lo crea y mantener ese SHA. Esta memoria registra SHAs de **implementaciones ya existentes** y merges conocidos. Los commits exclusivamente documentales se consultan en el historial Git del archivo; no requieren otro commit recursivo para registrar su propio hash.

**Diferenciar dos hashes cuando corresponda:** un deployment puede incluir un commit posterior sólo de documentación. Registrar tanto el SHA servido por Vercel como el SHA de la corrección funcional incluida en su historial.

**Cambios de datos:** además del commit Git, registrar archivo/versión de migración, entorno, fecha de ejecución, resultado, validación de constraints y procedimiento de reversión. Una migración escrita no equivale a una migración aplicada.

**Higiene del registro:** no guardar contraseñas, claves, cookies, tokens de ventas, teléfonos o payloads reales de compradores. Usar referencias al sistema autorizado y fixtures anonimizados.

### 2.3 Ubicación y continuidad

Este archivo, `docs/PLAN_DESARROLLO_PULSE.md`, es la memoria operativa versionada. `AGENTS.md` debe indicar su lectura y actualización obligatorias. Cada PR funcional debe tocar esta memoria o justificar en su revisión por qué no cambia el estado del plan.

Un archivo por sí solo no observa cambios externos ni se actualiza automáticamente: el desarrollador/agente que realiza el cambio es responsable de actualizarlo. En `P02` se añadirá un gate de CI para detectar PRs de implementación sin actualización del plan. Si otra persona trabaja fuera de ese flujo, reconciliar primero Git/DB/Vercel y registrar la diferencia; no reutilizar un estado obsoleto.

## 3. Orden de ejecución

| Orden | Fase | Resultado exigido antes de continuar |
| --- | --- | --- |
| 0 | `P00` Publicación pendiente | Corrección de disponibilidad verificada en el dominio de producción |
| 1 | `P01` Autorización y datos públicos | Mutaciones anónimas cerradas; datos del comprador minimizados |
| 2 | `P02` Dependencias, instalación y CI | Checkout reproducible, build y puertas de calidad obligatorias |
| 3 | `P03` Login y protección de abuso | Sesiones revocables, permisos coherentes y límites distribuidos |
| 4 | `P04` Esquema y aislamiento de DB | Baseline, migraciones, integridad tenant y backup/restore verificados |
| 5 | `P05` Dominio de boletas, reservas y pagos | Invariantes únicas y operaciones transaccionales/idempotentes |
| 6 | `P06` Integraciones y outbox | Eventos por tenant, entrega duradera y reconciliación |
| 7 | `P07` Consultas, paginación y caché | Disponibilidad eficiente sin perder autoridad de DB |
| 8 | `P08` Importaciones y exportaciones | Jobs duraderos, cuotas, progreso y descargas autorizadas |
| 9 | `P09` Calidad, observabilidad y operación | Suite completa del dominio, runbooks y trazabilidad |
| 10 | `P10` Carga real y salida comercial | SLO y aislamiento validados; rollout y rollback ensayados |

Implementar cada fase en PRs pequeños. Después de cada parche urgente, publicar y verificar su comportamiento; no mantener las correcciones de seguridad esperando una entrega única al final. La ejecución mantiene este orden; la preparación de fixtures o lectura de infraestructura puede adelantarse sin modificar producción.

## 4. P00 — Desbloquear y publicar el último commit de corrección

**Prioridad:** primera. **Estado:** Bloqueado para publicación. **Hallazgos:** F05 y bloqueo de despliegue. **Rama inicial:** `fix/exclude-occupied-tickets`.

### Diagnóstico confirmado del build

Log recibido del usuario el 2026-10-02. Las horas siguientes son las que muestra Vercel; el fragmento no indica su zona horaria.

| Evidencia del log | Resultado |
| --- | --- |
| Checkout | Rama `fix/exclude-occupied-tickets`, commit `b3a00c7`, asociado al SHA completo registrado arriba |
| Builder | Vercel CLI 62.1.0, Next.js 16.2.4, Turbopack, región iad1, 2 cores / 8 GB |
| Instalación | 414 paquetes instalados; termina y continúa al build |
| Compilación | Correcta, 14,4 s |
| TypeScript | Correcto, 8,0 s |
| Primera falla fatal | 09:37:18: falta URL de Supabase al evaluar `lib/supabase-admin.ts` |
| Etapa/ruta que aborta | `Collecting page data`; `/api/admin/bootstrap` |
| Resultado | `next build` termina con código 1 |

```text
Error: Falta la URL de Supabase. Configura NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL en Vercel.
Error: Failed to collect page data for /api/admin/bootstrap
Error: Command "next build" exited with 1
```

El código del SHA exacto confirma la validación durante la importación. Quitar esa validación, usar una URL inventada o crear un cliente vacío sólo para obtener un build verde no restaura el acceso real a DB. La primera corrección es de configuración del entorno, y podría no requerir ningún commit de código.

| Variable aceptada por el código | Acción en P00 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_URL` | Configurar la URL real del proyecto Supabase del entorno correspondiente; es la ausencia comprobada |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY` o `SUPABASE_SECRET_KEY` | Verificar una credencial privada válida del mismo proyecto; el log abortó antes de comprobarla, por lo que su ausencia no está demostrada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sólo requerida si se activa el cliente de `lib/supabase-public.ts`; no causó el error mostrado |
| `ADMIN_SESSION_SECRET` o `ADMIN_SECRET` | Verificar antes de probar login; no causó el error de este log |

Las credenciales privadas quedan únicamente en la configuración autorizada del proveedor; no añadir prefijo `NEXT_PUBLIC_` a una llave privada ni registrar su valor en este archivo.

### Tareas, en este orden

- [x] **P00-01 — Identificar el cambio pendiente.** Confirmado PR #34 abierto, HEAD `b3a00c764c1d4a8011574ac71b2fac16e06fa749`, ausente de `main`, Vercel failure. Guardar esta consulta como checkpoint; refrescarla antes de editar o integrar.
- [x] **P00-02 — Identificar el primer error del build.** Log recibido y contrastado con el código del commit. Causa confirmada: URL de Supabase ausente/vacía durante la importación; instalación, compilación y TypeScript correctos. Node/npm exactos no figuran en el fragmento: obtenerlos del proyecto/log completo si se necesita reproducir, sin inventarlos. Ver detalle anterior y M-002.
- [ ] **P00-03 — Corregir las variables de Vercel.** En el proyecto Pulse, revisar Settings → Environment Variables y el entorno del deployment fallido. Configurar la URL real y verificar la credencial privada del mismo proyecto. Para Preview, revisar alcance general y overrides de la rama `fix/exclude-occupied-tickets`; si la integración de Supabase sólo conectó Production, habilitar/configurar el entorno de preview apropiado. Verificar Production por separado antes de publicar; no copiar ciegamente credenciales productivas a pruebas. Registrar nombres, entorno, rama, fecha y responsable sin valores. Generar un nuevo deployment: la configuración nueva no modifica el deployment anterior. Si la corrección sólo es externa, registrar “commit de aplicación: no aplica”, conservando el SHA que se reconstruye.
- [ ] **P00-04 — Reproducir y resolver cualquier bloqueo restante.** Usar checkout aislado del HEAD real, herramientas equivalentes y variables de fixture/staging. Ejecutar install y build desde cero. Una ejecución local con valores ficticios no acredita acceso al Supabase de Vercel. Si aparece otro error, guardar el primer error nuevo y corregirlo con alcance mínimo. Resolver el lockfile en esta entrega sólo si impide la instalación/verificación reproducible; completar la tarea de entorno en P02. No mezclar refactorizaciones del login o schema.
- [ ] **P00-05 — Repetir la regresión de disponibilidad.** Ejecutar `node --test tests/availability.test.mjs` sobre el HEAD candidato. Verificar listado, búsqueda exacta, contiene, boletas iniciales y hold; un nombre, teléfono o abono excluyen la boleta. Oficina excluye vendedor asignado. El enlace de vendedor conserva únicamente su stock libre, conforme a la política comercial documentada. Comprobar refresco/pestaña en navegador. Las siete pruebas de fixture no sustituyen a Postgres ni a la prueba de navegador.
- [ ] **P00-06 — Verificar build y preview del HEAD exacto.** Ejecutar TypeScript y build; registrar lint y diferenciar los errores preexistentes del bloqueo real. Esperar un deployment de preview exitoso y comprobar allí los escenarios con datos de prueba. Repetir los checks si el HEAD cambia. No omitir la instalación limpia usando un `node_modules` prestado como prueba de publicación.
- [ ] **P00-07 — Integrar el PR y registrar ambos commits.** Incorporar a `main` únicamente el parche verificado. Guardar SHA de implementación, SHA de merge/squash y enlace al PR. Confirmar presencia del cambio en `main`; el merge por sí solo no cierra P00.
- [ ] **P00-08 — Verificar el deployment de producción.** Comprobar proyecto, Production Branch, entorno y SHA en Vercel. Verificar que el alias/dominio que usan compradores apunta al deployment nuevo, y revisar respuesta efectiva sin usar como evidencia sólo la pantalla del PR. Registrar deployment ID, SHA y dominio; si `main` no dispara publicación, revisar integración/branch/configuración y resolver el mecanismo de deployment existente.
- [ ] **P00-09 — Comprobar el comportamiento en producción.** Revisar mediante lecturas autorizadas que boletas con nombre, teléfono, abono o vendedor no aparecen en Oficina, incluyendo búsqueda y “ver más”. Para una compra/reserva completa, usar proyecto y boletas de prueba controlados; no alterar compradores o pagos reales para probar. Confirmar que la integración vigente conserva sus llamadas legítimas. Registrar evidencia anonimizada, fecha y resultado.
- [ ] **P00-10 — Cerrar P00 y actualizar esta memoria.** Marcar Verificado en producción; guardar SHAs, pruebas y deployment. Dejar `P01-01` como siguiente acción. Si hay regresión, revertir el código de forma controlada y documentar que un rollback no restaura automáticamente datos modificados durante el intervalo.

### Archivos del parche ya preparado

El PR contiene 17 archivos: `lib/boleta-availability.ts`, `tests/availability.test.mjs`, `lib/temporary-reservations.ts`, los componentes `ProyectoVentaClient` y `ProyectoVentaReservaClient`, páginas `/o`, `/p` y ventas admin, y las rutas de listado/aleatorios/reserva/asignación/GHL. Revisar la comparación fijada de la sección 1.1 antes de cambiar el alcance.

### Criterio de salida y límite de este parche

El build exitoso, la integración y la verificación del dominio deben estar acreditados por separado. El PR #34 no soluciona por sí solo F01/F02/F03/F04, las transacciones grupales, el campo legado `cliente_id` ni todos los escritores de estado. Esos puntos se atienden en las fases siguientes.

**Referencia operativa:** [variables y alcance por entorno/rama en Vercel](https://vercel.com/docs/environment-variables) y [gestión de variables](https://vercel.com/docs/environment-variables/managing-environment-variables), consultadas el 2026-10-02. Los valores se aplican a deployments nuevos; la bitácora debe registrar la modificación externa y su deployment posterior.

## 5. P01 — Cerrar acceso no autorizado y exposición de compradores

**Hallazgos:** F01, F02, F03, F04, F06 y parte de F12. **Dependencia:** P00 verificado.

- [ ] **P01-01 — F01: proteger `actualizar-boleta`.** Inventariar quién la llama: panel o integración. Para panel, exigir sesión, rol y acceso al proyecto mediante `lib/require-admin.ts`. Para integración, exigir credencial/firma limitada a tenant y proyectos autorizados. Derivar el contexto en servidor; no usar `empresa_id` recibido como permiso. Denegar anónimo, vendedor sin facultad y empresa ajena antes de construir la consulta. Validar transición y monto; quitar eco de payload y errores DB crudos.
- [ ] **P01-02 — F02: proteger `reservar-boleta`.** Aplicar el mismo contrato de actor/tenant, conservar condición de estado en el UPDATE y exigir ámbito de vendedor o pool Oficina. Comprobar que un secreto de A tampoco puede reservar en B. No reemplazar autenticación por un ID de proyecto conocido. Documentar cómo se actualiza el workflow legítimo antes de retirar un contrato legado.
- [ ] **P01-03 — F04: autenticar `oportunidades-ghl`.** Usar firma del cuerpo original y timestamp/ID de evento si la integración puede emitirlos. Si no, usar una credencial por integración vinculada en servidor a su tenant/proyectos y un ID idempotente. Eliminar el matching ambiguo por primer nombre/teléfono como identidad de operación; vincular por reserva/evento validado. Rechazar eventos ajenos, vencidos o inválidos sin mutar boletas.
- [ ] **P01-04 — F03: minimizar `/api/public/boleta`.** El QR/UUID público debe devolver sólo datos comerciales mínimos y enmascarados. Reservar nombre/teléfono completo y cartera detallada para actor autorizado o una capacidad específica, limitada y revocable de comprobante. Revisar el listado legado que expone UUIDs. Mantener útil la lectura de QR ya impresos sin convertir el UUID en permiso para ver PII. Añadir `Cache-Control: no-store` a respuestas sensibles.
- [ ] **P01-05 — F06: proteger QR y códigos de barras.** Añadir guard de administrador del proyecto a `generar-qr` y `generar-barcodes`, validar rango/cantidad y un límite inicial de recursos. No permitir exportación anónima ni de proyecto ajeno. La conversión a jobs duraderos corresponde a P08; el cierre de autorización es inmediato.
- [ ] **P01-06 — Revisar las 33 APIs y páginas servidor.** Clasificar cada una como privada por rol, integración autenticada o pública por capacidad. Registrar actor, tenant, campos permitidos y tablas. Asegurar que rutas nuevas no heredan “pública” por omisión del guard. Añadir `server-only` a módulos privilegiados que carezcan de él, en particular `lib/supabase-admin.ts`.
- [ ] **P01-07 — Regresión negativa por superficie.** Probar sin cookie/credencial, empresa A→B, vendedor A→B, vendedor sin facultad, token revocado y requests legítimos. Esperar 401/403 según contrato; comprobar que la DB permanece intacta tras un rechazo y que la API pública no entrega teléfono/nombre completos. Repetir contra preview y producción controlada.

**Archivos principales:** `lib/require-admin.ts`, `lib/supabase-admin.ts`, `app/api/proyectos/[proyectoId]/{actualizar-boleta,reservar-boleta,oportunidades-ghl,generar-qr,generar-barcodes,boletas-disponibles}/route.ts`, `app/api/public/boleta/route.ts`, comprobantes y consumidores de integración.

**Salida:** cerrar los PoC de acceso de la auditoría y mantener la operación autorizada de GHL/panel. Registrar el commit y deployment de cada parche urgente.

## 6. P02 — Dependencias, entorno reproducible y CI mínima

**Hallazgos:** F11, F17 y base de F18. **Dependencia:** P01 cerrado. El arreglo mínimo de instalación que necesitara P00 se conserva; aquí se completa el control del entorno.

- [ ] **P02-01 — Fijar herramientas y manifests.** Documentar Node/npm soportados, regenerar un lockfile completo, instalar con `npm ci` desde cero y verificar que el lock no cambia durante CI. Separar variables de desarrollo/staging/producción; crear `.env.example` sin valores privados.
- [ ] **P02-02 — Actualizar componentes vulnerables.** Repetir SCA sobre el árbol instalable, comprobar advisories primarios y actualizar Next y `eslint-config-next` de forma coordinada; actualizar Sharp y transitivas según compatibilidad. La auditoría de 2026-10-02 proponía Next 16.3.8 y Sharp 0.35.5: verificar esos objetivos al ejecutar, sin tratar versiones históricas como “la última”. Registrar lockfile, SBOM y avisos cerrados/alcanzabilidad restante. No usar `audit fix --force` sin revisar el diff.
- [ ] **P02-03 — Resolver los dos errores de lint.** Corregir hooks/flujo de carga en la página `reasignar-numero` y en `OpportunityErrorRecovery`; revisar warnings por riesgo y comportamiento. No desactivar reglas globales para obtener un check verde. Ejecutar TypeScript, lint y build del árbol limpio.
- [ ] **P02-04 — Instalar la CI inicial.** En PRs: install limpio, TypeScript, lint, pruebas de disponibilidad/autorización ya incorporadas, SCA y build. Separar fixtures de datos privados. Los tests añadidos en cada fase entran a este pipeline.
- [ ] **P02-05 — Hacer exigible la memoria.** Añadir gate que exija actualización de `docs/PLAN_DESARROLLO_PULSE.md` cuando un PR cambia aplicación, tests de producto, schema/migraciones, dependencias, configuración de deploy o CI. Admitir sólo excepciones documentadas y revisadas; no exigir autorregistro recursivo a commits puramente documentales.
- [ ] **P02-06 — Proteger `main`.** Exigir revisión y checks de calidad/build sobre el HEAD actual; separar previews de producción. Verificar qué automatiza realmente Supabase, porque un check skipped no prueba schema ni migraciones. Configurar protección desde la interfaz/API autorizada si el conector de GitHub no dispone de administración.

**Archivos principales:** `package.json`, `package-lock.json`, configuración Node, `.github/workflows/*`, `.env.example`, `AGENTS.md`, las dos fuentes con lint y README.

**Salida:** checkout limpio ejecuta instalación, pruebas y build; CI rechaza errores y cambios de producto sin memoria actualizada.

## 7. P03 — Login desacoplado, revocación y límites de abuso

**Hallazgos:** F09, F10, F20 y acoplamiento del login. **Dependencia:** P02.

- [ ] **P03-01 — Revocar sesiones al cambiar credenciales.** Añadir `session_version` o sesiones persistentes revocables mediante migración versionada. Incluir/verificar la versión o sesión en cada resolución; incrementar/revocar en reset de contraseña y logout. Definir retirada controlada de cookies antiguas. Probar que una cookie válida anterior deja de dar acceso tras reset y que baja/cambio de rol se aplica.
- [ ] **P03-02 — Unificar verificación de identidad.** Crear contratos de identidad/sesión/cookies separados de persistencia: autenticar, resolver y revocar. Extraer un codec firmado compatible y probarlo en las runtimes usadas. El Proxy sólo puede hacer verificación optimista de navegación; cada operación protegida vuelve a autorizar. No llamar JWT al token HMAC propio ni migrar a OAuth/SSO sin una decisión adicional.
- [ ] **P03-03 — Alinear cookies y CSRF.** Mantener login embebido si forma parte del producto; verificar `HttpOnly`, `Secure`, `SameSite` y `Partitioned` en los navegadores soportados. El borrado debe usar atributos compatibles. Establecer validación Origin/CSRF para mutaciones de sesión y panel; integraciones server-to-server utilizan su propio contrato. Probar en iframe y navegación normal.
- [ ] **P03-04 — Limitar abuso de forma distribuida.** Aplicar límites por IP/actor/tenant para login, hold/reserva, búsqueda intensiva y exportación, con un almacén compartido adecuado a Vercel. Un Map de un proceso no es suficiente. Definir ventanas/cuotas iniciales, 429, backoff, métricas y challenge proporcional; probar el límite entre distintas instancias y que no bloquea la operación normal.
- [ ] **P03-05 — Endurecer administración de cuentas.** Documentar roles y campos editables, separar reset de cambio de rol/empresa y auditar actor/destino. Proteger bootstrap de ejecución accidental posterior y concurrencia de creación inicial. Evaluar MFA para administradores mediante el proveedor/contrato escogido; registrar decisión y compatibilidad del embedding.

**Archivos principales:** `lib/auth-token.ts`, `lib/admin-auth.ts`, `lib/require-admin.ts`, `proxy.ts`, rutas login/logout/bootstrap/usuarios/vendedores y migración de sesiones.

**Salida:** reset/logout revocan, permisos no dependen sólo de la cookie antigua, navegadores objetivo pasan login/logout y los límites se cumplen entre instancias.

## 8. P04 — Baseline, integridad tenant y recuperación de DB

**Hallazgos:** F12, F16, F19 y parte de F22. **Dependencia:** P03. No aplicar schema suponiendo que los scripts históricos ya se ejecutaron.

- [ ] **P04-01 — Capturar el schema real con lectura autorizada.** Obtener tablas, tipos, defaults, unique, FK, `convalidated`, índices, RLS, policies, grants, triggers, funciones, tamaños, stats y uso de `pg_stat_statements`. Partir de `schema-inspection.sql` del paquete de auditoría. Guardar resultados anonimizados; actualizar el diccionario y DER con evidencia real.
- [ ] **P04-02 — Verificar backup antes de cambiar datos/schema.** Documentar plan/retención/PITR reales, acceso y restauración en proyecto aislado. Registrar duración e integridad restaurada. Establecer RPO/RTO con el negocio; 15 min/60 min son objetivos propuestos, no garantías de Supabase ni resultados de la auditoría.
- [ ] **P04-03 — Crear baseline y migraciones ordenadas.** Hacer que una DB vacía de staging pueda reconstruirse. Separar cambios de schema, índices concurrentes, saneamiento y validación. Usar lock/statement timeouts, pasos compatibles y estrategia de reversión. Corregir README que declara ausencia de UPDATE aunque scripts posteriores sí los contienen.
- [ ] **P04-04 — Detectar cruces e inconsistencias.** Buscar proyecto/vendedor de otra empresa, huérfanos, números duplicados, estados no canónicos y Disponible con cliente/abono. Conciliar sin borrar dinero o comprador para “hacer disponible”. Los resultados de lectura guían una migración de datos identificada, revisada y respaldada.
- [ ] **P04-05 — Implementar integridad tenant.** Confirmar la clave única del número por proyecto y alinear `onConflict`. Crear claves candidatas/FK compuestas para empresa-proyecto y empresa-usuario, y referencias coherentes desde boletas/enlaces/asignaciones. Validar FK históricas después de sanear. Documentar el comportamiento al eliminar usuarios para que no cambie inadvertidamente el stock Oficina.
- [ ] **P04-06 — Definir y probar la frontera RLS/backend.** Bloquear acceso directo anónimo a tablas privadas y probarlo con los roles reales. Documentar el mecanismo que transmite una identidad tenant a DB: JWT compatible con Supabase/Auth o un acceso backend/RPC de privilegio mínimo con actor validado. El HMAC actual no se convierte automáticamente en `auth.uid()`. No declarar aislamiento completo sólo por habilitar RLS: el service role la omite. Mantener `TenantContext` obligatorio en el backend y reducir el uso del cliente privilegiado.
- [ ] **P04-07 — Probar migraciones y restore en CI/staging.** Crear DB vacía, aplicar historial, cargar fixtures multiempresa y validar consultas/constraints/policies. Ensayar rollback de código junto con compatibilidad de schema; un rollback de Vercel no deshace DML ni una migración.

**Tablas:** `empresas`, `proyectos`, `admin_users`, `boletas`, `asignaciones_vendedores`, `clientes`, `movimientos_boletas`, `seller_sales_links`, `ganadores`.

**Salida:** schema real documentado, baseline reproducible, restricciones/policies comprobadas y restauración medida. Bases por tenant o particionamiento sólo se reconsideran con requisitos/volumen medidos.

## 9. P05 — Disponibilidad única, reservas atómicas y pagos íntegros

**Hallazgos:** F05, F07, F15, F16. **Dependencia:** P04. Esta fase completa el parche publicado en P00.

- [ ] **P05-01 — Formalizar invariantes y audiencias.** Libre implica estado canónico, ausencia de comprador en campos denormalizados y `cliente_id`, abono cero, ausencia de hold activo y política de asignación. Oficina excluye cualquier vendedor; el vendedor sólo oferta su stock libre si el contrato comercial lo permite. Documentar cualquier decisión pendiente sin ampliar permisos mientras se resuelve.
- [ ] **P05-02 — Aplicar una única regla en todas las lecturas y escrituras.** Listados iniciales/API, búsqueda, aleatorios, asignación, hold, reserva directa/GHL, importación, pago/liberación y booleano `disponible` del comprobante. Una validación de UI nunca sustituye la condición de UPDATE/constraint. Cubrir `cliente_id` legado y valores vacíos/espacios conservadoramente.
- [ ] **P05-03 — Separar el hold del timestamp de actualización.** Crear identificador/capacidad aleatoria de hold y `expires_at`; no usar un ISO predecible como secreto. Vincularlo a tenant, proyecto, vendedor/pool, grupo y actor/capacidad de compra. Confirmar/cancelar sólo ese hold vigente y autorizado, sin borrar abonos históricos.
- [ ] **P05-04 — Transaccionar la toma y confirmación grupal.** Implementar funciones/RPC transaccionales, con locks/UPDATE condicional y orden estable. La reserva de un grupo es completa o devuelve una semántica parcial explícita elegida y probada; no responde `success=true` si confirmó cero. Cliente/reserva/boletas/historial deben quedar coherentes tras timeout o fallo parcial. Registrar eventos para la outbox de P06 en la misma transacción.
- [ ] **P05-05 — Idempotencia de comandos de reserva/pago.** Identificar cada operación, guardar resultado y rechazar colisiones de payload. Reintentar el mismo comando no crea clientes, reservas o pagos duplicados. Probar duplicado, reordenamiento y retry después de una respuesta perdida.
- [ ] **P05-06 — Establecer fuente única de comprador y ledger de pagos.** Definir relación/snapshot coherentes; migrar representaciones antiguas con conciliación. Crear movimientos de abono/reversión con actor, referencia, monto, fecha e idempotencia; calcular/proyectar `valor_pagado` de forma transaccional. Bloquear monto negativo o borrado de pago por cambio a Disponible. Separar liberación, reasignación, cancelación y reversión financiera.
- [ ] **P05-07 — Ejecutar pruebas de carrera con Postgres real.** Dos compradores y dos tenants compitiendo por una misma boleta; grupos superpuestos; expiración simultánea con confirmación; cancelación repetida; webhook repetido; fallo entre cliente y boletas; pago durante hold. Afirmar sólo lo medido, conservar seed/commit/log anonimizados y verificar cero venta duplicada/cero pérdida de pago.

**Archivos principales:** `lib/boleta-availability.ts`, `lib/temporary-reservations.ts`, rutas public/admin de reserva, `actualizar-boleta`, `reservar-boleta`, `ghl-reserva`, asignaciones, importador, `/api/public/boleta`, migraciones y suite de integración.

**Salida:** los escritores comparten dominio/invariantes, grupos y dinero son coherentes y los escenarios de carrera pasan en DB real.

## 10. P06 — Integraciones por tenant, outbox y privacidad de formularios

**Hallazgos:** F04, F07, F08, F14, F21 y configuración de F22. **Dependencia:** P05.

- [ ] **P06-01 — Versionar el contrato de Sheets.** Enviar `empresa_id`, `proyecto_id`, número, estado/versión e ID del evento. Resolver destino y credencial desde configuración tenant, no desde un endpoint global ambiguo. Actualizar también Apps Script/hoja y confirmar compatibilidad; la corrección del payload sin receptor compatible no resuelve la colisión.
- [ ] **P06-02 — Crear outbox transaccional.** Persistir evento junto con el cambio de negocio. Worker con ack, reintentos/backoff, timeout, idempotencia, límite por tenant y cola de fallos. Evitar promesas sueltas o colas sólo en memoria de una función de Vercel. Evaluar la cola duradera disponible de Supabase antes de añadir infraestructura extra.
- [ ] **P06-03 — Evitar sync bloqueante en requests.** Confirmar la operación cuando DB/evento estén persistidos; entregar luego a Sheets/GHL. Mostrar al operador un estado de integración real y alertar backlog/fallos, sin convertir un error remoto en pérdida del cambio de DB. Definir semántica si el negocio exige entrega externa antes de algún paso.
- [ ] **P06-04 — Reconciliar integraciones.** Aplicar versiones para no sobrescribir estado reciente con un evento viejo, replay controlado, reparación y comparación periódica por tenant/proyecto. Probar números iguales en dos empresas, caída del receptor y entrega duplicada/desordenada.
- [ ] **P06-05 — Reducir PII en URLs del formulario.** Sustituir nombre/teléfono/ciudad en querystring por referencia opaca e intercambio autorizado cuando la integración lo permita. Si hay una restricción del formulario, documentar campos mínimos, TTL, redacción de logs y eliminación; no afirmar que el historial/referer queda protegido por ocultar visualmente el campo.
- [ ] **P06-06 — Actualizar workflows legítimos y runbook.** Versionar mapeos de GHL, headers/capacidades, IDs de evento, formularios y destino de Sheets por empresa. Probar alta/reserva/abono/error/reintento y rollback del contrato de ambos extremos.

**Archivos principales:** `lib/google-sheets-sync.ts`, webhooks GHL, `components/ProyectoVentaReservaClient.tsx`, configuración de integraciones, migrations/outbox y worker. Registrar también versión/hash de Apps Script y de configuración externa si no hay commit Git.

**Salida:** una boleta de A nunca actualiza la fila de B; fallos remotos quedan pendientes/reintentables y el inventario no espera llamadas secuenciales por número.

## 11. P07 — Paginación SQL, consultas e invalidación de caché

**Hallazgos:** F13 y costo de lectura/polling. **Dependencia:** P06.

- [ ] **P07-01 — Capturar planes de los diez patrones.** Obtener ranking real de `pg_stat_statements` y planes JSON en staging representativo. `explain-top10.sql` de la auditoría es una lista de candidatos, no el top real ni planes ejecutados. Para ANALYZE de lecturas, usar entorno aislado y revisar costo; no ANALYZE de DML en producción para medir.
- [ ] **P07-02 — Paginar el inventario en DB.** Reemplazar diez consultas por prefijo y ordenación de hasta 10.000 filas en JS por página/RPC con orden comercial estable y cursor. Conservar balance/aleatoriedad y “ver más” sin repetición; no reshuffle que cambie el orden entre páginas. No recalcular todos los grupos por cada búsqueda/page.
- [ ] **P07-03 — Reducir llamadas/filas con evidencia.** Objetivo inicial para el patrón Oficina: 12→2 llamadas y sólo las filas necesarias para la página. Medir nuevamente tráfico, p95, CPU/IO y errores en el mismo montaje; los objetivos no son un ahorro de factura certificado.
- [ ] **P07-04 — Separar lectura de limpieza de holds.** Vencimiento lógico se evalúa en la transacción; limpieza física en batch/job. Un GET de listado no debe hacer hasta 100 UPDATE y llamadas externas. Evitar reofertar un hold aún activo por retraso del worker.
- [ ] **P07-05 — Mejorar otras consultas.** Página real para la base admin; membresías/DISTINCT para proyectos de vendedor; `has_more`/keyset donde el conteo exacto no sea necesario; batch para oportunidades. Validar índices compuestos/parciales con planes y volumen. No añadir pg_trgm/partición por intuición.
- [ ] **P07-06 — Reusar datos iniciales y optimizar polling.** Evitar el fetch completo duplicado al montar; cursor de cambios, pausa de pestaña oculta y refresco al foco. Validar los monitores actuales de 3 s y el refresco de 15 s de PR34. Realtime sólo si compensa su complejidad/volumen.
- [ ] **P07-07 — Cachear metadata segura por scope.** Keys incluyen tenant/proyecto/audiencia/versión; TTL e invalidación comprobados al cambio. No cachear una autorización revocable de forma que sobreviva al reset ni usar caché como verdad del saldo/reserva. Si se cachea lectura de disponibilidad brevemente, el UPDATE atómico decide el éxito final.

**Archivos principales:** APIs públicas de boletas, páginas `/o`/`/p`, componentes de venta/monitores, `lib/project-sales-links.ts`, `lib/seller-sales-links.ts`, consultas admin y migraciones de índices/orden.

**Salida:** páginas y búsqueda correctas, sin boletas repetidas/ocupadas, con reducción medida y sin filtración por clave de caché.

## 12. P08 — Jobs de importación y exportación

**Hallazgos:** F06, F14 y cuellos de botella de CPU/memoria. **Dependencia:** P07. Se reutiliza la infraestructura duradera de P06.

- [ ] **P08-01 — Jobs de QR/códigos.** Endpoint autorizado crea job y devuelve ID/estado; worker genera por lotes y publica resultado en storage privado. Consultar progreso por tenant/actor y descargar con URL firmada de corta vida. Evitar construir todo el ZIP en la petición inicial.
- [ ] **P08-02 — Importación validada por lotes.** Límites de archivo, encoding/columnas/tipos, preview/dry-run y reporte por fila. Cargar staging/batch/RPC dentro del dominio, no un UPDATE por cada línea desde HTTP. Definir todo-o-nada o política parcial explícita, idempotencia y reconciliación.
- [ ] **P08-03 — Exportaciones de datos controladas.** Paginación/stream/job según volumen, alcance por rol, minimización de PII, registro de actor y caducidad de resultados. No crear URLs públicas permanentes a cartera.
- [ ] **P08-04 — Cuotas y recuperación.** Límites por tenant, concurrencia, tiempo, memoria, tamaños y retención. Cancelación/retry sin duplicar efectos; dead-letter y recuperación tras caída del worker. Probar lotes representativos, no extrapolar los diez QR del benchmark a 1.000.

**Salida:** jobs siguen siendo recuperables al terminar una función serverless; progreso y descargas respetan tenant/rol y la petición inicial no espera toda la generación.

## 13. P09 — Suite completa, observabilidad y onboarding

**Hallazgos:** F18, F22 y deuda de calidad. **Dependencia:** P08. Las pruebas críticas ya acompañaron a sus fases anteriores.

- [ ] **P09-01 — Consolidar pruebas por riesgo.** Unitarias de invariantes/validación; integración con Postgres/RLS/transactions; contratos GHL/Sheets; E2E de login embebido, compra, asignación, recibo y admin; restore y jobs. Coverage se mide con herramienta real y se publica por SHA; los tests del harness de auditoría no se cuentan como coverage de producto.
- [ ] **P09-02 — Reducir complejidad y duplicación.** Extraer casos de uso/repositorios y normalización compartida de las funciones de mayor riesgo: reasignación, venta/reserva, vendedores, asignación y GHL. Mantener comportamiento con regresiones; medir complejidad/clones con método declarado, sin perseguir una nota a costa de claridad.
- [ ] **P09-03 — Logs, métricas y audit trail.** Registrar request/event ID, tenant, actor, operación, resultado, latencia y commit/deployment; redactar PII/secretos. Eventos financieros y cambios de permisos con trazabilidad completa. Elegir sink y retención; alertar mutación rechazada, pago anómalo, conflictos, fallos de sync, backlog y exportación abusiva.
- [ ] **P09-04 — Configuración por empresa.** Sacar dominio, branding, proyecto comercial y destinos globales a configuración validada. Mantener la consulta de ganadores filtrada por empresa. Añadir runbooks de onboarding, roles, bootstrap, migración, incidentes, recuperación, integraciones y despliegue.
- [ ] **P09-05 — Medir incorporación de un desarrollador.** Checkout limpio→instalación→DB→fixtures→login→reserva controlada, sin datos de clientes. Objetivo inicial ≤60 min; registrar tiempo real, bloqueos y mejoras. Crear ADRs de decisiones de identidad/RLS, grupos de reserva, ledger, cola y orden de inventario.
- [ ] **P09-06 — Revisar tratamiento de datos.** Inventariar finalidad, campos, acceso, encargados, retención/exportación/eliminación y mecanismos de atención de titulares. Verificar TLS/cifrado/backups del proveedor con evidencia. Revisión jurídica de aplicabilidad y documentación; el código y esta memoria no certifican GDPR/Habeas Data.

**Salida:** otro desarrollador puede reproducir el producto; incidentes/operaciones críticas se reconstruyen sin exponer secretos o depender sólo del autor original.

## 14. P10 — Carga real, retest y publicación gradual

**Dependencia:** P09. Cierra la evidencia pendiente de la auditoría.

- [ ] **P10-01 — Fijar N y SLO.** Definir empresas, inventario por empresa, diez usuarios activos por tenant, mezcla lectura/reserva/pago, peak y región/plan. Proponer p95 lectura <500 ms, reserva <1 s, errores <1 % y cero accesos/ventas cruzadas; pactar objetivos antes del ensayo.
- [ ] **P10-02 — Carga sostenida en staging equivalente.** N=1,5,10 y N objetivo, con rampas y niveles de 20–30 min; búsquedas/pages, reservas superpuestas, pago/cancelación, GHL y exports con cuota. PostgreSQL real, no un sustituto en memoria. Guardar scripts, seed, configuración, SHAs y métricas sin PII.
- [ ] **P10-03 — Medir navegador e infraestructura.** TTFB, LCP/INP, latencia API, p50/p95/p99, CPU/RSS/event loop, IO/locks/conexiones, queries, cola, egress y costo por operación. Comparar antes/después y completar las métricas que quedaron pendientes por no disponer de Chromium/cloud en la auditoría.
- [ ] **P10-04 — Retest de seguridad.** Repetir PoC anónimos/cross-tenant, revocación, CSRF en navegador, abuso, SCA y secret scanning. No aceptar riesgo crítico/alto abierto de acceso; documentar los demás riesgos con dueño, plazo y compensaciones verificadas.
- [ ] **P10-05 — Ensayar restore/rollback y conciliación.** Recuperar DB/job/integración y verificar reserva/pagos/historial. Medir RPO/RTO contra objetivos, comprobar compatibilidad schema/código y que no se pierden operaciones recientes.
- [ ] **P10-06 — Rollout por cohortes.** Preview→staging→piloto→ampliación. Registrar SHA/deployment/domino, indicadores y condición de reversión en cada etapa. Sólo ampliar cuando los SLO y la conciliación se mantienen; actualizar este documento con cierre y backlog residual.

**Salida comercial:** autorización uniforme, integridad monetaria/inventario, aislamiento DB/servicios, sesiones revocables, jobs duraderos, entorno reproducible, restore y capacidad reales acreditados.

## 15. Cobertura de los 22 hallazgos

| Hallazgo | Corrección trazada en este plan | Estado inicial |
| --- | --- | --- |
| F01 Actualización anónima de estados/abonos | P01-01, P05-02/06 | Abierto |
| F02 Reserva sin autorización/scope vendedor | P01-02, P05-04/07 | Abierto |
| F03 PII en API pública | P01-04, P08-03, P09-06 | Abierto |
| F04 Oportunidades GHL sin firma | P01-03, P06-02/06 | Abierto |
| F05 Disponibilidad sólo por estado | P00, P05-01/02/07 | Corrección parcial en PR34, no publicada/verificada |
| F06 Exports anónimos y CPU/memoria | P01-05, P08-01/04 | Abierto |
| F07 Operaciones compuestas sin transacción | P05-04/05/07, P06-02 | Abierto |
| F08 Sheets sin namespace tenant | P06-01/04/06 | Abierto; efecto remoto no probado |
| F09 Sesión sobrevive reset | P03-01/02 | Abierto |
| F10 Falta de límites de abuso | P03-04/05, P08-04 | Abierto; WAF real por verificar |
| F11 Dependencias/advisories | P02-02 | Abierto; árbol desplegado por verificar |
| F12 Aislamiento dependiente de service role | P01-06, P04-05/06/07 | Abierto; policies/constraints reales por verificar |
| F13 Listado con 12 consultas/10.000 filas | P07-01/02/03/05/06/07 | Abierto |
| F14 Imports/sync secuenciales | P06-02/03, P08-02/04 | Abierto |
| F15 Hold predecible/validación/respuesta | P03-04, P05-03/04/07 | Abierto |
| F16 Modelo mixto cliente/pagos/estados | P04-04/05, P05-01/02/06 | Abierto |
| F17 Install/CI/rama sin gates | P00-03/04/06, P02-01/03/04/05/06 | Abierto |
| F18 Tests/observabilidad incompletos | Pruebas por fase, P02-04, P09-01/03 | Abierto |
| F19 Migraciones/restore sin evidencia | P04-01/02/03/07, P10-05 | Abierto |
| F20 Cookies/CSRF inconsistentes | P03-03, P10-04 | Abierto; exploit de navegador no probado |
| F21 PII en querystring | P06-05/06, P09-06 | Abierto |
| F22 Docs/config específica del cliente | P04-03, P06-01/06, P09-04/05 | Abierto |

Actualizar esta matriz al cerrar hallazgos con referencia a commit, pruebas y deployment; no cambiar “Abierto” sólo porque se escribió una propuesta.

## 16. Calendario y recursos de referencia

La auditoría estimó **320–480 horas-persona** para remediación y validación, no una cotización ni una medición. Este plan amplía el detalle y antepone explícitamente P00. El log real ya identifica una corrección inicial de configuración; estimar P00 después de verificar acceso al proyecto, entorno y nuevo build. No sumarlo dos veces si su trabajo ya pertenece al arreglo de entorno/disponibilidad de contención.

| Ventana orientativa desde 2026-10-05 | Enfoque | Referencia de la auditoría |
| --- | --- | --- |
| Antes de ampliar el trabajo | P00: variables Supabase, nuevo build y corrección verificada en producción | Duración por estimar con acceso y nuevo deployment |
| 5–9 oct. | P01/P02: contención y entorno/CI inicial | 48–64 h dentro del total original |
| 12–23 oct. | P03/P04/P05: identidad, tenant, dominio y DB | 80–120 h |
| 26 oct.–6 nov. | P06/P07/P08: integraciones, lecturas y jobs | 88–128 h |
| 9–20 nov. | P09 y preparación P10: pruebas, monitoreo, restore/carga | 80–120 h |
| 23–27 nov. | P10: retest, piloto y cierre | 24–48 h |

Son ventanas de planificación, no fechas comprometidas; recalcular después de P00, del schema real y de las decisiones de grupo/pagos. Los gates de fase prevalecen sobre el calendario.

Perfiles: senior Next/Supabase 200–280 h; DBA/Postgres 32–48 h; AppSec 24–40 h; QA 64–112 h. Coste monetario = horas reales por perfil × tarifa acordada + infraestructura. No se inventan tarifas ni ahorros de factura.

## 17. Bitácora histórica: añadir entradas, no borrar historia

### Registro 2026-10-02 / M-001 — Creación del plan y revisión del bloqueo

- **Tipo:** documentación y consulta de estado; no corrección de aplicación ejecutada en esta tarea.
- **Origen:** auditoría integral actual y petición de priorizar el commit sin publicar.
- **Aplicación auditada/main consultado:** `23dfededd0bbb19bd9372e53cc04d594f50811ce`.
- **Corrección existente:** `b3a00c764c1d4a8011574ac71b2fac16e06fa749`; PR #34; rama `fix/exclude-occupied-tickets`.
- **Hecho nuevo registrado:** el estado Vercel del commit es failure; el check de comentarios de preview es success. No son la misma validación.
- **Cambios de esta unidad:** plan detallado P00–P10, matriz F01–F22 y regla de lectura/actualización en `AGENTS.md`.
- **Archivos:** `docs/PLAN_DESARROLLO_PULSE.md`, `AGENTS.md`.
- **Rama documental:** `docs/plan-desarrollo-pulse`.
- **SHA de corrección funcional nueva:** no aplica; esta unidad no modificó la aplicación.
- **Commit documental / PR documental:** consultar historial de esta rama y PR asociado; su propio SHA no se autorregistra recursivamente.
- **Verificaciones:** lectura de la auditoría, consulta de main/PR/status/checks/comparación; revisión de estructura Markdown, cobertura de los 22 hallazgos y preservación de las reglas Next existentes.
- **Producción:** no se verificó SHA servido ni se publicó una corrección en esta unidad.
- **Bloqueo:** log de build de `dpl_8GDk9mWaeq1TaZavqSc31qriNKNQ` pendiente.
- **Siguiente acción concreta:** obtener y registrar el primer error de ese deployment en P00-02.

### Registro 2026-10-02 15:23 America/Bogota / M-002 — Causa del build confirmada por el log

- **Tarea/fase:** P00-02; bloqueo de publicación del parche F05.
- **Estado antes → después:** causa pendiente → diagnosticada; publicación continúa Bloqueada en P00-03.
- **Evidencia:** log de Vercel aportado por el usuario; checkout `fix/exclude-occupied-tickets` / `b3a00c7`; validación contrastada con `lib/supabase-admin.ts` del SHA completo `b3a00c764c1d4a8011574ac71b2fac16e06fa749`.
- **Causa:** falta de URL de Supabase en ese build; error al evaluar el módulo durante recopilación de `/api/admin/bootstrap`. No se comprobó aún la llave privada ni la configuración de Production.
- **Descartado como primer error fatal:** instalación, compilación, TypeScript y avisos de install scripts de Sharp/unrs-resolver. La desalineación de lockfile sigue como hallazgo separado, no como causa de este deployment.
- **Cambio de esta unidad:** actualizar panel, diagnóstico, P00-02/03/04, referencia de calendario y siguiente acción; guardar la diferencia entre configuración externa y commit de aplicación.
- **Archivos:** `docs/PLAN_DESARROLLO_PULSE.md`.
- **SHA nuevo de aplicación / migración / merge:** no aplica; no se modificó ni integró código.
- **Configuración Vercel / nuevo deployment / producción:** pendientes; no se cambiaron variables desde esta tarea.
- **Pruebas:** análisis del log y lectura del módulo exacto; no se ejecutó un nuevo build ni se verificó el dominio productivo.
- **Riesgo residual/bloqueo:** acceso y configuración del entorno de Vercel; posibilidad de una siguiente variable obligatoria ausente después de corregir la URL.
- **Siguiente acción concreta:** P00-03, revisar y configurar URL/credencial privada por entorno y rama, y generar un nuevo deployment del HEAD comprobado.

### Plantilla para la siguiente unidad

Copiar, completar con datos reales y añadir una nueva entrada cronológica:

```markdown
### Registro AAAA-MM-DD hh:mm America/Bogota / M-NNN — Título

- Tarea/fase y hallazgo: Pxx-yy; Fxx.
- Estado antes → después: ...
- Actor/responsable: ...
- Rama y commit base completo: ...
- Problema/objetivo: ...
- Cambio concreto: ...
- Archivos afectados: ...
- Decisión o contrato cambiado: ...
- Migración/config externa: identificador, versión, entorno y resultado; o no aplica.
- Pruebas: comando/escenario, entorno, SHA/árbol probado, resultado y evidencia anonimizada.
- Commit(s) de implementación, SHA completo: ...
- PR y SHA de merge/squash: ...
- Main verificado después de integrar: ...
- Deployment: ID, Preview/Production, SHA servido, dominio/alias y fecha; o pendiente.
- Verificación en producción: escenario, resultado y evidencia; o pendiente.
- Riesgo residual/bloqueo: ...
- Rollback: estrategia, commit de reversión y estado de datos; o no requerido.
- Siguiente acción concreta: ...
```

## 18. Checklist al retomar y al terminar una sesión

**Al retomar:** leer sección 1 y última entrada de bitácora; refrescar GitHub/DB/deployment relevante; respetar P00 como prioridad mientras no esté verificado en producción; elegir una sola siguiente tarea; registrar scope/base antes de editar.

**Al terminar:** actualizar estado y siguiente acción; registrar cambios, pruebas y commits reales; distinguir local/preview/main/producción; mantener la trazabilidad de migraciones y reversión; añadir entrada sin borrar registros anteriores.

**Fuera del plan inicial:** reescritura completa, Kubernetes, microservicio por módulo, SSO y base dedicada por tenant. Sólo añadirlos con una decisión registrada y evidencia de una necesidad que el diseño modular actual no pueda atender.
