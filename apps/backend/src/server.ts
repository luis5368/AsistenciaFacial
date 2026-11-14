import { config as loadEnv } from 'dotenv';
import { loadApplicationConfig } from './config/application.js';
import { createApp } from './app.js';
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { createDatabase } from './infrastructure/database.js';
import { PrismaAuthRepository } from './repositories/auth.js';
import { AuthService } from './modules/auth/service.js';

// Runtime separado de CLI migrador. No habilitar auth hasta validar institución por RLS.
let db: ReturnType<typeof createDatabase> | undefined;
try {
  loadEnv({ path: '.env.application', quiet: true });
  const config = loadApplicationConfig(process.env);
  if (!config.origin.startsWith('https://') || Number(new URL(config.origin).port || 443)!==config.port) throw Error();
  const key=readFileSync(process.env.LOCAL_TLS_KEY ?? '');
  const cert=readFileSync(process.env.LOCAL_TLS_CERT ?? '');
  db=createDatabase(process.env.DATABASE_URL);
  const auth=await AuthService.initialize(config.institutionId,new PrismaAuthRepository(db,config.institutionId));
  const server=createServer({key,cert,minVersion:'TLSv1.2'},createApp(config,undefined,auth));
  server.listen(config.port,'127.0.0.1');
  server.on('error', () => { process.stderr.write('No se pudo iniciar el servidor local.\n'); void db?.$disconnect(); process.exitCode = 1; });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,()=>server.close(()=>{void db?.$disconnect();}));
} catch {
  await db?.$disconnect();
  process.stderr.write('Inicio rechazado: configuración, institución o dependencia no disponible.\n');
  process.exitCode = 1;
}
