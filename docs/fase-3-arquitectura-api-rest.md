# Fase 3 — propuesta de arquitectura API REST

**Actualización vigente:** etapas 0/1 y autenticación de etapa 2 aceptadas para laboratorio. Etapa 3 implementada de forma aislada: institución propia, usuarios, docentes, estudiantes, grupos y asignaciones; 50/50 pruebas backend y 16/16 frontend satisfactorias. Administración NO está montada en el runtime ni activada contra PostgreSQL. Autenticación real y cookies en navegador siguen pendientes. Véanse [evidencia de etapa 3](evidencias/fase-3-etapa-3-administracion.md), [OpenAPI](openapi-v1.json), [ADR 006](decisiones/ADR-006-administracion-aislada.md) y [plan de validación real pendiente de autorización](fase-3-plan-validacion-real.md). No se inicia etapa 4.

Decisiones de implementación de etapa 3: bloqueo institucional con ReadCommitted explícito y comprobación vigente del actor; ETag dentro de transacción; auditoría atómica; revocación después del COMMIT. Se añadió GET `/teachers/{id}/assignments/{groupId}` para recuperar el ETag de edición. No hay campo active en Teacher: se usa el usuario y la asignación. El módulo de matrícula no se implementa; el filtro docente solo consulta episodios existentes. El texto inferior conserva la propuesta histórica y no constituye autorización para activar rutas o aprovisionar una base.

Fecha de revisión: 13 de noviembre de 2026, America/Guatemala.
**Estado del texto original: propuesta histórica; consultar actualización vigente arriba.** No se ejecutaron consultas
de BD, migraciones, inserciones ni modificaciones de código durante esta revisión.
El título Fase 3 responde al entregable solicitado; el roadmap original ubica
el núcleo API en Fase 2 y los flujos de asistencia en Fase 3. Este documento no
declara terminadas esas fases ni cambia su alcance académico automáticamente.

## 1. Decisiones propuestas y diferencias que requieren aprobación

| Decisión | Propuesta | Motivo y límite |
| --- | --- | --- |
| Organización | Monolito modular Express/TypeScript, controladores delgados, servicios transaccionales y repositorios Prisma | Aprovecha apps/backend; no añade servicios ni carpetas raíz |
| Contexto institucional | Una institución configurada por instancia local; sesión autenticada liga institución/usuario | Evita búsqueda global de correo bajo RLS; futuras instancias pueden usar un mapa de portales controlado por servidor |
| Autenticación | Contraseña Argon2id y sesión opaca en cookie; almacén en memoria acotado para laboratorio de una sola instancia | El esquema no incluye sesiones; reiniciar invalida todas. No apto para producción/múltiples procesos |
| Roles | ADMIN institucional y TEACHER con asignación activa al grupo | No hay superadministrador global ni roles estudiantiles |
| Período académico | schoolYear del grupo y calendario local versionado en configuración del servidor | No hay entidad AcademicPeriod ni cierres persistidos |
| Sincronización | Eventos manuales v1, UUID y hash existentes, transacción por evento | No integrar biometría; los ACK se emiten después del COMMIT |
| Correcciones | Solo ADMIN; una transición real por asistencia/transacción; historial y auditoría atómicos | Preserva triggers y versiones existentes; docente no puede corregir todavía |
| Offline | Límite propuesto de envío tardío de 24 h y reautenticación online al sincronizar | Fecha del dispositivo es declarativa, no prueba de identidad/tiempo |
| Borrado | Ningún DELETE de entidades académicas; desactivar/cerrar/revocar según campo existente | El rol app no tiene DELETE y los históricos son protegidos |

No hay concesiones de permisos pendientes según el
[informe final](evidencias/migracion-principal-fase-2.md): CREATE del migrador
retirado, app sin DDL, sin DELETE/TRUNCATE y sin acceso a metadata biométrica
o historial Prisma. No se solicita ampliar privilegios para esta propuesta.

### Inconsistencias y capacidades ausentes

1. **Login e institución:** email es único por institución, no global. Las 14
   tablas están bajo RLS y no puede buscarse un usuario globalmente sin contexto.
   Propuesta inicial: `API_INSTITUTION_ID` validado al arrancar y administrado
   fuera de HTTP. La instancia solo atiende esa institución; pruebas ejecutan
   instancias A/B contra fixtures aislados. No aceptar X-Institution-ID ni un
   institutionId del cuerpo como autorización. Un futuro Host debe resolverse
   exclusivamente mediante lista permitida y proxy confiable, no copiarlo a SQL.
2. **Sesiones y revocación:** faltan tablas de sesiones, recuperación de contraseña,
   MFA e invitaciones. Proponer memoria con expiración/revocación inmediata solo
   en desarrollo local. Persistencia robusta exigiría diseño y autorización
   adicional; no añadir columnas ni un almacén externo silenciosamente.
3. **Arranque sin usuarios:** principal está vacía. No habrá registro público ni
   endpoint para crear instituciones. El aprovisionamiento inicial de institución
   y ADMIN ficticio será una tarea local separada y autorizada; nunca ID fijo,
   cuenta hardcoded o contraseña compartida por defecto.
4. **Asignaciones sin períodos:** TeacherAssignment solo tiene active; no permite
   demostrar autorización histórica. Para el prototipo se exige asignación activa
   y usuario activo al recibir el evento; una revocación bloquea también la cola
   pendiente. No reconstruir una vigencia pasada inexistente ni reactivar para
   aceptar automáticamente datos tardíos. Historial de asignaciones requiere
   futura evolución del modelo si el responsable lo necesita.
5. **Períodos y archivo:** Group tiene schoolYear pero no active ni entidad de
   período. Institution no tiene active. No inventar endpoints de cierre de
   institución/grupo que el esquema no pueda persistir. Los años habilitados y
   límites de calendario se definirán en configuración local revisada; no usar
   automáticamente el año del reloj para autorizar. En producción harán falta
   persistencia, auditoría y política institucional de cierre.
6. **Corrección limitada:** solo ACTIVE ↔ VOID, con dos motivos enumerados.
   No puede editar estudiante, sesión, fecha ni episodio de una asistencia.
   Una atribución incorrecta implica anular y registrar otro evento, dos acciones
   explícitas auditadas, no editar el histórico ni asumir atomicidad entre peticiones.
7. **Auditoría reducida:** AuditEvent registra actor/acción/recurso/fecha; no tiene
   before/after, razón libre, requestId ni resultado. Correcciones sí conservan
   estado/versión anterior y posterior. No prometer historial completo de cambios
   administrativos ni guardar esos datos en nombres de acciones. Un diseño más
   detallado requerirá aprobación adicional.
8. **Concurrencia administrativa:** no hay version en usuarios/grupos/sesiones.
   Se propone ETag calculado sobre campos canónicos y comprobación bajo bloqueo
   para PATCH, sin inventar columnas. No garantiza detectar un cambio A→B→A;
   versionado persistente sería una mejora futura. Asistencia sí tiene versión.
9. **Revocación y retención offline:** el esquema no guarda entregas/tombstones de
   sincronización. Este alcance es envío de eventos, no un protocolo completo
   de descarga y borrado sincronizado de datos personales. No cachear directorios
   académicos de forma indefinida ni declarar resuelta revocación offline.
10. **Consentimiento/biometría:** consentimientos y metadata están separados; app
    no tiene permisos sobre metadata. No exponer endpoints biométricos ni exigir
    consentimiento facial para asistencia manual. Fase 1 mantiene sus pendientes.

## 2. Fuentes revisadas y garantías existentes

Revisados: schema.prisma definitivo, ambas migraciones aplicadas, informe final,
contratos de Fase 0 y preparación Fase 2, src/domain/attendance.ts,
src/infrastructure/database.ts y app.ts. Las reglas ejecutables actuales incluyen:

- Actor e institución forman parte del hash canónico; UUID y fecha UTC normalizados.
- Evento v1 admite exclusivamente method=manual y siete campos declarados.
- Unicidad de event_uuid institucional y asistencia ACTIVE por estudiante/sesión.
- FK institucional compuesta al episodio, intervalos `[inicio, fin)` sin solapes
  para mismo estudiante/grupo y prohibición de alterar identidad del episodio.
- Triggers de integridad bidireccional asistencia/corrección/auditoría, identificación
  de transacción y máximo una transición por asistencia en esa transacción.
- RLS ENABLE/FORCE, contexto transaccional mediante withInstitution y rol app
  separado del propietario. **RLS solo filtra institución**, no docente ni grupo.

La cuenta técnica app puede escribir más de lo que debe permitir un docente:
la autorización de negocio debe ejecutarse en servicios en cada petición. RLS
no protege de un servidor comprometido que establece otro contexto institucional.
No usar credenciales del migrador/administrador en la API.

## 3. Módulos y responsabilidades

| Módulo | Responsabilidad / dependencias |
| --- | --- |
| auth | Login, sesión, logout, cambio de contraseña y revocación; usuario institucional |
| institutions | Lectura/edición limitada del perfil propio; aprovisionamiento fuera de HTTP |
| users | Alta administrativa, rol, activación; impedir eliminación del último ADMIN activo |
| teachers | Perfil vinculado 1:1 al usuario y asignaciones; no modificar institutionId/userId por PATCH |
| students | Código institucional, nombre ficticio y active; lectura mínima para docente autorizado |
| groups | Grado, sección, año escolar; calendario definido por política del servidor |
| enrollments | Episodios históricos, fechas, no solapamiento y no invalidación de asistencias |
| class-sessions | Sesiones académicas y máquina de estados; distintas de sesiones de autenticación |
| devices | Asignación administrativa, vencimiento/revocación; requisito para evento manual |
| attendances | Registro manual, lectura filtrada, corrección e idempotencia de eventos |
| sync | Validación de lote y orquestación por evento; reutiliza AttendanceService |
| audit | Registro en la misma transacción; lectura administrativa, nunca endpoint de inserción pública |

Arquitectura propuesta, sin crear todavía estos archivos:

```text
src/http/          rutas, validadores DTO, middleware, errores, controladores
src/modules/*/    servicios de casos de uso y políticas de autorización
src/domain/       reglas puras, contratos, hash, estados, errores tipados
src/repositories/ adaptadores Prisma que requieren TransactionClient
src/infrastructure/ database, session-store, password-hasher, reloj, logger
src/config/       esquema de configuración validado al arrancar
```

Secuencia: límite de tamaño/origen → sesión → validación DTO → servicio →
withInstitution → autorización vigente/bloqueos → repositorios/auditoría → COMMIT
→ respuesta. Controlador no acepta PrismaClient global ni escribe SQL. Repositorios
no abren transacciones anidadas, no deciden autorización y exigen contexto tipado.
Parametrizar SQL de bloqueos; no interpolar identificadores del usuario.
Errores diferidos al COMMIT se capturan fuera de withInstitution; nunca responder
éxito dentro del callback de transacción.

## 4. Matriz de roles de aplicación

Todos los permisos son de la institución autenticada; denegar por defecto.
«Asignado» significa Teacher activo, User activo y TeacherAssignment.active
vigente al recibir la petición, grupo/año permitidos por política de servidor.

| Operación | Sin sesión | ADMIN | TEACHER |
| --- | --- | --- | --- |
| Salud mínima y login | Sí, limitados | Sí | Sí |
| Perfil y logout propios | No | Sí | Sí |
| Crear institución / acceder a otra | No | No | No |
| Leer/editar institución propia | No | Sí / Sí | Lectura mínima / No |
| Gestionar usuarios, roles y docentes | No | Sí | Solo perfil propio de lectura |
| Gestionar asignaciones | No | Sí | Solo consultar las propias |
| Alta/edición/desactivación estudiante | No | Sí | No |
| Leer estudiantes/matrículas | No | Institución | Solo alumnos de grupos asignados; proyección mínima |
| Gestionar grupos y matrículas | No | Sí | No |
| Crear/editar/cancelar sesiones académicas | No | Sí | No en MVP |
| Abrir/cerrar sesión académica | No | Sí | Solo grupo asignado y año habilitado |
| Registrar/sincronizar asistencia manual | No | Grupos de su institución | Grupos asignados |
| Leer asistencias | No | Institución | Grupos asignados, rango permitido |
| Corregir/anular/reactivar asistencia | No | Sí | No |
| Consultar auditoría completa | No | Sí | No; sí resultado de sus eventos autorizados |
| Crear/revocar dispositivos | No | Sí | Solo consultar el propio |
| Fotos/embeddings/metadata biométrica | No | No | No |

Actor, rol e institución se resuelven en servidor. Bloquear autoescalamiento,
cambio de institutionId y desactivación/degradación del último ADMIN: serializar
operaciones de roles con bloqueo de la fila Institution y contar ADMIN activos
dentro de la misma transacción. No confiar en un rol guardado por el navegador.

## 5. Autenticación y sesiones

### Flujo local propuesto

1. Configuración fija de institución validada contra su existencia al iniciar;
   fallo cerrado si no está aprovisionada. Sin login multiinstitución global.
2. Login recibe solo email/contraseña. Normalizar email como exige el CHECK,
   buscar dentro del contexto institucional configurado y comprobar active.
   Mensaje genérico para usuario ausente, inactivo o contraseña errónea; hash
   ficticio de coste comparable en ausencia de usuario para reducir diferencias.
3. Hash Argon2id con sal aleatoria; parámetros iniciales de referencia 19 MiB,
   2 iteraciones y paralelismo 1, sujetos a benchmark local y revisión del paquete
   Windows antes de instalar. No cifrar contraseñas para recuperarlas.
   Propuesta sin MFA: mínimo 15 caracteres, máximo 128, aceptar frases/Unicode
   sin truncamiento ni normalización silenciosa; bloquear contraseñas comunes
   con recurso local revisado y no enviar contraseñas a servicios externos.
4. Emitir token aleatorio de 32 bytes; almacenar solo su hash y datos mínimos en
   SessionStore de memoria acotado. Cookie `__Host-af_session`, HttpOnly, Secure,
   SameSite=Lax, Path=/, sin Domain; HTTPS local para el ensayo. No guardar token
   en localStorage, IndexedDB ni respuestas JSON.
5. Propuesta inicial: inactividad 30 min y duración absoluta 8 h. Renovar identificador
   tras login/reautenticación; expiración se comprueba en servidor, sin prolongar
   indefinidamente la duración absoluta. Logout revoca de inmediato y borra cookie.
6. En cada petición comprobar sesión, usuario activo/rol actual y dispositivo si
   aplica. Cambio de contraseña/rol o desactivación revoca todas las sesiones del
   usuario; la lectura actual de usuario impide usar privilegios desactualizados.
   Fallo del almacén o reinicio obliga a login, no conserva acceso implícito.

Almacén de memoria: una instancia/proceso, limpieza por TTL, cupo de sesiones
global/usuario y límites ante inundación. No se propone usar MemoryStore de una
librería como solución de producción. No hay refresh tokens/JWT persistentes.
Recuperación de contraseña/MFA/correo/invitaciones quedan fuera hasta diseñar
tokens de un uso, revocación persistente y evidencias de entrega.

Cookies de sesión opacas, expiración y regeneración siguen recomendaciones de
[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
La elección de Argon2id y sus parámetros mínimos se basa en
[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### Controles HTTP y navegador

Mismo origen HTTPS para PWA/API; CORS deshabilitado por defecto. Si se necesita
Vite separado, permitir únicamente el origen local explícito y credenciales,
nunca wildcard. Para mutaciones: validar Origin/Fetch Metadata y token CSRF
asociado a la sesión en cabecera; login también comprueba origen y admite solo
JSON, no formularios cross-site. SameSite no sustituye CSRF. Limitar login por
IP y cuenta con espera progresiva, sin bloqueo indefinido fácil de provocar.
Propuesta inicial: 5 intentos fallidos por cuenta/15 min y 30 por IP/15 min,
ajustables tras ensayo; no confiar en X-Forwarded-For fuera de proxy autorizado.

Cabeceras de seguridad/CSP revisadas, desactivar x-powered-by, errores sin stack,
logs sin cuerpos de login, cookies, hashes, nombres o vectores. Logging técnico
con requestId generado por servidor, código, duración y resultado. API con
Cache-Control: no-store; Service Worker no cachea auth ni rutas de datos académicos.
El laboratorio biométrico permanece separado y no comparte su almacenamiento
de perfiles con la API. El control de XSS también importa con cookies HttpOnly.
Referencias de endurecimiento: [Express](https://expressjs.com/en/advanced/best-practice-security/).

## 6. Catálogo de endpoints propuesto

Base `/api/v1`. A=ADMIN; T=TEACHER bajo alcance de la matriz. Todos los IDs son
UUID, filtrados por contexto del servidor; ningún endpoint tiene tenantId libre.
«PATCH» usa lista explícita de campos y If-Match; no mass assignment de Prisma.

| Método y ruta | Permiso | Entrada/validación principal | Éxito |
| --- | --- | --- | --- |
| GET /health | Público | Sin detalle de BD/configuración | 200 estado mínimo |
| POST /auth/login | Público limitado | email, password; institución de servidor | 200 perfil mínimo + cookie |
| GET /auth/session | A/T | Sesión vigente | 200 perfil, expiración, token CSRF |
| POST /auth/logout | A/T | CSRF | 204, revoca cookie/sesión |
| POST /auth/password-change | A/T | currentPassword, newPassword; reautenticación | 204, revoca sesiones y exige login |
| GET /institution | A/T | Proyección por rol | 200 |
| PATCH /institution | A | name 1–160 | 200 + ETag |
| GET /users; GET /users/:id | A | Paginación/filtros permitidos | 200, sin passwordHash |
| POST /users | A | email ≤254, role ADMIN/TEACHER, contraseña inicial sin logs | 201 + Location; sin envío de correo |
| PATCH /users/:id | A | email, role, active; proteger último ADMIN | 200 + ETag |
| GET /me | A/T | Identidad de sesión | 200 perfil propio |
| GET /teachers; GET /teachers/:id | A | Paginación | 200 |
| POST /teachers | A | userId institucional activo con role TEACHER; relación única | 201 |
| GET /me/assignments | T | Año/rango permitidos | 200 |
| PUT /teachers/:id/assignments/:groupId | A | active boolean; referencias del mismo colegio | 200/201 |
| GET /students; GET /students/:id | A/T | T: existencia de matrícula en grupo asignado | 200 proyección mínima |
| POST /students | A | studentCode 1–64, fullName 1–200, ficticios | 201 |
| PATCH /students/:id | A | código/nombre/active; no reasignar ID | 200 + ETag |
| GET /groups; GET /groups/:id | A/T | T solo asignados; schoolYear autorizado | 200 |
| POST /groups | A | grade 1–80, section 1–40, schoolYear 2000–2200 | 201 |
| PATCH /groups/:id | A | grade/section; schoolYear inmutable por política API | 200 + ETag |
| GET /groups/:id/enrollments | A/T | Intervalo de consulta, episodios del grupo autorizado | 200 |
| POST /groups/:id/enrollments | A | studentId, startsAt, endsAt opcional; sin solapamientos | 201 |
| PATCH /enrollments/:id | A | Solo fechas; no excluir asistencias históricas | 200 + ETag |
| GET /groups/:id/sessions; GET /sessions/:id | A/T | Rango temporal acotado | 200 |
| POST /groups/:id/sessions | A | startsAt < endsAt; dentro del calendario | 201, PLANNED |
| PATCH /sessions/:id | A | Fechas solo PLANNED y sin asistencias | 200 + ETag |
| POST /sessions/:id/transitions | A/T | toStatus permitido; autorización y If-Match | 200 + ETag |
| GET /devices | A/T | T solo los asignados a sí mismo | 200 |
| POST /devices | A | assignedUserId activo, expiresAt futuro | 201 |
| POST /devices/:id/revocation | A | Revocación irreversible en MVP | 200; repetición devuelve revocado |
| POST /attendances | A/T | Contrato manual v1 exacto | 201 nuevo / 200 reintento |
| POST /sync/attendances | A/T | events: 1–100 eventos manuales | 200 resultados por evento |
| GET /sessions/:id/attendances | A/T | Sesión/grupo autorizados; paginado | 200 |
| GET /attendances/:id | A/T | Alcance vigente; sin campos técnicos internos | 200 |
| POST /attendances/:id/corrections | A | correctionId, expectedVersion, toStatus, reason | 201 / 200 reintento |
| GET /attendances/:id/corrections | A | Histórico de asistencia autorizada | 200 |
| GET /audit-events | A | Filtros acción/recurso/fecha, paginado | 200 |

No hay DELETE, endpoints de instituciones globales, autorregistro, subir archivos,
exportaciones masivas, escritura directa de auditoría ni endpoints de biometría.
PUT de asignación usa clave compuesta existente: actualización requiere If-Match;
creación requiere If-None-Match:*. Desactivación conserva la fila; no inventa fechas.
Un profesor que deja de ser TEACHER debe perder asignaciones activas dentro del
servicio administrativo, revocar sesiones y conservar su historial.

### Validación común y respuestas

DTO estrictos, rechazar campos desconocidos y institutionId/actorId/createdBy/
enrollmentId/payloadHash/transitionTxid suministrados al registro manual.
Solo JSON, máximo propuesto 256 KiB por petición, lote ≤100, paginación por cursor
opaco con límite 50/default y 100/máximo, filtros permitidos, rango de listados ≤31
días salvo consulta administrativa explícita. Cursor nunca concede acceso y debe
mantener filtros/contexto. Fechas del evento UTC canónico con milisegundos como
parseManualEvent; otras fechas también ISO UTC estricto. Errores de unicidad
no deben revelar identidad de recursos de otra institución.

Respuestas de recurso `{data, meta:{requestId}}`; listas `{data, nextCursor}`.
No exponer passwordHash, payloadHash, transitionTxid, secretos o relaciones Prisma
completas. Errores JSON: `{error:{code,message,requestId,fields?}}`, con fields
limitado a nombres/códigos de campo, sin repetir valores sensibles.

| HTTP | Códigos / uso |
| --- | --- |
| 400 / 415 / 413 | JSON o esquema de envelope inválido / tipo no permitido / tamaño |
| 401 | AUTH_REQUIRED, SESSION_EXPIRED, INVALID_CREDENTIALS |
| 403 | FORBIDDEN para operación de rol conocida, CSRF_FAILED |
| 404 | RESOURCE_NOT_FOUND para ID ajeno, fuera de alcance o inexistente |
| 409 | EVENT_UUID_CONFLICT, ACTIVE_ATTENDANCE_EXISTS, ENROLLMENT_OVERLAP, VERSION_CONFLICT, INVALID_TRANSITION |
| 412 / 428 | ETag no coincide / precondición If-Match ausente |
| 422 | Fecha/campo válido sintácticamente pero incompatible, NO_ENROLLMENT, DEVICE_REVOKED, SYNC_WINDOW_EXPIRED |
| 429 | RATE_LIMITED con Retry-After |
| 503 | Dependencia indisponible o concurrencia transitoria agotada; retryable |
| 500 | Invariante inesperada; mensaje genérico, incidente técnico |

Traducir P2002/23505 por restricción conocida; 23P01 a solape, FK/23514 a error
de dominio cuando sea identificable. No convertir cualquier P0001 en conflicto
esperado: clasificar los mensajes propios de triggers mediante lista cerrada,
sin exponer SQL. 40001/40P01 y equivalente Prisma P2034: máximo 3 intentos de la
transacción completa con backoff y jitter; luego 503. No reintentar errores de
validación ni cambiar UUID/payload para superar conflictos.

## 7. Autorización académica y episodios

Dentro de una misma transacción: usuario activo y rol actual → grupo derivado
de la sesión académica → año/calendario permitido → asignación docente activa
si T → estudiante y episodio del mismo colegio → dispositivo asignado al actor,
no revocado y no vencido al recibir. Aplicar incluso cuando un UUID sea válido.
deviceId es una referencia a un registro autorizado, **no atestación del equipo
físico**: un usuario autenticado puede copiarlo; no prometer identificación segura
de hardware. Revocación bloquea cargas posteriores.

Para cada nuevo evento, resolver exactamente:

```text
institutionId = contexto autenticado
groupId       = ClassSession.groupId (nunca cuerpo del evento)
studentId     = evento.student_id validado en el alcance
t             = evento.occurred_at_client
episodio      = Enrollment donde institutionId/studentId/groupId coinciden
                y startsAt <= t y (endsAt es NULL o t < endsAt)
```

0 episodios → NO_ENROLLMENT; 1 → usar su id; más de 1 → fallo de integridad,
detener ese evento sin elegir «el más reciente». Un reingreso usa el episodio de
la fecha declarada, no el vigente al sincronizar. El fin es exclusivo: exactamente
en endsAt ya no pertenece al episodio anterior. No cambiar el episodio de un
evento ya aceptado. La FK y el trigger vuelven a comprobarlo en PostgreSQL.

La API prohíbe cambiar identidad de matrículas o reasignar grupos de sesiones;
fechas de sesión con asistencias quedan inmutables por política aunque el SQL
actual no imponga esa regla. El calendario del año se configura en zona
America/Guatemala y se transforma a UTC; no confundir año local con UTC.

Máquina de sesiones propuesta: PLANNED→OPEN→CLOSED; ADMIN puede PLANNED→CANCELLED
o OPEN→CANCELLED solo sin asistencias. No reabrir CLOSED/CANCELLED en MVP. Apertura
requiere estar dentro de su horario; captura t debe estar en `[startsAt,endsAt)`.
Aceptar evento nuevo con sesión OPEN, o CLOSED solo si es envío tardío permitido
antes de endsAt+24 h. Rechazar PLANNED/CANCELLED. Rechazar t más de 5 minutos en
el futuro del servidor y receivedAt−t>24 h. Son valores propuestos, no una política
académica ya aprobada. Para casos fuera de ventana se necesita revisión posterior,
no falsificar fechas ni cambiar silenciosamente el actor.

## 8. Asistencia manual, idempotencia y auditoría

### Registro y reintentos

Contrato existente preservado: schema_version, event_uuid, student_id, session_id,
device_id, occurred_at_client, method=manual. Usar parseManualEvent y attendanceHash
sin cambiar orden canónico ni incluir el episodio derivado en el hash v1.

1. Autenticar y comprobar autorización actual de lectura/operación. Validar DTO
   y calcular hash incluyendo institución y actor confiables.
2. Dentro de withInstitution, buscar event_uuid. Si existe y hash coincide,
   devolver `already_accepted`, id y estado/versión actuales, sin insertar ni
   volver a resolver episodio. Un evento anulado no se reactiva por reintento.
   Si hash difiere, devolver conflicto/needs_review. Revalidar acceso antes de
   revelar el resultado; un actor revocado no recupera datos por conocer un UUID.
3. Para evento nuevo, bloquear/comprobar usuario, asignación, sesión, dispositivo
   y episodio; validar políticas temporales y resolver matrícula. Las validaciones
   de captura no se vuelven a aplicar como rechazo a un reintento ya persistido
   solo porque ahora la sesión esté cerrada, siempre que conserve autorización.
4. Insertar ACTIVE/v1 y audit `attendance.registered`/`attendance` con actor e
   institución del servidor, IDs generados y receivedAtServer del servidor.
5. Confirmar transacción antes del ACK. La auditoría de creación es requisito
   del servicio; el SQL solo obliga auditoría de correcciones.
6. Carrera por UUID: PostgreSQL decide. Tras error de unicidad y rollback,
   leer en **otra transacción** con contexto y comparar hash; no consultar en
   transacción abortada. Si conflicto de unicidad ACTIVE con otro UUID, informar
   ACTIVE_ATTENDANCE_EXISTS y no sobrescribir ni tratarlo como reintento válido.

Bloqueos en orden consistente y solo transacciones breves; bloqueo compartido de
referencias protege frente a revocaciones/cambios concurrentes, revocadores usan
bloqueo incompatible. El orden de matrícula debe respetar el trigger que actualiza
Student antes de revisar episodios; probar carreras con cambios de matrícula.
No esperar red, calcular hash de contraseña ni enviar mensajes dentro de una tx.

### Lotes offline

Envelope `{events:[...]}`. Rechazar tamaño/envelope inválido completo antes de
escribir; cada evento válido se procesa en transacción independiente. Mantener
el orden y devolver `{index,event_uuid,status,attendance_id?,version?,code?,retryable}`.
Estados compatibles con el dominio: accepted, already_accepted, needs_review,
rejected, retryable_error. HTTP 200 para lote autenticado procesado con resultados
mixtos; fallos globales de autenticación/CSRF usan 401/403 sin procesar eventos.
UUID duplicado en lote con payload distinto se detecta previamente y ambos quedan
needs_review; duplicado idéntico puede devolver un ACK y una repetición por índice.

Si el proceso cae después de algunos commits, no se promete atomicidad de lote:
reenviar todos con sus UUID originales recupera resultados. Cola Dexie futura
se particiona por institución/usuario/dispositivo; otro usuario no reasigna eventos.
Reautenticarse al recuperar red con la misma identidad. Session expired no borra
cola; una revocación exige revisión y política local de retención, no autoaceptación.
Sin conexión no se llama a la API ni se afirma validación servidor; UI indica
pendiente. Background Sync opcional, reintentos explícitos y jitter obligatorios.

### Correcciones

POST recibe UUID correctionId, expectedVersion, toStatus y reason enumerados.
Actor/institución se derivan; primero buscar correctionId autorizado. Si existe,
comparar asistencia, actor, fromVersion, toStatus y reason; coincidencia devuelve
ACK original sin validar contra la versión actual ya incrementada. Cambio de
contenido con el mismo ID → conflicto. No hay hash de corrección persistido:
comparar estos campos inmutables, no recordedAt generado por servidor.

Para nueva corrección: bloquear asistencia, exigir expectedVersion vigente y
estado distinto; UPDATE solo status/version; insertar AttendanceCorrection con
estados/versiones calculados y AuditEvent `attendance.corrected` con
resource_type=`attendance_correction`, resource_id=correctionId y mismo actor.
Todo en una tx y una transición por asistencia. Los triggers asignan transaction
id y comprueban las tres entidades al COMMIT. Un conflicto al reactivar por otra
ACTIVE revierte historial y auditoría. Reintento concurrente se resuelve tras
rollback y nueva lectura igual que el UUID de registro.

Otras mutaciones administrativas registran acción/recurso/actor en la misma tx;
el SQL no obliga por sí mismo esa auditoría. Los fallos de login sin usuario
identificado no caben en AuditEvent (actor FK obligatorio): usar registro técnico
local minimizado, sin inventar actor de sistema ID 1.

## 9. Plan de implementación y pruebas — no ejecutado

Cada etapa requiere aprobar antes sus decisiones y cualquier instalación.
No se habilita principal para fixtures; nuevas bases o cambios de esquema requieren
autorización independiente. Sandbox histórica se conserva, sin reset ni borrado.

| Etapa | Entrega posterior | Criterio de aceptación |
| --- | --- | --- |
| 0 | Resolver decisiones de sección 1 y contrato OpenAPI | Tenant/login, sesiones, calendario, ventanas y roles aprobados |
| 1 | HTTP, validación, errores, repositorios transaccionales | Sin consultas fuera de contexto; DTO/errores/cursors probados |
| 2 | Autenticación local y aprovisionamiento ficticio autorizado | Cookie/CSRF, expiración/revocación, límites y rechazo cross-tenant |
| 3 | Catálogos, usuarios, docentes y asignaciones | Matriz completa, último ADMIN, If-Match y auditoría atómica |
| 4 | Matrículas, sesiones y dispositivos | Reingresos, límites temporales, carreras/revocaciones sin datos huérfanos |
| 5 | Registro, sincronización y correcciones | UUID, conflictos, rollback, respuesta perdida y auditoría reproducibles |
| 6 | Ensayos E2E locales y revisión de seguridad | Sin fugas en API/Service Worker/logs; informe antes de integración UI académica |

Pruebas propuestas concretas:

- **Unitarias:** hash existente invariable; UUIDs/UTC estrictos; políticas A/T,
  límites `[inicio,fin)`, calendario y ventanas, transiciones, expiración con reloj
  inyectable, traducción de errores y normalización ETag. Mantener node:test del
  backend existente; Vitest puede usarse donde aporte valor sin migrarlo por estética.
- **HTTP con Supertest:** A/B × ADMIN/TEACHER × asignado/no asignado/inactivo;
  login genérico, cuerpo con institución/actor falsificados, ID ajeno=404, CSRF,
  token de otra instancia, passwordHash nunca serializado; límites 100/101 eventos,
  payload excesivo, cursor alterado y filtros fuera de alcance.
- **PostgreSQL real aislado:** dos instituciones ficticias; RLS sin contexto,
  reutilización de pool tras COMMIT/ROLLBACK, FK cruzadas, permisos app sin DDL;
  nuevas pruebas no deben confundirse con las 52 verificaciones ya ejecutadas.
  SQLite y mocks no demuestran políticas/triggers PostgreSQL.
- **Concurrencia:** dos envíos mismo UUID igual/distinto contenido, UUID distinto
  para misma ACTIVE, dos correcciones misma versión, corrección aislada, auditoría
  ausente, dos transiciones, revocación simultánea, cierre de episodio concurrente,
  solapamientos RC/RR y reintentos 40001/40P01 sin duplicar audit.
- **Offline/E2E Playwright:** respuesta perdida después de COMMIT, reconexión,
  expiración/login mismo actor, cambio de usuario sin mezclar cola, lote parcialmente
  confirmado, envío tardío CLOSED, docente revocado rechazado. Pruebas Android y
  reconocimiento facial siguen siendo otra evidencia, no validada por estos tests.
- **Auditoría y seguridad:** secretos ausentes de logs, callback de sesión no cacheado,
  password-change revoca sesiones, caída de store falla cerrado, autorización tras
  cambio de rol, ETag obsoleto, fallo de audit revierte mutación, último ADMIN bajo carrera.

## 10. Dependencias y riesgos antes de producción

Esta revisión no instaló ni actualizó paquetes ni ejecutó npm audit contra el
registro. Evidencia histórica local: audit Fase 2 reporta **15 paquetes afectados
(11 moderados, 4 bajos)**; el análisis backend-runtime reporta **6 moderados**.
No son 15 fallos independientes ni prueba de explotabilidad remota del API.
Los informes no acreditan el estado vigente de vulnerabilidades al implementar.

| Cadena / riesgo documentado | Medida propuesta |
| --- | --- |
| Prisma/dev/streams-local/ajv/fast-uri (URI parsing) | Repetir audit y npm explain; examinar grafo real de bundle runtime y uso de URI; no exponer herramientas dev ni afirmar exclusión solo por devDependencies |
| Workbox/Vite/glob/minimatch | Revisar entradas de compilación y riesgo de consumo de recursos; no procesar patrones externos; actualizar solo mediante PR/cambio autorizado y regresiones PWA |
| deepmerge / serialize-javascript | Evitar merge genérico de DTO y serialización de datos no confiables en scripts; confirmar versiones/rutas alcanzables |
| pg 8.23.1, aviso pgpass futuro | No usar pgpass implícito como contrato de producción; configuración segura del proceso app, sin cargar .env migrador en runtime |
| Sesiones, hash, validación, cabeceras, rate limit, Supertest | Paquetes candidatos aún por seleccionar; revisar licencia, mantenimiento, Windows/Node24, transitivas, versiones exactas y pruebas antes de instalar |

Referencias de evidencia: [audit completo](evidencias/npm-audit-fase-2.json),
[audit backend](evidencias/npm-audit-backend-runtime-fase-2.json). Antes de producción:
auditoría nueva con fecha, SBOM/lock reproducible, comprobar alcance y mitigación
de cada aviso; no npm audit fix automático ni cambios sorpresa en Prisma/biometría.

Puertas adicionales: sesiones/revocación persistentes y MFA administrativo,
calendario y asignaciones históricas modelados si se requieren, protección de
secretos y rotación, HTTPS, política de retención, backup del esquema migrado
y recuperación real, límites de carga/pool y observabilidad, revisión de autorización
independiente, y autorización legal/ética de cualquier piloto. Nada de ello
autoriza ahora producción ni datos reales de menores.

## 11. Resultado de esta tarea y aprobación solicitada

Se realizó revisión estática de archivos y evidencias y consulta de documentación
oficial de seguridad. No se probó una API inexistente ni se volvió a ejecutar
la suite de integración; los resultados históricos se identifican como tales.
Solo se creó esta propuesta Markdown. No se modificaron BD, modelos, SQL,
dependencias, frontend o motor biométrico.

Solicitar aprobación de: institución fija por instancia; sesiones locales volátiles
con límites indicados; política docente vigente al recibir; calendario configurado;
ventanas de 24 h/5 min; correcciones solo ADMIN; bootstrap ficticio separado y
etapas propuestas. Si se necesitan sesiones persistentes, autorización docente
histórica o cierres académicos robustos desde el inicio, revisar el modelo mediante
una propuesta adicional antes de implementar. **Detenerse aquí: no desarrollar
endpoints ni autenticación hasta la decisión del responsable.**
