import type { AuthUser } from '../auth/repository.js';

export interface Catalog {
  institution: { id: string; name: string };
  user: AuthUser;
  teacher: { id: string; institutionId: string; userId: string };
  student: { id: string; institutionId: string; studentCode: string; fullName: string; active: boolean };
  group: { id: string; institutionId: string; grade: string; section: string; schoolYear: number };
}
export type Kind = keyof Catalog;
export interface Assignment { institutionId: string; teacherId: string; groupId: string; active: boolean }
export interface Scope { teacherUserId?: string; years: number[]; now: Date }
export interface Page { limit: number; after?: string }
export interface AdministrationTx {
  /** Acquired before reading actor or counting admins. All administrative writers use this lock. */
  lockInstitution(): Promise<void>;
  lockActor(id: string): Promise<void>;
  get<K extends Kind>(kind: K, id: string, scope?: Scope): Promise<Catalog[K] | null>;
  list<K extends Kind>(kind: K, page: Page, scope: Scope): Promise<Catalog[K][]>;
  insert<K extends Kind>(kind: K, record: Catalog[K]): Promise<Catalog[K]>;
  update<K extends Kind>(kind: K, id: string, changes: Partial<Catalog[K]>): Promise<Catalog[K]>;
  countActiveAdmins(): Promise<number>;
  assignment(teacherId: string, groupId: string): Promise<Assignment | null>;
  saveAssignment(record: Assignment, exists: boolean): Promise<Assignment>;
  ownAssignments(userId: string, page: Page, scope: Scope): Promise<Assignment[]>;
  audit(actorId: string, action: string, kind: string, resourceId: string): Promise<void>;
}
export interface AdministrationUnitOfWork {
  run<T>(institutionId: string, action: (tx: AdministrationTx) => Promise<T>): Promise<T>;
}
