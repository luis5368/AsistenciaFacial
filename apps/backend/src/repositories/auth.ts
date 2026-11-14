import type { PrismaClient } from '../generated/prisma/client.js';
import { withInstitution } from '../infrastructure/database.js';
import type { AuthRepository, AuthUser } from '../modules/auth/repository.js';

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly db: PrismaClient, private readonly institutionId: string) {}
  institutionExists() {
    return withInstitution(this.db, this.institutionId, async tx =>
      (await tx.institution.findUnique({ where: { id: this.institutionId }, select: { id: true } })) !== null);
  }
  findByEmail(email: string) {
    return withInstitution(this.db, this.institutionId, tx => tx.user.findUnique({
      where: { institutionId_email: { institutionId: this.institutionId, email } },
    }));
  }
  findById(id: string) {
    return withInstitution(this.db, this.institutionId, tx => tx.user.findUnique({
      where: { institutionId_id: { institutionId: this.institutionId, id } },
    }));
  }
  replacePassword(expected: AuthUser, nextHash: string) {
    if (expected.institutionId !== this.institutionId) return Promise.resolve(false);
    return withInstitution(this.db, this.institutionId, async tx => {
      const result = await tx.user.updateMany({ where: { institutionId: this.institutionId,
        id: expected.id, active: true, role: expected.role, passwordHash: expected.passwordHash },
        data: { passwordHash: nextHash } });
      if (result.count !== 1) return false;
      await tx.auditEvent.create({ data: { institutionId: this.institutionId, actorId: expected.id,
        action: 'auth.password_changed', resourceType: 'user', resourceId: expected.id } });
      return true;
    });
  }
}
