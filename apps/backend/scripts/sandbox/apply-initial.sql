\set ON_ERROR_STOP on
\ir assert-migrator.sql
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema')
 OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
   WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema')
 OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema') THEN
   RAISE EXCEPTION 'sandbox_not_empty_review_required';
 END IF;
END;
$$;
-- SQL aprobado sin cambios, ejecutado una sola vez como migrador.
\ir ../../prisma/migrations/20261113000000_initial_review/migration.sql
