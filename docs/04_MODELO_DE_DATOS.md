# Modelo de datos inicial — PostgreSQL + IndexedDB (corresponde a 5.2)

Actualización 2026-11-13: la preparación aprobada se concreta en
[schema.prisma](../apps/backend/prisma/schema.prisma) y [Fase 2](fase-2-preparacion.md).
La tabla siguiente se conserva como borrador histórico. Diferencias explícitas:
docentes separados de usuarios; año derivado del grupo en matrícula; correcciones
separadas; metadatos de plantillas sin embedding; auditoría sin JSON libre.
No se ha aplicado el esquema a PostgreSQL.

**Estado:** borrador técnico; no es un esquema migrado ni ejecutado. Adaptar tras confirmar reglas académicas y el consentimiento.

## PostgreSQL (entidades principales)

| Entidad | Campos esenciales (tipos orientativos) | Relaciones / restricciones |
|---|---|---|
| `institutions` | `id UUID PK`, `name TEXT`, `created_at TIMESTAMPTZ` | 1:N usuarios, estudiantes, grupos |
| `users` | `id UUID`, `institution_id UUID`, `email TEXT`, `password_hash TEXT`, `role ENUM/TEXT`, `active BOOL` | email único dentro de institución; nunca contraseña en claro |
| `students` | `id UUID`, `institution_id UUID`, `student_code TEXT`, `full_name TEXT`, `active BOOL` | código único por institución; evitar identificadores innecesarios |
| `groups` | `id UUID`, `institution_id UUID`, `grade TEXT`, `section TEXT`, `school_year INT` | institución 1:N grupos |
| `enrollments` | `id UUID`, `student_id UUID`, `group_id UUID`, `school_year INT` | N:M estudiante-grupo a través de matrícula |
| `teacher_assignments` | `id UUID`, `user_id UUID`, `group_id UUID`, `active BOOL` | N:M docente-grupo según colegio |
| `class_sessions` | `id UUID`, `group_id UUID`, `starts_at TIMESTAMPTZ`, `ends_at TIMESTAMPTZ`, `status TEXT` | grupo 1:N sesiones |
| `biometric_consents` | `id UUID`, `student_id UUID`, `status TEXT`, `granted_at`, `revoked_at`, `evidence_ref` | guardar evidencia protegida; historial de cambios |
| `facial_templates` | `id UUID`, `student_id UUID`, `model_name TEXT`, `model_version TEXT`, `encrypted_embedding BYTEA`, `key_ref TEXT`, `created_at` | versiones y acceso estrictamente limitados |
| `devices` | `id UUID`, `assigned_user_id UUID`, `institution_id UUID`, `status TEXT`, `last_seen_at` | revocación y alcance del dispositivo |
| `attendances` | `id UUID`, `event_uuid UUID UNIQUE`, `student_id UUID`, `session_id UUID`, `method TEXT`, `occurred_at_client`, `received_at_server`, `created_by UUID`, `status TEXT` | evitar doble asistencia activa por estudiante/sesión; correcciones auditadas |
| `audit_events` | `id UUID`, `actor_id UUID`, `institution_id UUID`, `action TEXT`, `resource_type`, `resource_id`, `created_at`, `metadata JSONB` | evitar biometría cruda y secretos en logs |

**Relaciones necesarias:** institución-usuario 1:N; institución-estudiante 1:N; estudiante-grupo N:M (matriculas); docente-grupo N:M (asignaciones); grupo-sesión 1:N; sesión-asistencia 1:N; estudiante-plantilla 1:N (versiones), estudiante-consentimiento 1:N histórico.

## IndexedDB / Dexie — Object Stores

| Store | Clave / índices propuestos | Ciclo de vida |
|---|---|---|
| `students_cache` | `id`, `group_id`, `cache_version` | solo estudiantes asignados; actualizar/revocar |
| `classes_cache` | `id`, `group_id`, `starts_at` | sesiones descargadas y autorizadas |
| `templates_cache` | `id`, `student_id`, `model_version` | embeddings cifrados; rotar al cambiar modelo/autorización |
| `attendance_queue` | `event_uuid`, `status`, `session_id`, `created_at` | preservar hasta ACK o resolución explícita |
| `sync_metadata` | `key`, `value`, `updated_at` | estado de bootstrap, versión y última sincronización |
| `device_policy` | `device_id`, `expires_at`, `policy_version` | autorización offline y expiración |

## Decisiones de integridad

1. Separar `event_uuid` (idempotencia del evento) del ID de fila central.
2. Guardar UTC con `TIMESTAMPTZ`; mostrar hora local de Guatemala solo en UI y reportes.
3. No almacenar fotos del rostro en `students_cache` ni en registros de asistencia, salvo justificación y autorización específica.
4. Diseñar `facial_templates` de modo que pueda eliminarse la plantilla sin destruir los registros de asistencia no biométricos legalmente retenibles.
5. Evitar mezclar cifrado y consultas indexadas: los campos de índice deben minimizar metadatos personales.
6. El esquema definitivo se implementará con migraciones versionadas y seeds **ficticios**.
