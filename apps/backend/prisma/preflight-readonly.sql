-- Ejecutar por separado con cada rol, solo después de autorización de conexión.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS role_name,
       current_setting('server_version') AS server_version,
       inet_server_addr() AS server_address, inet_server_port() AS server_port;
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
  FROM pg_roles WHERE rolname IN ('asistencia_app', 'asistencia_migrator');
SELECT has_database_privilege(current_user, current_database(), 'CONNECT') AS can_connect,
       has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema,
       has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
       has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create;
SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = current_database();
SELECT nspname, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = 'public';
SELECT r.rolname AS member_of FROM pg_roles r
  WHERE r.rolname <> current_user AND pg_has_role(current_user, r.oid, 'MEMBER');
SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY c.relname;
COMMIT;
