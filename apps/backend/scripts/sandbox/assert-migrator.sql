\set ON_ERROR_STOP on
DO $$
BEGIN
 IF current_database() <> 'asistencia_facial_sandbox' OR current_user <> 'asistencia_migrator'
 OR inet_server_addr() IS NULL OR inet_server_addr() NOT IN ('127.0.0.1'::inet,'::1'::inet)
 OR inet_server_port() <> 5432 OR current_setting('server_version_num')::int <> 180006 THEN
   RAISE EXCEPTION 'unexpected_sandbox_destination';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database()
   AND pg_get_userbyid(datdba)='asistencia_migrator') THEN RAISE EXCEPTION 'unexpected_owner'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND
   (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
   RAISE EXCEPTION 'unexpected_migrator_privileges';
 END IF;
END;
$$;
