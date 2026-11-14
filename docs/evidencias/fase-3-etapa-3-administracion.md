# Fase 3, etapa 3 — administración y catálogos aislados

Fecha: 13 de noviembre de 2026, Guatemala. Estado: implementación aislada terminada para revisión; **no activada contra PostgreSQL**. Se conserva la aceptación técnica de etapa 2 y sus pendientes: autenticación real, cookies en navegador y futura autorización de entorno.

## Alcance e inventario

Se implementaron institución propia, usuarios, perfiles docentes, estudiantes, grupos y asignaciones. Los casos de uso comparten `AdministrationService` y una unidad de trabajo transaccional; la política y las proyecciones están separadas del controlador y del adaptador Prisma. No existe endpoint para crear instituciones, borrar entidades, gestionar matrículas o restablecer administrativamente contraseñas.

| Archivos creados | Responsabilidad |
|---|---|
| apps/backend/src/modules/administration/ports.ts | Tipos de entidades y puertos transaccionales |
| apps/backend/src/modules/administration/policy.ts | Política ADMIN, actor vigente y proyecciones sin secretos |
| apps/backend/src/modules/administration/service.ts | Catálogos, último ADMIN, ETag, paginación, asignaciones, auditoría y revocación posterior al COMMIT |
| apps/backend/src/repositories/administration.ts | Adaptador Prisma institucional; bloqueos y filtros relacionales |
| apps/backend/src/http/controllers/administration.ts | Router HTTPS con sesión y CSRF; fábrica sin montaje automático |
| apps/backend/test/administration.test.ts | 13 pruebas agregadas, varias parametrizadas con matriz HTTP |
| apps/backend/test/helpers/administration.ts | Doble transaccional serializado con snapshot, rollback y datos sintéticos A/B |
| docs/fase-3-plan-validacion-real.md | Propuesta de ensayo real pendiente de autorización |
| docs/decisiones/ADR-006-administracion-aislada.md | Decisiones, garantías y límites |

Modificados: `src/infrastructure/database.ts` permite indicar aislamiento transaccional sin alterar el valor usado por los consumidores anteriores; `src/http/controllers/auth.ts` exporta el lector estricto de cookie existente; `src/http/errors.ts` añade conflictos y referencias inválidas; generador OpenAPI, prueba contractual, OpenAPI JSON, arquitectura, evaluación tecnológica y estado en AGENTS. No se instalaron dependencias ni se cambió el lockfile. Continúan las ocho alertas npm documentadas, sin audit fix ni nueva afirmación de auditoría limpia.

`server.ts` y `createApp` **no importan ni montan** administración. No hay bandera de entorno para activarla accidentalmente. El montaje se realiza exclusivamente en el ensayo HTTPS de `test/administration.test.ts`, con dobles. La fábrica del repositorio Prisma no abre conexiones al importarse y no se instanció contra ninguna base en este trabajo.

## Endpoints y matriz

Todas las rutas llevan `/api/v1`. GET admite HEAD sin cuerpo. Sin sesión: 401 en el ensayo. Todas las escrituras requieren ADMIN actual, HTTPS, Origin exacto y CSRF. Todos los identificadores institucionales y el actor proceden del servidor.

| Método y ruta | ADMIN | TEACHER |
|---|---|---|
| GET /institution | Perfil propio | Perfil propio mínimo |
| PATCH /institution | Editar nombre con If-Match | 403 |
| GET /me | Perfil propio | Perfil propio |
| GET /users; GET /users/{id} | Institución propia, sin hash | 403 |
| POST /users; PATCH /users/{id} | Alta y edición; protección último ADMIN | 403 |
| GET /teachers; GET /teachers/{id} | Institución propia | 403; identidad propia en /me |
| POST /teachers | Usuario activo TEACHER de la institución | 403 |
| GET /students; GET /students/{id} | Institución propia | Solo activos con episodio vigente en grupo asignado |
| POST /students; PATCH /students/{id} | Alta/edición/desactivación | 403 |
| GET /groups; GET /groups/{id} | Años habilitados | Solo asignación activa y años habilitados |
| POST /groups; PATCH /groups/{id} | Año configurado; año e identidad inmutables en PATCH | 403 |
| GET /me/assignments | 403, ruta específica docente | Asignaciones propias activas de años habilitados |
| GET /teachers/{id}/assignments/{groupId} | Consultar asignación y ETag | 403 |
| PUT /teachers/{id}/assignments/{groupId} | Crear con If-None-Match: *, editar con If-Match | 403 |

La lectura individual de asignación se añadió para recuperar el ETag sin tener que conservar una respuesta de escritura anterior. No cambia el esquema ni añade capacidad de administración fuera del módulo autorizado. La respuesta de creación incluye Location. Los GET individuales editables y las escrituras devuelven ETag; las colecciones usan `data` y `nextCursor`. El perfil /me no requiere ETag.

OpenAPI usa `x-implemented=true`, `x-tested=automated-doubles`, `x-runtime-enabled=false` y `x-postgresql-validated=false` para administración. Enumera las puertas pendientes. Para módulos futuros `x-implemented=false`. Las extensiones no significan que cada rama haya sido probada ni constituyen una prueba de PostgreSQL.

## Integridad, autorización y seguridad

1. La unidad de trabajo establece `app.institution_id` dentro de la transacción y usa **ReadCommitted explícito**. Bloquea primero la fila institucional `FOR UPDATE`; luego la fila del actor `FOR SHARE`; vuelve a leer y verificar estado, rol e identidad de autenticación antes del caso de uso. El valor del cliente nunca selecciona institución.
2. Las operaciones administrativas de una institución se serializan, incluidas lecturas, como decisión conservadora de laboratorio. El conteo de ADMIN activos se ejecuta después del bloqueo. Desactivar o degradar el último produce 409 `LAST_ADMIN`. No hay DELETE ni campo de borrado lógico alternativo. Esto depende de que los escritores sigan este protocolo; **no es una nueva restricción SQL que impida cambios manuales externos**.
3. If-Match se comprueba bajo el mismo bloqueo. Faltante: 428; mal formado: 400; obsoleto: 412. No hay columna version: persiste la limitación A→B→A del diseño aprobado. El ETag incluye institución, tipo y campos de la proyección, nunca hash de contraseña. POST no obtiene idempotencia nueva; conserva restricciones de unicidad de entidades cuando existen.
4. Actualización y AuditEvent están en la misma transacción. Los errores de auditoría o de COMMIT impiden responder éxito. La revocación de sesiones por cambio efectivo de rol/estado ocurre al resolverse la unidad de trabajo, **después** del COMMIT. El cambio de contraseña propio conserva el flujo de etapa 2, con revocación tras auditoría y COMMIT. No se agregó un reset de contraseña administrativo fuera del contrato.
5. TEACHER se verifica de nuevo en transacción. Los filtros de repositorio requieren usuario activo, rol TEACHER, asignación activa y año habilitado. Lectura estudiantil: estudiante activo y episodio `startsAt <= ahora < endsAt` (o fin abierto). Solo se consulta la relación existente; no se implementó CRUD de matrículas. La prueba real de esos filtros bajo RLS continúa pendiente.
6. Cursor HMAC de proceso ligado a institución, actor y recurso; orden por UUID, límite por defecto 50, máximo 100, consulta de una fila adicional. No refleja PII. Reiniciar invalida cursores, además de sesiones. No garantiza una fotografía histórica estable si el catálogo cambia entre páginas.
7. DTO estrictos impiden asignar tenant, actor, ID, passwordHash o campos extra. Contraseña inicial obligatoria sin valor predeterminado, hash Argon2id existente y sal aleatoria. Proyecciones por lista de campos; datos de contacto/nombres solo en las respuestas autorizadas, nunca en logs técnicos o auditoría. Los errores de unicidad y referencia son genéricos.
8. Teacher no tiene `active`; se utiliza la vigencia del usuario y la asignación. Group no tiene `active` y el año se controla con configuración del servidor. No se inventaron campos ni migraciones. La auditoría existente no permite before/after ni identificar íntegramente la clave compuesta de asignación: se registra acción `assignment.updated` y el docente como recurso; no se oculta esa limitación.

El diseño de bloqueos se contrastó con [PostgreSQL 18: bloqueos explícitos](https://www.postgresql.org/docs/18/explicit-locking.html). Las firmas de Prisma 7.10.1 se verificaron mediante tipos del cliente instalado y compilación. La página online de transacciones consultada redirigió a Prisma 8: **no se trasladó esa API al proyecto ni se actualizó Prisma**.

## Pruebas realmente ejecutadas

| Grupo | Resultado y límite |
|---|---|
| Matriz HTTP de lecturas y escrituras ADMIN/TEACHER | Satisfactoria con HTTPS real y repositorio doble |
| Altas, edición, auditoría, referencias, duplicados | Satisfactorias con entidades sintéticas |
| Instituciones A/B y sesión/cursor ajenos | Rechazados; sin consultas PostgreSQL |
| Usuario inactivo/asignación inactiva | Acceso y alcance rechazados |
| Cuerpos manipulados, CSRF ausente, encabezados tenant/rol | Rechazados sin escrituras |
| Dos solicitudes concurrentes de reducción de ADMIN | 200 + 409; permanece un ADMIN en el doble serializado |
| Dos PATCH con ETag idéntico | 200 + 412; no sobrescritura en el doble |
| Auditoría y COMMIT fallidos | Rollback de datos; sin revocación prematura |
| Rol/estado confirmado | COMMIT precede revocación; token previo rechazado |
| Cambio de contraseña y auditoría fallida | Hash y sesión conservados tras rollback; éxito posterior revoca |
| Respuestas, logs y auditoría | Sin passwordHash, contraseña ni cookie/token; proyecciones explícitas |
| Adaptador Prisma con doble | Contexto, SQL parametrizado, ReadCommitted, filtros y auditoría inspeccionados; no ejecución SQL real |
| Rutas en servidor habitual | No montadas; ensayo devuelve 404 |
| TypeScript backend/frontend | Satisfactorio |
| Build backend y generación OpenAPI | Satisfactorios |
| Suite backend completa | **50/50**: 37 anteriores + 13 nuevas |
| Suite frontend | **16/16** |

Comandos ejecutados desde raíz (las pruebas requieren leer el certificado local privado preparado en etapa 2):

```powershell
git status --short
npm.cmd run openapi -w apps/backend
npm.cmd run typecheck -w apps/backend
npm.cmd run test -w apps/backend
npm.cmd run typecheck -w apps/frontend
npm.cmd run test -w apps/frontend
Get-FileHash apps/backend/prisma/schema.prisma
Get-ChildItem apps/backend/prisma/migrations/*/migration.sql | Get-FileHash
```

La suite usa Node test/Supertest y Vitest frontend. Ejecución bajo la cuenta local autorizada para evitar el fallo conocido de tsx en el ejecutor restringido y acceder al certificado con ACL privada. No se instalaron certificados, no se cambiaron sus permisos durante esta etapa y no se ejecutó navegador. No se ejecutaron comandos Prisma contra una base. La prueba histórica de migración usa comparación SQL local, no una migración.

Checksums preservados:

| Artefacto | SHA-256 |
|---|---|
| schema.prisma | 61cc948e724be0258637b8c48ea4d7bf6868453c466465b8119eccacb39a66bf |
| migración inicial | dc3a10d34f0d795fabe8ca6f769ccbc54c8e04ba655dc582b6f366a417a471bd |
| migración correctiva | 4fd264537d9399f122b709c0368c51744c7344be03ed0802b671855cb29a6f2b |

## Incidencias y aceptación pendiente

No hubo pruebas fallidas en las ejecuciones de esta etapa. Git muestra el proyecto previo como no rastreado; se preservó el contenido existente y no se creó historial, commit ni push. Los avisos y estados históricos de AGENTS/roadmap que limitaban el trabajo a etapas anteriores se interpretan conforme a la autorización expresa actual, sin declarar otras fases concluidas.

Incidencia documental: AGENTS y evaluación tecnológica contenían fragmentos finales Windows-1252 mezclados con UTF-8, lo que impidió aplicar el parche. Se normalizaron esos fragmentos a UTF-8 conservando el texto antes de actualizar el estado. Python no estaba disponible; se utilizó Node para la conversión. No afectó al código ni a las pruebas.

La concurrencia probada es del servicio sobre un doble serializado, **no de dos conexiones PostgreSQL**. El doble contiene relaciones de matrícula sintéticas de solo lectura; no implementa ni demuestra RLS, triggers o integridad física. El adaptador compilado necesita ensayo real de consultas, permisos, bloqueos, colisiones y rollback, según [plan independiente](../fase-3-plan-validacion-real.md).

Antes de activar: autorización del entorno aislado, aprovisionamiento ficticio revisado, validación real de auth/RLS/cambio de contraseña y auditoría, cookies en navegador, bloqueo del último ADMIN entre conexiones, recuperación ante fallos y revisión de las ocho alertas npm. La serialización amplia debe medirse antes de escalar. No se desarrolló etapa 4 ni se modificaron principal, sandbox, biometría o frontend. Recomendación: aceptar el alcance aislado probado, conservando la activación bloqueada.
