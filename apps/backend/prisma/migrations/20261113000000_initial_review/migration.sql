-- BORRADOR para revisión. No aplicado a PostgreSQL.
BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ACTIVE', 'VOID');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DISABLED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PLANNED', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CorrectionReason" AS ENUM ('REGISTRATION_ERROR', 'REVIEW_CONFIRMED');

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "students" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_code" VARCHAR(64) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "students_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "groups" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "grade" VARCHAR(80) NOT NULL,
    "section" VARCHAR(40) NOT NULL,
    "school_year" INTEGER NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "teacher_assignments" (
    "institution_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("institution_id","teacher_id","group_id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "devices" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "assigned_user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "biometric_consents" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "recorded_by" UUID NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "notice_version" VARCHAR(40) NOT NULL,
    "evidence_ref" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "biometric_consents_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "biometric_template_metadata" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "consent_id" UUID NOT NULL,
    "model_name" VARCHAR(80) NOT NULL,
    "model_version" VARCHAR(80) NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DISABLED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "biometric_template_metadata_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "event_uuid" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "method" VARCHAR(24) NOT NULL DEFAULT 'manual',
    "payload_hash" CHAR(64) NOT NULL,
    "occurred_at_client" TIMESTAMPTZ(3) NOT NULL,
    "received_at_server" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "attendance_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "from_version" INTEGER NOT NULL,
    "to_version" INTEGER NOT NULL,
    "from_status" "AttendanceStatus" NOT NULL,
    "to_status" "AttendanceStatus" NOT NULL,
    "reason" "CorrectionReason" NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "institution_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "resource_type" VARCHAR(40) NOT NULL,
    "resource_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("institution_id","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_institution_id_email_key" ON "users"("institution_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "students_institution_id_student_code_key" ON "students"("institution_id", "student_code");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_institution_id_user_id_key" ON "teachers"("institution_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_institution_id_school_year_grade_section_key" ON "groups"("institution_id", "school_year", "grade", "section");

-- CreateIndex
CREATE INDEX "enrollments_institution_id_group_id_idx" ON "enrollments"("institution_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_institution_id_student_id_group_id_key" ON "enrollments"("institution_id", "student_id", "group_id");

-- CreateIndex
CREATE INDEX "teacher_assignments_institution_id_group_id_idx" ON "teacher_assignments"("institution_id", "group_id");

-- CreateIndex
CREATE INDEX "class_sessions_institution_id_group_id_starts_at_idx" ON "class_sessions"("institution_id", "group_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_institution_id_id_group_id_key" ON "class_sessions"("institution_id", "id", "group_id");

-- CreateIndex
CREATE INDEX "devices_institution_id_assigned_user_id_idx" ON "devices"("institution_id", "assigned_user_id");

-- CreateIndex
CREATE INDEX "biometric_consents_institution_id_student_id_status_idx" ON "biometric_consents"("institution_id", "student_id", "status");

-- CreateIndex
CREATE INDEX "biometric_consents_institution_id_recorded_by_idx" ON "biometric_consents"("institution_id", "recorded_by");

-- CreateIndex
CREATE UNIQUE INDEX "biometric_consents_institution_id_id_student_id_key" ON "biometric_consents"("institution_id", "id", "student_id");

-- CreateIndex
CREATE INDEX "biometric_template_metadata_institution_id_consent_id_stude_idx" ON "biometric_template_metadata"("institution_id", "consent_id", "student_id");

-- CreateIndex
CREATE INDEX "attendances_institution_id_session_id_group_id_idx" ON "attendances"("institution_id", "session_id", "group_id");

-- CreateIndex
CREATE INDEX "attendances_institution_id_student_id_group_id_idx" ON "attendances"("institution_id", "student_id", "group_id");

-- CreateIndex
CREATE INDEX "attendances_institution_id_device_id_idx" ON "attendances"("institution_id", "device_id");

-- CreateIndex
CREATE INDEX "attendances_institution_id_created_by_idx" ON "attendances"("institution_id", "created_by");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_institution_id_event_uuid_key" ON "attendances"("institution_id", "event_uuid");

-- CreateIndex
CREATE INDEX "attendance_corrections_institution_id_actor_id_idx" ON "attendance_corrections"("institution_id", "actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_corrections_institution_id_attendance_id_to_vers_key" ON "attendance_corrections"("institution_id", "attendance_id", "to_version");

-- CreateIndex
CREATE INDEX "audit_events_institution_id_resource_type_resource_id_recor_idx" ON "audit_events"("institution_id", "resource_type", "resource_id", "recorded_at");

-- CreateIndex
CREATE INDEX "audit_events_institution_id_actor_id_idx" ON "audit_events"("institution_id", "actor_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_institution_id_user_id_fkey" FOREIGN KEY ("institution_id", "user_id") REFERENCES "users"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_institution_id_student_id_fkey" FOREIGN KEY ("institution_id", "student_id") REFERENCES "students"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_institution_id_group_id_fkey" FOREIGN KEY ("institution_id", "group_id") REFERENCES "groups"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_institution_id_teacher_id_fkey" FOREIGN KEY ("institution_id", "teacher_id") REFERENCES "teachers"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_institution_id_group_id_fkey" FOREIGN KEY ("institution_id", "group_id") REFERENCES "groups"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_institution_id_group_id_fkey" FOREIGN KEY ("institution_id", "group_id") REFERENCES "groups"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_institution_id_assigned_user_id_fkey" FOREIGN KEY ("institution_id", "assigned_user_id") REFERENCES "users"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "biometric_consents" ADD CONSTRAINT "biometric_consents_institution_id_student_id_fkey" FOREIGN KEY ("institution_id", "student_id") REFERENCES "students"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "biometric_consents" ADD CONSTRAINT "biometric_consents_institution_id_recorded_by_fkey" FOREIGN KEY ("institution_id", "recorded_by") REFERENCES "users"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "biometric_template_metadata" ADD CONSTRAINT "biometric_template_metadata_institution_id_consent_id_stud_fkey" FOREIGN KEY ("institution_id", "consent_id", "student_id") REFERENCES "biometric_consents"("institution_id", "id", "student_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_institution_id_student_id_group_id_fkey" FOREIGN KEY ("institution_id", "student_id", "group_id") REFERENCES "enrollments"("institution_id", "student_id", "group_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_institution_id_session_id_group_id_fkey" FOREIGN KEY ("institution_id", "session_id", "group_id") REFERENCES "class_sessions"("institution_id", "id", "group_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_institution_id_device_id_fkey" FOREIGN KEY ("institution_id", "device_id") REFERENCES "devices"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_institution_id_created_by_fkey" FOREIGN KEY ("institution_id", "created_by") REFERENCES "users"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_institution_id_attendance_id_fkey" FOREIGN KEY ("institution_id", "attendance_id") REFERENCES "attendances"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_institution_id_actor_id_fkey" FOREIGN KEY ("institution_id", "actor_id") REFERENCES "users"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_institution_id_actor_id_fkey" FOREIGN KEY ("institution_id", "actor_id") REFERENCES "users"("institution_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- BEGIN CUSTOM INVARIANTS
-- Fuente de restricciones adicionales; incorporada al SQL inicial, NO ejecutar aparte.
CREATE UNIQUE INDEX attendances_one_active_per_session
  ON attendances (institution_id, student_id, session_id) WHERE status = 'ACTIVE';

ALTER TABLE users ADD CONSTRAINT users_email_canonical CHECK (email = lower(btrim(email)) AND length(email) > 3);
ALTER TABLE groups ADD CONSTRAINT groups_year_range CHECK (school_year BETWEEN 2000 AND 2200);
ALTER TABLE enrollments ADD CONSTRAINT enrollments_valid_period CHECK (ends_at IS NULL OR ends_at > starts_at);
ALTER TABLE class_sessions ADD CONSTRAINT sessions_valid_period CHECK (ends_at > starts_at);
ALTER TABLE biometric_consents ADD CONSTRAINT consents_valid_period CHECK (
  expires_at > granted_at AND (revoked_at IS NULL OR revoked_at >= granted_at)
  AND ((status = 'GRANTED' AND revoked_at IS NULL) OR (status = 'REVOKED' AND revoked_at IS NOT NULL))
);
ALTER TABLE biometric_template_metadata ADD CONSTRAINT templates_revocation CHECK (
  (status = 'DISABLED' AND revoked_at IS NULL) OR (status = 'REVOKED' AND revoked_at IS NOT NULL)
);
ALTER TABLE attendances ADD CONSTRAINT attendances_manual_v1 CHECK (method = 'manual' AND schema_version = 1);
ALTER TABLE attendances ADD CONSTRAINT attendances_hash CHECK (payload_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE attendances ADD CONSTRAINT attendances_version CHECK (version >= 1);
ALTER TABLE attendance_corrections ADD CONSTRAINT corrections_transition CHECK (
  from_version >= 1 AND to_version = from_version + 1 AND from_status <> to_status
);

-- UUID/contenido originales inmutables; las correcciones cambian solo estado/versión.
CREATE FUNCTION guard_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'attendance_delete_forbidden'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.version <> 1 OR NEW.status <> 'ACTIVE' THEN RAISE EXCEPTION 'attendance_initial_state'; END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'version') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'version')
    OR NEW.version <> OLD.version + 1 OR NEW.status = OLD.status THEN
    RAISE EXCEPTION 'attendance_immutable_or_invalid_transition';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_guard BEFORE INSERT OR UPDATE OR DELETE ON attendances
  FOR EACH ROW EXECUTE FUNCTION guard_attendance();

CREATE FUNCTION forbid_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append_only_history';
END;
$$;
CREATE TRIGGER correction_append_only BEFORE UPDATE OR DELETE ON attendance_corrections
  FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();

-- Comprueba al COMMIT que una actualización tiene corrección y auditoría coherentes.
CREATE FUNCTION require_attendance_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM attendance_corrections c JOIN audit_events a
      ON a.institution_id = c.institution_id AND a.resource_id = c.id
      AND a.actor_id = c.actor_id AND a.resource_type = 'attendance_correction'
      AND a.action = 'attendance.corrected'
    WHERE c.institution_id = NEW.institution_id AND c.attendance_id = NEW.id
      AND c.from_version = OLD.version AND c.to_version = NEW.version
      AND c.from_status = OLD.status AND c.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'attendance_correction_audit_required'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER attendance_correction_required AFTER UPDATE ON attendances
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_attendance_correction();

-- Deniega filas si falta contexto. SET LOCAL evita reutilizar contexto en el pool.
-- No sustituye autenticación, roles ni comprobación de asignaciones en el servidor.
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions FORCE ROW LEVEL SECURITY;
CREATE POLICY institution_scope ON institutions
  USING (id = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.institution_id', true), '')::uuid);
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'students', 'teachers', 'groups', 'enrollments', 'teacher_assignments',
    'class_sessions', 'devices', 'biometric_consents', 'biometric_template_metadata',
    'attendances', 'attendance_corrections', 'audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_scope ON %I USING (institution_id = nullif(current_setting(''app.institution_id'', true), '''')::uuid) WITH CHECK (institution_id = nullif(current_setting(''app.institution_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END;
$$;

COMMIT;
