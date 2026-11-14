-- Diagnóstico autorizado: catálogos únicamente, ninguna fila personal.
-- Ejecutar con psql -X -w -v ON_ERROR_STOP=1 y default_transaction_read_only=on.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
DO $$
BEGIN
  IF current_database() <> 'asistencia_facial' OR inet_server_port() <> 5432
     OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet) THEN
    RAISE EXCEPTION 'unexpected_diagnostic_destination';
  END IF;
END;
$$;
SELECT current_database(), current_user, inet_server_addr(), inet_server_port(),
       current_setting('server_version'), current_setting('transaction_read_only');
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
  FROM pg_roles WHERE rolname IN ('asistencia_app', 'asistencia_migrator');
SELECT r.rolname,
       has_database_privilege(r.oid, current_database(), 'CONNECT') AS can_connect,
       has_database_privilege(r.oid, current_database(), 'CREATE') AS can_create_schema,
       has_database_privilege(r.oid, current_database(), 'TEMP') AS can_create_temp,
       has_schema_privilege(r.oid, 'public', 'USAGE') AS public_usage,
       has_schema_privilege(r.oid, 'public', 'CREATE') AS public_create
  FROM pg_roles r WHERE rolname IN ('asistencia_app', 'asistencia_migrator');
SELECT member_role.rolname AS member, parent_role.rolname AS inherited_role,
       pg_has_role(member_role.oid, parent_role.oid, 'USAGE') AS privileges_available,
       pg_has_role(member_role.oid, parent_role.oid, 'SET') AS can_set_role
  FROM pg_roles member_role CROSS JOIN pg_roles parent_role
  WHERE member_role.rolname IN ('asistencia_app', 'asistencia_migrator')
    AND member_role.oid <> parent_role.oid
    AND pg_has_role(member_role.oid, parent_role.oid, 'MEMBER');
SELECT datname, pg_get_userbyid(datdba) AS owner
  FROM pg_database WHERE datname IN ('asistencia_facial', 'asistencia_facial_sandbox');
SELECT nspname, pg_get_userbyid(nspowner) AS owner
  FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema';
SELECT n.nspname, c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
    AND c.relkind IN ('r','p','v','m','S') ORDER BY n.nspname, c.relname;
SELECT n.nspname, p.proname, pg_get_userbyid(p.proowner) AS owner, p.prosecdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema';
SELECT d.datname, s.stats_reset, s.tup_inserted, s.tup_updated, s.tup_deleted
  FROM pg_database d JOIN pg_stat_database s ON s.datid = d.oid
  WHERE d.datname = current_database();
-- Contadores orientativos; actividad concurrente ajena impide atribuir cambios solo con ellos.
COMMIT;
