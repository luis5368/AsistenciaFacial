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
