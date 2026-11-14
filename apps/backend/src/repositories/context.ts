import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { Principal } from '../modules/auth/ports.js';
import { withInstitution } from '../infrastructure/database.js';
export interface RepositoryContext { readonly tx: Prisma.TransactionClient; readonly principal: Principal }
/** No conectado a rutas: futuro servicio aporta identidad resuelta por auth del servidor. */
export function inPrincipalTransaction<T>(db: PrismaClient, configuredInstitution: string, principal: Principal,
  operation: (context: RepositoryContext) => Promise<T>): Promise<T> {
  if (principal.institutionId !== configuredInstitution) return Promise.reject(new Error('Contexto institucional incompatible.'));
  return withInstitution(db, configuredInstitution, tx => operation({ tx, principal }));
}
