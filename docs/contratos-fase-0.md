# Contratos preliminares de Fase 0

Actualización 2026-11-13: [Fase 2 preparación](fase-2-preparacion.md) concreta solo
el contrato manual v1 y correcciones. Actor e institución se derivan del servidor
y se rechazan si se incluyen en el cuerpo. La API y la cola siguen sin implementar;
lo que sigue conserva las propuestas históricas de Fase 0.

Decisión técnica propuesta. Este archivo documenta interfaces, no las implementa
ni garantiza su viabilidad. Las dependencias y modelos siguen sin instalarse.

## Adaptadores

| Adaptador | Operaciones propuestas | Garantías que deberán probarse |
| --- | --- | --- |
| `BiometricEngine` | `initialize(modelManifest)`, `extract(frame)`, `compare(probe, authorizedTemplates, policy)`, `dispose()` | Errores explícitos por modelo incompatible, cara ausente/múltiple y calidad insuficiente; embeddings asociados a versión; resultado sugerido o rechazo, nunca asistencia automática |
| `LocalAttendanceStore` | `record(event)`, `listPending(limit)`, `applyResults(results)`, `recoverInterrupted()` | Guardado local/cola en una transacción; contenido y UUID inmutables; ACK persistido antes de depurar; recuperación de envíos interrumpidos |
| `SyncService` | `syncOnce()`, `getStatus()`, `cancel()` | Autorización vigente, lotes acotados, backoff, confirmación individual y ausencia de pérdida ante cancelación; cancelar no deshace un commit del servidor |

`extract` procesa el fotograma en memoria; no implica persistir imágenes.
`compare` recibe exclusivamente plantillas autorizadas y compatibles. Su salida
debe separar puntuación, umbral y versión del modelo; no emitir un porcentaje
de confianza sin calibración que lo sustente. Ningún embedding forma parte del
evento de asistencia. El almacenamiento de plantillas y sus claves se diseñará
por separado antes de cualquier enrolamiento experimental.

## Evento y autorización

Campos de propuesta: `schema_version`, `event_uuid`, `student_id`, `session_id`,
`occurred_at_client` (UTC), `device_id`, `created_by`, `method` (`manual` o
`biometric_confirmed`). UUID estable desde la primera escritura. El servidor
verifica actor y dispositivo contra la sesión autenticada, deriva la institución
y comprueba pertenencia de estudiante/sesión/grupo; no confía en esos campos
solo porque el cliente los envíe.

`received_at_server` y el identificador central se asignan en el servidor.
La autorización offline y su caducidad deben definirse antes de implementar
la aceptación de eventos tardíos. Un rechazo conserva el pendiente para revisión.

## API de sincronización borrador

`POST /api/sync/attendances`: cuerpo `{ schema_version, events: [...] }`.
Respuesta de lote procesable: `{ results: [...] }`; cada resultado incluye
`event_uuid`, `status`, y según corresponda `attendance_id`,
`received_at_server` o `reason_code`. Estados por elemento:

- `accepted`: persistido con éxito.
- `already_accepted`: mismo UUID y contenido, devolver confirmación equivalente.
- `needs_review`: duplicado lógico, UUID reutilizado con otro contenido o regla
  de negocio incumplida; incluir código sin revelar información de otro colegio.
- `retryable_error`: error transitorio; mantener evento y reintentar.

HTTP 400 corresponde a sobre inválido; 401/403 a autenticación/autorización del
lote; 413 a tamaño excedido; 429 a limitación de tasa; 5xx a fallo transitorio.
No interpretar estos errores globales como ACK de ningún elemento. Límites de
lote y versión del contrato quedan por fijar. El contrato final tendrá OpenAPI.

Una transacción de servidor por evento debe registrar la decisión de idempotencia
y la asistencia antes de responder. Los reenvíos se revisan dentro del alcance
autorizado. Concurrencia se resuelve mediante restricciones, no solo consultas.
La propuesta de unicidad lógica es una asistencia activa por institución,
estudiante y sesión. Correcciones requieren operación explícita y auditoría.

## Estados locales

`PENDING -> SENDING -> ACKED` es el camino satisfactorio.
`SENDING -> RETRYABLE_ERROR -> SENDING` conserva el mismo evento.
`SENDING -> NEEDS_REVIEW` conserva el evento y motivo para intervención.
Al reiniciar, `SENDING` abandonado vuelve a pendiente de reintento. Una respuesta
perdida no demuestra fallo del servidor: siempre reenviar el mismo UUID.
Solo `accepted` o `already_accepted` permiten marcar `ACKED`.

## Mapeo central y local

| Central según `04_MODELO_DE_DATOS.md` | Local | Política propuesta |
| --- | --- | --- |
| Estudiantes, matrículas y asignaciones | `students_cache` | Proyección mínima del grupo autorizado |
| `class_sessions` | `classes_cache` | Sesiones y vigencia autorizadas |
| `facial_templates` y consentimiento | `templates_cache` | Solo si se aprueba experimento y diseño de claves; versiones y revocación |
| `attendances` | `attendance_queue` | Evento local persistido y ACK central; retención posterior por definir |
| Dispositivos y permisos | `device_policy` | Vigencia offline y versión de política |
| Versiones y cambios de servidor | `sync_metadata` | Cursor de sincronización; no sustituye autorización |

El modelo central cargado es el borrador de BD de Fase 0; no se generan
migraciones ni un esquema Prisma ficticiamente validado. Las relaciones deben
impedir referencias cruzadas entre instituciones, además de filtrar consultas.

## Verificación futura

Cubrir OFF-03/04 y SEC-01 con respuesta perdida, simultaneidad entre dispositivos,
reutilización de UUID con contenido distinto y acceso cruzado. Probar fallos de
transacción local y recuperación tras cierre. No se han ejecutado estos ensayos.
