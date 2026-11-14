-- Corrección adicional autorizada; conservar intacta la migración inicial.
BEGIN;
LOCK TABLE enrollments, attendances, attendance_corrections, audit_events IN ACCESS EXCLUSIVE MODE;
-- Acceso del propietario para backfill; se restaura FORCE antes de COMMIT.
ALTER TABLE enrollments NO FORCE ROW LEVEL SECURITY;
ALTER TABLE attendances NO FORCE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events NO FORCE ROW LEVEL SECURITY;

ALTER TABLE attendances ADD COLUMN enrollment_id UUID;
ALTER TABLE attendances ADD COLUMN transition_txid BIGINT;
ALTER TABLE attendance_corrections ADD COLUMN transition_txid BIGINT NOT NULL DEFAULT 0;
ALTER TABLE attendances DISABLE TRIGGER attendance_guard;
ALTER TABLE attendances DISABLE TRIGGER attendance_correction_required;
UPDATE attendances a SET enrollment_id=e.id FROM enrollments e
 WHERE a.institution_id=e.institution_id AND a.student_id=e.student_id AND a.group_id=e.group_id;
ALTER TABLE attendances ENABLE TRIGGER attendance_guard;
ALTER TABLE attendances ENABLE TRIGGER attendance_correction_required;
ALTER TABLE attendances ALTER COLUMN enrollment_id SET NOT NULL;
ALTER TABLE attendances DROP CONSTRAINT attendances_institution_id_student_id_group_id_fkey;
DROP INDEX enrollments_institution_id_student_id_group_id_key;
CREATE UNIQUE INDEX enrollments_institution_id_id_student_id_group_id_key
 ON enrollments(institution_id,id,student_id,group_id);
CREATE INDEX enrollments_institution_id_student_id_group_id_starts_at_idx
 ON enrollments(institution_id,student_id,group_id,starts_at);
CREATE INDEX attendances_institution_id_enrollment_id_student_id_group_id_idx
 ON attendances(institution_id,enrollment_id,student_id,group_id);
ALTER TABLE attendances ADD CONSTRAINT attendances_episode_fkey
 FOREIGN KEY(institution_id,enrollment_id,student_id,group_id)
 REFERENCES enrollments(institution_id,id,student_id,group_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_finite_period
 CHECK(isfinite(starts_at) AND (ends_at IS NULL OR isfinite(ends_at)));
ALTER TABLE audit_events ADD CONSTRAINT audit_correction_pair
 CHECK((action='attendance.corrected') = (resource_type='attendance_correction'));
CREATE UNIQUE INDEX audit_one_per_correction ON audit_events(institution_id,resource_id)
 WHERE action='attendance.corrected' AND resource_type='attendance_correction';

CREATE OR REPLACE FUNCTION guard_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'attendance_delete_forbidden'; END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.version<>1 OR NEW.status<>'ACTIVE' OR NEW.transition_txid IS NOT NULL THEN
     RAISE EXCEPTION 'attendance_initial_state';
   END IF;
   RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-'status'-'version') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'version')
   OR NEW.version<>OLD.version+1 OR NEW.status=OLD.status THEN
   RAISE EXCEPTION 'attendance_immutable_or_invalid_transition';
 END IF;
 IF OLD.transition_txid = pg_current_xact_id()::text::bigint THEN
   RAISE EXCEPTION 'one_attendance_transition_per_transaction';
 END IF;
 NEW.transition_txid := pg_current_xact_id()::text::bigint;
 RETURN NEW;
END;
$$;

CREATE FUNCTION stamp_correction_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.transition_txid := pg_current_xact_id()::text::bigint;
 RETURN NEW;
END;
$$;
CREATE TRIGGER correction_transaction BEFORE INSERT ON attendance_corrections
 FOR EACH ROW EXECUTE FUNCTION stamp_correction_transaction();

CREATE OR REPLACE FUNCTION require_attendance_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM attendance_corrections c JOIN audit_events a
    ON a.institution_id=c.institution_id AND a.resource_id=c.id AND a.actor_id=c.actor_id
    AND a.action='attendance.corrected' AND a.resource_type='attendance_correction'
   WHERE c.institution_id=NEW.institution_id AND c.attendance_id=NEW.id
    AND c.from_version=OLD.version AND c.to_version=NEW.version
    AND c.from_status=OLD.status AND c.to_status=NEW.status
    AND c.transition_txid=NEW.transition_txid AND c.transition_txid=pg_current_xact_id()::text::bigint
 ) THEN RAISE EXCEPTION 'attendance_correction_audit_required'; END IF;
 RETURN NULL;
END;
$$;

CREATE FUNCTION require_correction_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM attendances a JOIN audit_events e
   ON e.institution_id=NEW.institution_id AND e.resource_id=NEW.id AND e.actor_id=NEW.actor_id
   AND e.action='attendance.corrected' AND e.resource_type='attendance_correction'
  WHERE a.institution_id=NEW.institution_id AND a.id=NEW.attendance_id
   AND a.version=NEW.to_version AND a.status=NEW.to_status
   AND a.transition_txid=NEW.transition_txid AND NEW.transition_txid=pg_current_xact_id()::text::bigint
 ) THEN RAISE EXCEPTION 'correction_real_transition_and_audit_required'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER correction_requires_transition AFTER INSERT ON attendance_corrections
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_correction_transition();

CREATE FUNCTION require_audit_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.action='attendance.corrected' AND NOT EXISTS (
  SELECT 1 FROM attendance_corrections c JOIN attendances a
   ON a.institution_id=c.institution_id AND a.id=c.attendance_id
  WHERE c.institution_id=NEW.institution_id AND c.id=NEW.resource_id AND c.actor_id=NEW.actor_id
   AND c.to_version=a.version AND c.to_status=a.status
   AND c.transition_txid=a.transition_txid AND c.transition_txid=pg_current_xact_id()::text::bigint
 ) THEN RAISE EXCEPTION 'audit_real_correction_required'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER audit_requires_correction AFTER INSERT ON audit_events
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_audit_correction();

CREATE FUNCTION guard_enrollment_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.institution_id,NEW.id,NEW.student_id,NEW.group_id)
    IS DISTINCT FROM (OLD.institution_id,OLD.id,OLD.student_id,OLD.group_id) THEN
   RAISE EXCEPTION 'enrollment_identity_immutable';
 END IF;
 -- Serializa por estudiante. UPDATE real sin cambio de valor también detecta
 -- snapshots obsoletos en REPEATABLE READ/SERIALIZABLE (40001, reintentar).
 UPDATE students SET active=active WHERE institution_id=NEW.institution_id AND id=NEW.student_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'enrollment_student_missing' USING ERRCODE='23503'; END IF;
 IF NEW.ends_at IS NOT NULL AND NEW.ends_at<=NEW.starts_at THEN
   RAISE EXCEPTION 'enrollment_invalid_period' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM enrollments e WHERE e.institution_id=NEW.institution_id
  AND e.student_id=NEW.student_id AND e.group_id=NEW.group_id AND e.id<>NEW.id
  AND tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(NEW.starts_at,NEW.ends_at,'[)')) THEN
   RAISE EXCEPTION 'enrollment_period_overlap' USING ERRCODE='23P01';
 END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM attendances a
  WHERE a.institution_id=NEW.institution_id AND a.enrollment_id=NEW.id
   AND NOT (a.occurred_at_client <@ tstzrange(NEW.starts_at,NEW.ends_at,'[)'))) THEN
   RAISE EXCEPTION 'enrollment_period_would_orphan_history' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER enrollment_period_guard BEFORE INSERT OR UPDATE ON enrollments
 FOR EACH ROW EXECUTE FUNCTION guard_enrollment_period();

CREATE FUNCTION guard_attendance_episode() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE episode enrollments%ROWTYPE;
BEGIN
 SELECT * INTO episode FROM enrollments WHERE institution_id=NEW.institution_id
   AND id=NEW.enrollment_id AND student_id=NEW.student_id AND group_id=NEW.group_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'attendance_episode_missing' USING ERRCODE='23503'; END IF;
 IF NOT (NEW.occurred_at_client <@ tstzrange(episode.starts_at,episode.ends_at,'[)')) THEN
   RAISE EXCEPTION 'attendance_outside_episode' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_episode_guard BEFORE INSERT ON attendances
 FOR EACH ROW EXECUTE FUNCTION guard_attendance_episode();

ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE attendances FORCE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
COMMIT;
