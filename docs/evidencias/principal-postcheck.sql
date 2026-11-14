-- Preparado para después de migrate deploy; NO ejecutado durante la preparación.
-- postgres se usa solo para inventario y conteos completos pese a FORCE RLS.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT 1 / ((current_database()='asistencia_facial' AND current_user='postgres'
 AND inet_server_port()=5432 AND host(inet_server_addr()) IN ('::1','127.0.0.1'))::int) AS destination_guard \gset
SELECT current_database(),current_user,version(),current_setting('transaction_read_only');
SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;
SELECT migration_name,checksum,finished_at,rolled_back_at,applied_steps_count
 FROM public._prisma_migrations ORDER BY migration_name;
SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default
 FROM information_schema.columns WHERE table_schema='public' AND table_name<>'_prisma_migrations'
 ORDER BY table_name,ordinal_position;
SELECT c.conrelid::regclass AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition
 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
 WHERE n.nspname='public' ORDER BY table_name,c.conname;
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname;
SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;
SELECT p.proname,p.prosecdef,pg_get_functiondef(p.oid) AS definition FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname;
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
 JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder;
SELECT c.relname,
 has_table_privilege('asistencia_app',c.oid,'SELECT') AS sel,
 has_table_privilege('asistencia_app',c.oid,'INSERT') AS ins,
 has_table_privilege('asistencia_app',c.oid,'UPDATE') AS upd,
 has_table_privilege('asistencia_app',c.oid,'DELETE') AS del,
 has_table_privilege('asistencia_app',c.oid,'TRUNCATE') AS trunc,
 has_table_privilege('asistencia_app',c.oid,'TRIGGER') AS trig,
 has_table_privilege('asistencia_app',c.oid,'REFERENCES') AS refs
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;
SELECT column_name,has_column_privilege('asistencia_app','public.attendances',column_name,'UPDATE') AS app_update
 FROM information_schema.columns WHERE table_schema='public' AND table_name='attendances' ORDER BY ordinal_position;
-- PostgreSQL genera solo SELECT; no consultar datos personales, solo conteos.
SELECT format('SELECT %L AS table_name,count(*) AS rows FROM %I.%I;',c.relname,n.nspname,c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname \gexec
ROLLBACK;
