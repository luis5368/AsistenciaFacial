import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { apiLabUrl } from './src/config/api-lab-url.js';

// Configuración explícita del ensayo: nunca carga .env ni .env.sandbox.
loadEnv({ path: '.env.api-lab', quiet: true });
const url = apiLabUrl(process.env.API_LAB_MIGRATION_DATABASE_URL, 'asistencia_migrator');
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url },
});
