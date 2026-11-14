# Fase 2 — migración estructural a principal

## Resultado final — permisos completados y verificados

**La migración estructural y sus permisos quedan completados para revisión.**
Esta sección sustituye los estados parciales del historial inferior. No se volvió
a ejecutar deploy ni baselining; las dos migraciones previamente aplicadas y sus
checksums se verificaron antes de modificar permisos.

### Operaciones de esta continuación

La conexión psql de asistencia_migrator confirmó principal, ::1:5432 y el estado
parcial previsto. Se compararon los SHA-256 de ambos SQL con `_prisma_migrations`:
coinciden; ambas filas tienen finished_at, rolled_back_at NULL y un paso aplicado.

Como asistencia_migrator se ejecutó exactamente el bloque del apartado 6 del plan,
en transacción con guardia de destino:

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM asistencia_app;
GRANT SELECT, INSERT, UPDATE ON institutions, users, students, teachers, groups,
 enrollments, teacher_assignments, class_sessions, devices, biometric_consents TO asistencia_app;
GRANT SELECT, INSERT ON attendances TO asistencia_app;
GRANT UPDATE (status, version) ON attendances TO asistencia_app;
GRANT SELECT, INSERT ON attendance_corrections, audit_events TO asistencia_app;
```

COMMIT exitoso. Después, en una conexión independiente como postgres a principal,
con guardia de destino y transacción, se ejecutó:

```sql
REVOKE CREATE ON DATABASE asistencia_facial FROM asistencia_migrator;
REVOKE CREATE ON SCHEMA public FROM asistencia_migrator;
```

COMMIT exitoso. **No quedan permisos CREATE temporales pendientes de retirada.**
No se cambiaron propietarios ni privilegios administrativos globales.

### Inventario y seguridad finales

| Control | Resultado comprobado |
| --- | --- |
| Tablas | 14 de dominio con 0 filas cada una; _prisma_migrations con 2 filas |
| Estructura de dominio | 98 columnas, 20 FK, 12 CHECK, 41 índices |
| Objetos adicionales | 9 triggers habilitados, 8 funciones, 14 políticas, 6 enums |
| RLS | ENABLE y FORCE en las 14 tablas de dominio |
| Integridad diferida | Los 3 triggers de coherencia son DEFERRABLE INITIALLY DEFERRED |
| Historial | Exactamente las dos migraciones aprobadas, checksums coincidentes |
| Prisma status / diff | Ambos exit 0; diff vacío |
| App y migrador | Sin CREATE en base/public, sin TEMP y sin atributos administrativos globales |
| Dueños | Objetos del dominio: migrador; base: postgres; public: pg_database_owner |
| Prueba de acceso al historial como app | SELECT rechazado con SQLSTATE 42501 |

Matriz efectiva de asistencia_app, validada para cada tabla y columna:

| Objetos | SELECT | INSERT | UPDATE | DELETE/TRUNCATE/REFERENCES/TRIGGER |
| --- | --- | --- | --- | --- |
| institutions, users, students, teachers, groups, enrollments, teacher_assignments, class_sessions, devices, biometric_consents | Sí | Sí | Sí | No |
| attendances | Sí | Sí | Solo status y version | No |
| attendance_corrections, audit_events | Sí | Sí | No | No |
| biometric_template_metadata, _prisma_migrations | No | No | No | No |

La ausencia de CREATE, privilegios administrativos, membresías y propiedad de
objetos en app confirma que no dispone de facultades DDL sobre este esquema.
Se comprobaron permisos mediante catálogos; no se intentaron DROP/TRUNCATE ni
otras operaciones destructivas. El migrador conserva facultades de propietario
sobre objetos existentes aun sin CREATE: su credencial no debe utilizarse en API.

### Evidencia ejecutada y límites

- [Inventario final completo](migracion-principal-inventario-final.txt): consultas
  de principal-postcheck.sql, definiciones de restricciones, índices, funciones,
  triggers, políticas, matriz y conteos bajo lectura administrativa.
- [Roles, propiedad y ACL finales](migracion-principal-estado-final.json).
- [Validación automática de solo lectura](migracion-principal-validacion-final.json):
  passed=true; comprobaciones con postgres y asistencia_app, sin insertar fixtures.
- [Prisma status/diff](migracion-principal-status-diff-final.json) y
  [SQL de diferencias vacío](migracion-principal-diff-final.sql).

Se ejecutaron `prisma migrate status` y `prisma migrate diff
--from-config-datasource --to-schema prisma/schema.prisma --script --exit-code`
con Prisma 7.10.1, PRISMA_SANDBOX=0, sin mostrar configuración privada.
La consulta de asistencia sin contexto devolvió cero filas; en una base vacía
esto no demuestra por sí solo aislamiento funcional. Las 52 pruebas con datos
ficticios continúan siendo evidencia de sandbox; no se repitieron escrituras
de negocio en principal. Las pruebas finales aquí son de estructura, permisos,
historial, RLS configurada y rechazo real de lectura de metadata protegida.

No hubo fallos en esta continuación. El paquete pg emitió un aviso de deprecación
del soporte automático pgpass para su futura versión 9; no afectó la versión
instalada ni se actualizaron dependencias. No se leyó manualmente pgpass.

Principal queda estructuralmente preparada y vacía de datos de negocio. Sandbox,
restore_check y ambos intentos de respaldo se conservan sin modificaciones de
esta continuación. No se cambiaron migraciones, biometría ni frontend; no hubo
commits, push, despliegues ni inicio de API.

**Recomendación para revisión:** aceptar la finalización estructural y de permisos.
Una siguiente tarea de API deberá autorizarse aparte y contemplar autenticación,
contexto institucional transaccional, permisos por usuario, resolución de episodios,
idempotencia y correcciones auditadas. El respaldo actual representa el estado
previo vacío; un ensayo de recuperación del esquema ya migrado queda pendiente
de autorización, sin reutilizar automáticamente la base de recuperación existente.

---

## Estado vigente — migraciones aplicadas; permisos finales pendientes

13 de noviembre de 2026, 21:53, America/Guatemala. **Las dos migraciones se
aplicaron correctamente mediante Prisma 7.10.1. El procedimiento completo no
está concluido: falló la autenticación psql del migrador al comenzar los permisos
de aplicación.** Se detuvieron las escrituras sin reintentar ni borrar objetos.

### Precondiciones satisfechas

pg_stat_activity devolvió cero conexiones concurrentes. El
[diagnóstico definitivo](migracion-principal-previo-definitivo.json) confirmó
principal vacía, PostgreSQL 18.6, loopback:5432, propietario postgres y roles
sin privilegios administrativos. Los hashes de ambos SQL, esquema y respaldo
coincidieron con los valores aprobados del historial inferior. El respaldo sigue
disponible y su recuperación exitosa/diferencia ACL están documentadas.
.env está excluido de Git. El verificador JavaScript compilado comprobó conexión
efectiva de asistencia_migrator a principal, PRISMA_SANDBOX=0, versión 7.10.1 y
exactamente dos directorios de migración. Prisma validate terminó con exit 0.

### Escrituras ejecutadas y punto de detención

1. Como postgres, en principal, BEGIN y guardia de destino, ausencia de sesiones
   concurrentes y relaciones de usuario. GRANT CONNECT/CREATE al migrador en base;
   USAGE/CREATE en public; CONNECT y USAGE a app; REVOKE CREATE en public y TEMPORARY
   en base a PUBLIC. COMMIT exitoso.
2. Como asistencia_migrator, utilizando configuración privada y PRISMA_SANDBOX=0:
   `node ../../node_modules/prisma/build/index.js migrate deploy` desde apps/backend.
   **Exit 0**, sin baseline. [Resultado](migracion-principal-deploy.json).
3. Se intentó conectar mediante `psql -X -w -h localhost -p 5432 -U asistencia_migrator
   -d asistencia_facial -v ON_ERROR_STOP=1` para aplicar los permisos de tablas
   establecidos en el plan. **Autenticación fallida: fe_sendauth: no password supplied.**
   El SQL no llegó al servidor: no se aplicó ninguno de esos GRANT/REVOKE de tablas.

Prisma autenticó mediante MIGRATION_DATABASE_URL; psql requiere su propia
autenticación local. No se copiaron secretos entre mecanismos. Se respetó la
orden de detenerse y no reintentar escrituras. **Permanecen CREATE en base y
public para el migrador; su retirada está pendiente.**

### Historial e inventario real (consultas posteriores de solo lectura)

| Migración | Finalización local | Pasos | Resultado |
| --- | --- | --- | --- |
| 20261113000000_initial_review | 21:53:17.135413 | 1 | finished_at presente, rolled_back_at NULL |
| 20261114000000_corrections_enrollment_episodes | 21:53:17.159020 | 1 | finished_at presente, rolled_back_at NULL |

Los checksums registrados coinciden exactamente con los dos SQL aprobados.
[Inventario completo, definiciones, historial y conteos](migracion-principal-inventario-parcial.txt).
Existen **14 tablas de dominio vacías y _prisma_migrations con 2 filas**.
Conteos comprobados: **98 columnas, 20 FK, 12 CHECK, 41 índices de dominio,
9 triggers, 8 funciones, 14 políticas RLS, 6 enums**. Las 14 tablas tienen ENABLE
y FORCE RLS. Los objetos pertenecen a asistencia_migrator; la base sigue siendo
de postgres y public de pg_database_owner. No se insertaron registros de dominio.

Después del error solo se realizaron verificaciones de lectura:
`prisma migrate status` exit 0 y `prisma migrate diff --from-config-datasource
--to-schema prisma/schema.prisma --script --exit-code` exit 0, SQL vacío.
Véanse [resultados](migracion-principal-status-diff.json) y
[diff](migracion-principal-diff.sql). Esto verifica estructura/historial, pero
no sustituye la finalización pendiente de permisos de aplicación.

### Permisos efectivos actuales

| Permiso | asistencia_app | asistencia_migrator |
| --- | --- | --- |
| CONNECT / USAGE public | Sí / Sí | Sí / Sí |
| CREATE en base / public | No / No | **Sí / Sí, pendientes de retirar** |
| TEMP | No | No |
| Atributos administrativos globales | Ninguno | Ninguno |
| SELECT/INSERT/UPDATE de tablas de dominio | **No concedidos todavía** | Facultades de propietario |
| DELETE/TRUNCATE historiales | No | Propietario; triggers protegen mutaciones previstas |
| Acceso a _prisma_migrations | No | Propietario |

La matriz detallada por tabla/columna está en el inventario; todos los privilegios
de tabla/UPDATE de columna consultados para app son false en este punto.
[Estado de roles y ACL posterior](migracion-principal-estado-parcial.json).
La revocación de TEMP de PUBLIC es efectiva para ambos roles; no se otorgó CREATE
a app. No se habilitó la API ni se probaron escrituras de negocio en principal.

### Continuación específica propuesta

Configurar localmente autenticación psql para **localhost, puerto 5432, base
asistencia_facial, usuario asistencia_migrator**, sin compartir contraseña.
Después de confirmación, comprobar historial/checksums y estado parcial;
**no repetir deploy ni exigir base vacía de estructura**: ya está migrada.
Aplicar únicamente el bloque de permisos de app del apartado 6 del plan,
retirar CREATE del migrador como postgres y repetir matriz/inventario/status/diff.
Esta es la operación pendiente que debe revisarse antes de continuar; no se
propone restauración, eliminación ni alteración manual del historial.

Estado de bases: principal migrada estructuralmente y vacía de datos; sandbox
conservada (dueño asistencia_migrator); restore_check conservada (dueño postgres).
No se modificaron las bases experimentales ni los respaldos, ni SQL versionado,
motor facial o frontend. No hubo commits, push ni despliegues. La recomendación
es completar y verificar permisos antes de autorizar el desarrollo de API REST.

---

## Estado vigente — sesiones autorizadas terminadas; pgAdmin se reconectó

Desde localhost:5432/postgres, como postgres, se verificaron exactamente las
dos sesiones autorizadas: base asistencia_facial, usuario postgres, cliente ::1,
backend_type `client backend`, estado idle y xact_start NULL.

| PID | Aplicación | Puerto cliente | backend_start | Terminación |
| --- | --- | --- | --- | --- |
| 36748 | pgAdmin 4 - DB:asistencia_facial | 61149 | 2026-11-13 17:26:46.347273-06 | true |
| 38432 | pgAdmin 4 - CONN:6247500 | 59321 | 2026-11-13 17:26:55.252281-06 | true |

Un bloque DO comprobó ambos registros antes de llamar exclusivamente a
`pg_terminate_backend(36748,5000)` y `pg_terminate_backend(38432,5000)`.
Ambas llamadas devolvieron true. Tras pg_stat_clear_snapshot, la consulta inmediata
a pg_stat_activity para principal devolvió **0 filas**. No se terminaron otras
conexiones ni procesos Windows y no se modificaron roles ni objetos.

Al repetir precondiciones, una nueva consulta devolvió **PID 18548**, aplicación
`pgAdmin 4 - DB:asistencia_facial`: reconexión automática. Se detuvo el procedimiento
conforme a la restricción expresa. No se terminó el nuevo PID, que no estaba
autorizado, ni se concedieron permisos ni ejecutaron migraciones.

Se conservó el [nuevo diagnóstico de solo lectura](migracion-principal-previo-ejecucion.json).
Los hashes de ambos SQL, esquema y respaldo siguen coincidiendo; .env está
excluido de Git. El verificador compilado confirmó destino principal y migrador,
Prisma 7.10.1 y sandbox desactivada. Ninguna de esas comprobaciones permite ignorar
la reconexión observada. No hay permisos temporales pendientes de retirada.

Pendiente: detener la reconexión desde el cliente pgAdmin y confirmar su cierre
efectivo antes de repetir la ventana de migración. No se propone un bucle de
terminación ni revocar CONNECT para evadir esta condición. Principal permanece
sin migrar; sandbox, base de recuperación y respaldos no fueron modificados.

---

## Última continuación — verificador resuelto, conexiones aún presentes

Se reconstruyó el backend mediante `npm.cmd run build -w apps/backend` (exit 0)
y se ejecutó el verificador con Node nativo y `dist/config/database-url.js`,
sin cargar tsx. Se preservó la validación original de URL y se verificó una
conexión efectiva de solo lectura: asistencia_migrator, asistencia_facial,
::1, puerto 5432; PRISMA_SANDBOX=0. Resultado **verified=true**, exit 0.
El problema local de tsx queda evitado mediante la alternativa autorizada,
sin desactivar controles ni revelar credenciales.

La consulta administrativa de solo lectura de pg_stat_activity, repetida antes
y después de esta verificación, sigue mostrando:

| PID | Aplicación | Cliente | Inicio local | Estado |
| --- | --- | --- | --- | --- |
| 36748 | pgAdmin 4 - DB:asistencia_facial | ::1:61149 | 13/11/2026 17:26:46 | idle, sin transacción abierta |
| 38432 | pgAdmin 4 - CONN:6247500 | ::1:59321 | 13/11/2026 17:26:55 | idle, sin transacción abierta |

No se consultó el texto de sus consultas. No hay evidencia de escritura activa,
pero persisten clientes concurrentes que el procedimiento exige cerrar. Por ello
se detuvo antes de modificar principal. No se terminaron conexiones ni procesos.
**0 migraciones, 0 cambios de permisos; ningún permiso temporal pendiente.**
Las restantes precondiciones deberán repetirse al resolver esta condición; no
se consideran renovadas automáticamente por comprobaciones de turnos anteriores.

Para continuar, identificar y desconectar el proceso pgAdmin que mantiene esas
sesiones. Si el responsable desea que se terminen desde PostgreSQL, deberá
autorizarlo expresamente; antes de hacerlo habría que comprobar nuevamente su
identidad y estado. No se solicita ampliar permisos del migrador ni cambiar SQL.

---

## Estado vigente — reanudación detenida en precondiciones

El responsable comunicó la configuración de `.env` y el cierre de clientes.
Se confirmó que `.env` está excluido de Git y se repitió el diagnóstico:
[preflight de reanudación](migracion-principal-previo-final.json).
Los hashes de ambos SQL, schema.prisma y respaldo siguen coincidiendo con los
aprobados. No hubo escrituras en PostgreSQL.

La consulta de `pg_stat_activity` como postgres, en modo de solo lectura, todavía
devuelve **dos sesiones postgres en principal, PID 36748 y 38432, ambas idle**.
No son consultas escritoras activas, pero no cumplen la ventana acordada sin
clientes concurrentes. No se terminaron sesiones automáticamente.

El verificador de conexión mediante `node --import tsx` falló antes de ejecutar
su código: `ERR_SYSTEM_ERROR`, `uv_os_get_passwd returned ENOMEM`, al cargar tsx
y consultar la identidad Windows. Node informa versión 24.20.0. No es evidencia
de contraseña incorrecta ni de error de PostgreSQL: la conexión del migrador
no llegó a verificarse. No se imprimieron credenciales ni URLs. PRISMA_SANDBOX
se fijó a 0 en el proceso previsto de verificación.

**Resultado: 0 migraciones aplicadas; ningún GRANT/REVOKE; ningún permiso temporal
pendiente de retirada.** No se ejecutaron status/diff ni inventario posterior de
tablas porque se detuvo antes de las operaciones autorizadas de escritura.

Para continuar: cerrar efectivamente las conexiones indicadas (desconectar el
servidor en pgAdmin o cerrar la aplicación, no solo pestañas) y volver a verificar
la ventana. El fallo local de tsx requiere ejecutar el verificador en un contexto
de Windows compatible o usar el módulo JavaScript compilado equivalente, sin
relajar las comprobaciones del destino. No se reintentaron migraciones ni se
modificó el diseño. La autorización estructural previa permanece vigente.

---

## Historial — primer intento detenido por configuración ausente

Fecha: 13 de noviembre de 2026, America/Guatemala.
**Estado: autorización recibida; detenido en precondiciones, sin escrituras.**

La autorización adjunta permite aplicar las dos migraciones y los permisos del
plan, pero exige detenerse antes de modificar principal si falla una precondición.
No se otorgaron permisos temporales ni se ejecutó Prisma migrate deploy.

## Diagnóstico previo real

Se ejecutó [principal-preflight.sql](principal-preflight.sql) mediante psql -X -w
como asistencia_app, con default_transaction_read_only=on y BEGIN READ ONLY.
Resultado: [migracion-principal-previo.json](migracion-principal-previo.json).
Se verificó también la identidad y actividad mediante consultas administrativas
de solo lectura, sin consultar texto de consultas ni credenciales.

| Precondición | Resultado |
| --- | --- |
| Destino | localhost (::1):5432/asistencia_facial, PostgreSQL 18.6 |
| Propiedad | Base postgres; public de pg_database_owner |
| Vacío | Sin relaciones, funciones ni tipos de aplicación; sin historial Prisma |
| Roles | App y migrador sin SUPERUSER, CREATEDB, CREATEROLE, REPLICATION o BYPASSRLS |
| Permisos efectivos | Ambos con CONNECT/TEMP y USAGE public; sin CREATE en base/public |
| Respaldo | 1.097 bytes, hash aprobado coincidente; restauración previa exit 0 |
| Configuración Prisma principal | **No disponible**: no existe apps/backend/.env ni MIGRATION_DATABASE_URL en el proceso |
| PRISMA_SANDBOX | No habilitado en el proceso consultado |
| Conexiones concurrentes | Dos sesiones postgres de pgAdmin en estado idle; ninguna escritura activa observada |

La ausencia de una consulta activa no demuestra que esos clientes estén detenidos.
No se terminaron conexiones ajenas. El backend no tiene un script de arranque
en su package.json; esto tampoco sustituye cerrar los clientes de BD durante
la ventana de migración.

## Checksums verificados sin modificaciones

| Artefacto | SHA-256 |
| --- | --- |
| 20261113000000_initial_review/migration.sql | `dc3a10d34f0d795fabe8ca6f769ccbc54c8e04ba655dc582b6f366a417a471bd` |
| 20261114000000_corrections_enrollment_episodes/migration.sql | `4fd264537d9399f122b709c0368c51744c7344be03ed0802b671855cb29a6f2b` |
| schema.prisma | `61cc948e724be0258637b8c48ea4d7bf6868453c466465b8119eccacb39a66bf` |
| Respaldo válido del segundo intento | `149beb403d6cb8b19401fbc335e8c9adb53221c175d3c2a728927324bd56becd` |

La prueba de recuperación y la diferencia esperada de ACL de base están en el
[informe de recuperación](recuperacion-postgresql-fase-2.md). Los archivos SQL
y el respaldo permanecen intactos.

## Comandos y comprobaciones ejecutadas

- Get-Content de autorización, instrucciones, configuración sin secretos y package.json.
- Get-FileHash de ambos SQL, schema.prisma y respaldo; Get-Item para tamaño.
- Test-Path de apps/backend/.env y comprobación booleana de variables de proceso,
  sin leer ni mostrar contenidos privados.
- git status --short: cambios existentes conservados, sin commits.
- psql -X -w -q -t -A -h localhost -p 5432 -U asistencia_app -d asistencia_facial
  -v ON_ERROR_STOP=1 -f docs/evidencias/principal-preflight.sql
  -o docs/evidencias/migracion-principal-previo.json.
- psql administrativo a principal: BEGIN READ ONLY; identidad/destino;
  pg_stat_activity sin texto de consultas; propietarios de las tres bases; ROLLBACK.

Las consultas PostgreSQL terminaron con exit 0. No se ejecutaron migraciones,
GRANT/REVOKE, cambios de propietarios, baselining ni alteraciones de historial.

## Pendiente para continuar

Configurar localmente `MIGRATION_DATABASE_URL` en `apps/backend/.env` (ignorado por
Git), para asistencia_migrator en localhost:5432/asistencia_facial, sin parámetros
URL ni fragmento. Introducir la contraseña mediante el editor local, sin pegar
la URL o contraseña en la conversación. No copiar la configuración de sandbox
como destino principal. No activar PRISMA_SANDBOX.

Cerrar o desconectar las sesiones de pgAdmin sobre principal y mantener detenida
la aplicación y cualquier escritor. Después de confirmarlo, repetir las
precondiciones y verificar la conexión efectiva del migrador sin revelar secretos.
La autorización estructural ya recibida se conserva; no se requiere ampliarla
para continuar el procedimiento previsto cuando se subsanen estas condiciones.

## Estado final y verificaciones pendientes

Las tres bases existen: asistencia_facial (postgres), asistencia_facial_sandbox
(asistencia_migrator) y asistencia_facial_restore_check (postgres). No se modificó
ninguna en esta continuación. Los respaldos se conservan.

Principal permanece sin tablas de dominio ni _prisma_migrations; **0 migraciones
aplicadas**. No hay permisos temporales pendientes de retirada. Status, diff,
inventario posterior y matriz de permisos endurecidos están pendientes, no fallidos:
se detuvo el procedimiento antes de ejecutarlos. No se inició API REST ni se
insertaron datos. No hubo commits, push o despliegues.

Recomendación: subsanar configuración y ventana sin clientes concurrentes;
después ejecutar el plan autorizado. El desarrollo de API debe esperar la
verificación estructural final y una instrucción posterior del responsable.
