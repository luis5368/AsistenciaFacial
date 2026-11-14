-- Diagnóstico exclusivamente de lectura. No muestra contraseñas ni configuraciones de conexión.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT 1 / ((current_database()='asistencia_facial'
 AND current_user='asistencia_app' AND inet_server_port()=5432
 AND host(inet_server_addr()) IN ('127.0.0.1','::1'))::int) AS destination_guard \gset
SELECT jsonb_pretty(jsonb_build_object(
 'checked_at',clock_timestamp(), 'database',current_database(),'actor',current_user,
 'host',host(inet_server_addr()),'port',inet_server_port(),
 'read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version'),
 'database_acl',(SELECT jsonb_build_object('owner',pg_get_userbyid(datdba),'acl',datacl) FROM pg_database WHERE datname=current_database()),
 'schemas',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl) ORDER BY nspname),'[]') FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema'),
 'relations',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner)) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'),
 'functions',(SELECT coalesce(jsonb_agg(p.proname ORDER BY p.proname),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'),
 'types',(SELECT coalesce(jsonb_agg(t.typname ORDER BY t.typname),'[]') FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'),
 'extensions',(SELECT jsonb_agg(extname ORDER BY extname) FROM pg_extension),
 'event_trigger_count',(SELECT count(*) FROM pg_event_trigger),
 'large_object_count',(SELECT count(*) FROM pg_largeobject_metadata),
 'default_acl',(SELECT coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(defaclrole),'schema',defaclnamespace,'kind',defaclobjtype,'acl',defaclacl)),'[]') FROM pg_default_acl),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication,'bypassrls',rolbypassrls,
 'connect',has_database_privilege(oid,current_database(),'CONNECT'),'create_db',has_database_privilege(oid,current_database(),'CREATE'),'temp',has_database_privilege(oid,current_database(),'TEMP'),
 'usage_public',has_schema_privilege(oid,'public','USAGE'),'create_public',has_schema_privilege(oid,'public','CREATE')) ORDER BY rolname) FROM pg_roles WHERE rolname IN ('asistencia_app','asistencia_migrator')),
 'memberships',(SELECT coalesce(jsonb_agg(jsonb_build_object('member',pg_get_userbyid(member),'role',pg_get_userbyid(roleid),'admin',admin_option)),'[]') FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('asistencia_app','asistencia_migrator')))
));
ROLLBACK;
