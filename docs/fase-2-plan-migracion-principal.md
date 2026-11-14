# Fase 2 — plan de migración a la base principal

**Actualización de ejecución:** las dos migraciones y los permisos aprobados ya
se aplicaron; CREATE temporal del migrador retirado, 14 tablas de dominio vacías,
status correcto y diff vacío. Véase el [informe final](evidencias/migracion-principal-fase-2.md).
Los comandos siguientes se conservan como procedimiento histórico; no repetir
la preparación para base vacía ni la aplicación de migraciones.

Actualización 13/11/2026: respaldo y restauración del estado vacío completados
en la base independiente autorizada; consultar [evidencia y limitaciones](evidencias/recuperacion-postgresql-fase-2.md).
La ACL explícita de base no se replicó; los permisos efectivos comprobados coinciden.
Las concesiones y migraciones sobre principal siguen sin autorizar ni ejecutar.

Fecha: **13 de noviembre de 2026**, America/Guatemala.
Estado: **preparado para revisión; no ejecutado**. La aceptación técnica de la
sandbox fue otorgada expresamente por el responsable: 52/52 comprobaciones y
correspondencia del esquema. Esa evidencia se conserva en el
[informe consolidado](evidencias/ensayo-postgresql-fase-2.md).

Este plan requiere autorización expresa antes del primer GRANT, CREATE DATABASE,
restore o migrate deploy. No habilita la API, un despliegue ni biometría permanente.
La anomalía temporal heredada es exclusivamente de datos ficticios de sandbox;
se conserva documentada y no se copiará ni corregirá como parte de esta operación.

## 1. Verificación realizada y límites

Se ejecutó [principal-preflight.sql](evidencias/principal-preflight.sql) mediante
psql -w, dentro de una transacción READ ONLY y con
`default_transaction_read_only=on`. [Resultado original](evidencias/principal-preflight.json):

| Control | Resultado del 13/11, 19:41 Guatemala |
| --- | --- |
| Servidor/destino | PostgreSQL 18.6, ::1:5432, asistencia_facial |
| Actor y modo | asistencia_app, transaction_read_only=on |
| Propietario de base / public | postgres / pg_database_owner |
| Objetos de usuario | 0 relaciones, 0 funciones, 0 tipos; solo esquema public |
| Otros objetos | 0 large objects, 0 event triggers; solo extensión plpgsql |
| App y migrador | LOGIN; sin SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS ni membresías |
| Permisos efectivos de ambos | CONNECT y TEMP en base; USAGE en public; sin CREATE en base ni public |
| ACL predeterminadas personalizadas | Ninguna |

Propietarios y permisos relevantes coinciden con el ensayo anterior. El JSON
conserva además las ACL actuales para comparar al ejecutar. CONNECT/TEMP de PUBLIC
son privilegios predeterminados; no se retiraron. En consecuencia, «sin CREATE»
no significa «sin posibilidad de tablas temporales». El endurecimiento propuesto
más abajo retira TEMP de PUBLIC únicamente en esta base, sujeto a aprobación.

Git continúa con archivos sin seguimiento; no se hizo commit ni se descartaron
cambios. No se leyó pgpass ni se imprimieron URLs o secretos. No se conectó a la
sandbox ni se ejecutó de nuevo su suite de escritura durante esta preparación.

## 2. Artefactos inmutables y precondiciones

| Artefacto | SHA-256 comprobado |
| --- | --- |
| `20261113000000_initial_review/migration.sql` | `dc3a10d34f0d795fabe8ca6f769ccbc54c8e04ba655dc582b6f366a417a471bd` |
| `20261114000000_corrections_enrollment_episodes/migration.sql` | `4fd264537d9399f122b709c0368c51744c7344be03ed0802b671855cb29a6f2b` |
| `apps/backend/prisma/schema.prisma` | `61cc948e724be0258637b8c48ea4d7bf6868453c466465b8119eccacb39a66bf` |

Los dos SQL contienen BEGIN/COMMIT. La inicial crea el dominio y la correctiva
añade integridad bidireccional y episodios. No se modificaron. El comentario
«BORRADOR / No aplicado» de la inicial es histórico: no se cambia porque alteraría
su checksum; el estado efectivo está en el informe y en el historial de sandbox.

Antes de ejecutar deben cumplirse **todas** estas condiciones:

1. Autorización nueva para permisos y aplicación en principal; autorización
   separada que nombre la base aislada de recuperación antes de crearla.
2. Repetir diagnóstico y comprobar que todo sigue vacío, sin `_prisma_migrations`,
   otras relaciones, funciones o tipos. Ante objetos inesperados, detenerse:
   este procedimiento no sirve para una base parcialmente migrada.
3. Exactamente los dos directorios de migración indicados, lock PostgreSQL,
   hashes coincidentes, Prisma/client/adapter 7.10.1 y Node 24.20.0 del lockfile.
4. Copia privada del código, SQL, lockfile, inventario y permisos; respaldo
   verificable y ensayo de recuperación satisfactorio antes de tocar principal.
5. API y otros escritores detenidos; una sola ejecución de migración; credenciales
   del migrador separadas de app. No usar postgres para ejecutar Prisma.
6. Espacio suficiente para respaldo, restauración y WAL, ventana de mantenimiento
   y operador disponible. No se ha medido todavía duración/RTO de recuperación.

Desde la raíz, controles sin escritura en base:

```powershell
git status --short
git check-ignore apps/backend/.env apps/backend/.env.sandbox backups/principal/revision.dump
Get-ChildItem apps/backend/prisma/migrations
Get-FileHash apps/backend/prisma/migrations/*/migration.sql,apps/backend/prisma/schema.prisma -Algorithm SHA256
npm.cmd run prisma:validate -w apps/backend
npm.cmd run test -w apps/backend
npm.cmd run test -w apps/frontend
npm.cmd run typecheck -w apps/backend
npm.cmd run build -w apps/backend
```

## 3. Respaldo previo y recuperación aislada — todavía pendientes

Usar binarios PostgreSQL 18 instalados. Ruta propuesta privada:
`C:\Projects\AsistenciaFacial\backups\principal\<marca-local>\`, excluida por
`backups/`. Restringir su ACL de Windows al operador y administradores autorizados,
conservarla en volumen local cifrado y verificar acceso antes del dump. No subir
dump, SQL restaurado o credenciales a Git. No exportar contraseñas de roles.

La copia es de **principal**, jamás de sandbox. Se propone postgres para el
respaldo completo: después de migrar FORCE RLS puede impedir un dump completo
con el migrador. Es una sesión administrativa de lectura, no la identidad app.
pg_dump no guarda roles globales: se usan los existentes, sin recrearlos.
Guardar ACL de base/esquema del preflight aparte; restaurar sin --create no
restablece automáticamente todos los atributos/ACL de la base original.

Comandos previstos, PowerShell desde raíz; comprobar cada salida y detener ante
error. La marca crea una carpeta nueva: no sobrescribir un respaldo existente.

```powershell
$pgBin = 'C:/Program Files/PostgreSQL/18/bin'
$backupDir = Join-Path (Get-Location) ('backups/principal/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $backupDir) { throw 'Ruta de respaldo ya existe' }
New-Item -ItemType Directory -Path $backupDir -ErrorAction Stop | Out-Null
# Revisar/restringir ACL localmente antes de continuar.
Get-Acl -LiteralPath $backupDir | Format-List
$dumpFile = Join-Path $backupDir 'principal-pre-migracion.dump'
$env:PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=60000'
try {
  & "$pgBin/psql.exe" -X -w -q -t -A -h localhost -p 5432 -U asistencia_app -d asistencia_facial -v ON_ERROR_STOP=1 -f docs/evidencias/principal-preflight.sql -o "$backupDir/preflight.json"
  if ($LASTEXITCODE -ne 0) { throw 'Preflight falló' }
  & "$pgBin/pg_dump.exe" -w -h localhost -p 5432 -U postgres -d asistencia_facial --format=custom --file=$dumpFile
  if ($LASTEXITCODE -ne 0) { throw 'Respaldo falló' }
} finally { Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue }
& "$pgBin/pg_restore.exe" --list $dumpFile
if ($LASTEXITCODE -ne 0) { throw 'Archivo de respaldo ilegible' }
Get-FileHash -LiteralPath $dumpFile -Algorithm SHA256
```

Revisar el preflight antes de seguir; conservar hash, tamaño, versión de herramientas
y hora. `pg_restore --list` solo verifica lectura del archivo, **no demuestra
recuperación**. La prueba siguiente es una puerta de aprobación pendiente.

Base propuesta para la prueba: `asistencia_facial_restore_check` (no creada).
Antes de crear, ejecutar consulta en postgres y detener si existe:

```powershell
& "$pgBin/psql.exe" -X -w -h localhost -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT datname FROM pg_database WHERE datname='asistencia_facial_restore_check';"
# SOLO con autorización que nombre esta nueva base y resultado anterior vacío:
& "$pgBin/createdb.exe" -w -h localhost -p 5432 -U postgres --owner=postgres --template=template0 asistencia_facial_restore_check
if ($LASTEXITCODE -ne 0) { throw 'No continuar: base no creada' }
& "$pgBin/psql.exe" -X -w -h localhost -p 5432 -U postgres -d asistencia_facial_restore_check -c "SELECT current_database(),inet_server_addr(),inet_server_port();"
if ($LASTEXITCODE -ne 0) { throw 'Destino de restauración no comprobado' }
& "$pgBin/pg_restore.exe" -w -h localhost -p 5432 -U postgres --dbname=asistencia_facial_restore_check --single-transaction --exit-on-error $dumpFile
if ($LASTEXITCODE -ne 0) { throw 'Recuperación no aprobada' }
```

Confirmar visualmente destino y vacío antes de restaurar. No usar --create,
--clean ni cambiar el destino a principal. Conservar propietarios/ACL de objetos
del archivo (no usar --no-owner para declarar fidelidad). Comparar catálogos y
conteos con el respaldo; la base vacía debe seguir sin objetos de aplicación.
La propiedad de base y la ACL de base se comparan separadamente: el ensayo no
restaura automáticamente estos atributos. Medir duración, registrar hash y
resultado; no borrar automáticamente esa base.

Un respaldo vacío prueba la recuperación del estado **previo**; no demuestra
recuperación de datos de aplicación futuros. Antes de habilitar datos persistentes
se requerirá un segundo ensayo con respaldo posterior y verificaciones de RLS,
historial, relaciones y conteos, en un destino aislado expresamente autorizado.

## 4. Permisos mínimos propuestos — NO aplicados

Mantener postgres como dueño de `asistencia_facial` y pg_database_owner de public.
El migrador será dueño solo de los objetos que cree; no será miembro de postgres
ni de app, ni obtendrá privilegios administrativos globales.

La inicial contiene `CREATE SCHEMA IF NOT EXISTS public`. PostgreSQL comprueba
CREATE sobre la base **antes** de comprobar si el esquema existe. Por ello se
requiere CREATE temporal sobre la base, además de CREATE/USAGE sobre public.
Se retirará al finalizar; no editar el SQL para evitarlo. Fundamento:
[CreateSchemaCommand de PostgreSQL 18](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/commands/schemacmds.c).

Tras aprobación, conectar como postgres exclusivamente a principal con psql -X -w
y ejecutar este SQL, comprobando resultado; no ejecutarlo ahora:

Comando interactivo desde raíz:
`& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -w -h localhost -p 5432 -U postgres -d asistencia_facial -v ON_ERROR_STOP=1 -P pager=off`.
Introducir el bloque SQL y cerrar la sesión con `\q`; no dejar sesión administrativa abierta.

```sql
BEGIN;
DO $$ BEGIN
 IF current_database()<>'asistencia_facial' OR current_user<>'postgres'
    OR inet_server_port()<>5432 OR host(inet_server_addr()) NOT IN ('::1','127.0.0.1')
 THEN RAISE EXCEPTION 'Destino o actor no autorizado'; END IF;
END $$;
GRANT CONNECT, CREATE ON DATABASE asistencia_facial TO asistencia_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO asistencia_migrator;
GRANT CONNECT ON DATABASE asistencia_facial TO asistencia_app;
GRANT USAGE ON SCHEMA public TO asistencia_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE asistencia_facial FROM PUBLIC;
COMMIT;
```

Mantener CONNECT de PUBLIC como estaba evita cambiar accesos no evaluados; el
control de autenticación local sigue dependiendo de pg_hba y credenciales.
La retirada de TEMP propuesta afecta solo esta base y debe incluirse explícitamente
en la aprobación. No otorgar CREATE a app ni permisos predeterminados amplios.

## 5. Aplicación de ambas migraciones — NO ejecutada

En principal vacía se usará **Prisma 7.10.1 migrate deploy**, que aplica ambos
directorios por orden y registra su historial. **No usar resolve --applied ni
copiar `_prisma_migrations` de sandbox**: aquí las migraciones no están aplicadas.
Tampoco ejecutar psql -f sobre los SQL en paralelo con Prisma. Deploy no utiliza
shadow database; no usar migrate dev, reset o db push. Véase
[documentación específica v7](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production).

Configurar localmente `MIGRATION_DATABASE_URL` en `apps/backend/.env`, excluido
de Git, mediante editor seguro sin imprimir contenido: rol asistencia_migrator,
host localhost, puerto 5432, base asistencia_facial, sin parámetros URL ni fragmento.
No reutilizar `.env.sandbox`. La configuración existente de principal rechaza
parámetros, incluido schema=public; el esquema por defecto es public.
No incluir contraseña en argumentos, historial de terminal ni transcripciones.

Desde `apps/backend`, después de permisos aprobados y respaldo recuperado:

```powershell
$env:PRISMA_SANDBOX = '0'
# No debe existir una MIGRATION_DATABASE_URL heredada distinta de la configuración local.
@'
import {config} from 'dotenv';
import {localDatabaseUrl} from './src/config/database-url.ts';
import pg from 'pg';
let client;
try {
  config({quiet:true});
  client = new pg.Client({connectionString:localDatabaseUrl(process.env.MIGRATION_DATABASE_URL,'migration'),
    options:'-c default_transaction_read_only=on'});
  await client.connect();
  const {rows:[r]} = await client.query("SELECT current_database() AS db,current_user AS actor,host(inet_server_addr()) AS host,inet_server_port() AS port");
  if(r.db!=='asistencia_facial'||r.actor!=='asistencia_migrator'||r.port!==5432||!['::1','127.0.0.1'].includes(r.host)) throw Error();
  const {rows:[objects]} = await client.query("SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') AS relations,(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') AS functions,(SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') AS types");
  if(Object.values(objects).some(count=>Number(count)!==0)) throw Error();
  console.log('Destino principal vacío y migrador verificados');
} catch {
  console.error('Verificación fallida; revisar localmente sin publicar credenciales');
  process.exitCode=1;
} finally { if(client) await client.end(); }
'@ | node --import tsx --input-type=module
if ($LASTEXITCODE -ne 0) { throw 'Detener: conexión no verificada' }
node ../../node_modules/prisma/build/index.js migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Migración falló: detener y revisar, no reintentar a ciegas' }
node ../../node_modules/prisma/build/index.js migrate status
if ($LASTEXITCODE -ne 0) { throw 'Historial no aprobado' }
node ../../node_modules/prisma/build/index.js migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code
if ($LASTEXITCODE -ne 0) { throw 'Hay diferencias o error de introspección' }
Remove-Item Env:PRISMA_SANDBOX
```

No activar DEBUG ni transcribir salidas de error sin revisarlas localmente.
La verificación no imprime la URL. Volver a comprobar que no hay objetos antes
de deploy; el diagnóstico debe ser inmediato y sin otros escritores. Estos
comandos son previstos: deploy en principal aún no se ha probado ni ejecutado.

## 6. Permisos de aplicación y retirada de permisos temporales

Tras deploy exitoso, como migrador conectado a principal y previa comprobación
de destino, aplicar el equivalente explícito de los permisos probados en sandbox:

Comando interactivo:
`& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -w -h localhost -p 5432 -U asistencia_migrator -d asistencia_facial -v ON_ERROR_STOP=1 -P pager=off`.
Introducir el bloque y cerrar con `\q`.

```sql
BEGIN;
DO $$ BEGIN
 IF current_database()<>'asistencia_facial' OR current_user<>'asistencia_migrator'
    OR inet_server_port()<>5432 OR host(inet_server_addr()) NOT IN ('::1','127.0.0.1')
 THEN RAISE EXCEPTION 'Destino o actor no autorizado'; END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM asistencia_app;
GRANT SELECT, INSERT, UPDATE ON institutions, users, students, teachers, groups,
 enrollments, teacher_assignments, class_sessions, devices, biometric_consents TO asistencia_app;
GRANT SELECT, INSERT ON attendances TO asistencia_app;
GRANT UPDATE (status, version) ON attendances TO asistencia_app;
GRANT SELECT, INSERT ON attendance_corrections, audit_events TO asistencia_app;
COMMIT;
```

No se concede acceso a biometric_template_metadata ni `_prisma_migrations`,
DELETE, TRUNCATE, REFERENCES o TRIGGER. No hay secuencias: los UUID los genera
el cliente Prisma. UPDATE sobre students/enrollments es necesario para los
triggers de episodios y sus bloqueos. No introducir SECURITY DEFINER.
Estos privilegios de rol técnico no sustituyen la autorización por usuario/API.

Cerrar sesión del migrador y, como postgres conectado a principal, después de
verificaciones y con la misma guardia de destino del apartado 4:

```sql
BEGIN;
REVOKE CREATE ON DATABASE asistencia_facial FROM asistencia_migrator;
REVOKE CREATE ON SCHEMA public FROM asistencia_migrator;
COMMIT;
```

No se cambia el dueño de base/esquema. Retirar CREATE limita nuevas estructuras,
pero el migrador conserva facultades de dueño sobre sus objetos existentes:
proteger su credencial y no usarla como app. Migraciones futuras que creen objetos
requerirán conceder CREATE nuevamente mediante una autorización específica.

## 7. Verificación posterior — preparada, no ejecutada

Desde raíz, ejecutar el [inventario de solo lectura](evidencias/principal-postcheck.sql)
con postgres, exclusivamente para catálogos y conteos completos pese a FORCE RLS:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/psql.exe' -X -w -h localhost -p 5432 -U postgres -d asistencia_facial -v ON_ERROR_STOP=1 -P pager=off -f docs/evidencias/principal-postcheck.sql
if ($LASTEXITCODE -ne 0) { throw 'Verificación incompleta' }
```

Revisar definiciones completas contra SQL y
[inventario validado](evidencias/ensayo-postgresql-correcciones-resultados.json),
no aceptar solo conteos:

| Criterio | Esperado |
| --- | --- |
| Dominio / metadata | 14 tablas de dominio vacías + `_prisma_migrations` con 2 filas exitosas |
| Historial | Nombres y checksums del apartado 2, finished_at no nulo, rolled_back_at nulo, applied_steps_count mayor que cero; aplicación real, no baseline |
| Propiedad | Objetos del dominio e historial del migrador; base postgres; public pg_database_owner |
| Estructura dominio | 98 columnas, 20 FK, 12 CHECK, 41 índices, 6 enums con 14 valores |
| Seguridad/integridad | 9 triggers habilitados, 8 funciones, 14 políticas RLS; ENABLE y FORCE en todas las tablas de dominio |
| Índices especiales | attendances_one_active_per_session y audit_one_per_correction con predicados correctos |
| Integridad diferida | attendance_correction_required, correction_requires_transition y audit_requires_correction DEFERRABLE INITIALLY DEFERRED |
| Episodios | FK attendances_episode_fkey y triggers de períodos/asistencias presentes |
| Privilegios app | Según matriz del apartado 6; UPDATE de asistencia solo status/version; no acceso a historial Prisma/metadata biométrica |
| Prisma | migrate status exitoso y diff vacío; no sustituyen inspección de triggers/RLS |

Repetir el preflight para propietarios/roles/permisos (esta vez relaciones ya no
vacías) y comparar diferencias **solo** con lo autorizado. App y migrador deben
quedar sin CREATE en base/public y sin TEMP efectivo tras el endurecimiento.
No otorgar UPDATE a toda attendance para corregir errores de permisos.

Como asistencia_app, en psql con -X -w y destino explícito principal, comprobar:

```sql
BEGIN READ ONLY;
SELECT current_database(),current_user,current_setting('app.institution_id',true);
SELECT count(*) FROM public.attendances;
SELECT has_database_privilege(current_user,current_database(),'CREATE'),
       has_schema_privilege(current_user,'public','CREATE'),
       has_table_privilege(current_user,'public.audit_events','DELETE'),
       has_table_privilege(current_user,'public.audit_events','UPDATE'),
       has_table_privilege(current_user,'public._prisma_migrations','SELECT');
ROLLBACK;
```

Esperado: principal/app, contexto ausente, count=0 y cinco false. Cero filas en
base vacía **no prueba por sí solo aislamiento**; esa prueba con dos instituciones
ya se ejecutó en sandbox. No correr integration-v2.mjs ni insertar fixtures en
principal. Las pruebas de escritura/concurrencia sobre principal no forman parte
de este plan. Conservar el informe de resultados antes de habilitar cualquier API.

## 8. Fallos, interrupciones y recuperación

- Cada archivo tiene su propia transacción; **el par completo no es atómico**.
  Si falla la correctiva, la inicial puede estar confirmada y Prisma puede
  conservar una fila de fallo. No habilitar app en ese estado.
- Ante fallo: detener, cerrar escritores, capturar catálogos, historial sin
  publicar `logs` sin revisión, hashes y error sanitizado. Comparar estado físico
  con el punto esperado. No asumir rollback por el código de salida de CLI.
- No editar migraciones aplicadas, eliminar filas de `_prisma_migrations`, usar
  reset/db push o resolve --applied para ocultar un fallo. Un resolve --rolled-back
  requeriría comprobar rollback real y autorización específica de recuperación.
- La recuperación preferida se prueba en una **base aislada vacía autorizada**
  con el dump preoperación y el procedimiento del apartado 3. No usar --clean.
  Restaurar el dump vacío sobre principal parcialmente migrada **no elimina**
  los objetos nuevos y no constituye reversión.
- Para devolver principal al estado previo se necesita un plan adicional aprobado:
  inventario de objetos a retirar o sustitución controlada de base restaurada,
  cierre de conexiones, permisos/propietario originales y verificación de ausencia
  de escrituras posteriores. No se incluyen comandos destructivos ejecutables
  automáticamente ni se presupone autorización para eliminar/renombrar principal.
- Si solo falla una concesión de permisos, mantener app detenida; comparar ACL,
  proponer corrección específica y repetir verificaciones. No ampliar privilegios
  globales para sortear el error.

Los bloqueos ACCESS EXCLUSIVE de la correctiva y su retirada temporal de FORCE
para backfill están dentro de su transacción; por eso se exige base vacía sin
escritores. En la principal no habrá backfill de filas ni anomalía heredada.
El ensayo de recuperación debe fijar un RTO observado; no se promete un tiempo
de restauración antes de medirlo. Con escritores detenidos, el respaldo aprobado
representa el punto de recuperación previo a esta migración.

## 9. Validaciones de esta preparación y aprobación pendiente

Ejecutadas realmente: diagnóstico de solo lectura (exit 0), hashes de ambos SQL
y esquema, Prisma validate (exit 0), backend **16/16**, frontend **16/16**,
TypeScript y build backend (exit 0). No se instalaron dependencias.
También se comprobaron los enlaces locales y la sintaxis de los cinco bloques
PowerShell (0 errores), sin ejecutarlos. El SQL de postverificación está preparado,
pero no se ejecutó porque todavía no existen las tablas principales.
No se ejecutaron deploy, grants, dump, restore, pruebas de integración con escritura
ni creación de una base. Las **52 pruebas** son la evidencia aceptada del ensayo
anterior, no una nueva ejecución en esta preparación.

Para aprobar ejecución deben revisarse y autorizarse: nombre/destino de recuperación,
respaldo y recuperación probados, concesiones temporales y retirada de TEMP,
deploy de ambos hashes, permisos de app y retirada de CREATE. Si cambia cualquier
precondición, detenerse y presentar la diferencia. La aceptación posterior exige
todos los controles de la sección 7, ningún objeto/dato inesperado y documentación
del resultado. Fase 1 continúa abierta; no se cambia YuNet/SFace ni se habilita
almacenamiento biométrico.

Fuentes oficiales revisadas: [pg_dump 18](https://www.postgresql.org/docs/18/app-pgdump.html),
[pg_restore 18](https://www.postgresql.org/docs/18/app-pgrestore.html),
[privilegios PostgreSQL 18](https://www.postgresql.org/docs/18/ddl-priv.html)
y documentación Prisma v7 enlazada arriba. No confundir los comandos de versiones
posteriores de Prisma con los de 7.10.1 fijados en este proyecto.
