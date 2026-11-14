\set ON_ERROR_STOP on
\set ECHO none
-- Solo para ejecución interactiva local: no redirigir ni capturar contraseñas.
-- No admite reutilización automática de roles/bases preexistentes.
DO $$
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres'
     OR inet_server_addr() IS NULL
     OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)
     OR inet_server_port() <> 5432
     OR current_setting('server_version_num')::integer <> 180006 THEN
    RAISE EXCEPTION 'unexpected_preparation_destination';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asistencia_migrator') THEN
    RAISE EXCEPTION 'migrator_already_exists_review_required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = 'asistencia_facial_sandbox') THEN
    RAISE EXCEPTION 'sandbox_already_exists_review_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asistencia_app'
    AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolreplication AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'unexpected_application_role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles r WHERE r.rolname <> 'asistencia_app'
      AND pg_has_role('asistencia_app', r.oid, 'MEMBER')
  ) THEN RAISE EXCEPTION 'application_role_membership_review_required'; END IF;
END;
$$;

CREATE ROLE asistencia_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS;
SET password_encryption = 'scram-sha-256';
\password asistencia_migrator

CREATE DATABASE asistencia_facial_sandbox OWNER asistencia_migrator TEMPLATE template0;
COMMENT ON DATABASE asistencia_facial_sandbox IS
  'AsistenciaFacial Fase 2: ensayo local autorizado, solo datos ficticios. Conservar para revision.';

-- Nuevo destino explícito. No conectar a asistencia_facial para ninguna escritura.
\connect asistencia_facial_sandbox postgres localhost 5432
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'asistencia_facial_sandbox' OR current_user <> 'postgres'
     OR inet_server_addr() IS NULL
     OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)
     OR inet_server_port() <> 5432 THEN
    RAISE EXCEPTION 'unexpected_sandbox_destination';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = current_database()
    AND pg_get_userbyid(datdba) = 'asistencia_migrator') THEN
    RAISE EXCEPTION 'unexpected_sandbox_owner';
  END IF;
END;
$$;
REVOKE ALL ON DATABASE asistencia_facial_sandbox FROM PUBLIC;
GRANT CONNECT ON DATABASE asistencia_facial_sandbox TO asistencia_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO asistencia_app;
GRANT USAGE, CREATE ON SCHEMA public TO asistencia_migrator;
COMMIT;

SELECT current_database(), inet_server_addr(), inet_server_port(),
  pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = current_database();
\echo Preparacion finalizada. No se aplicaron migraciones ni se crearon tablas de dominio.
