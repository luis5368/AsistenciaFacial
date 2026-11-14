-- PLAN PARA REVISIÓN, NO EJECUTADO. Roles previamente provisionados sin claves en Git.
-- Ejecutar por administrador local DESPUÉS de migrar y tras autorización,
-- en asistencia_facial únicamente. Revisar roles-review.sql antes de migrar.
BEGIN;
-- Requiere que migrador sea propietario de los objetos creados por su migración.
-- No otorgar membresía en migrador al usuario app, ni propiedad de DB/esquema/tablas.
-- Aplicar las siguientes concesiones DESPUÉS de crear las tablas autorizadamente:
GRANT SELECT, INSERT, UPDATE ON institutions, users, students, teachers, groups,
  enrollments, teacher_assignments, class_sessions, devices, biometric_consents TO asistencia_app;
GRANT SELECT, INSERT ON attendances TO asistencia_app;
GRANT UPDATE (status, version) ON attendances TO asistencia_app;
GRANT SELECT, INSERT ON attendance_corrections, audit_events TO asistencia_app;
REVOKE ALL ON biometric_template_metadata FROM asistencia_app;
-- Sin DELETE/TRUNCATE ni acceso a _prisma_migrations. Sin grants automáticos futuros.
COMMIT;
