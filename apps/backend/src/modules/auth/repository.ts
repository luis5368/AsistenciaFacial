export interface AuthUser {
  id: string;
  institutionId: string;
  email: string;
  role: 'ADMIN' | 'TEACHER';
  active: boolean;
  passwordHash: string;
}
export interface AuthRepository {
  institutionExists(): Promise<boolean>;
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  /** Comparación de credenciales/rol activo y escritura/auditoría atómicas. */
  replacePassword(expected: AuthUser, nextHash: string): Promise<boolean>;
}
