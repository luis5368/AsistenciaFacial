\set ON_ERROR_STOP on
\ir assert-migrator.sql
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='attendances' AND column_name='enrollment_id') THEN
   RAISE EXCEPTION 'corrective_already_present_review_required';
 END IF;
END;
$$;
\ir ../../prisma/migrations/20261114000000_corrections_enrollment_episodes/migration.sql
