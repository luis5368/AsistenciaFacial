import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';
import { localDatabaseUrl } from '../config/database-url.js';

/** Fábrica explícita, sin conexión ni consulta al importar el módulo. */
export function createDatabase(url: string | undefined = process.env.DATABASE_URL): PrismaClient {
  const connectionString = localDatabaseUrl(url, 'application');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 5000 }) });
}

/** institutionId debe proceder de autenticación del servidor, nunca del cuerpo HTTP. */
export async function withInstitution<T>(
  db: PrismaClient,
  institutionId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { isolationLevel: Prisma.TransactionIsolationLevel },
): Promise<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(institutionId)) {
    throw new Error('Institución inválida.');
  }
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.institution_id', ${institutionId}, true)`;
    return operation(tx);
  }, options);
}
