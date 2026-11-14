\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'asistencia_facial_api_lab' OR current_user<>'asistencia_migrator'
 OR inet_server_port()<>5432 OR host(inet_server_addr()) NOT IN ('::1','127.0.0.1')
 THEN RAISE EXCEPTION 'Destino o actor no autorizado'; END IF;
END $$;
REVOKE CREATE ON DATABASE asistencia_facial_api_lab FROM PUBLIC, asistencia_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, asistencia_app;
GRANT CONNECT ON DATABASE asistencia_facial_api_lab TO asistencia_app;
GRANT USAGE ON SCHEMA public TO asistencia_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, asistencia_app;
GRANT SELECT, INSERT, UPDATE ON institutions, users, students, teachers, groups,
 enrollments, teacher_assignments, class_sessions, devices, biometric_consents TO asistencia_app;
GRANT SELECT, INSERT ON attendances TO asistencia_app;
GRANT UPDATE (status, version) ON attendances TO asistencia_app;
GRANT SELECT, INSERT ON attendance_corrections, audit_events TO asistencia_app;
COMMIT;
