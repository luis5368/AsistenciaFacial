import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

test('SQL inicial corresponde a su esquema histórico y conserva invariantes adicionales', () => {
  const generated = execFileSync(process.execPath, [resolve('../../node_modules/prisma/build/index.js'),
    'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.initial.prisma', '--script'],
    { encoding: 'utf8', timeout: 30000, env: { ...process.env, MIGRATION_DATABASE_URL: '', DATABASE_URL: '', CHECKPOINT_DISABLE: '1' } });
  assert.match(generated, /CREATE TABLE "attendances"/); // No aceptar código 0 con salida vacía.
  const migration = readFileSync('prisma/migrations/20261113000000_initial_review/migration.sql', 'utf8');
  assert.ok(migration.includes(generated.trim()));
  assert.ok(migration.includes(readFileSync('prisma/invariants.sql', 'utf8').trim()));
  assert.match(migration, /BEGIN;/);
  assert.ok(migration.trim().endsWith('COMMIT;'));
  // Es comparación de artefactos; no prueba ejecución de SQL ni integridad en PostgreSQL.
});
