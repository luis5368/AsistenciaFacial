-- PREVIO a migrar, solo tras autorización y revisión de propietarios/membresías.
-- Roles deben existir; establecer contraseñas con psql \password, nunca en este archivo.
-- Administrador local conectado a asistencia_facial. No ejecutado durante preparación.
BEGIN;
ALTER ROLE asistencia_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE asistencia_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM asistencia_app;
GRANT CONNECT ON DATABASE asistencia_facial TO asistencia_app, asistencia_migrator;
GRANT USAGE ON SCHEMA public TO asistencia_app, asistencia_migrator;
GRANT CREATE ON SCHEMA public TO asistencia_migrator;
-- Si app es dueño de DB/esquema o hereda privilegios, DETENERSE y revisar:
-- REVOKE no elimina privilegios inherentes a propiedad ni todos los heredados.
COMMIT;
