\set ON_ERROR_STOP on
\ir assert-migrator.sql
BEGIN;
GRANT SELECT, INSERT, UPDATE ON institutions, users, students, teachers, groups,
 enrollments, teacher_assignments, class_sessions, devices, biometric_consents TO asistencia_app;
GRANT SELECT, INSERT ON attendances TO asistencia_app;
GRANT UPDATE (status, version) ON attendances TO asistencia_app;
GRANT SELECT, INSERT ON attendance_corrections, audit_events TO asistencia_app;
REVOKE ALL ON biometric_template_metadata FROM asistencia_app;
COMMIT;
