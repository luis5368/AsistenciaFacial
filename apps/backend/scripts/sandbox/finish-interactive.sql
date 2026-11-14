\set ON_ERROR_STOP on
\set ECHO none
-- Continuacion del aprovisionamiento ya realizado. No crea roles ni bases.
DO $$
BEGIN
  IF current_database() <> 'asistencia_facial_sandbox' OR current_user <> 'postgres'
    OR inet_server_addr() IS NULL
    OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)
    OR inet_server_port() <> 5432
    OR current_setting('server_version_num')::integer <> 180006 THEN
    RAISE EXCEPTION 'unexpected_sandbox_destination';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = current_database()
    AND pg_get_userbyid(datdba) = 'asistencia_migrator') THEN
    RAISE EXCEPTION 'unexpected_sandbox_owner';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('asistencia_migrator','asistencia_app')
    AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolreplication AND NOT rolbypassrls) <> 2 THEN
    RAISE EXCEPTION 'unexpected_role_attributes';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
    WHERE r.rolname IN ('asistencia_app','asistencia_migrator')) THEN
    RAISE EXCEPTION 'unexpected_explicit_memberships';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')) THEN
    RAISE EXCEPTION 'sandbox_has_objects_review_required';
  END IF;
END;
$$;
SET password_encryption = 'scram-sha-256';
\password asistencia_migrator

BEGIN;
REVOKE ALL ON DATABASE asistencia_facial_sandbox FROM PUBLIC;
GRANT CONNECT ON DATABASE asistencia_facial_sandbox TO asistencia_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO asistencia_app;
GRANT USAGE, CREATE ON SCHEMA public TO asistencia_migrator;
COMMIT;
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
SELECT r.rolname,
  has_database_privilege(r.oid,current_database(),'CONNECT') AS connect,
  has_schema_privilege(r.oid,'public','USAGE') AS usage,
  has_schema_privilege(r.oid,'public','CREATE') AS create_schema
FROM pg_roles r WHERE r.rolname IN ('asistencia_app','asistencia_migrator');
\echo Preparacion completada. Configure pgpass local para ambos roles en sandbox. No se aplicaron migraciones.
