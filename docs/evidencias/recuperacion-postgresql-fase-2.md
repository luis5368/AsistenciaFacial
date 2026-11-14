# Fase 2 — respaldo y prueba de recuperación

## Estado vigente — restauración completada

13 de noviembre de 2026, America/Guatemala. Se completó la continuación autorizada
sin crear de nuevo la base, sobrescribir respaldos ni modificar la principal.
**pg_restore terminó con exit 0; duración observada: 185,581 ms (aprox. 0,186 s).**
La medición abarca la ejecución del proceso local, no todo el procedimiento
operativo, y no constituye una garantía de RTO para una base con datos.

Antes de restaurar se verificó la conexión postgres a ::1:5432 y el destino exacto
`asistencia_facial_restore_check`, propiedad de postgres, sin objetos inesperados.
Se conservaron [diagnóstico previo del destino](recuperacion-destino-antes.json),
[consulta utilizada](recuperacion-destino-diagnostico.sql) y
[diagnóstico posterior](recuperacion-destino-despues.json).

Se utilizó exclusivamente el respaldo válido del segundo intento:

- Ruta: `backups/principal/20261113-204826-recuperacion/principal-pre-migracion.dump`.
- Tamaño verificado: **1.097 bytes (mil noventa y siete)**.
- SHA-256 antes y después: `149beb403d6cb8b19401fbc335e8c9adb53221c175d3c2a728927324bd56becd`.
- `pg_restore --list`: exit 0; 5 entradas internas, sin objetos de aplicación.
- No se alteró la carpeta privada ni el archivo vacío del primer intento.

Comando efectivamente ejecutado:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/pg_restore.exe' -w -h localhost -p 5432 -U postgres --dbname=asistencia_facial_restore_check --single-transaction --exit-on-error 'C:/Projects/AsistenciaFacial/backups/principal/20261113-204826-recuperacion/principal-pre-migracion.dump'
```

No se usaron --clean, --create, createdb ni comandos de migración. No hubo errores
de autenticación en esta continuación. [Resultado y medición](recuperacion-ejecucion.json).

### Comparación de inventarios

| Elemento | Principal original | Destino restaurado |
| --- | --- | --- |
| Propietario de base | postgres | postgres, establecido al crear el destino |
| Esquema public / dueño | public / pg_database_owner | Igual |
| ACL de public | pg_database_owner=UC; PUBLIC=U | Igual |
| Relaciones, funciones y tipos de usuario | 0 / 0 / 0 | 0 / 0 / 0 |
| Historial Prisma | Ausente | Ausente |
| Large objects / event triggers | 0 / 0 | 0 / 0 |
| Extensiones | plpgsql | plpgsql |
| ACL predeterminadas personalizadas / membresías | Ninguna | Ninguna |
| Permisos efectivos app y migrador | CONNECT/TEMP, USAGE public; sin CREATE ni privilegios administrativos | Iguales |
| ACL explícita de base | PUBLIC=Tc, postgres=CTc, asistencia_app=c | NULL: privilegios predeterminados |

La diferencia de ACL de base es **esperada**, ya identificada en el plan:
sin --create no se restablecen automáticamente los atributos/ACL de la base
original. El destino conserva permisos predeterminados y app recibe CONNECT
mediante PUBLIC, sin la entrada explícita adicional de principal. No se ejecutaron
GRANT/REVOKE para igualarlas. La propiedad coincide por la creación autorizada,
no como prueba de que el dump la haya restaurado. Tampoco se restauraron roles
globales ni se probaron configuraciones específicas de base/rol.

El [comparador de resultados](recuperacion-comparacion.json) encontró solo
`database_acl` entre origen y destino, excluyendo nombre, actor y hora del
diagnóstico. Entre destino previo/posterior no hay diferencias de inventario,
como corresponde a este respaldo vacío.

Se repitió el [diagnóstico posterior de principal](recuperacion-principal-despues.json)
como asistencia_app con BEGIN READ ONLY y default_transaction_read_only=on.
Comparado con el [original](recuperacion-principal-antes-intento2.json), no hay
diferencias en ninguno de los campos inventariados salvo la hora. Principal
permanece vacía y con propietarios/permisos intactos. Esta comprobación es de
catálogos y permisos, no una comparación binaria de archivos físicos del servidor.

### Alcance de la aceptación y recomendación

El ensayo acredita que el respaldo actual de una **base vacía** es legible y que
pg_restore termina satisfactoriamente en el destino aislado. No prueba recuperación
de tablas, registros, triggers, RLS o historial Prisma después de las migraciones:
esos objetos aún no existen en principal. Se requerirá otro ensayo autorizado
con un respaldo posterior para evaluar esos escenarios.

Se conservan ambos intentos de respaldo, la base restaurada y las evidencias JSON.
La sandbox y su anomalía ficticia no se tocaron. No hubo commits, push, despliegues,
migraciones ni cambios de permisos/propietarios de principal. No se repitieron
pruebas de aplicación porque no se modificó código funcional.

**Recomendación:** dar por superada la prueba de recuperación del estado vacío
con la salvedad documentada de ACL de base. Es viable solicitar revisión y nueva
autorización del plan de migración principal; no ejecutarlo con esta autorización.

---

## Historial — segundo intento, respaldo válido y restauración pendiente

13 de noviembre de 2026, America/Guatemala. Esta sección sustituye el estado
operativo del primer intento conservado más abajo.

Se repitió el diagnóstico de solo lectura a las **20:48:26**:
[JSON del segundo intento](recuperacion-principal-antes-intento2.json).
Principal continúa sin relaciones, funciones ni tipos de aplicación, y sin
historial Prisma. Propietario postgres, public de pg_database_owner, permisos
de app/migrador y ACL sin cambios respecto del diagnóstico anterior.

Se creó una carpeta nueva, excluida de Git:
`C:\Projects\AsistenciaFacial\backups\principal\20261113-204826-recuperacion\`.
Su ACL NTFS tiene herencia desactivada y FullControl limitado a la identidad
de ejecución, SYSTEM y Administradores, como en el primer intento. Se conservó
allí una copia del diagnóstico previo. La carpeta anterior y su archivo vacío
no se modificaron ni se utilizaron como respaldo.

| Comprobación | Resultado real |
| --- | --- |
| Archivo | `principal-pre-migracion.dump`, formato custom, gzip |
| pg_dump | Exit 0, PostgreSQL 18.6, origen asistencia_facial |
| Tamaño | **1.097 bytes** |
| SHA-256 | `149beb403d6cb8b19401fbc335e8c9adb53221c175d3c2a728927324bd56becd` |
| pg_restore --list | Exit 0; 5 entradas internas de TOC, sin objetos seleccionados de aplicación |
| Creación del archivo | 20:48:42, hora local |

Se ejecutó pg_dump con los mismos argumentos documentados abajo, usando la nueva
ruta y `default_transaction_read_only=on`. El listado vacío de objetos concuerda
con la base sin objetos de aplicación; no demuestra todavía una restauración.

Después del respaldo, una nueva consulta administrativa a localhost:5432/postgres
comprobó identidad postgres, dirección loopback, puerto 5432 y ausencia del destino.
Solo entonces se ejecutó, con **exit 0**:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/createdb.exe' -w -h localhost -p 5432 -U postgres --maintenance-db=postgres --owner=postgres --template=template0 asistencia_facial_restore_check
```

La comprobación siguiente con psql -X -w, usuario postgres y base
asistencia_facial_restore_check falló: **`fe_sendauth: no password supplied`**.
Se detuvo el procedimiento, sin ejecutar pg_restore ni nuevas consultas de BD.

**Entrada local requerida:** host `localhost`, puerto `5432`, base
`asistencia_facial_restore_check`, usuario `postgres`. No compartir contraseñas.

La base de recuperación **ya fue creada en este intento autorizado** y se conserva
sin restauración. No volver a ejecutar createdb. Antes de continuar deberá
inspeccionarse que corresponde a esta creación (propietario postgres, base vacía,
sin objetos inesperados), sin sobrescribirla ni eliminarla. La regla de detenerse
ante una base preexistente impidió reutilizar otras bases; esta es la creada por
el procedimiento actual, cuya autenticación queda pendiente.

Comparación física origen/destino, permisos recuperados, duración de restauración
y diagnóstico posterior de principal: **pendientes**, porque la instrucción exige
detenerse cuando falta autenticación. La única escritura PostgreSQL ejecutada
fue crear el destino autorizado; no se modificó principal. No se hicieron GRANT,
REVOKE, cambios de propietario, migraciones, commits, push ni despliegues.

Recomendación: conservar el respaldo válido, completar autenticación del destino
y probar la restauración antes de considerar la migración principal. El tiempo
de recuperación sigue sin medirse. No declarar superada todavía esta puerta.

---

## Historial — primer intento

Fecha: 13 de noviembre de 2026, America/Guatemala.
**Estado: detenido por autenticación; recuperación no ejecutada ni aprobada.**
Se respetó la instrucción de detenerse al faltar una entrada específica para
la conexión administrativa. No se consultaron contraseñas, .env ni pgpass.conf.

## Diagnóstico previo

[Evidencia JSON](recuperacion-principal-antes.json), obtenida a las 19:54:07
mediante [principal-preflight.sql](principal-preflight.sql), psql -X -w,
actor asistencia_app, destino localhost:5432/asistencia_facial, dirección ::1,
PostgreSQL 18.6. Se usó BEGIN READ ONLY y default_transaction_read_only=on.

| Elemento | Resultado |
| --- | --- |
| Propietario de base | postgres |
| Esquema public | Propiedad de pg_database_owner; ACL conservada |
| Relaciones, funciones y tipos de usuario | 0, 0 y 0 |
| Historial Prisma | Ausente; no hay relaciones de aplicación |
| Large objects / event triggers | 0 / 0 |
| Extensiones | Solo plpgsql |
| App y migrador | CONNECT/TEMP y USAGE; sin CREATE en base/public ni atributos administrativos |
| ACL de base | PUBLIC=TEMP/CONNECT; postgres=CREATE/TEMP/CONNECT; asistencia_app=CONNECT |

La consulta administrativa de solo lectura a localhost:5432/postgres autenticó
como postgres y confirmó ::1:5432. La consulta
`SELECT datname FROM pg_database WHERE datname='asistencia_facial_restore_check'`
devolvió **0 filas**. No se ejecutó createdb.

## Carpeta privada y respaldo fallido

Ruta local conservada (excluida de Git por `backups/`):
`C:\Projects\AsistenciaFacial\backups\principal\20261113-195407-recuperacion\`.

La ACL NTFS tiene herencia desactivada y únicamente tres entradas explícitas
FullControl: identidad de ejecución `DESKTOP-MG9M73B\CodexSandboxOffline`,
SYSTEM y Administradores. No hay entradas heredadas. La revisión por otro
usuario podría requerir acceso administrativo. No se comprobó cifrado del volumen.
Se conservó `preflight.json` (1.793 bytes) dentro de esta carpeta.

Comando intentado, con default_transaction_read_only=on y statement_timeout=60000:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe' -w -h localhost -p 5432 -U postgres -d asistencia_facial --format=custom --file='C:/Projects/AsistenciaFacial/backups/principal/20261113-195407-recuperacion/principal-pre-migracion.dump'
```

Resultado: **exit 1**, `fe_sendauth: no password supplied`.
El archivo generado tiene **0 bytes** y no es un respaldo válido.
Su SHA-256 es `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
identifica únicamente el archivo vacío y no acredita recuperación.
No se ejecutó pg_restore --list porque el dump falló. No se borró el archivo.

Entrada de autenticación local que debe configurar el responsable:

| Host | Puerto | Base | Usuario |
| --- | --- | --- | --- |
| localhost | 5432 | asistencia_facial | postgres |

No compartir la contraseña en la conversación. La autenticación de postgres
a la base postgres ya funcionó; eso no garantiza una entrada para asistencia_facial.

## Restauración e inventario comparativo

| Control | Origen | Destino |
| --- | --- | --- |
| Base | asistencia_facial, vacía | asistencia_facial_restore_check, no existe según consulta previa |
| Propiedad y estructura | Inventariadas en JSON previo | No aplicable; no creada |
| Permisos recuperados | ACL original registrada | No restaurados ni comparados |
| Restauración | Pendiente de respaldo válido | No ejecutada |
| Tiempo de recuperación | No medido | No hubo restauración |

No se obtuvo diagnóstico posterior de PostgreSQL: se detuvieron las conexiones
al producirse el fallo, conforme a la instrucción del responsable. No se ejecutó
ninguna operación de escritura en la principal. Al reanudar deben repetirse
diagnósticos previo y posterior; no reutilizar esta evidencia como comprobación
futura de estado.

Una restauración sin --create no restablece automáticamente la propiedad y ACL
de la base, configuraciones específicas de base/rol ni roles globales; deberán
compararse separadamente. La restricción vigente prohíbe GRANT/REVOKE: antes de
restaurar habrá que inspeccionar el listado del dump y omitir su restauración de
ACL si contiene esas instrucciones, documentando las diferencias, sin aplicarlas
silenciosamente. No se ha inspeccionado aún un dump válido.

## Continuación y recomendación

No recomendar todavía la migración principal: falta un respaldo válido y una
recuperación real comprobada. Después de configurar la autenticación, repetir
preflight y ausencia de destino, crear otra carpeta privada para el nuevo intento
sin sobrescribir esta evidencia, ejecutar dump/list/hash y continuar solamente
si todos tienen éxito. Si falta autenticación específica para el destino de
restauración, detenerse e indicar únicamente los parámetros necesarios.

No se ejecutaron migraciones, GRANT, REVOKE, ALTER ROLE, creación/borrado de bases,
commits, push o despliegues. No se tocó sandbox ni su anomalía ficticia. No hubo
cambios de código que justificaran repetir pruebas unitarias: esta tarea es
operativa y su comprobación de recuperación está pendiente.
