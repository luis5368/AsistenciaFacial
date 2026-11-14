/** Contratos para futura autorización académica. AuthService implementa el flujo de sesión local. */
export interface Principal {
  readonly institutionId: string;
  readonly userId: string;
  readonly role: 'ADMIN' | 'TEACHER';
}
export interface AuthenticationPort {
  authenticate(sessionToken: string | undefined): Promise<Principal | null>;
}
export interface AuthorizationPort {
  assertAllowed(principal: Principal, action: string, resourceId?: string): Promise<void>;
}
