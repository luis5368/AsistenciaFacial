-- Verificación futura de estructura; no consulta datos personales.
BEGIN READ ONLY;
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
SELECT tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public';
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'attendances';
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conrelid, conname;
SELECT tgrelid::regclass AS table_name, tgname, pg_get_triggerdef(oid) AS definition
  FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
  ('attendances'::regclass, 'attendance_corrections'::regclass, 'audit_events'::regclass);
COMMIT;
