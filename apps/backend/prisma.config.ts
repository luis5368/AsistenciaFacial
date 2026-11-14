import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { localDatabaseUrl } from './src/config/database-url.js';
import { sandboxMigrationUrl } from './src/config/sandbox-url.js';

// Sin URL: validate/generate son locales; migrar falla por falta de URL.
// La CLI nunca reutiliza las credenciales del usuario de aplicación.
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
// Ensayo autorizado: destino fijo, sin contraseña en código ni lectura manual de pgpass.
const sandbox = process.env.PRISMA_SANDBOX === '1';
let sandboxUrl = 'postgresql://asistencia_migrator@localhost:5432/asistencia_facial_sandbox';
if (sandbox) {
  loadEnv({ path: '.env.sandbox', quiet: true });
  const candidate = process.env.SANDBOX_MIGRATION_DATABASE_URL;
  if (candidate) {
    sandboxUrl = sandboxMigrationUrl(candidate);
  }
}
// El motor 7.10.1 exige datasource incluso para diff entre archivos. Solo para
// este comando sin BD se proporciona un destino ficticio que no es la BD local.
const args = process.argv.slice(2);
const offlineDiff = args[0] === 'migrate' && args[1] === 'diff'
  && args.includes('--from-empty') && args.includes('--to-schema')
  && !args.some((arg) => arg.startsWith('--') && /config-datasource|migrations/.test(arg));
const url = offlineDiff ? 'postgresql://offline@127.0.0.1:1/offline_schema_only'
  : sandbox ? sandboxUrl
  : migrationUrl ? localDatabaseUrl(migrationUrl, 'migration') : undefined;
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(url ? { datasource: { url } } : {}),
});
