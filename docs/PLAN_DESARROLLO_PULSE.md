# Plan de desarrollo y memoria de Pulse

> Documento operativo: leerlo antes de modificar Pulse y actualizarlo con cada cambio funcional, migración, prueba relevante, commit de implementación, integración, despliegue o reversión.
>
> **Prioridad inicial: desbloquear el build, integrar la corrección de disponibilidad del PR #34 y verificarla en producción.** Las demás fases se ejecutan en el orden de este documento.
>
> **Flujo autorizado desde 2026-10-02 15:58 America/Bogota:** validación local → `main` → build de **Production** en Vercel → verificación en producción. El usuario no utiliza Preview ni autoriza crear otro proyecto Supabase para esta publicación. Esta decisión sustituye el requisito anterior de configurar/verificar Preview.

## 1. Estado actual: empezar a leer aquí

| Campo | Estado registrado |
| --- | --- |
| Repositorio | [SFrancoH/pulse](https://github.com/SFrancoH/pulse) |
| Rama vigente de esta memoria | `main`; historial documental original en `docs/plan-desarrollo-pulse` |
| PR documental de origen | [#35 — Plan de desarrollo y memoria operativa](https://github.com/SFrancoH/pulse/pull/35), cerrado/merged por incorporación de su historial en `e4165c58751ebb928930323f37da9b42c2d098a2` |
| Commit inicial de la memoria | `3b966483ffa103c9fa914af3e6e36a4b0228540c`; los cambios documentales posteriores se consultan en el historial Git |
| Creación y última revisión de esta versión | 2026-10-02, zona horaria America/Bogota |
| Último checkpoint de ejecución | 2026-10-02 17:44 America/Bogota; preparación P01-01/02 integrada en main y build Vercel success; activación de las rutas pendiente de configuración manual |
| Flujo de publicación | Local → main → Production → verificación; Preview no aplica |
| Fuente | Auditoría técnica integral de Pulse, 2026-10-02, 31 páginas; hallazgos F01–F22 |
| Versión auditada | `23dfededd0bbb19bd9372e53cc04d594f50811ce` |
| Main de integración funcional verificado | `726f99f5251940fe7b6e38e46bc428eda11c40cd`; commits documentales posteriores se consultan en el historial del archivo |
| Último commit de corrección conocido | `b3a00c764c1d4a8011574ac71b2fac16e06fa749` |
| Rama de esa corrección | `fix/exclude-occupied-tickets` |
| PR de corrección | [#34 — Excluir boletas con cliente o abonos de la disponibilidad](https://github.com/SFrancoH/pulse/pull/34) |
| Estado del PR #34 | **Integrado** el 2026-10-02; commit de merge `726f99f5251940fe7b6e38e46bc428eda11c40cd` |
| Estado de integración de GitHub | `merged=true`; SHA y árbol de main comprobados después del merge |
| Build histórico de la rama/Preview descartado | **Vercel: failure** por URL Supabase ausente; no corresponde al nuevo build de main |
| Build del merge funcional | **Vercel: success**, SHA `726f99f5251940fe7b6e38e46bc428eda11c40cd`; [deployment completado](https://vercel.com/soy-sebastian-franco-s-projects/pulse/HK2CZgTuz6Lg8xuLKCLXMYu2ipJk) |
| Último deployment de main comprobado | **Vercel: success**, SHA `fcbfd1590e19702a14780ef04db52af59d11c37b`; [deployment de preparación completado](https://vercel.com/soy-sebastian-franco-s-projects/pulse/9cTFQYj6qfX555BtEddwjK3SJNjc). Los checkpoints posteriores sólo documentales se consultan en Git |
| Check `Vercel Preview Comments` | Success: sólo confirma que no hay comentarios pendientes; no confirma un build correcto |
| Check `Supabase Preview` | Skipped: no detectó cambios en el directorio `supabase` |
| Deployment fallido identificado | `dpl_8GDk9mWaeq1TaZavqSc31qriNKNQ` |
| SHA y dominio efectivo de producción | Comprobación manual confirmada por el usuario; SHA del último build observado `570cf77acd8d3de461b1c632963a1b91e946c7db`. No se proporcionó el dominio exacto ni una captura del SHA servido |
| Fase activa | `P01` — autorización de mutaciones y protección de datos públicos |
| Última evidencia recibida | «listo que seria lo siguiente ?», 2026-10-02 17:23 America/Bogota, respuesta al procedimiento de Production/ventas |
| Paso siguiente | `P01-01/02` — preparar autorización de actualizar/reservar y configurar credenciales de workflows antes de activarla |
| Bloqueo actual | P00 sin bloqueo. La activación de P01 necesita configurar Vercel/GHL y recibir confirmación manual del usuario |
| Regresión local del parche | 7/7 pruebas con fixtures; fuentes probadas verificadas por hash contra `b3a00c764c1d4a8011574ac71b2fac16e06fa749`; no acredita build, DB real ni producción |
| Confirmación manual del usuario | P00 confirmado con «listo»; evidencia declarada por el usuario, no una prueba independiente automatizada. No se solicitan de nuevo Preview ni otro Supabase |
| Preparación de P01 | Integrada en main, commit `fcbfd1590e19702a14780ef04db52af59d11c37b`; 26/26 pruebas, TypeScript y lint de archivos nuevos correctos; Vercel success. Las rutas todavía no consumen el guard |
| Cambios de aplicación realizados al crear este plan | Ninguno; se creó la documentación y la regla de mantenimiento de la memoria |

**Conclusión y evidencia:** la corrección `b3a00c764c1d4a8011574ac71b2fac16e06fa749` se integró por PR #34 en `726f99f5251940fe7b6e38e46bc428eda11c40cd`, y la memoria por PR #35 en `e4165c58751ebb928930323f37da9b42c2d098a2`. Vercel completó también el build documental `570cf77acd8d3de461b1c632963a1b91e946c7db`. La respuesta «listo» del usuario confirma el procedimiento solicitado de Production/alias y disponibilidad; P00 se cierra con esa evidencia manual. No se inventan dominio, boletas concretas, capturas, prueba de compra completa ni pruebas independientes de DB/navegador.

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
| Preview verificado | Estado histórico/opcional; fuera del flujo autorizado actual y no es un gate de publicación |
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
5. **Antes de integrar:** revisar los checks del HEAD exacto y las pruebas locales. Preview no se usa: registrar su fallo de configuración como entorno descartado, sin llamarlo build de Production. Un check verde de comentarios tampoco sustituye al build. Registrar PR y dependencias; comprobar el build efectivo de Production después de integrar.
6. **Después de integrar:** registrar SHA de implementación y SHA de merge/squash por separado. Confirmar que `main` contiene el cambio y actualizar el panel.
7. **Después de desplegar:** registrar deployment ID, entorno, SHA publicado, dominio/alias observado, fecha y pruebas en producción. Si el deployment falla, cambiar a Bloqueado y conservar el error real.
8. **Al cerrar una sesión de trabajo:** dejar la fase y tarea activas, lo ya implementado, lo aún no publicado, bloqueos y una siguiente acción concreta. No dejar sólo “continuar mañana”.

**Evitar la circularidad del hash:** un archivo no puede contener el SHA del mismo commit que lo crea y mantener ese SHA. Esta memoria registra SHAs de **implementaciones ya existentes** y merges conocidos. Los commits exclusivamente documentales se consultan en el historial Git del archivo; no requieren otro commit recursivo para registrar su propio hash.

**Diferenciar dos hashes cuando corresponda:** un deployment puede incluir un commit posterior sólo de documentación. Registrar tanto el SHA servido por Vercel como el SHA de la corrección funcional incluida en su historial.

**Cambios de datos:** además del commit Git, registrar archivo/versión de migración, entorno, fecha de ejecución, resultado, validación de constraints y procedimiento de reversión. Una migración escrita no equivale a una migración aplicada.

**Higiene del registro:** no guardar contraseñas, claves, cookies, tokens de ventas, teléfonos o payloads reales de compradores. Usar referencias al sistema autorizado y fixtures anonimizados.

### 2.3 Ubicación y continuidad

Este archivo, `docs/PLAN_DESARROLLO_PULSE.md`, es la memoria operativa versionada. `AGENTS.md` debe indicar su lectura y actualización obligatorias. Cada PR funcional debe tocar esta memoria o justificar en su revisión por qué no cambia el estado del plan.

Las referencias posteriores a staging/DB aislada se ejecutan como entorno local o efímero con PostgreSQL real y datos de prueba, sin crear un proyecto Supabase adicional. No convertir las pruebas de migración, restore o carga en ensayos destructivos sobre la DB productiva. La equivalencia con Vercel/Supabase cloud debe medirse y sus límites documentarse.

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

**Prioridad:** primera. **Estado:** Verificado en producción por confirmación manual del usuario; cerrado el 2026-10-02 17:23 America/Bogota. **Hallazgos:** F05 y bloqueo de despliegue. **Rama inicial:** `fix/exclude-occupied-tickets`.

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
- [x] **P00-03 — Verificar la configuración de Production.** Preview queda descartado por el usuario. Publicar desde main con la configuración de Production existente y comprobar el nuevo build. El status del main previo es success, pero no sustituye esa comprobación. Si el build productivo informa una variable ausente, pedir al usuario que configure la URL/llave privada del Supabase activo en Settings → Environment Variables → Production y esperar confirmación antes del redeploy/verificación. Registrar la configuración externa sin valores privados; no modificar `lib/supabase-admin.ts` para ocultar un error real.
- [x] **P00-04 — Resolver el bloqueo de publicación.** El árbol del parche se reconstruyó y verificó localmente; Vercel completó instalación/build de main. No se hizo install/build limpio local. Esa comprobación de reproducibilidad se traslada explícitamente a P02-01; no se atribuye a P00 una prueba que no se ejecutó.
- [x] **P00-05 — Repetir la regresión de disponibilidad.** Ejecutar `node --test tests/availability.test.mjs` sobre el HEAD candidato. Verificar listado, búsqueda exacta, contiene, boletas iniciales y hold; un nombre, teléfono o abono excluyen la boleta. Oficina excluye vendedor asignado. El enlace de vendedor conserva únicamente su stock libre, conforme a la política comercial documentada. Comprobar refresco/pestaña en navegador. Las siete pruebas de fixture no sustituyen a Postgres ni a la prueba de navegador.
- [x] **P00-06 — Verificar código y build del SHA exacto.** Ejecutar regresión y TypeScript localmente, comprobar el árbol del parche y distinguir herramientas/dependencias existentes de una instalación limpia. El log de b3a00c7 ya acredita compilación y TypeScript en Vercel antes de fallar por una variable de Preview. Después de integrar, exigir build exitoso de Production para el SHA de main; no sustituirlo por pruebas locales ni por un check de comentarios. Repetir checks si cambia código y registrar lint preexistente como deuda pendiente.
- [x] **P00-07 — Integrar el PR y registrar ambos commits.** Incorporar a `main` el parche verificado localmente, por autorización del usuario para publicación directa. Guardar SHA de implementación, SHA de merge/squash y enlace al PR. No esperar un Preview que el usuario descartó; confirmar que el build de Production arranca para el SHA integrado. El merge por sí solo no cierra P00.
- [x] **P00-08 — Verificar el deployment de producción.** Comprobar proyecto, Production Branch, entorno y SHA en Vercel. Verificar que el alias/dominio que usan compradores apunta al deployment nuevo, y revisar respuesta efectiva sin usar como evidencia sólo la pantalla del PR. Registrar deployment ID, SHA y dominio; si `main` no dispara publicación, revisar integración/branch/configuración y resolver el mecanismo de deployment existente.
- [x] **P00-09 — Comprobar el comportamiento en producción.** Revisar mediante lecturas autorizadas que boletas con nombre, teléfono, abono o vendedor no aparecen en Oficina, incluyendo búsqueda y “ver más”. Para una compra/reserva completa, usar proyecto y boletas de prueba controlados; no alterar compradores o pagos reales para probar. Confirmar que la integración vigente conserva sus llamadas legítimas. Registrar evidencia anonimizada, fecha y resultado.
- [x] **P00-10 — Cerrar P00 y actualizar esta memoria.** Marcar Verificado en producción; guardar SHAs, pruebas y deployment. Dejar `P01-01` como siguiente acción. Si hay regresión, revertir el código de forma controlada y documentar que un rollback no restaura automáticamente datos modificados durante el intervalo.

### P00-03 — Procedimiento vigente para Production

La instrucción de las 15:58 cancela la espera de Preview registrada en M-004. La integración por main está autorizada. No pedir al usuario que cree otro Supabase ni que repita el deployment de la rama de preview.

1. Integrar el parche validado en main y consultar el status Vercel del SHA resultante.
2. Si Production falla por URL/llave ausente, abrir Pulse → Settings → Environment Variables, seleccionar **Production** y verificar `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_URL`, más una llave privada válida del Supabase activo bajo los aliases aceptados. No reemplazar credenciales existentes válidas ni enviar sus valores al chat.
3. Para una operación manual, proporcionar al usuario el error y los pasos concretos, dejar estado Bloqueado y esperar su confirmación.
4. Después de confirmar una corrección externa, reconstruir el SHA de main para Production. Registrar ID/URL, SHA, estado y dominio/alias activo.
5. Confirmar el comportamiento del listado/búsqueda en la página de ventas mediante lecturas autorizadas. Para una prueba de reserva que escribe datos, usar únicamente boletas/proyecto de prueba controlados; no alterar compradores o pagos reales.

No ejecutar el procedimiento histórico siguiente; se conserva sólo para explicar M-004.

### Procedimiento anterior de Preview — cancelado, sólo histórico

**Responsable de esta acción:** usuario con acceso a Vercel/Supabase. **Estado:** Bloqueado, esperando confirmación. No hay acceso disponible desde esta sesión para editar las variables de ese proyecto. El usuario pidió explícitamente instrucciones y una pausa cuando fuera necesaria una operación manual.

1. Abrir el proyecto [Pulse en Vercel](https://vercel.com/soy-sebastian-franco-s-projects/pulse), entrar en **Settings → Environment Variables** y revisar **Preview**, incluidos valores específicos de la rama `fix/exclude-occupied-tickets`.
2. En el Supabase destinado a pruebas/preview, copiar la URL desde **Connect** y consultar la llave privada existente en **Settings → API Keys**. URL y llave deben pertenecer al mismo proyecto. Si sólo existe una DB de producción, detenerse aquí e informarlo para preparar el entorno de prueba antes de vincular sus credenciales.
3. En Vercel, agregar/corregir `NEXT_PUBLIC_SUPABASE_URL`, o conservar `SUPABASE_URL` si es el nombre válido existente. Verificar una llave privada bajo `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY` o `SUPABASE_SECRET_KEY`, según el tipo y nombre ya usado. El código prioriza esos aliases en ese orden: no dejar un alias anterior con credencial de otro proyecto. Una llave pública/anon no sustituye la privada.
4. Aplicar los valores al entorno **Preview** y, para esta entrega, a la rama `fix/exclude-occupied-tickets`. Mantener la configuración de Production independiente. Guardar los cambios; no enviar llaves por chat ni registrarlas en Git.
5. Antes de probar login, verificar que Preview tiene `ADMIN_SESSION_SECRET` o `ADMIN_SECRET` de al menos 24 caracteres. Conservar el secreto correcto si ya existe; si falta, establecer un secreto aleatorio propio del entorno de pruebas, usando un generador de contraseñas. No rotar el secreto productivo como parte de este paso.
6. En **Deployments**, abrir el deployment fallido de la rama `fix/exclude-occupied-tickets` / commit `b3a00c7`, ejecutar **Redeploy** y esperar su resultado. Este paso es un nuevo build de Preview; no un merge ni una promoción a Production. Registrar URL del nuevo deployment, entorno, commit y estado.
7. Confirmar por chat que se guardaron las variables y se ejecutó el redeploy. Enviar sólo URL del deployment y estado **Ready** o **Error**; si falla, adjuntar el primer error nuevo con secretos ocultos.

**Condición histórica para reanudar:** confirmación explícita del usuario más revisión del nuevo build. Este gate de Preview quedó cancelado por la instrucción de las 15:58; la espera manual sólo vuelve a aplicar si es necesaria una operación concreta de Production.

**Verificación realizada al cerrar P00:** `node --test tests/availability.test.mjs` pasó 7/7 y `tsc --noEmit` terminó con exit 0 sobre el árbol exacto del parche `42bce74aa4786428d4aad5602d64ff6368a47798`. Vercel completó los builds de main y el usuario confirmó el procedimiento de Production/ventas. No se ejecutó una instalación limpia local; reproducibilidad se completa en P02. PostgreSQL real, concurrencia y recorridos automatizados de navegador siguen pendientes en sus fases; no se presentaron los fixtures como esas pruebas.

Referencias: [configuración de variables](https://vercel.com/docs/environment-variables/managing-environment-variables), [alcance por entorno y rama](https://vercel.com/docs/environment-variables), [llaves de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

### Archivos del parche ya preparado

El PR contiene 17 archivos: `lib/boleta-availability.ts`, `tests/availability.test.mjs`, `lib/temporary-reservations.ts`, los componentes `ProyectoVentaClient` y `ProyectoVentaReservaClient`, páginas `/o`, `/p` y ventas admin, y las rutas de listado/aleatorios/reserva/asignación/GHL. Revisar la comparación fijada de la sección 1.1 antes de cambiar el alcance.

### Criterio de salida y límite de este parche

El build exitoso, la integración y la verificación del dominio deben estar acreditados por separado. El PR #34 no soluciona por sí solo F01/F02/F03/F04, las transacciones grupales, el campo legado `cliente_id` ni todos los escritores de estado. Esos puntos se atienden en las fases siguientes.

**Referencia operativa:** [variables y alcance por entorno/rama en Vercel](https://vercel.com/docs/environment-variables) y [gestión de variables](https://vercel.com/docs/environment-variables/managing-environment-variables), consultadas el 2026-10-02. Los valores se aplican a deployments nuevos; la bitácora debe registrar la modificación externa y su deployment posterior.

## 5. P01 — Cerrar acceso no autorizado y exposición de compradores

**Hallazgos:** F01, F02, F03, F04, F06 y parte de F12. **Dependencia:** P00 verificado.

**Estado P01-01/02:** preparación verificada local, integrada en main `fcbfd1590e19702a14780ef04db52af59d11c37b` y build Vercel success; guard y contrato descritos en [P01_WEBHOOKS.md](P01_WEBHOOKS.md). La conexión del guard a los handlers y la remediación efectiva siguen pendientes. Configurar `PULSE_PROJECT_WEBHOOK_KEYS` en Vercel Production y Bearer en los workflows legítimos, confirmar por chat y luego activar por main. No declarar F01/F02 cerrados por tener helpers sin uso.

- [ ] **P01-01 — F01: proteger `actualizar-boleta`.** Inventariar quién la llama: panel o integración. Para panel, exigir sesión, rol y acceso al proyecto mediante `lib/require-admin.ts`. Para integración, exigir credencial/firma limitada a tenant y proyectos autorizados. Derivar el contexto en servidor; no usar `empresa_id` recibido como permiso. Denegar anónimo, vendedor sin facultad y empresa ajena antes de construir la consulta. Validar transición y monto; quitar eco de payload y errores DB crudos.
- [ ] **P01-02 — F02: proteger `reservar-boleta`.** Aplicar el mismo contrato de actor/tenant, conservar condición de estado en el UPDATE y exigir ámbito de vendedor o pool Oficina. Comprobar que un secreto de A tampoco puede reservar en B. No reemplazar autenticación por un ID de proyecto conocido. Documentar cómo se actualiza el workflow legítimo antes de retirar un contrato legado.
- [ ] **P01-03 — F04: autenticar `oportunidades-ghl`.** Usar firma del cuerpo original y timestamp/ID de evento si la integración puede emitirlos. Si no, usar una credencial por integración vinculada en servidor a su tenant/proyectos y un ID idempotente. Eliminar el matching ambiguo por primer nombre/teléfono como identidad de operación; vincular por reserva/evento validado. Rechazar eventos ajenos, vencidos o inválidos sin mutar boletas.
- [ ] **P01-04 — F03: minimizar `/api/public/boleta`.** El QR/UUID público debe devolver sólo datos comerciales mínimos y enmascarados. Reservar nombre/teléfono completo y cartera detallada para actor autorizado o una capacidad específica, limitada y revocable de comprobante. Revisar el listado legado que expone UUIDs. Mantener útil la lectura de QR ya impresos sin convertir el UUID en permiso para ver PII. Añadir `Cache-Control: no-store` a respuestas sensibles.
- [ ] **P01-05 — F06: proteger QR y códigos de barras.** Añadir guard de administrador del proyecto a `generar-qr` y `generar-barcodes`, validar rango/cantidad y un límite inicial de recursos. No permitir exportación anónima ni de proyecto ajeno. La conversión a jobs duraderos corresponde a P08; el cierre de autorización es inmediato.
- [ ] **P01-06 — Revisar las 33 APIs y páginas servidor.** Clasificar cada una como privada por rol, integración autenticada o pública por capacidad. Registrar actor, tenant, campos permitidos y tablas. Asegurar que rutas nuevas no heredan “pública” por omisión del guard. Añadir `server-only` a módulos privilegiados que carezcan de él, en particular `lib/supabase-admin.ts`.
- [ ] **P01-07 — Regresión negativa por superficie.** Probar sin cookie/credencial, empresa A→B, vendedor A→B, vendedor sin facultad, token revocado y requests legítimos en fixtures/DB aislada local. Esperar 401/403 según contrato; comprobar DB intacta tras rechazo y ausencia de PII pública. Después de main, verificar en producción con alcance controlado; no ensayar PoC de escritura anónima sobre compradores reales.

**Archivos principales:** `lib/require-admin.ts`, `lib/supabase-admin.ts`, `app/api/proyectos/[proyectoId]/{actualizar-boleta,reservar-boleta,oportunidades-ghl,generar-qr,generar-barcodes,boletas-disponibles}/route.ts`, `app/api/public/boleta/route.ts`, comprobantes y consumidores de integración.

**Salida:** cerrar los PoC de acceso de la auditoría y mantener la operación autorizada de GHL/panel. Registrar el commit y deployment de cada parche urgente.

## 6. P02 — Dependencias, entorno reproducible y CI mínima

**Hallazgos:** F11, F17 y base de F18. **Dependencia:** P01 cerrado. El arreglo mínimo de instalación que necesitara P00 se conserva; aquí se completa el control del entorno.

- [ ] **P02-01 — Fijar herramientas y manifests.** Documentar Node/npm soportados, regenerar un lockfile completo, instalar con `npm ci` desde cero y verificar que el lock no cambia durante CI. Separar variables de desarrollo/staging/producción; crear `.env.example` sin valores privados.
- [ ] **P02-02 — Actualizar componentes vulnerables.** Repetir SCA sobre el árbol instalable, comprobar advisories primarios y actualizar Next y `eslint-config-next` de forma coordinada; actualizar Sharp y transitivas según compatibilidad. La auditoría de 2026-10-02 proponía Next 16.3.8 y Sharp 0.35.5: verificar esos objetivos al ejecutar, sin tratar versiones históricas como “la última”. Registrar lockfile, SBOM y avisos cerrados/alcanzabilidad restante. No usar `audit fix --force` sin revisar el diff.
- [ ] **P02-03 — Resolver los dos errores de lint.** Corregir hooks/flujo de carga en la página `reasignar-numero` y en `OpportunityErrorRecovery`; revisar warnings por riesgo y comportamiento. No desactivar reglas globales para obtener un check verde. Ejecutar TypeScript, lint y build del árbol limpio.
- [ ] **P02-04 — Instalar la CI inicial.** En PRs: install limpio, TypeScript, lint, pruebas de disponibilidad/autorización ya incorporadas, SCA y build. Separar fixtures de datos privados. Los tests añadidos en cada fase entran a este pipeline.
- [ ] **P02-05 — Hacer exigible la memoria.** Añadir gate que exija actualización de `docs/PLAN_DESARROLLO_PULSE.md` cuando un PR cambia aplicación, tests de producto, schema/migraciones, dependencias, configuración de deploy o CI. Admitir sólo excepciones documentadas y revisadas; no exigir autorregistro recursivo a commits puramente documentales.
- [ ] **P02-06 — Proteger `main`.** Exigir revisión y checks de calidad/build sobre el HEAD actual dentro del flujo local/CI → main → Production; no hacer obligatorio Preview mientras no se use. Verificar qué automatiza Supabase, porque un check skipped no prueba schema ni migraciones. Configurar protección desde interfaz/API autorizada si el conector no dispone de administración.

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
- [ ] **P10-06 — Rollout por cohortes.** Validación local/DB aislada → main/Production → piloto por tenant → ampliación. Registrar SHA/deployment/dominio, indicadores y condición de reversión en cada etapa. Preview no es requisito; cambiar el alcance de cohortes/configuración de forma controlada. Sólo ampliar cuando SLO y conciliación se mantienen; actualizar cierre y backlog residual.

**Salida comercial:** autorización uniforme, integridad monetaria/inventario, aislamiento DB/servicios, sesiones revocables, jobs duraderos, entorno reproducible, restore y capacidad reales acreditados.

## 15. Cobertura de los 22 hallazgos

| Hallazgo | Corrección trazada en este plan | Estado inicial |
| --- | --- | --- |
| F01 Actualización anónima de estados/abonos | P01-01, P05-02/06 | Abierto |
| F02 Reserva sin autorización/scope vendedor | P01-02, P05-04/07 | Abierto |
| F03 PII en API pública | P01-04, P08-03, P09-06 | Abierto |
| F04 Oportunidades GHL sin firma | P01-03, P06-02/06 | Abierto |
| F05 Disponibilidad sólo por estado | P00, P05-01/02/07 | Corrección parcial integrada, Vercel success; comprobación de ventas pendiente |
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

### Registro 2026-10-02 15:34 America/Bogota / M-003 — Memoria versionada y verificada

- **Tipo/estado:** documentación publicada en rama GitHub; PR #35 en borrador, pendiente de integración. P00 continúa Bloqueado en P00-03.
- **Commit inicial:** `3b966483ffa103c9fa914af3e6e36a4b0228540c`; rama `docs/plan-desarrollo-pulse`; [PR #35](https://github.com/SFrancoH/pulse/pull/35).
- **Archivos versionados:** `docs/PLAN_DESARROLLO_PULSE.md` y `AGENTS.md`.
- **Validación documental:** 18 secciones, 71 tareas con IDs únicos y secuenciales, 22 hallazgos cubiertos, cercas Markdown balanceadas y reglas Next originales preservadas. Contenido remoto del commit inicial comprobado contra los archivos locales.
- **Estado refrescado:** `main` permanece en `23dfededd0bbb19bd9372e53cc04d594f50811ce`; PR #34 abierto, no integrado, HEAD `b3a00c764c1d4a8011574ac71b2fac16e06fa749`.
- **Aplicación/DB/Vercel:** sin cambios ejecutados en esta unidad; sin pruebas de runtime ni publicación de la corrección.
- **Cambio documental posterior:** esta entrada y enlaces del panel registran el commit inicial y el PR ya existentes; su commit propio se obtiene del historial del archivo.
- **Siguiente acción concreta:** P00-03, corregir configuración del entorno de Vercel y generar un nuevo deployment; después continuar P00-04–10 antes de P01.

### Registro 2026-10-02 15:43 America/Bogota / M-004 — Inicio de ejecución y espera de configuración manual

- **Tarea/fase:** P00-03; comprobación independiente de P00-05.
- **Estado antes → después:** bloqueo diagnosticado → ejecución iniciada y Bloqueado esperando acción/confirmación manual del usuario.
- **Instrucción del usuario:** ejecutar el plan; explicar cualquier proceso manual y esperar su confirmación antes de continuar con el trabajo dependiente.
- **Memoria de entrada:** archivo adjunto leído desde la copia local; contenido idéntico al plan remoto del commit documental `d1a36deec2bfe612b747894fb238b5aea7aad4c7`.
- **Estado remoto verificado:** `main=23dfededd0bbb19bd9372e53cc04d594f50811ce`; PR #34 abierto, HEAD `b3a00c764c1d4a8011574ac71b2fac16e06fa749`; status Vercel failure y mismo deployment fallido. PR #35 sigue en borrador.
- **Pruebas ejecutadas:** `node --test tests/availability.test.mjs` → 7 pruebas, 7 pass, 0 fail. Comprueba listado/búsqueda Oficina, stock de vendedor y rechazo de hold para boletas ocupadas con fixtures.
- **Integridad de las fuentes:** SHA de blob local/remoto coincidente para test, filtro, reservas temporales, dos rutas públicas, `package.json` y `package-lock.json`. No se supone que el checkout completo o sus dependencias sean una instalación limpia.
- **Entorno de la prueba:** Node 24.19.0; TypeScript 5.9.3; Supabase JS 2.117.2. DB/red simuladas; no se modificaron compradores ni pagos.
- **Cambio de esta unidad:** checkpoint, resultado y alcance de las pruebas, instrucciones manuales, responsable, condición de pausa y siguiente acción.
- **Archivos modificados:** `docs/PLAN_DESARROLLO_PULSE.md`. No se modificó código de aplicación.
- **Rama/commit base de documentación:** `docs/plan-desarrollo-pulse` / `d1a36deec2bfe612b747894fb238b5aea7aad4c7`; PR #35. El commit de este checkpoint se obtiene del historial del archivo.
- **SHA funcional que continúa pendiente:** `b3a00c764c1d4a8011574ac71b2fac16e06fa749`; no hay nueva implementación funcional.
- **Migración/configuración externa/deployment:** ninguno ejecutado en esta sesión. Variables, nuevo build, merge y producción pendientes.
- **Bloqueo:** configuración de Preview de Vercel requiere acción manual; confirmación del usuario no recibida.
- **Rollback:** no requerido para runtime/DB; esta unidad sólo añade documentación y ejecuta fixtures.
- **Siguiente acción concreta:** usuario realiza el procedimiento P00-03 y confirma URL/resultado; después revisar el build del commit exacto y completar P00-04/05/06 antes de integrar.

### Registro 2026-10-02 16:08 America/Bogota / M-005 — Flujo corregido a main directo y parche validado

- **Tarea/fase:** P00-04/05/06/07.
- **Decisión del usuario:** no usa Preview porque ocupa recursos/proyecto; publicar directamente desde main. La espera anterior de M-004 queda cancelada para Preview, sin afirmar que se configuraron sus variables.
- **Estado:** En curso; listo para integrar el parche con comprobaciones locales y verificar después el build de Production.
- **Base de aplicación:** main `23dfededd0bbb19bd9372e53cc04d594f50811ce`; corrección/PR #34 `b3a00c764c1d4a8011574ac71b2fac16e06fa749`.
- **Estado Vercel previo:** main tiene status success, deployment `3DFgLumWDTV7fQKs59L7vvcXoubn`. Es evidencia de un build previo, no confirmación del nuevo SHA ni del dominio servido.
- **Revisión del parche:** 17 archivos; sin migraciones, cambio de credenciales ni modificación de schema. Conserva un filtro de nombre/teléfono/abonos y alcance de Oficina/vendedor; el restante F05 se completa en P05.
- **Integridad:** reconstruido en worktree aislado el árbol exacto `42bce74aa4786428d4aad5602d64ff6368a47798`, idéntico al commit remoto del parche.
- **Pruebas:** `node --test tests/availability.test.mjs` → 7/7 pass; `./node_modules/.bin/tsc --noEmit` → exit 0.
- **Alcance de validación:** Node 24.19.0, Next 16.2.4, TypeScript 5.9.3, Supabase JS 2.117.2, dependencias existentes. No se realizó una instalación limpia ni una prueba con DB real. El log b3a00c7 aportado por el usuario acredita compilación/TypeScript en Vercel y el fallo posterior de variable en el entorno descartado.
- **Documentación cambiada:** flujo local→main→Production, retirada del gate de Preview, procedimiento manual condicional para Production, pruebas y seguimiento. Conservada la historia M-001–004 y los 22 hallazgos.
- **Archivos documentales:** `docs/PLAN_DESARROLLO_PULSE.md`, `AGENTS.md`; base del historial de memoria `e66abbcba7644da16e32281823e2a7859f2e5584` / PR #35.
- **Integración/deployment nuevo:** pendientes en este checkpoint; no marcar publicados hasta obtener evidencia.
- **Operación manual:** ninguna exigida ahora; si el build de Production falla por variables, explicar el proceso en Production y esperar confirmación.
- **Siguiente acción concreta:** integrar PR #34 por su SHA exacto, registrar el merge en la memoria e incorporar el plan a main; consultar build y solicitar la comprobación visual de ventas si no puede verificarse desde esta sesión.

### Registro 2026-10-02 16:11 America/Bogota / M-006 — Corrección integrada en main

- **Tarea/fase:** P00-07, seguida de P00-08.
- **Estado:** Integrado en main; build Vercel pending. No se declara Desplegado/Verificado en producción.
- **Autorización:** instrucción del usuario de publicar directamente desde main, sin Preview.
- **Implementación:** `b3a00c764c1d4a8011574ac71b2fac16e06fa749`, PR #34.
- **Merge real:** `726f99f5251940fe7b6e38e46bc428eda11c40cd`; método merge con HEAD esperado para evitar integrar un parche diferente del probado.
- **Main y árbol verificados:** `726f99f5251940fe7b6e38e46bc428eda11c40cd` / `42bce74aa4786428d4aad5602d64ff6368a47798`; mismo árbol del parche comprobado localmente.
- **Pruebas previas:** 7/7 disponibilidad con fixtures y TypeScript exit 0, registradas en M-005. No se repiten por cambios sólo documentales.
- **Deployment observado:** [Vercel HK2CZgTuz6Lg8xuLKCLXMYu2ipJk](https://vercel.com/soy-sebastian-franco-s-projects/pulse/HK2CZgTuz6Lg8xuLKCLXMYu2ipJk); contexto Vercel pending, “Vercel is deploying your app”. Entorno y alias no expuestos por ese status.
- **Memoria en main:** se incorporan plan y AGENTS con el historial documental previo como segundo padre del commit de documentación. Sólo se actualiza main; no se exige otra publicación de Preview.
- **DB/variables externas:** no se cambiaron ni se hicieron pruebas sobre compradores reales.
- **Estado P00-07:** integrado; el checkbox final queda abierto conforme al criterio de verificación en producción de la sección 2.1.
- **Rollback de aplicación:** revertir el merge del parche sobre el main vigente si hay una regresión; verificar el build/alias después. No deshace automáticamente cambios de datos concurrentes.
- **Siguiente acción concreta:** esperar/comprobar status del main vigente; si falla por variables, explicar el proceso manual de Production y esperar confirmación; si termina, verificar entorno/alias y listado/búsqueda de ventas antes de P01.

### Registro 2026-10-02 16:18 America/Bogota / M-007 — Builds de main completados; espera de comprobación visual

- **Tarea/fase:** P00-06/08/09.
- **Estado:** Integrado en main y deployment completado según Vercel; Verificado en producción sigue pendiente.
- **Implementación/merge:** `b3a00c764c1d4a8011574ac71b2fac16e06fa749` / `726f99f5251940fe7b6e38e46bc428eda11c40cd`, PR #34 merged.
- **Main con memoria:** `e4165c58751ebb928930323f37da9b42c2d098a2`; PR #35 cerrado con merged=true al incorporar su historial. Plan/AGENTS remotos verificados byte a byte contra los archivos locales.
- **Build funcional:** contexto Vercel success, “Deployment has completed”; [HK2CZgTuz6Lg8xuLKCLXMYu2ipJk](https://vercel.com/soy-sebastian-franco-s-projects/pulse/HK2CZgTuz6Lg8xuLKCLXMYu2ipJk).
- **Build con memoria:** contexto Vercel success, “Deployment has completed”; [8KG3wtidCZrZ9S4ADkjoMy2rSmsi](https://vercel.com/soy-sebastian-franco-s-projects/pulse/8KG3wtidCZrZ9S4ADkjoMy2rSmsi).
- **Resultado del cambio de flujo:** no fue necesario configurar Preview ni crear un proyecto Supabase. No se atribuye al build de Production la ausencia de URL de la rama anterior.
- **Limitación:** el status GitHub no expone entorno Production ni alias efectivo, y no se dispone de sesión/datos para comprobar visualmente la venta habitual. No se usaron credenciales de compradores ni se alteraron sus registros.
- **Cambio de esta unidad:** registrar builds success y cerrar el bloqueo de compilación; abrir la espera manual concreta de entorno/alias y disponibilidad.
- **Archivo modificado:** `docs/PLAN_DESARROLLO_PULSE.md`; el commit de este checkpoint es sólo documental y se obtiene del historial Git. Puede generar otro build del mismo código funcional; verificar su status sin repetir pruebas de aplicación sin causa.
- **Procedimiento manual:** usuario abre el deployment vigente de main en Vercel y confirma Environment=Production / Ready y dominio habitual; luego recarga ventas y comprueba que una boleta con nombre/teléfono/abono o vendedor asignado no aparece como disponible en Oficina ni en búsqueda, y que una libre sí aparece. En enlaces de vendedor se conserva sólo su stock libre según el contrato comercial.
- **Confirmación requerida:** pendiente; compartir resultado y, si hay fallo, número de prueba y mensaje sin datos personales. No ejecutar cambios de código/DB de P01 mientras esta comprobación de P00 esté pendiente.
- **Siguiente acción concreta:** esperar confirmación del usuario, registrar dominio/escenarios/resultado, cerrar P00-08/09/10 si corresponde y comenzar P01-01.

### Registro 2026-10-02 17:23 America/Bogota / M-008 — P00 confirmado e inicio de P01

- **Tarea/fase:** cierre P00-03–10; inicio P01-01/02, F01/F02.
- **Evidencia manual:** el usuario respondió «listo que seria lo siguiente ?» al procedimiento de verificar Production/Ready, dominio habitual y exclusión de boletas ocupadas. Se acepta como confirmación del procedimiento; no se recibieron dominio exacto, números, capturas ni resultado de una compra completa.
- **Estado P00:** Verificado en producción por confirmación manual; cerrados publicación y defecto de disponibilidad de PR #34. No equivale a cerrar todos los escritores ni los hallazgos F01/F02/F16.
- **Estado remoto al retomar:** main `570cf77acd8d3de461b1c632963a1b91e946c7db`, árbol `c02272e7e5892c3bdb5ecb6cd25eb701d3657b06`; fuente local reconstruida con ese árbol exacto, preservando los worktrees anteriores.
- **Implementación funcional P00 / merge:** `b3a00c764c1d4a8011574ac71b2fac16e06fa749` / `726f99f5251940fe7b6e38e46bc428eda11c40cd`.
- **Build más reciente observado:** Vercel success en main `570cf77acd8d3de461b1c632963a1b91e946c7db`, deployment [8nbKoxLYQqHLiifcrSMERks1rYKv](https://vercel.com/soy-sebastian-franco-s-projects/pulse/8nbKoxLYQqHLiifcrSMERks1rYKv).
- **Límites conservados:** 7 pruebas de disponibilidad con fixtures y TypeScript correctos; sin instalación limpia local, EXPLAIN/DB real, carga ni prueba automatizada de navegador. La reproducibilidad local se verifica en P02.
- **Inventario P01:** no hay llamadas internas del frontend a `actualizar-boleta`/`reservar-boleta`. `app/api/crear-proyecto/route.ts` genera sus URLs y `app/admin/crear-proyecto/page.tsx` las muestra como webhooks de integración. Los workflows reales de GHL no son visibles desde el repositorio; se requiere comprobación/configuración manual.
- **Problema confirmado:** ambas rutas mutan con service role sin autenticar al remitente. `reservar-boleta` toma la empresa del body; `actualizar-boleta` devuelve payloads y errores crudos. La credencial global de `/api/ghl-reserva` pertenece a otra ruta y no protege éstas.
- **Unidad prevista:** autorización de administrador por sesión o credencial privada vinculada al proyecto; empresa derivada del proyecto en servidor; validación de monto/estado y respuestas sin eco de PII. Reserva conserva UPDATE condicional y distingue Oficina/stock del vendedor identificado.
- **Archivos previstos:** guard compartido, validación del payload, pruebas de autorización, ambas rutas, runbook de configuración y esta memoria. La autenticación de `oportunidades-ghl` se ejecuta en P01-03; no se declara corregida en esta unidad.
- **Publicación:** sólo main, sin Preview ni otro proyecto Supabase. No activar un contrato que rechace al workflow legítimo hasta completar y confirmar la configuración manual necesaria.
- **Siguiente acción concreta:** preparar y probar el guard y el contrato, entregar los pasos de Vercel/GHL; esperar confirmación antes de activar las rutas en main.

### Registro 2026-10-02 17:40 America/Bogota / M-009 — Preparación probada de autorización; espera de configuración GHL

- **Tarea/fase y hallazgos:** preparación P01-01/02, F01/F02; pruebas iniciales de P01-07. Las tres tareas siguen abiertas hasta conectar/verificar los handlers.
- **Base:** main `570cf77acd8d3de461b1c632963a1b91e946c7db`, árbol `c02272e7e5892c3bdb5ecb6cd25eb701d3657b06`.
- **Estado antes → después:** inventario de callers completado → preparación Verificada local, activación Bloqueada esperando configuración/confirmación manual. Publicación de la preparación en main pendiente al escribir esta entrada; no equivale a activar la protección.
- **Archivos nuevos:** `lib/project-webhook-auth.ts`, `lib/boleta-webhook-payload.ts`, `tests/project-webhook-auth.test.mjs`, `tests/helpers/webhook-harness.mjs`, `docs/P01_WEBHOOKS.md`. Archivo actualizado: esta memoria.
- **Guard:** administrador mediante sesión y guard vigente; integración mediante Bearer distinto por proyecto, validado antes de consultar proyecto/boletas; empresa derivada del proyecto activo en DB. Una credencial A no sirve en B; configuración malformada, débil o duplicada falla cerrado. No usar credencial de otro endpoint, token de ventas ni tenant del body como permiso.
- **Validación preparada:** aliases de campos GHL y formularios; número de 1–4 dígitos sin truncamiento; estados conocidos; montos finitos no negativos, con formatos COP explícitos. No declara corregidas aún las transiciones históricas de negocio de P05 ni rutas que no usan esta validación.
- **Contrato/rotación:** registro privado inicial `PULSE_PROJECT_WEBHOOK_KEYS` sin migración DB. Cambiar/borrar una entrada requiere deployment nuevo para afectar la configuración activa. Registro persistente/scopes/replay/idempotencia permanecen en P06/P01-03; no se atribuyen a este helper.
- **Pruebas:** `node --test tests/project-webhook-auth.test.mjs`: 26 pass, 0 fail; escenarios anónimo, rol vendedor, empresa ajena, key cruzada/revocada, configuración inválida/reutilizada, origen ajeno, proyecto inactivo, error DB sin detalle, formatos de payload/número/estado/monto y camino legítimo. `tsc --noEmit`: exit 0. Lint de los cuatro archivos nuevos de código/pruebas: exit 0.
- **Entorno de pruebas:** Node 24.19.0, dependencias existentes de P00; SDK Supabase real con transporte simulado y registros ficticios. Auth de proyecto/rol ejecuta `lib/require-admin.ts`; la resolución de cookie/usuario se simula. No acredita DB/PostgREST reales, RLS, concurrencia, UI, métricas de producción, instalación limpia ni cobertura total. No se repite disponibilidad porque sus fuentes no cambiaron.
- **Comprobación de publicación segura:** los handlers `actualizar-boleta`/`reservar-boleta`, consumidores y esquema permanecen idénticos al main base. Sólo se preparan módulos todavía no importados por esas rutas. Se mantiene compatible el workflow existente durante la configuración; F01/F02 continúan expuestos hasta la activación.
- **Configuración externa/DB:** no ejecutada desde esta sesión, sin acceso directo a Vercel/GHL/Supabase; no se generaron ni compartieron credenciales reales. No hace falta Preview ni un proyecto adicional.
- **Acción manual:** seguir `docs/P01_WEBHOOKS.md`: inventariar todas las acciones de las dos rutas, ID exacto, clave aleatoria exclusiva, variable privada de Production, Bearer en GHL, mapeo del ID estable de vendedor si aplica y confirmación sin secretos. Fuentes primarias de HighLevel consultadas y enlazadas en el runbook.
- **Bloqueo/razón:** activar ahora rechazaría workflows legítimos sin header. El usuario exigió explicación y espera ante procesos manuales; sólo se publica la preparación, no se retira el contrato legado todavía.
- **Siguiente acción concreta:** recibir confirmación de Vercel/GHL y del mapeo de vendedor si aplica; reconciliar HEAD; conectar el guard y filtros tenant/seller a ambos POST, ejecutar negativos sobre handlers completos, actualizar memoria y publicar por main. Después comprobar Vercel y requests controlados; continuar P01-03.

### Registro 2026-10-02 17:44 America/Bogota / M-010 — Preparación P01 integrada en main y build completado

- **Tarea/fase:** preparación P01-01/02; espera de configuración y activación. F01/F02 continúan abiertos.
- **Commit de implementación real:** `fcbfd1590e19702a14780ef04db52af59d11c37b`; padre `570cf77acd8d3de461b1c632963a1b91e946c7db`.
- **Árbol probado y publicado:** `7d535482dd0f873ebe4653633780513aa84492a4`; identidad local/remota comprobada antes de publicar. Seis archivos de preparación/memoria; ningún handler ni schema cambió.
- **Integración:** actualización de main sin force y con comprobación del HEAD esperado; flujo directo autorizado por el usuario, sin push de otra rama ni Preview. Código, pruebas y memoria en una misma unidad de commit; sin PR nuevo ni SHA de merge separado.
- **Pruebas:** 26/26 del guard/parser; TypeScript y lint acotado exit 0, descritos en M-009. No se repiten por este checkpoint puramente documental. Se comprobaron cercas Markdown y cierre de los diez ítems P00 con límites de evidencia explícitos.
- **Deployment de esta implementación:** contexto Vercel success, “Deployment has completed”, [9cTFQYj6qfX555BtEddwjK3SJNjc](https://vercel.com/soy-sebastian-franco-s-projects/pulse/9cTFQYj6qfX555BtEddwjK3SJNjc), SHA `fcbfd1590e19702a14780ef04db52af59d11c37b`. El status GitHub no expone el alias/entorno; la confirmación manual P00 correspondía al deployment anterior. No se afirma una prueba productiva de autorización aún inactiva.
- **Qué sigue pendiente:** configurar la variable privada de Production y headers de GHL; confirmar ID estable de vendedor cuando se reserve su stock; conectar el guard y probar los handlers completos; verificar nuevo deployment y contrato efectivo.
- **Datos/credenciales externas:** sin modificación ni lectura de registros reales; configuración manual no confirmada. No se necesita redeploy manual para esta preparación ni otro proyecto Supabase.
- **Memoria:** este checkpoint registra el SHA funcional de preparación ya existente; su propio commit documental se consulta en Git, evitando autorregistro recursivo.
- **Rollback:** retirar la preparación no cambia datos ni el contrato activo; las rutas todavía conservan el comportamiento anterior. No usar un bypass anónimo cuando se active la protección.
- **Siguiente acción concreta:** el usuario realiza los pasos de `docs/P01_WEBHOOKS.md` y confirma Vercel/GHL sin compartir claves. Esperar esa respuesta antes de activar las rutas en main; después ejecutar el paso de activación y seguir P01-03.

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

**Al terminar:** actualizar estado y siguiente acción; registrar cambios, pruebas y commits reales; distinguir local/main/desplegado/verificado en producción; mantener trazabilidad de migraciones/reversión y la decisión de no usar Preview; añadir entrada sin borrar registros anteriores.

**Fuera del plan inicial:** reescritura completa, Kubernetes, microservicio por módulo, SSO y base dedicada por tenant. Sólo añadirlos con una decisión registrada y evidencia de una necesidad que el diseño modular actual no pueda atender.
