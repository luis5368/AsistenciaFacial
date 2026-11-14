# Ensayo controlado PostgreSQL — Fase 2

**Aceptación técnica del responsable (13 de noviembre de 2026):** aceptadas las
correcciones y las 52/52 comprobaciones de sandbox. La anomalía temporal ficticia
heredada se conserva documentada y sin modificar. Se autorizó preparar, no ejecutar,
la migración a principal: véase el [plan y nueva puerta de autorización](../fase-2-plan-migracion-principal.md).
El diagnóstico posterior de solo lectura confirma principal vacía; la suite de
integración de sandbox no se volvió a ejecutar en esta preparación.

## Resultado vigente — corrección y validación final en sandbox

Fecha local: 13 de noviembre de 2026 (evidencias UTC del 14 de noviembre).
Esta sección sustituye las conclusiones bloqueantes y los pendientes de baselining
del historial inferior, que se conserva como trazabilidad. **52/52 comprobaciones
reales de integración satisfactorias**, incluidas las regresiones del ensayo
original. El defecto `CORRECTION_WITHOUT_ATTENDANCE_UPDATE` queda resuelto en
`localhost:5432/asistencia_facial_sandbox`. Esto no autoriza migrar la principal
ni declara concluida la Fase 1.

### Cambios aplicados y alcance

- Se conservó intacta la migración inicial y se aplicó únicamente la
  [migración correctiva adicional](../../apps/backend/prisma/migrations/20261114000000_corrections_enrollment_episodes/migration.sql).
- Asistencia, corrección y auditoría se comprueban en ambos sentidos mediante
  triggers diferidos: deben representar la misma transición, versiones, actor y
  transacción. Se rechazan correcciones o auditorías aisladas, estados incoherentes,
  auditorías ausentes y una segunda transición de la misma asistencia en una transacción.
- PostgreSQL asigna el identificador completo de transacción; el cliente no puede
  usarlo para fabricar una transición. Los historiales anteriores se preservaron.
- Matrículas por episodios con intervalos `[inicio, fin)`, fin opcional; se admiten
  episodios contiguos, se rechazan solapamientos para el mismo estudiante y grupo.
  Cada asistencia queda vinculada al episodio mediante FK institucional compuesta.
- El control concurrente serializa las matrículas mediante actualización sin cambio
  de valor del estudiante padre. READ COMMITTED rechaza el solapamiento con `23P01`;
  REPEATABLE READ puede devolver `40001`, que requiere reintentar la transacción
  completa. No se instaló ninguna extensión. Esta serialización por estudiante
  tiene un coste de contención que deberá medirse con carga representativa.
- Se impiden nuevas asistencias fuera del período y cambios de período que dejen
  fuera asistencias históricas. Se mantienen RLS, unicidad activa e idempotencia.

El [esquema Prisma](../../apps/backend/prisma/schema.prisma) refleja los nuevos
campos y relaciones. `schema.initial.prisma` conserva la instantánea para verificar
la migración original. Los contratos manuales v1 conservan su hash: la selección
del episodio corresponde al servidor por institución, estudiante, grupo y fecha;
no se añadió un identificador aportado por el cliente ni un endpoint definitivo.

### Evidencia y resultados

| Verificación ejecutada | Resultado real |
| --- | --- |
| [Integración final](ensayo-postgresql-correcciones-resultados.json), ejecución `f31d3b73-519d-4866-9013-53dec478d208` | 52 aprobadas, 0 fallidas |
| RLS con app y migrador, dos instituciones, contexto ausente y pool reutilizado | Aislamiento y limpieza del contexto comprobados |
| UUID y asistencia activa duplicados; carreras concurrentes | Una confirmación y un rechazo; sin duplicación |
| Corrección legítima con auditoría, incluso inserción diferida antes del UPDATE | Confirma; conserva coherencia |
| Corrección aislada, auditoría aislada, estados/actor incorrectos y segunda transición | Rechazo y rollback comprobados |
| Correcciones concurrentes/versiones obsoletas | Una transición confirma; la otra queda obsoleta |
| Episodios históricos, límites temporales y concurrencia | Contiguos aceptados; solapamientos y fechas fuera del episodio rechazados |
| DDL y modificación/borrado de historiales con app | Denegados; pruebas DDL del propietario revertidas |
| Pruebas unitarias backend | 16/16 aprobadas |
| Pruebas automatizadas frontend existentes | 16/16 aprobadas; frontend sin modificaciones |
| Prisma validate/generate, TypeScript y compilación backend | Código de salida 0 |
| [Replay inicial](prisma-replay-initial.json), [candidato](prisma-replay-candidate.json) y [final](prisma-replay-final.json) | Correspondencia física verificada |
| [Modelo Prisma](prisma-replay-model.json) y [diff nativo final](prisma-diff-final.sql) | Sin diferencias; diff exit 0 |
| [Historial Prisma](prisma-baseline-resultados.json) | Dos migraciones, checksums correctos, status exit 0; app sin acceso al historial |

Inventario final del dominio: **14 tablas, 98 columnas, 20 FK, 12 CHECK,
41 índices, 9 triggers de usuario, 8 funciones, 14 políticas RLS y 6 enums
(14 valores)**. Las 14 tablas mantienen ENABLE/FORCE RLS. Aparte existe
`_prisma_migrations`, tabla técnica: 15 tablas físicas en total. El inventario
JSON incluye otras restricciones PostgreSQL, como NOT NULL y PK; no confundir
su total con el de CHECK.

La idempotencia se probó con PostgreSQL, Prisma y funciones de dominio; no es
una validación HTTP de endpoints de asistencia, todavía no implementados.
Los datos del ensayo son ficticios. No se utilizaron imágenes ni embeddings.

### Conservación y anomalía histórica pendiente

Se compararon inmediatamente antes/después de aplicar la correctiva los hashes
del contenido previo: **2 matrículas, 3 asistencias, 1 corrección y 1 auditoría
sin alteración de sus campos originales**. Véanse [antes](preservation-before.json)
y [después](preservation-after.json). Las nuevas columnas se excluyeron de esa
comparación; los ensayos posteriores añadieron sus propios datos ficticios.

Se detectó **1 asistencia ficticia heredada fuera de su período**: el ensayo
anterior había cerrado su matrícula en junio conservando una asistencia de
noviembre. Se vinculó a su episodio original y se preservó, sin inventar fechas
ni limpiar datos silenciosamente. El conteo anterior a la migración no estaba
medido (`null`); el posterior es 1. Esta anomalía permanece para revisión y no
debe interpretarse como un conjunto histórico completamente saneado. Las nuevas
escrituras sí están protegidas. Antes de una migración sobre datos existentes,
se necesita una prevalidación temporal y una decisión explícita de remediación
si aparecen casos equivalentes; este ensayo no autoriza corregirlos en principal.

### Baselining Prisma 7.10.1 comprobado

Se reprodujeron las migraciones desde vacío en un esquema temporal **dentro de
una transacción de la misma sandbox**, comparando tablas, tipos, índices,
restricciones, definiciones de funciones, triggers y políticas. Se hizo ROLLBACK
y se comprobó la ausencia del esquema temporal. El replay no ejecutó una
instalación en otra base ni requirió shadow database. La reproducción SQL está
comprobada; no se afirma haber ejecutado `migrate deploy` sobre una base nueva.

Solo después de comprobar la correspondencia se ejecutaron mediante la CLI:

```text
prisma migrate resolve --applied 20261113000000_initial_review
prisma migrate resolve --applied 20261114000000_corrections_enrollment_episodes
prisma migrate status
```

Los tres comandos terminaron con código 0. Ambas filas tienen `finished_at`,
`rolled_back_at=null` y `applied_steps_count=0`, correspondiente al registro de
migraciones ya aplicadas mediante baselining. No se insertaron filas manualmente.
Una segunda ejecución del verificador omitió ambos resolve y confirmó status 0,
sin duplicar historial; el JSON conserva esta última comprobación.

| Migración | SHA-256 del SQL aplicado y registrado |
| --- | --- |
| Inicial | `dc3a10d34f0d795fabe8ca6f769ccbc54c8e04ba655dc582b6f366a417a471bd` |
| Correctiva | `4fd264537d9399f122b709c0368c51744c7344be03ed0802b671855cb29a6f2b` |

La única configuración de Prisma carga `.env.sandbox` explícitamente cuando
`PRISMA_SANDBOX=1`. La variable privada `SANDBOX_MIGRATION_DATABASE_URL` se valida
para localhost, puerto 5432, migrador y nombre de sandbox exactos; solo admite
el parámetro opcional `schema=public`. Los errores de validación no revelan la
URL. El archivo está excluido de Git, no se imprimió ni se modificó su contenido.
psql/pg usan autenticación local disponible sin leer manualmente pgpass.

### Comandos ejecutados y reproducción

Desde la raíz del repositorio, con credenciales locales previamente preparadas:

```powershell
node apps/backend/scripts/sandbox/verify-replay.mjs
node apps/backend/scripts/sandbox/preservation.mjs
node apps/backend/scripts/sandbox/verify-replay.mjs --candidate
& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -w -h localhost -p 5432 -U asistencia_migrator -d asistencia_facial_sandbox -v ON_ERROR_STOP=1 -P pager=off -f apps/backend/scripts/sandbox/apply-corrective.sql
node apps/backend/scripts/sandbox/preservation.mjs --after
node apps/backend/scripts/sandbox/verify-replay.mjs --final
node apps/backend/scripts/sandbox/verify-replay.mjs --model
node apps/backend/scripts/sandbox/integration-v2.mjs
node apps/backend/scripts/sandbox/baseline.mjs --record
npm.cmd run prisma:validate -w apps/backend
npm.cmd run prisma:generate -w apps/backend
npm.cmd run test -w apps/backend
npm.cmd run typecheck -w apps/backend
npm.cmd run build -w apps/backend
```

**No repetir la aplicación SQL ni los snapshots de preservación:** el script
de aplicación rechaza una sandbox ya corregida y los snapshots corresponden
al instante de migración. `integration-v2.mjs` añade escenarios ficticios;
`verify-replay.mjs --final` revierte su esquema temporal. El verificador de
baseline comprueba destino, replay, checksums y estado antes de registrar y
se detiene ante un historial inesperado. No usar estos scripts contra principal.

Para repetir el diff nativo, desde `apps/backend`, establecer
`$env:PRISMA_SANDBOX='1'` y ejecutar
`npx --no-install prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code`;
retirar después la variable. Durante el ensayo se capturó la salida SQL solo
tras éxito, sin publicar la salida sensible de configuración.

### Incidencias y límites

- La CLI no autenticaba con la URL sin contraseña aunque pg/psql sí utilizaban
  pgpass. Se resolvió con la variable privada configurada por el usuario.
- La URL incluía `schema=public`: la primera guardia lo rechazó; se admitió
  expresamente solo ese parámetro y se agregaron tres pruebas de destino y
  confidencialidad. No se relajaron host, base, puerto ni rol.
- PostgreSQL truncó el nombre de un índice a su límite de identificador; el
  esquema Prisma usa el nombre físico explícito. El diff final es vacío.
- La primera ejecución ampliada tuvo un error del fixture: cambió la fecha
  sin recalcular su hash canónico. Se corrigió el generador de prueba, no la
  restricción, y se repitió la suite completa: 52/52. Se conserva
  [la primera ejecución](ensayo-postgresql-correcciones-run1.json).
- La comprobación de RLS no sustituye la futura autorización del servidor:
  el contexto institucional debe proceder de autenticación confiable. El dueño
  de objetos puede alterar DDL/RLS; su credencial no debe usarse en ejecución app.

### Principal protegida y recomendación

La comprobación final con psql, `asistencia_app` y
`default_transaction_read_only=on` devolvió: `asistencia_facial`, ::1:5432,
propietario postgres, public propiedad de pg_database_owner y **0 tablas de
usuario en public**. App mantiene CONNECT/USAGE y carece de CREATE tanto en
base como esquema. App y migrador no tienen SUPERUSER, CREATEDB, CREATEROLE,
REPLICATION ni BYPASSRLS. No se modificaron objetos, datos ni permisos de principal.

Recomendación: aceptar técnicamente la corrección estructural ensayada y el
baselining de sandbox, con revisión explícita del caso ficticio heredado.
Antes de principal: autorización nueva, respaldo verificable y procedimiento de
restauración aprobado, inventario/prevalidación temporal, revisión de privilegios
y ventana para los bloqueos de migración. Incorporar reintentos de serialización
y resolución de episodios al implementar la API. No editar migraciones aplicadas:
una reversión posterior requerirá otra migración revisada o restauración aprobada;
no usar reset/db push ni borrar históricos. Persisten los pendientes de Fase 1
(Android físico y validaciones complementarias) y la revisión de dependencias
documentada en el historial. No se instalaron ni actualizaron dependencias aquí.

Fuentes oficiales: [baselining Prisma](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining),
[configuración Prisma](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
y [identificadores de transacción PostgreSQL 18](https://www.postgresql.org/docs/18/functions-info.html).

---

## Historial: ensayo inicial, aceptación bloqueada por integridad

**Conclusión histórica superada por la validación correctiva al inicio del informe.**
PostgreSQL 18.6 local, sandbox conservada, migración SQL inicial aplicada sin
cambios como asistencia_migrator. No se utilizó postgres para migrar ni probar.
Resultado: **30 comprobaciones satisfactorias y 1 hallazgo estructural bloqueante**.
No se recomienda todavía migrar `asistencia_facial`.

Evidencia completa: [resultados e inventario físico JSON](ensayo-postgresql-resultados.json).
Identificador del ensayo: `87a977f9-e150-40fc-ab5d-c68bb0a220b2`.
Runner reproducible: [integration.mjs](../../apps/backend/scripts/sandbox/integration.mjs).
Solo usa datos ficticios y credenciales resueltas por psql/pg; no abre ni copia
pgpass, no carga .env ni admite un destino arbitrario por parámetro.

### Preparación, destino y aplicación efectiva

Ambos roles autenticaron mediante `psql -w` a
`localhost:5432/asistencia_facial_sandbox`. Las consultas devolvieron ::1, 18.6,
propietario asistencia_migrator, ambos roles sin SUPERUSER/CREATEDB/CREATEROLE/
REPLICATION/BYPASSRLS. App tiene CONNECT/USAGE pero no CREATE en base ni public;
el migrador puede CREATE por propiedad y permisos. Solo existía el esquema public;
no había relaciones ni funciones de usuario. La guardia inmediatamente anterior
a migrar comprobó también ausencia de tipos no pertenecientes al sistema.

Prisma validó schema.prisma. Se comprobaron los hashes del esquema y SQL antes
y después: coinciden con los valores conservados en este informe. Se ejecutaron:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -w -h localhost -p 5432 -U asistencia_migrator -d asistencia_facial_sandbox -v ON_ERROR_STOP=1 -P pager=off -f apps/backend/scripts/sandbox/apply-initial.sql
& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -w -h localhost -p 5432 -U asistencia_migrator -d asistencia_facial_sandbox -v ON_ERROR_STOP=1 -P pager=off -f apps/backend/scripts/sandbox/grants.sql
```

Ambos terminaron con código 0. `apply-initial.sql` verifica destino/rol/propietario
y base vacía e incluye el archivo SQL original mediante `\ir`, sin modificarlo.
El único NOTICE fue que public ya existía. El SQL confirmó COMMIT. grants.sql
concedió los permisos de tablas/columnas previstos exclusivamente en sandbox.

**Importante:** se aplicó SQL mediante psql, no mediante `prisma migrate deploy`.
No se creó `_prisma_migrations` ni se registró un baseline. No ejecutar deploy
sobre esta sandbox ya poblada ni asumir que su historial Prisma está inicializado.
Antes de una integración definitiva, decidir y autorizar el manejo de ese historial.
La integración Prisma se probó realmente con el cliente generado y adapter-pg,
consultas ORM y el helper withInstitution; las escrituras del ensayo usan pg.
No se modificó la guardia de URL del backend principal para permitir sandbox.

### Inventario físico observado

| Objeto | Cantidad verificada |
| --- | ---: |
| Tablas de dominio | 14 |
| Enums | 6 |
| FK | 20 |
| CHECK adicionales | 10 |
| Índices totales | 38: 14 de PK + 24 explícitos |
| Triggers de usuario | 4 |
| Funciones de usuario | 3 |
| Políticas RLS | 14 |
| Tablas con ENABLE y FORCE RLS | 14 |

Todas las tablas pertenecen a asistencia_migrator. El JSON incluye nombres y
definiciones obtenidos de pg_class, pg_enum, pg_constraint, pg_indexes, pg_trigger,
pg_proc y pg_policies, no solo conteos extraídos del archivo SQL.

### Pruebas realizadas con conexiones reales

| Prueba | Resultado observado |
| --- | --- |
| Fixtures | Dos instituciones, usuarios y estudiantes exclusivamente ficticios, creados como app |
| RLS sin contexto | SELECT devuelve cero filas tanto con app como con migrador; FORCE RLS se aplica también al dueño |
| INSERT sin contexto / institución cruzada | Denegado, SQLSTATE 42501 |
| A consulta/modifica B | Cero filas visibles o modificadas; A sí ve sus propias filas |
| FK estudiante de otro colegio | 23503, enrollments_institution_id_student_id_fkey |
| Periodo inválido de sesión | 23514, sessions_valid_period |
| Prisma y pool reutilizado | Mismo PID 15864, max=1; después de COMMIT y ROLLBACK, sin contexto se ven cero instituciones |
| UUID y hash de evento persistido | Relectura clasifica mismo contenido como already_accepted y contenido alterado como needs_review; conserva una fila |
| UUID duplicado por INSERT | 23505, attendances_institution_id_event_uuid_key |
| Otro UUID para misma asistencia activa | 23505, attendances_one_active_per_session |
| UPDATE de asistencia sin corrección/auditoría | Falla al COMMIT con P0001; quedan ACTIVE y versión 1 |
| Corrección válida | UPDATE + historial + auditoría confirman VOID/versión 2 en una transacción |
| Versión obsoleta | UPDATE con expectedVersion anterior afecta cero filas |
| App CREATE/DROP/ALTER TABLE | Denegados, 42501; ningún objeto alterado |
| App TRUNCATE/DELETE/UPDATE de historiales | Denegados, 42501, con historial existente |
| Migrador DDL | Puede crear tabla de prueba dentro de transacción; ROLLBACK; to_regclass confirma que no quedó tabla |
| Dueño modifica auditoría o contenido original | Triggers rechazan con P0001 |
| Reinscripción tras cerrar matrícula en mismo grupo | 23505, enrollments_institution_id_student_id_group_id_key |
| Fallo tras escritura válida | División por cero 22012 revierte la inserción; otra conexión confirma ausencia |
| Dos conexiones concurrentes, mismo UUID | Un COMMIT, un 23505, exactamente una asistencia |
| Dos conexiones concurrentes, UUID distintos/misma clave lógica | Un COMMIT, un 23505 del índice parcial, exactamente una asistencia |
| Corrección sin actualizar asistencia ni auditoría | **Permitida inesperadamente**; constraints diferidas forzadas a IMMEDIATE no la rechazan; ROLLBACK explícito |

Son pruebas de persistencia/helpers, no una API de sincronización implementada ni
un ensayo de respuesta HTTP perdida. Las carreras usaron dos conexiones app
autenticadas; no se simuló el usuario con SET ROLE administrativo. Las fixtures
y resultados válidos permanecen en sandbox para revisión; no se borró la base.
El intento de corrección inconsistente no quedó persistido.

### Hallazgo bloqueante y propuestas sin aplicar

**CORRECTION_WITHOUT_ATTENDANCE_UPDATE:** el trigger diferido actual comprueba
UPDATE de asistencia → existencia de corrección y auditoría. No comprueba la
dirección inversa. Una app con INSERT en attendance_corrections puede agregar un
historial de versión 2→3 y VOID→ACTIVE mientras la asistencia sigue VOID/2, sin
auditoría. El caso fue detenido y revertido, sin alterar esquema ni SQL aprobado.

Propuesta para aprobación: agregar validación transaccional inversa al INSERT de
corrección, exigiendo correspondencia con la transición efectivamente realizada
y auditoría del mismo actor. Decidir si se permite más de una transición por
asistencia en una transacción; un chequeo ingenuo contra la última versión puede
rechazar historiales válidos o aceptar entradas ficticias. Considerar centralizar
la operación autorizada y restringir escrituras directas; conservar controles
de servidor e integridad de BD. Añadir pruebas de inserción huérfana lógica,
auditoría ausente/actor distinto, orden de operaciones, reintento y concurrencia.
**Ninguna de estas correcciones se implementó.**

La restricción de matrículas históricas también se comprobó físicamente: cerrar
ends_at no permite insertar otro periodo para el mismo estudiante/groupId.
Si se necesitan reingresos, aprobar historial de periodos o episodios con ID de
matrícula y adaptar la FK de Attendance. No quitar solo el UNIQUE: la FK actual
depende de él. La prueba confirmó la limitación, no decidió la regla académica.

Riesgos conservados: permisos por docente/grupo y vigencia temporal no están
implementados; RLS usa un contexto establecido por servidor, no autentica al
usuario final. El dueño migrador puede cambiar DDL/RLS: no usar sus credenciales
en la aplicación. Un hash no sustituye autorización ni evidencia de presencia.

### Verificaciones automatizadas e incidencias del arnés

Comandos ejecutados:

```powershell
npm.cmd run prisma:validate -w apps/backend
npm.cmd run build -w apps/backend
node apps/backend/scripts/sandbox/integration.mjs --run-sandbox
npm.cmd run test -w apps/backend
npm.cmd test
npm.cmd run typecheck -w apps/backend
```

Prisma válido; build y TypeScript correctos; **13/13 pruebas unitarias backend y
16/16 frontend aprobadas**. Backend se ejecutó con permiso ampliado por la
limitación conocida de tsx en el entorno restringido, sin cambiar dependencias.
El runner de integración guardó 30 controles satisfactorios y un hallazgo.

Primer intento del runner: guardia de dirección rechazó `::1/128`, porque el cast
inet a text incluye máscara; no había escrito fixtures. Se corrigió únicamente
el arnés para comparar `host(inet_server_addr())`, que devuelve ::1. Segundo
intento ejecutó la matriz. pg advirtió que su soporte automático de pgpass quedará
obsoleto en pg 9; la versión instalada 8.23.1 autenticó correctamente. No se
actualizó pg ni se implementó lectura manual de contraseñas.

La primera versión del reporte etiquetó como passed el diagnóstico que logró
reproducir la inconsistencia y devolvió código 0; eso no significa requisito
aprobado. Se clasificó explícitamente esa observación como finding y la aceptación
global como blocked. El runner ahora devuelve código 2 al hallar ese defecto.
Se conservan las observaciones originales y una nota en el JSON; no se repitieron
escrituras para cambiar esa presentación. Se comprobó sintaxis con `node --check`.

### Protección de principal y cierre

Al terminar se ejecutó otra vez diagnostic-main-readonly.sql como asistencia_app
sobre principal, con transaction_read_only=on: conserva dueño postgres, esquema
public propiedad pg_database_owner, ningún objeto de usuario y contadores de
inserción/actualización/eliminación en cero. Los permisos de app conservan
CONNECT/USAGE/TEMP y no CREATE; sin membresías elevadas. No se envió ninguna
escritura a principal. Las sesiones del ensayo se cerraron en finally.

El rol migrador tiene CONNECT/USAGE/TEMP efectivos en principal por PUBLIC,
sin CREATE, como ya se había advertido. No se otorgaron permisos adicionales
allí ni se corrigió su ACL. Cualquier endurecimiento requiere autorización aparte.

Archivos nuevos: assert-migrator.sql, apply-initial.sql, grants.sql e
integration.mjs en apps/backend/scripts/sandbox; evidencia JSON física.
Actualizado: este informe. schema.prisma y migration.sql mantienen sus hashes.
No hay nuevos paquetes, cambios de frontend/biometría, commits, push o despliegue.
La revisión previa de 15 alertas npm permanece documentada abajo; no se ejecutó
audit fix ni se considera resuelta por estas pruebas de BD.

**Recomendación:** aceptar la evidencia de conexión, migración SQL y controles
probados; no autorizar aún la migración definitiva. Primero aprobar/corregir la
integridad inversa de correcciones, decidir la política de matrículas, repetir
los casos afectados, definir historial Prisma y verificar respaldo/restauración.
Toda modificación propuesta y la posterior migración principal quedan detenidas
para revisión del responsable. Fase 1 sigue abierta.

## Estado más reciente: recursos creados, autenticación de ensayo pendiente

Después de que el responsable configuró el acceso de postgres a la base de
mantenimiento, el diagnóstico administrativo READ ONLY confirmó servidor 18.6,
sesión postgres en `postgres`, dirección ::1, puerto 5432 y ausencia de ambos
recursos. Se mostró el SQL sin secretos antes de la creación.

**Operaciones ejecutadas:**

- CREATE ROLE asistencia_migrator LOGIN, con NOSUPERUSER, NOCREATEDB,
  NOCREATEROLE, NOREPLICATION y NOBYPASSRLS; PASSWORD NULL, pendiente del paso
  interactivo. No se generó, leyó ni copió ninguna contraseña.
- CREATE DATABASE asistencia_facial_sandbox OWNER asistencia_migrator TEMPLATE
  template0; comentario que identifica el ensayo ficticio y pide conservarlo.
- REVOKE ALL de PUBLIC y GRANT CONNECT a asistencia_app **solo sobre sandbox**.

El archivo ejecutado es [provision.sql](../../apps/backend/scripts/sandbox/provision.sql).
Su primer intento terminó con código 3: CREATE ROLE, CREATE DATABASE y COMMENT
se ejecutaron, pero `\connect` a sandbox como postgres falló por falta de
contraseña disponible para ese destino. No se repitió la creación. Los permisos
de base se completaron después desde la sesión postgres de mantenimiento, con
comprobación de destino y propietario, en una transacción correcta (código 0).
Las sesiones administrativas finalizaron al terminar cada comando.

### Resultado comprobado desde catálogos

| Elemento | Estado real |
| --- | --- |
| asistencia_migrator | Existe, LOGIN, los cinco privilegios administrativos indicados en false |
| asistencia_facial_sandbox | Existe, propietario asistencia_migrator |
| asistencia_app sobre sandbox | CONNECT sí; CREATE de esquema no; TEMPORARY no |
| asistencia_migrator sobre sandbox | CONNECT/CREATE/TEMP sí por propiedad; no es CREATEDB global |
| asistencia_facial | Conserva propietario postgres; ninguna operación de escritura enviada a esta base |
| Privilegios de public en sandbox | Ajuste específico pendiente del acceso a sandbox |
| Migración y 14 tablas de dominio | No aplicadas/no creadas por esta tarea |

Una conexión separada como asistencia_app a sandbox también falló con código 2,
`fe_sendauth: no password supplied`, antes de cualquier consulta. No se usaron
SET ROLE ni credenciales administrativas para simular ese usuario. No se probó
la autenticación del migrador: su contraseña se dejó NULL expresamente para el
paso interactivo autorizado. No se leyó pgpass ni valores/hash de contraseñas.

### Único paso local necesario para continuar

El responsable debe ejecutar en su terminal desde la raíz del proyecto:

```powershell
& .\apps\backend\scripts\sandbox\finish-interactive.ps1
```

Este script solicita la clave administrativa directamente mediante psql sobre
sandbox; valida destino, versión, propietario, atributos y ausencia de objetos;
solicita dos veces la nueva clave del migrador mediante `\password`; completa
los grants de esquema sandbox. **No crea recursos, no migra, no toca principal.**
No usar transcript ni compartir las claves. Después, configurar entradas privadas
de pgpass para ambos roles en `localhost:5432:asistencia_facial_sandbox`.

No ejecutar otra vez prepare-interactive/provision: los recursos ya existen.
`finish-interactive.sql` y `.ps1` están preparados, no ejecutados por Codex; si se
interrumpen, conservar recursos y revisar, sin borrar. La aprobación del ensayo
sigue vigente: falta autenticación interactiva, no otra autorización genérica.

La integración, RLS física, concurrencia, correcciones y pruebas con migrador/app
continúan pendientes. No presentar el aprovisionamiento como ensayo superado.
No hubo cambios en schema.prisma, migration.sql, YuNet/SFace, dependencias o
frontend. El registro histórico siguiente se conserva como trazabilidad y no
debe confundirse con el estado actual de recursos.

## Actualización: autorización de creación y preparación interactiva

El responsable autorizó expresamente crear `asistencia_migrator` y
`asistencia_facial_sandbox`, ahora **con el migrador como propietario de la base**.
Esto sustituye la propuesta anterior de propiedad postgres y la espera de permiso
para creación. No autoriza modificar la principal, crear otros roles/bases ni
aplicar allí migraciones. La autorización para el ensayo no necesita repetirse.

Estado real de esta actualización: **creación e integración no ejecutadas**.
Se repitió el diagnóstico con asistencia_app en principal, en READ ONLY: servidor
18.6, ::1:5432, permisos y propietarios sin cambios respecto de la tabla siguiente,
sin tablas de dominio. El migrador y la sandbox siguen ausentes.

Se intentó autenticar como postgres para diagnósticos de solo lectura tanto contra
principal como contra la base de mantenimiento postgres. Ambos intentos terminaron
con **código psql 2**, `fe_sendauth: no password supplied`, antes de ejecutar SQL.
El acceso configurado para asistencia_app no proporciona credenciales del operador.
No se abrió el archivo pgpass ni se solicitaron contraseñas en el chat.

### Procedimiento local interactivo preparado

Archivos nuevos (preparados, **no ejecutados**):

- [prepare-interactive.ps1](../../apps/backend/scripts/sandbox/prepare-interactive.ps1).
- [prepare-interactive.sql](../../apps/backend/scripts/sandbox/prepare-interactive.sql).

Para resolver el paso que exige entrada de contraseñas, el responsable puede
ejecutar desde su propia terminal PowerShell, en la raíz del proyecto:

```powershell
& .\apps\backend\scripts\sandbox\prepare-interactive.ps1
```

No ejecutar con transcript/captura de contraseñas ni incluirlas en el comando.
psql pide la contraseña del operador postgres, luego solicita dos veces la nueva
contraseña del migrador mediante `\password`. La nueva conexión a sandbox puede
volver a pedir la clave del operador. El script no recibe ni imprime claves.
Tras terminar, configurar personalmente las entradas específicas de pgpass para
`localhost:5432:asistencia_facial_sandbox:asistencia_migrator` y
`localhost:5432:asistencia_facial_sandbox:asistencia_app`, sin compartir valores.

El procedimiento valida host loopback, puerto 5432, versión exacta 18.6 y sesión
postgres en la base de mantenimiento postgres. Rechaza cualquier rol migrador o
sandbox preexistente para revisión, y un app privilegiado/con membresías. Crea
solo el rol permitido con atributos mínimos; configura SCRAM para su contraseña;
crea solo la sandbox desde template0, propiedad del migrador; añade comentario
identificador y concede CONNECT/USAGE a app exclusivamente en sandbox. Retira
permisos de PUBLIC exclusivamente en sandbox. No crea tablas de dominio ni aplica
la migración. No hace GRANT/REVOKE/ALTER sobre la principal ni cambia asistencia_app.

Si se interrumpe, puede quedar un rol sin contraseña o una sandbox parcialmente
preparada. El script se detiene, no limpia ni elimina nada, y no se debe reintentar
a ciegas: inspeccionar el estado y continuar solo si coincide con lo autorizado.
No se usa postgres para ejecutar ni simular pruebas de RLS del usuario app.

Verificación realizada del procedimiento: parser de PowerShell sin errores; SQL
revisado estáticamente, no ejecutado. Hashes de schema.prisma y migration.sql
siguen iguales a los registrados abajo. No se instalaron paquetes ni cambiaron
frontend, modelos o SQL estructural. Las pruebas de integración, inventario
físico y diferencias de permisos del migrador siguen pendientes de este acceso.

La recomendación sigue siendo **no migrar la principal**. Una vez terminado el
paso interactivo, comprobar objetos/roles/destino de nuevo, preparar guardia
exclusiva de sandbox y ejecutar la matriz ya autorizada. La pertenencia del
migrador como propietario implica que podrá DDL en sandbox; app debe carecer de
propiedad y privilegios equivalentes. No se otorgan permisos adicionales en la
principal, aunque su CONNECT existente para PUBLIC debe considerarse como se
explica en la revisión de permisos siguiente.

## Actualización: diagnóstico autenticado posterior

Tras configurar el responsable pgpass.conf, se completaron dos sesiones de
diagnóstico con `asistencia_app`. **Autenticación resuelta; ensayo de integración
aún no ejecutado.** Esta sección sustituye el estado de bloqueo del registro
histórico que sigue. La última instrucción exige esperar autorización antes de
crear roles/bases o realizar cualquier modificación, también en sandbox.

Se ejecutó `diagnostic-main-readonly.sql` con psql `-X -w`,
`ON_ERROR_STOP=1`, timeout de conexión de 5 s y
`PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=10000'`.
Salida real: `asistencia_facial`, `asistencia_app`, `::1`, puerto `5432`,
servidor **18.6**, `transaction_read_only=on`. psql terminó con código **0**.
Una segunda sesión READ ONLY consultó atributos de `postgres` y ACL mediante
`aclexplode(coalesce(datacl, acldefault('d', datdba)))` y el equivalente para
`pg_namespace`/`public`; también terminó con código 0. No se abrió ni mostró el
archivo de contraseñas; psql utilizó su mecanismo de autenticación habitual.

### Permisos efectivos observados

| Comprobación | Resultado |
| --- | --- |
| LOGIN de asistencia_app | Sí |
| CONNECT a asistencia_facial | Sí |
| CREATE en la base (crear esquemas) | No |
| USAGE de esquema public | Sí |
| CREATE en esquema public | No |
| TEMPORARY | Sí, concedido a PUBLIC |
| SUPERUSER / CREATEDB / CREATEROLE | No / No / No |
| REPLICATION / BYPASSRLS | No / No |
| Membresías en otros roles | Ninguna devuelta por pg_has_role |
| Propietario de asistencia_facial | postgres |
| Propietario del esquema public | pg_database_owner; el propietario efectivo de esta base es postgres |
| asistencia_migrator | No existe en pg_roles |
| asistencia_facial_sandbox | No existe en pg_database |
| Tablas, particiones, vistas, vistas materializadas y secuencias fuera de esquemas de sistema | Ninguna |
| Funciones fuera de esquemas de sistema | Ninguna |

No se observaron privilegios administrativos excesivos en `asistencia_app`.
TEMPORARY permite crear tablas temporales: es más amplio que el mínimo de una
aplicación que no las necesita, aunque no concede CREATE de objetos persistentes.
También existen CONNECT de PUBLIC y USAGE de PUBLIC sobre el esquema. No se
revocó nada. Revocar TEMP solamente a app no retiraría el permiso que obtiene por
PUBLIC; cualquier endurecimiento de la principal requiere un plan y autorización
separados, considerando a todos sus usuarios.

El rol `postgres` existe, permite LOGIN y tiene SUPERUSER, CREATEDB y CREATEROLE.
Es candidato a operador de preparación, **no** a usuario de aplicación ni a rol
con el que validar RLS. No se inició sesión como postgres ni se verificaron sus
credenciales. Los contadores de la principal mostraron 0 inserciones,
actualizaciones y eliminaciones; son auxiliares, no una prueba aislada de
inmutabilidad. Todas las sentencias ejecutadas fueron diagnósticas, en lectura.

### Operaciones propuestas, NO ejecutadas

Solicitar autorización conjunta y específica para:

1. Conectar como operador `postgres` local y volver a comprobar que no existen
   `asistencia_migrator` ni `asistencia_facial_sandbox`. Si aparecen, detenerse;
   no asumir que pueden reutilizarse.
2. Crear el rol global `asistencia_migrator` con LOGIN, NOSUPERUSER, NOCREATEDB,
   NOCREATEROLE, NOREPLICATION y NOBYPASSRLS. Sin membresías elevadas ni concesión
   de ese rol a `asistencia_app`. El rol es global: su creación requiere la
   autorización adicional solicitada, aunque solo se use para este ensayo.
3. Establecer su contraseña fuera de archivos versionados, mediante entrada
   interactiva segura del responsable, y configurar entradas locales de pgpass
   para la sandbox. No cambiar la contraseña ni atributos de `asistencia_app`.
4. Crear **solo si sigue ausente** `asistencia_facial_sandbox` desde template0,
   propiedad del operador `postgres`. No otorgar CREATEDB al migrador. Identificar
   la base con un comentario de ensayo ficticio y conservarla para revisión.
5. Dentro de la sandbox exclusivamente: retirar CONNECT/TEMP de PUBLIC y CREATE
   de PUBLIC en public; conceder CONNECT y USAGE a app/migrador y CREATE en public
   solo al migrador. Mantener app sin propiedad, DDL ni permisos heredados elevados.
   No cambiar ACL, propietario o configuración de `asistencia_facial`.
6. Preparar/probar la guardia exclusiva del ensayo: destino local sandbox exacto,
   rechazo de la principal, y comprobación de `current_database()` antes de
   escribir. Migrar como asistencia_migrator, que será dueño de sus objetos;
   conceder a app solo los permisos de tablas/columnas previstos, en la sandbox.
7. Ejecutar la matriz pendiente con ambos roles, conservar resultados y base,
   sin corregir automáticamente errores estructurales. No aplicar nada a principal.

Crear un rol global puede permitirle conectar a bases con CONNECT otorgado a
PUBLIC, incluida la principal. Se limitará el uso del ensayo por destino; eso no
equivale a un bloqueo de acceso del rol en todo el clúster. Una exclusión estricta
de la principal exigiría revisar ACL/HBA o usar otro clúster, fuera de este plan y
sin autorización actual. No se promete aislamiento de credenciales que el diseño
de permisos PostgreSQL no proporciona.

No se repitieron las pruebas unitarias ni npm audit en esta actualización: no se
cambió código, dependencias o SQL estructural. Sus resultados anteriores se
conservan abajo. Los controles RLS, concurrencia, migración y rollback siguen
pendientes; el diagnóstico de permisos no los reemplaza.

## Registro histórico previo a corregir pgpass

Fecha: 2026-11-13. Estado: **ensayo de integración bloqueado por autenticación**.
Se completaron revisión estática, pruebas sin BD y clasificación de dependencias.
No se ejecutaron migraciones ni pruebas de integración contra PostgreSQL.
No se modificó la base principal, sus permisos ni roles globales. No se creó ni
eliminó una base de ensayo; su existencia todavía no pudo consultarse.

## Autorización y condiciones de ejecución

Principal protegida: `localhost:5432/asistencia_facial`, rol `asistencia_app`.
Solo consultas diagnósticas de lectura. Ensayo autorizado exclusivamente en una
base nueva `asistencia_facial_sandbox`; si ya existe, detenerse sin reutilizarla.
No están autorizados cambios de roles globales, integración definitiva, reset,
db push, borrado de la sandbox, commits, push o despliegues.

Se revisaron AGENTS, documentos rectores, contratos, arquitectura preparada,
schema.prisma, migration.sql, configuración, conexión y planes de permisos.
La autorización actual sustituye el límite anterior de preparación exclusivamente
para este ensayo. AGENTS refleja el alcance nuevo. Fase 1 sigue abierta.
Git continúa con los archivos del proyecto sin seguimiento; se preservaron los
archivos existentes. No se modificaron esquema, migración, motor ni frontend.

## Diagnóstico real y bloqueo

Se localizó `C:/Program Files/PostgreSQL/18/bin/psql.exe`; `--version` devuelve
**psql (PostgreSQL) 18.6**. Es la versión del cliente, no una consulta al servidor.

Intento ejecutado desde la raíz:

```powershell
$env:PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=10000'
$env:PGCONNECT_TIMEOUT='5'
& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -w -h localhost -p 5432 -U asistencia_app -d asistencia_facial -v ON_ERROR_STOP=1 -f apps/backend/prisma/preflight-readonly.sql
Remove-Item Env:PGOPTIONS
Remove-Item Env:PGCONNECT_TIMEOUT
```

Resultado: `connection to server at "localhost" (::1), port 5432 failed:
fe_sendauth: no password supplied`. La autenticación falló antes de ejecutar SQL.
El script envolvente terminó con código 0 por su limpieza de variables; ese código
no se interpreta como éxito de psql. El mensaje de psql es la evidencia del fallo.

Comprobaciones de disponibilidad, sin leer secretos: no existe `.env` backend,
no existe el pgpass predeterminado y no están configuradas PGPASSFILE/PGPASSWORD
en el proceso. No se buscaron contraseñas en historiales ni se intentó eludir la
autenticación. Se solicitó al responsable configurar credenciales locales e
identificar roles existentes para crear la sandbox y migrar.

**No verificados:** CONNECT/CREATE/USAGE efectivos, SUPERUSER/CREATEDB/BYPASSRLS,
membresías, propiedad de objetos, separación de roles, versión del servidor y
existencia de la sandbox. No se puede afirmar que `asistencia_app` tenga permisos
excesivos o adecuados sin las consultas.

Se preparó [diagnostic-main-readonly.sql](../../apps/backend/prisma/diagnostic-main-readonly.sql):
transacción READ ONLY, destino principal/loopback/puerto comprobado, timeout y
consultas de catálogos. Incluye `has_database_privilege`, `has_schema_privilege`,
`pg_roles`, `pg_has_role`, propietarios de DB/esquemas/relaciones/funciones,
existencia de sandbox y contadores orientativos. No consulta datos personales.
**Este archivo nuevo no se ha ejecutado.** Los contadores no demuestran por sí
solos ausencia de actividad de otros procesos; nuestro intento no envió escrituras.

## Inventario previsto, no observado en PostgreSQL

Fuente reproducible: [inventario estático JSON](inventario-previsto-postgresql-fase-2.json).

| Objeto | Cantidad prevista | Verificado en servidor |
| --- | ---: | --- |
| Tablas de dominio | 14 | No |
| Enums | 6 | No |
| FK | 20 | No |
| Índices explícitos CREATE INDEX | 24 | No; no incluye índices de PK |
| CHECK adicionales | 10 | No |
| Funciones PL/pgSQL | 3 | No |
| Triggers explícitos | 4 | No; no incluye triggers internos de FK |
| Tablas con ENABLE/FORCE RLS y política | 14 previstas | No |

Tablas: institutions, users, students, teachers, groups, enrollments,
teacher_assignments, class_sessions, devices, biometric_consents,
biometric_template_metadata, attendances, attendance_corrections y audit_events.
Prisma agregaría `_prisma_migrations` como tabla de infraestructura aparte.
Enums: UserRole, AttendanceStatus, ConsentStatus, TemplateStatus, SessionStatus,
CorrectionReason.

SHA-256 de archivos conservados, comprobados al inicio y al cierre de la revisión:

- schema.prisma: `94f5fcedf13ab7d41fbdd78e9ce3dcab00911795607577725398e9e42de6a2cd`.
- migration.sql: `dc3a10d34f0d795fabe8ca6f769ccbc54c8e04ba655dc582b6f366a417a471bd`.

## Revisión de RLS, integridad y matrículas

El SQL configura políticas por `current_setting('app.institution_id', true)` y
FORCE RLS. Sin contexto, la comparación no es verdadera; con contexto de A se
prevé filtrar B. Esto todavía es lectura del diseño, no resultado de prueba.
SUPERUSER/BYPASSRLS pueden eludir RLS; TRUNCATE no está protegido por RLS. Por eso
hay que verificar privilegios reales además de políticas. Fuente:
[PostgreSQL 18: seguridad por fila](https://www.postgresql.org/docs/18/ddl-rowsecurity.html).

`withInstitution` configura contexto local dentro de una transacción. La prueba
unitaria usa un doble y confirma orden/parametrización, pero no demuestra limpieza
del contexto al reutilizar una conexión real. Ensayar con pool de tamaño 1,
contexto A, consulta sin contexto y contexto B, comprobando el PID reutilizado;
repetir después de rollback. El rol compartido de aplicación puede establecer el
contexto: no otorgar conexión SQL a usuarios finales ni derivarlo del cuerpo HTTP.

### Matrículas: limitación confirmada por inspección

`@@unique([institutionId, studentId, groupId])` impide una segunda fila de matrícula
del mismo estudiante en el **mismo groupId**, aunque la anterior tenga `ends_at`.
Esto impide representar dos periodos separados de baja/reingreso conservando ambas
filas. Un grupo nuevo del año siguiente tiene otro ID y no choca con esa clave.
No se ejecutó el INSERT para observar SQLSTATE 23505; es una consecuencia estática
de la restricción, no una medición de servidor.

Decisión pendiente: mantener una matrícula única con historial de periodos en otra
entidad, o permitir episodios separados con ID de matrícula y controles de solape.
En la segunda opción, modificar también la FK de Attendance: hoy referencia la
terna única, por lo que **quitar solo el UNIQUE no es una corrección suficiente**.
Se propone revisar pertenencia de sesión/grupo, periodo y política de reingreso
antes de aprobar ese cambio. El diseño autorizado permanece intacto.

### Otros puntos que deben probarse o resolverse

- La guardia de URL actual acepta solo `asistencia_facial`. No utilizarla sin
  adaptación para un ensayo: preparar una entrada exclusiva que rechace principal
  y acepte únicamente sandbox; mantener la configuración principal sin relajación
  global. El ensayo debe comprobar `current_database()` antes de toda escritura.
- No ejecutar `roles-review.sql`: altera roles globales y queda fuera de esta
  autorización. Los grants del ensayo deben aplicarse solo dentro de la sandbox.
- El trigger diferido exige corrección y auditoría para UPDATE de asistencia.
  La dirección inversa no está cubierta: insertar una corrección no exige por sí
  solo que ocurra la actualización correspondiente. Ensayar esta posibilidad;
  valorar trigger adicional o servicio transaccional autorizado. No se ha
  demostrado explotación ni se cambió silenciosamente la migración.
- El SQL no comprueba vigencia del actor, matrícula, dispositivo ni asignación
  docente. Es responsabilidad futura del servicio, todavía sin implementar.
- UUID único evita una segunda inserción; el ACK idempotente y el conflicto por
  hash distinto pertenecen al servicio. No confundir un 23505 con prueba completa
  de sincronización idempotente.

## Matriz de ensayo pendiente

Todas estas filas tienen estado **NO EJECUTADO: credenciales/roles pendientes**.
Las identidades futuras serán exclusivamente ficticias.

| Caso | Procedimiento / criterio esperado |
| --- | --- |
| Creación segura | Consultar pg_database; si existe sandbox, detenerse. Crear desde template0 solo si ausente, sin reutilizar ni borrar |
| Separación de roles | Migrador distinto de app; app sin propiedad, privilegios elevados, membresías elevadas o SET ROLE hacia migrador |
| Migración Prisma | Destino sandbox fijo, verificar versión/destino; aplicar una vez, inventariar objetos y checksum de migración |
| RLS sin contexto | SELECT no devuelve filas; INSERT rechazado por política, no por una FK accidental |
| Dos instituciones | A solo ve A; consultar/actualizar B desde A no afecta filas; INSERT cruzado rechazado |
| Pool reutilizado | Mismo PID; contexto local no persiste tras COMMIT ni ROLLBACK |
| UUID | Mismo evento reenviado no agrega fila; contenido alterado produce conflicto; probar la lógica del helper junto con restricción real |
| Asistencia activa | UUID diferente para mismo alumno/sesión ACTIVE rechazado por índice parcial |
| FK/CHECK | Datos deliberadamente inconsistentes fallan por restricción esperada; no contabilizar otro error como éxito |
| Concurrencia | Dos conexiones intentan mismo UUID/clave lógica; una confirma, otra conflicto; exactamente una fila persistida |
| Corrección válida | Cambio estado/version + historial + auditoría mismo actor en una transacción confirma |
| Corrección inválida | Sin historial/auditoría falla al COMMIT; estado/version originales permanecen |
| Corrección huérfana lógica | Intento de registrar corrección sin cambio correspondiente; documentar resultado como incidencia si se acepta |
| Historial protegido | UPDATE/DELETE/TRUNCATE y DDL con app rechazados; probar con filas existentes, sin confundir cero filas con denegación |
| Reinscripción | Segundo periodo del mismo estudiante/groupId frente a grupo nuevo de otro año; registrar restricción concreta |
| Rollback | Escritura válida seguida de fallo revierte todo; comprobar desde otra conexión y conservar evidencia agregada |

Ante error estructural, detener el caso afectado, conservar SQLSTATE/constraint
sin contenido personal, proponer corrección y pedir aprobación antes de alterar
schema/migration. No reutilizar un ensayo previo sin una autorización nueva que
resuelva la prohibición de reutilizar una base preexistente.

## Pruebas automatizadas realmente ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm.cmd run test -w apps/backend` | Primer intento: tsx falla por `uv_os_get_passwd ENOMEM` en sandbox; reintento con ejecución ampliada: **13/13 pasan** |
| `npm.cmd test` | **16/16 pasan**, dos archivos Vitest del frontend |
| `npm.cmd run prisma:validate -w apps/backend` | Esquema válido |
| `npm.cmd run typecheck -w apps/backend` | Correcto |
| `npm.cmd run build -w apps/backend` | Correcto |
| `psql --version` | Cliente 18.6 |
| Diagnóstico principal con psql | Falló autenticación; no hay resultados SQL |

Estas pruebas no acreditan RLS, concurrencia, integridad PostgreSQL ni permisos.
No se ejecutaron ensayos biométricos humanos, Android ni pruebas de integración
de API inexistente. No se instalaron ni actualizaron dependencias.

## Revisión de las 15 alertas npm

Evidencias conservadas: [audit completo](npm-audit-fase-2.json) y
[audit backend omitiendo dev](npm-audit-backend-runtime-fase-2.json).
Ambos comandos terminaron con código 1 por hallazgos:

```powershell
npm.cmd audit --json
npm.cmd audit --omit=dev -w apps/backend --json
```

Completo: **15 paquetes afectados: 11 moderados, 4 bajos, 0 altos/críticos**.
Omitiendo dev del backend: **6 moderados**. El grafo conserva dependencias
devOptional por la relación de Prisma/client; no afirmar que `--omit=dev` elimina
toda la cadena. Los 15 son nodos afectados, no vulnerabilidades independientes.

| Paquete | Severidad | Impacto contextual / tratamiento propuesto |
| --- | --- | --- |
| @apideck/better-ajv-errors | Moderada heredada | Herramienta Workbox de build; depende de ajv; entrada de esquemas/configuración de build, no endpoint implementado |
| @prisma/client | Moderada heredada | Dependencia runtime real; audit la marca por prisma. No equivale a demostrar vulnerabilidad del motor de consultas; conservar hallazgo hasta verificar paquete final |
| @prisma/dev | Moderada heredada | Herramientas Prisma dev; permanece en audit omit-dev. No se inicia servicio prisma dev en este proyecto |
| @prisma/streams-local | Moderada heredada | Cadena Prisma dev → ajv; no invocada por el código de aplicación revisado; permanece en grafo omit-dev |
| @rollup/plugin-node-resolve | Baja heredada | Resolución de módulos en build; afectado por deepmerge, no ruta HTTP del backend |
| @rollup/plugin-terser | Baja heredada | Minificación en build; afectado por serialize-javascript; examinar entradas de build antes de considerar exposición del artefacto |
| ajv | Moderada heredada | Usa fast-uri; cadena compartida Prisma dev/Workbox; no hay uso directo de ajv en src backend |
| deepmerge 4.3.1 | Baja | Contaminación de prototipo del objeto resultante al mezclar entradas maliciosas; dependencias de build, no mezcla de cuerpos HTTP implementada |
| fast-uri 3.1.8 | Moderada (incluye avisos bajos) | Confusión de esquema/host/normalización e inyección de esquema; riesgo si se usa para decisiones de confianza sobre URI externas. El validador local usa URL nativo, no fast-uri |
| glob 11.1.0 | Moderada | Cancelación de recorrido de archivos y cadena minimatch: disponibilidad del build ante árboles/patrones hostiles; no se ejecuta glob sobre peticiones del backend |
| minimatch 10.2.6 | Moderada | Consumo de recursos con patrones hostiles; desarrollo/build; no entrada de usuario final conectada en código revisado |
| prisma | Moderada heredada | CLI necesaria para generación/migración; cadena dev/streams-local/ajv. No ejecutar servidores de desarrollo Prisma como servicio de aplicación |
| serialize-javascript 7.1.2 | Baja | XSS en serialización de cuerpo de función con cierre script; actualmente herramienta de build. No hay SSR/serialización de funciones recibidas de usuarios implementada |
| vite-plugin-pwa | Moderada heredada | Plugin de build por Workbox; no es evidencia de fallo del motor facial ni de RLS |
| workbox-build | Moderada heredada | Agrega varias cadenas de build; separar del runtime Service Worker; revisar artefacto final antes de producción |

Clasificación basada en audit, lockfile y puntos de importación de aplicación
revisados. **No es una prueba de no explotabilidad ni una aprobación de seguridad
para producción.** No existe aún un servidor de aplicación publicado, así que no
hay explotación remota demostrada sobre el proyecto; los riesgos de herramientas
y cadena de suministro siguen vigentes.

Referencias de avisos primarios: [fast-uri](https://github.com/advisories/GHSA-w74x-v6f9-j3xg),
[serialize-javascript](https://github.com/advisories/GHSA-m5mm-p8h7-m29v).
El JSON completo conserva los restantes identificadores y enlaces.
El registry informa `fixAvailable=false`; eso no significa que no pueda existir
una actualización puntual aguas arriba. Proponer una actualización controlada
después de revisar compatibilidad y pedir autorización; no se ejecutó audit fix,
overrides ni cambios de versión. Antes de producción, verificar un paquete de
runtime aislado sin herramientas de build y volver a auditarlo.

## Cómo desbloquear sin exponer credenciales

Configurar personalmente `%APPDATA%/postgresql/pgpass.conf` con ACL limitada al
usuario de Windows, o indicar un PGPASSFILE privado. No enviar contraseñas al chat.
Formato según [documentación PostgreSQL 18](https://www.postgresql.org/docs/18/libpq-pgpass.html):
`hostname:port:database:username:password`; evitar comodines y escapar `:`/`\`.
Debe existir entrada para `localhost:5432:asistencia_facial:asistencia_app` y, cuando
se conozcan los roles existentes, las entradas específicas del ensayo. No se creó
un archivo de credenciales con valores ficticios ni se cambiaron contraseñas.

Se necesita identificar un rol existente autorizado con CREATEDB para crear la
sandbox y un migrador existente distinto de app. Si no existe separación viable,
solicitar autorización adicional **con nombres y privilegios concretos** antes
de crear o alterar roles globales. No reemplazar esa separación probando todo
como superusuario: produciría evidencia engañosa sobre RLS y permisos de app.

## Antes de cualquier migración principal

1. Desbloquear autenticación y terminar diagnóstico real sin corregir privilegios
   automáticamente; resolver excesos con autorización específica posterior.
2. Confirmar roles y sandbox ausente. Adaptar exclusivamente la ruta de ensayo
   para rechazar principal, probar esa guardia y ejecutar la matriz real.
3. Resolver política de reinscripción y revisar integridad inversa de correcciones;
   cualquier cambio estructural requiere aprobación y nuevos ensayos.
4. Revisar permisos definitivos, avisos npm y políticas de autorización del servicio.
5. Probar respaldo/restauración, revisar SQL final y obtener autorización separada
   para operaciones de escritura sobre la base principal.

Entrega parcial: este informe, tres JSON de evidencia, diagnóstico SQL de lectura
y actualización de alcance en AGENTS. **No se recomienda aplicar la migración
principal todavía.** La autorización de ensayo sigue vigente; su ejecución está
pendiente de credenciales y roles, no de una nueva aprobación genérica.
