# Fase 3 — laboratorio de integración real API

Estado vigente, 14 de noviembre de 2026 (Guatemala): diagnóstico final **de solo lectura completado para laboratorio, principal y recuperación**. Inventario y conteos del laboratorio confirmados. El diagnóstico actual de sandbox quedó pendiente por falta de autenticación postgres. Se revisó la evidencia previa de **49 comprobaciones reales**, sin repetirlas; regresión histórica **52/52 backend y 16/16 frontend**, no reejecutada en este diagnóstico. La aceptación global sigue siendo parcial por los ensayos complementarios pendientes. No activar módulos en principal. Las secciones inferiores conservan la historia de ejecución.

## Cierre del diagnóstico administrativo de solo lectura

Autorización vigente: exclusivamente diagnóstico, sin migraciones, permisos, fixtures ni pruebas de escritura. Todas las conexiones exitosas de esta continuación se hicieron como **postgres**, mediante psql -X -w, a localhost:5432. El laboratorio confirmó current_database=asistencia_facial_api_lab, dirección ::1 y transaction_read_only=on. Se utilizó BEGIN READ ONLY en cada inventario; postgres no se utilizó como credencial de API. No se leyeron archivos de contraseñas ni se expusieron valores privados.

### Evidencias nuevas

- [Inventario nominal final del laboratorio](api-lab-inventario-final.jsonl): tablas/propietarios, políticas completas, índices, restricciones, triggers, funciones con huella MD5 de definición, enums, ACL, permisos efectivos por tabla y columna, conteos e historial Prisma.
- [Conteos agregados de usuarios, auditoría y asignaciones](api-lab-conteos-finales.jsonl): sin correos, hashes ni identificadores personales.
- [Diagnóstico de principal](diagnostico-asistencia_facial.jsonl).
- [Diagnóstico de recuperación](diagnostico-asistencia_facial_restore_check.jsonl).
- `scripts/api-lab-readonly-inventory.sql`: consultas ejecutadas, incluidas las consultas SELECT de conteo generadas desde nombres de catálogo debidamente citados. No contiene escrituras de datos, DDL ni cambios de permisos.

Las exportaciones se normalizaron localmente a JSONL válido. El primer lector supuso una fila física por JSON y falló porque json_agg emitió saltos de línea; se corrigió el procesamiento local sin repetir ni alterar operaciones en PostgreSQL. No se considera ese fallo una prueba de base de datos fallida.

### Inventario y permisos finales

Confirmados: **14 tablas de dominio + _prisma_migrations**, 14 políticas, 42 índices, 148 restricciones de catálogo (12 CHECK, 20 FK, 98 NOT NULL, 15 PK y 3 tipo t), 9 triggers no internos, 8 funciones y **6 enums**. El inventario adjunto contiene nombres/definiciones y estado de habilitación de triggers; no se reejecutó su comportamiento. Todas las tablas de dominio mantienen RLS ENABLE/FORCE. El historial Prisma conserva exactamente dos migraciones finalizadas y no revertidas. Los checksums del laboratorio y principal coinciden con los dos SQL versionados.

El propietario del laboratorio sigue siendo asistencia_migrator; el de principal y recuperación, postgres; sandbox figura en el catálogo como propiedad de asistencia_migrator. Los roles existentes app/migrador siguen sin SUPERUSER, CREATEDB, CREATEROLE, REPLICATION ni BYPASSRLS según las consultas de catálogo. El propietario del laboratorio conserva sus facultades de creación propias de ese entorno; no se alteró este hecho.

Los permisos efectivos de app por tabla y columna coinciden entre principal y laboratorio. App carece de DELETE, TRUNCATE y TRIGGER; no tiene CREATE de base/esquema, ni acceso SELECT al historial Prisma o metadatos biométricos. Auditorías y correcciones no permiten UPDATE. Se exportó también la matriz de UPDATE por columna, incluida la restricción de attendance a status/version. Esta comprobación es administrativa de catálogo, no una repetición de pruebas funcionales con app.

Se compararon programáticamente políticas, índices, restricciones, triggers, huellas de funciones, enums y permisos de app entre laboratorio y principal: iguales. La igualdad es de estos componentes observados, no una afirmación de igualdad de datos ni de todo atributo de cada base.

### Conteos verificados por SELECT

| Tabla | Filas laboratorio |
|---|---:|
| institutions | 2 |
| users | 8 |
| teachers | 4 |
| groups | 4 |
| students | 4 |
| enrollments | 4 |
| teacher_assignments | 4 |
| audit_events | 4 |
| _prisma_migrations | 2 |
| attendances, attendance_corrections, class_sessions, devices, biometric_consents, biometric_template_metadata | 0 cada una |

Estado resultante de usuarios: 3 ADMIN activos, 1 ADMIN inactivo, 1 TEACHER activo y 3 TEACHER inactivos. Asignaciones: 2 activas y 2 inactivas. Auditorías: `auth.password_changed`=1, `student.updated`=1 y `user.updated`=2. Estos valores son compatibles con los fixtures y las mutaciones del ensayo previo; no se repusieron estados iniciales ni contraseñas. No se consultaron hashes de contraseña o datos biométricos.

Se leyó `fase-3-api-lab-resultados.json`: **49 entradas, todas PASS**, fixturesCommitted=true, completed=true y Chrome 157.0.8103.51. Los conteos de entidades coinciden con sus cantidades de aprovisionamiento. Esta revisión confirma consistencia de la evidencia exportada y el estado actual; **no es una nueva ejecución ni prueba independiente de las 49 comprobaciones**. Permanecen las limitaciones de cobertura detalladas en el informe.

### Bases protegidas y alcance de la confirmación

| Base | Comprobación actual | Conclusión sustentada |
|---|---|---|
| asistencia_facial | Inventario completo READ ONLY; 14 tablas de dominio con cero filas, 2 migraciones con hashes aprobados, estructura/RLS/permisos esperados | Compatible con el estado previamente documentado; no se realizaron escrituras durante el ensayo ni este diagnóstico |
| asistencia_facial_restore_check | Inventario READ ONLY; sin tablas, políticas, índices, funciones ni enums de aplicación | Compatible con la restauración histórica de la base vacía; no se realizaron escrituras |
| asistencia_facial_sandbox | Propietario confirmado mediante pg_database; conexión directa postgres falló con `fe_sendauth: no password supplied` | No se modificó ni reintentó. Contenido, anomalía ficticia y permisos actuales no revalidados; subsiste la evidencia histórica del ensayo de Fase 2 |

No existe en este trabajo una comparación criptográfica completa de datos antes/después ni un registro de auditoría global que permita afirmar que nadie externo modificó las bases. La afirmación de ausencia de modificaciones se limita a nuestras operaciones registradas y a la compatibilidad de los estados que sí pudieron inspeccionarse. El intento fallido de sandbox no ejecutó SQL; cualquier archivo vacío asociado a ese intento no es inventario válido. No se cambiaron credenciales ni se utilizó otro rol para eludirlo.

### Pendientes y recomendación para revisión

La autenticación administrativa del **laboratorio** ya está resuelta; el bloqueo histórico inferior para esa conexión deja de estar vigente. Para completar el diagnóstico actual de sandbox se necesitaría configurar localmente la entrada localhost:5432/asistencia_facial_sandbox para postgres y autorizar su continuación de solo lectura; no se solicita ni ejecuta cambio de permisos.

Los pendientes funcionales anteriores no se ejecutaron porque esta autorización es exclusivamente de lectura: reinicio de proceso con token vigente, expiración absoluta con repositorio real, fallo SQL de auditoría/COMMIT y trazabilidad adicional de revocación/cookies/respuestas. Conservar las 49 comprobaciones como evidencia parcial válida, sin elevarlas a aceptación completa ni activar módulos en principal. No hubo nuevas regresiones ejecutadas, cambios de dependencias, commits, push, despliegues o inicio de etapa 4. Laboratorio conservado para revisión.

## Resultado de la ejecución real del 14 de noviembre

### Precondiciones y operaciones

Se repitieron identidad y destino como asistencia_migrator: localhost:5432/asistencia_facial_api_lab, servidor ::1, propietario asistencia_migrator. Cero relaciones de usuario y cero conexiones concurrentes antes de migrar. Archivo privado excluido de Git y checksums coincidentes con los aprobados. La primera lectura de configuración desde la cuenta restringida falló EPERM; se validó bajo la cuenta local propietaria, sin cambiar ACL, copiar credenciales ni imprimir valores. Este fallo no se contó como comprobación aprobada.

Desde apps/backend se ejecutó **una sola vez**:

```powershell
& ../../node_modules/.bin/prisma.cmd migrate deploy --config prisma.api-lab.config.ts
```

Código 0. Se aplicaron `20261113000000_initial_review` y `20261114000000_corrections_enrollment_episodes`, sin baselining. Historial: ambas finalizadas y no revertidas, checksums idénticos. No repetir deploy como mecanismo de ensayo ni recrear el laboratorio.

Luego se ejecutó `scripts/api-lab-permissions.sql` como asistencia_migrator, solo en el laboratorio, en transacción con guard de destino/rol. Código 0/COMMIT. Retiró CREATE a PUBLIC/app y permisos de tablas a PUBLIC/app, y aplicó la matriz mínima autorizada. No alteró roles globales ni otras bases.

### Inventario físico observado

| Objeto | Resultado |
|---|---|
| Tablas de dominio | 14, todas RLS ENABLE/FORCE |
| Historial Prisma | 1 tabla adicional, 2 migraciones finalizadas |
| Políticas RLS | 14 |
| Índices | 42 |
| Claves foráneas | 20 |
| CHECK | 12 |
| NOT NULL de catálogo | 98 |
| Claves primarias | 15, incluyendo historial Prisma |
| Constraints tipo t en pg_constraint | 3 |
| Triggers no internos | 9 |
| Funciones public | 8 |

El JSON [fase-3-api-lab-resultados.json](fase-3-api-lab-resultados.json) conserva el inventario de tablas, permisos por tabla y nombres de 49 comprobaciones. El conteo de enums y el inventario nominal completo de índices/funciones no se exportaron todavía; no declarar inventario exhaustivo. Las restricciones únicas implementadas como índices no se incluyen en el conteo de claves primarias/FK.

Identidades técnicas verificadas: migrador para estructura/fixtures; asistencia_app para dos clientes Prisma, pool pg y todas las pruebas HTTP. App sin CREATE de base/esquema, DELETE ni TRUNCATE; sin SELECT de historial Prisma o metadata biométrica y sin UPDATE de auditoría/correcciones. No se usó postgres para simular aplicación. No se probaron intentos DDL destructivos: se comprobaron privilegios efectivos mediante catálogo.

### Fixtures confirmados

Una transacción del migrador creó exclusivamente datos ficticios: 2 instituciones A/B, 8 usuarios (4 ADMIN activos, 2 TEACHER activos y 2 TEACHER inactivos), 4 perfiles docentes, 4 grupos, 4 estudiantes, 4 episodios y 4 asignaciones (2 activas y 2 inactivas). UUID aleatorios y correos example.test. Contraseñas suministradas privadamente, sin valor predeterminado, hashes Argon2id con sales aleatorias. No se exportaron contraseñas, hashes, tokens ni nombres identificables.

Las pruebas modificaron algunos registros ficticios: una reducción del conjunto de ADMIN en A confirmó y la otra fue rechazada; se conservó un ADMIN activo en A. Un nombre sintético se actualizó mediante ETag; el docente activo de A fue desactivado después del ensayo de rollback; una contraseña ADMIN de B cambió con auditoría. No se restauró el estado inicial ni se eliminaron fixtures. El conteo final administrativo independiente quedó pendiente por la autenticación descrita abajo.

### Pruebas reales y límites

Ejecutor nuevo: `apps/backend/scripts/run-api-lab.mjs`, usando código backend compilado, fábrica de Prisma exclusiva, Express HTTPS loopback y Chrome mediante Playwright. Un marcador privado `private_data/api-lab-run.json` impide volver a lanzar el aprovisionamiento; no borrar ese marcador ni repetir el script. El campo `completed=true` del JSON significa que terminaron sus 49 comprobaciones, **no que se completaron todos los criterios de la autorización**.

| Caso | Resultado observado |
|---|---|
| Login A/B, usuario técnico asistencia_app | 200 y perfil de institución correspondiente |
| Cuenta inexistente/inactiva o contraseña incorrecta | 401 genérico |
| RLS con contexto A/B | 4 usuarios por contexto; sin contexto, cero |
| Reutilización de conexión pg | Mismo PID, contexto A/B en transacciones y cero filas después de rollback |
| ADMIN/TEACHER | ADMIN consulta usuarios; TEACHER recibe 403 |
| Alcance docente | Solo estudiante asignado; grupo con asignación inactiva 404; estudiante B desde A 404 |
| Último ADMIN | Dos clientes Prisma independientes, solicitudes Promise.all: una confirma y otra LAST_ADMIN; queda uno activo |
| ETag concurrente | Una actualización confirma y otra PRECONDITION_FAILED |
| Rollback | UPDATE real revertido al lanzar fallo controlado dentro de la auditoría; usuario y sesión conservados |
| Revocación | Desactivación confirmada rechaza la sesión docente en la siguiente solicitud |
| Contraseña | Cambio real 204, AuditEvent aumenta en uno, sesión anterior rechazada, login con nueva contraseña 200 |
| Logout | 204 y cookie eliminada |
| Caducidad | 30 minutos mediante reloj inyectado, con repositorio real; no espera física de 30 minutos |
| Reinicio de almacén | Nueva instancia AuthService rechaza token; no fue reinicio de proceso completo |
| Logs | Inspección automatizada sin frases de ensayo, passwordHash ni cookie |

La concurrencia fue ejecutada con dos clientes reales y operaciones concurrentes; no se exportó una traza temporal de locks/PID de ambas transacciones. El fallo de auditoría fue una excepción deliberada del arnés dentro de una transacción PostgreSQL real, no una violación SQL al insertar AuditEvent. No se afirma haber probado un fallo diferido de COMMIT real. La sesión docente pertenece a otra instancia de AuthService: el rechazo tras cambio demuestra revalidación de estado persistido; no prueba por sí solo un mecanismo de notificación inmediata entre procesos. El hook local posterior a COMMIT tiene evidencia de los tests con dobles de etapa 3.

### Navegador y TLS

Se usaron contextos Playwright separados A/B y páginas con fetch real por HTTPS. Cookies comprobadas: HttpOnly, Secure, SameSite=Lax y Path=/; document.cookie vacío. Para comprobar que los puertos no aíslan cookies, un tercer contexto recibió la cookie de A y la envió al puerto de B: B devolvió 401. No se asumió aislamiento por puerto.

`ignoreHTTPSErrors=true` se limitó a esos contextos de ensayo; no se modificó el almacén de Windows ni se desactivó globalmente TLS. Esto demuestra el comportamiento probado de cookies con esa excepción, no confianza PKI real. La ausencia de Domain ya tiene prueba HTTP de etapa 2; no se añadió aserción de Set-Cookie en esta ejecución. No se realizó ensayo HTTP de envío de Secure con las excepciones de localhost del navegador. CSRF ausente rechazado con 403; pruebas cross-site más amplias siguen cubiertas solo por los ensayos anteriores con dobles.

### Regresión y comandos

Se ejecutaron `node --check scripts/run-api-lab.mjs` y, una vez, `node scripts/run-api-lab.mjs` desde apps/backend. Después, desde raíz: `npm.cmd run typecheck -w apps/backend`, `npm.cmd run test -w apps/backend`, `npm.cmd run typecheck -w apps/frontend`, `npm.cmd run test -w apps/frontend`. TypeScript satisfactorio; 52/52 backend y 16/16 frontend. No se instalaron dependencias ni se modificaron migraciones, esquema o frontend.

Aviso observado: pg 8 anuncia obsolescencia de soporte pgpass para una versión futura 9. No se actualizó ni cambió el método automáticamente. Los procesos HTTPS y contextos navegador del ensayo se cerraron al finalizar; bases y datos se conservan.

### Incidencia final y pendientes

Para obtener un conteo final independiente se intentó una consulta `BEGIN READ ONLY` con postgres a localhost:5432/asistencia_facial_api_lab. La conexión falló con código 1, `fe_sendauth: no password supplied`; el SQL no llegó a ejecutarse. Se detuvo el diagnóstico sin cambiar autenticación, permisos o datos, y sin repetirlo automáticamente.

Se requiere entrada local pgpass para **localhost / 5432 / asistencia_facial_api_lab / postgres** antes de retomar ese diagnóstico. Uso exclusivamente de lectura para inventario y recuperación de identificadores técnicos ficticios necesarios para ensayos complementarios; nunca para ejecutar pruebas como app. El primer ejecutor no conservó el mapa de UUID de fixtures fuera de memoria; no recrearlos para resolver esa limitación.

Pendientes para aceptación completa: inventario final y enums, ensayo de proceso reiniciado con token todavía vigente (el ensayo de nueva instancia usó un token ya caducado y no demuestra revocación por reinicio independientemente), expiración absoluta de 8 h con repositorio real, fallo SQL de auditoría/COMMIT controlado, trazabilidad de revocación local inmediatamente posterior a COMMIT, verificación de respuestas sin secretos más exhaustiva y evidencias de cookies complementarias. Preparar un ejecutor de continuación que use fixtures existentes, sin reaprovisionar ni repetir migraciones.

Estado final de las cuatro bases: laboratorio migrado y con datos ficticios conservados; asistencia_facial, asistencia_facial_sandbox y asistencia_facial_restore_check no se conectaron ni modificaron en esta ejecución. No se afirma haber revalidado su contenido. Recomendación: aceptación parcial de la evidencia real obtenida; **no activar contra principal** hasta cerrar los pendientes y recibir autorización expresa. No se inició etapa 4, no hubo commits, push ni despliegues.

## Continuación del 14 de noviembre

- `psql -X -w` como asistencia_migrator y asistencia_app: código 0, destino asistencia_facial_api_lab, servidor ::1, puerto 5432; propietario asistencia_migrator.
- Inventario mediante pg_class/pg_namespace: cero relaciones fuera de esquemas del sistema; pg_proc: cero funciones fuera de esquemas del sistema. No hay tablas de aplicación, historial de migración ni fixtures. Estado compatible con la base creada para este ensayo.
- Permisos efectivos actuales de app: CONNECT=true, CREATE de base=false, USAGE public=true, CREATE public=false. No se otorgaron nuevos permisos.
- SHA-256 verificados e idénticos: esquema `61cc948e724be0258637b8c48ea4d7bf6868453c466465b8119eccacb39a66bf`; inicial `dc3a10d34f0d795fabe8ca6f769ccbc54c8e04ba655dc582b6f366a417a471bd`; correctiva `4fd264537d9399f122b709c0368c51744c7344be03ed0802b671855cb29a6f2b`.
- `Test-Path apps/backend/.env.api-lab` devolvió false. `git check-ignore` confirma que la ruta está excluida. No se intentó migrate deploy con configuración ausente ni se copiaron credenciales de otro entorno.
- Preparado `scripts/prepare-api-lab-secrets.ps1`: entrada local sin eco de la contraseña existente del migrador y dos frases ficticias distintas para los ensayos. Crea solo el archivo ignorado, con ACL restringida antes de escribir secretos. Base64 de las frases es transporte, no cifrado; proteger todo el archivo. No crea cuentas ni conecta a bases. No fue ejecutado por el agente y requiere intervención local del responsable; solo se verificó sintaxis PowerShell.
- No se ejecutaron migraciones, grants, fixtures, servidores, navegador ni pruebas de integración. No se repitió la suite automatizada previamente aprobada. Las tres bases protegidas no se conectaron ni modificaron en esta continuación.

Paso local pendiente, desde raíz en una terminal sin transcripción:

```powershell
./scripts/prepare-api-lab-secrets.ps1
```

No compartir el archivo, las frases ni la URL. El script no sobrescribe un archivo existente ni cambia la política de ejecución del sistema. Si la política impide ejecutarlo, informar del bloqueo sin pegar secretos. Al continuar se validará el destino de forma sanitizada antes de migrar. La autenticación real HTTP, RLS funcional, concurrencia, fixtures y cookies siguen pendientes.

## Operaciones efectivamente realizadas

1. Se leyó la autorización expresa y el plan. Git conserva el proyecto como archivos no rastreados; no se crearon commits ni se sobrescribieron cambios existentes.
2. Diagnóstico administrativo de solo lectura conectado con `psql -X -w` a `localhost:5432/postgres`: current_database=postgres, current_user=postgres, dirección del servidor ::1, puerto 5432.
3. Se confirmó ausencia de asistencia_facial_api_lab. Los roles asistencia_migrator y asistencia_app existen, tienen LOGIN y carecen de SUPERUSER, CREATEDB, CREATEROLE, REPLICATION y BYPASSRLS. No se modificaron roles.
4. Se creó exclusivamente asistencia_facial_api_lab, con propietario asistencia_migrator y template0. `createdb` terminó con código 0.
5. La conexión `psql -w` como asistencia_migrator al nuevo laboratorio terminó con código 1: `fe_sendauth: no password supplied`. Se detuvo la operación afectada antes de cualquier migración, GRANT o fixture. No se leyó pgpass ni se imprimieron credenciales.
6. Una consulta posterior al catálogo desde postgres/postgres confirmó la existencia y propiedad de las cuatro bases indicadas abajo.

Comando de creación ejecutado:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/createdb.exe' -w -h localhost -p 5432 -U postgres --maintenance-db=postgres --owner=asistencia_migrator --template=template0 asistencia_facial_api_lab
```

No repetir este comando: la base ya existe y se conserva para revisión.

## Estado observado de bases

| Base | Propietario observado en pg_database | Estado de este ensayo |
|---|---|---|
| asistencia_facial | postgres | No se conectó ni modificó; no se revalidaron sus objetos/datos |
| asistencia_facial_sandbox | asistencia_migrator | No se conectó ni modificó |
| asistencia_facial_restore_check | postgres | No se conectó ni modificó |
| asistencia_facial_api_lab | asistencia_migrator | Creada desde template0; sin migraciones ni fixtures ejecutados; inventario interno pendiente por autenticación |

No se afirma un inventario físico verificado del laboratorio: la consulta de tablas planeada no llegó a ejecutarse porque falló la conexión. Tampoco se atribuyen a esta ejecución las verificaciones históricas de las otras bases.

## Preparación de ejecutor

Creado `apps/backend/src/config/api-lab-url.ts`: permite solo localhost:5432/asistencia_facial_api_lab y el rol explícito asistencia_app o asistencia_migrator, sin parámetros ni fragmentos. Rechaza principal, sandbox, restore_check y usuarios alternativos. No modifica los validadores del runtime principal.

Creada configuración independiente `apps/backend/prisma.api-lab.config.ts`; solo consume `.env.api-lab` y `API_LAB_MIGRATION_DATABASE_URL`. No carga `.env`, `.env.sandbox` ni reutiliza credenciales de migración principal. No fue ejecutada contra PostgreSQL. La ruta del esquema y las dos migraciones existentes se reutilizan sin modificarlos. El futuro ejecutor de HTTP y navegador todavía no está implementado.

## Condiciones locales pendientes

Verificaciones locales ejecutadas: las dos pruebas del guard `api-lab-url.test.ts` pasaron (2/2), compilación backend satisfactoria y `git check-ignore apps/backend/.env.api-lab` confirmó exclusión. El primer intento de build se lanzó con selector de workspace desde el directorio backend y falló por ubicación; se corrigió ejecutándolo desde raíz. No se repitió la suite completa ni se presenta la aceptación histórica 50/50 como una nueva ejecución.

- Configurar pgpass local para host localhost, puerto 5432, base asistencia_facial_api_lab, usuarios asistencia_migrator y asistencia_app. No compartir su contenido.
- Configurar privadamente `API_LAB_MIGRATION_DATABASE_URL` en `apps/backend/.env.api-lab`, con migrador y ese destino exclusivo, sin parámetros. Prisma 7 requiere esta vía según el ensayo anterior; no copiar ni exponer la URL de principal. El archivo queda excluido por `.env.*`.
- Antes de fixtures, preparar un procedimiento interactivo local para introducir contraseñas sin eco. No hay contraseñas predeterminadas, cuentas ni hashes aprovisionados.
- Al reanudar: verificar identidad, propiedad y ausencia de objetos inesperados en la base recién creada. No tratar su existencia como autorización para reutilizar una base ajena ni recrearla.

## Matriz de resultados pendientes

| Validación | Resultado actual |
|---|---|
| Existencia previa/destino/roles | Diagnóstico satisfactorio antes de creación |
| Creación autorizada | Satisfactoria, código 0 |
| Autenticación migrador | Fallida: contraseña no disponible |
| Autenticación app | No ejecutada |
| Migraciones e historial Prisma | No ejecutados |
| Inventario de tablas, índices, funciones, triggers, RLS | Pendiente |
| Permisos mínimos del laboratorio | No configurados ni verificados todavía |
| Fixtures | 0 insertados por el ensayo |
| Login, Argon2, cambio de contraseña y auditoría reales | Pendientes |
| Autorización, RLS y pool | Pendientes |
| Concurrencia real, ETag, último ADMIN, rollback y revocación | Pendientes |
| Cookies Playwright A/B, CSRF, expiración y reinicio | Pendientes |
| Inspección de secretos en respuestas/logs reales | Pendiente; no se iniciaron servidores |

Recomendación actual: no activar etapas 2/3 contra principal. Conservar el laboratorio y completar autenticación local antes de continuar. No hubo cambios a esquema, migraciones, dependencias, biometría, frontend, roles globales o permisos de otras bases. Sin commits, push ni despliegues.
