import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../../http/errors.js';
import { uuid } from '../../http/contracts.js';
import type { AuthRepository, AuthUser } from './repository.js';
import { PasswordHasher } from './password.js';
import { digest, MemoryRateLimit, MemorySessions } from './memory.js';
import type { Clock } from './memory.js';

const fingerprint=(u:AuthUser)=>digest(JSON.stringify([u.id,u.institutionId,u.passwordHash,u.role,u.active]));
const profile=(u:AuthUser)=>({id:u.id,institutionId:u.institutionId,email:u.email,role:u.role});
export class AuthService {
  private readonly csrfKey=randomBytes(32);
  private readonly sessions:MemorySessions;
  private readonly limits:MemoryRateLimit;
  private constructor(private readonly institutionId:string,private readonly repo:AuthRepository,
    private readonly hasher:PasswordHasher,private readonly dummyHash:string,now:Clock){
    this.sessions=new MemorySessions(now);this.limits=new MemoryRateLimit(now);
  }
  static async initialize(institutionId:string,repo:AuthRepository,hasher=new PasswordHasher(),now:Clock=Date.now) {
    if(!uuid.safeParse(institutionId).success||!await repo.institutionExists())throw new Error('Institución no disponible.');
    return new AuthService(institutionId,repo,hasher,await hasher.hash(randomBytes(32).toString('base64url')),now);
  }
  private valid(u:AuthUser|null):u is AuthUser {return !!u&&u.active&&u.institutionId===this.institutionId&&['ADMIN','TEACHER'].includes(u.role);}
  private csrf(token:string) {return createHmac('sha256',this.csrfKey).update(token).digest('base64url');}
  async login(email:string,password:string,ip:string,oldToken?:string){
    this.limits.take('login-ip:'+ip,30,15*60_000);
    this.limits.take('login-account:'+this.institutionId+':'+email,5,15*60_000);
    const user=await this.repo.findByEmail(email);
    const verified=await this.hasher.verify(this.valid(user)?user.passwordHash:this.dummyHash,password);
    if(!this.valid(user)||!verified)throw new HttpError('INVALID_CREDENTIALS');
    const current=await this.repo.findById(user.id);
    if(!this.valid(current)||fingerprint(current)!==fingerprint(user))throw new HttpError('INVALID_CREDENTIALS');
    if(oldToken)this.sessions.revoke(oldToken);
    const token=this.sessions.issue(user.id,this.institutionId,fingerprint(user));
    return {token,profile:profile(user)};
  }
  async authenticate(token:string|undefined){
    if(!token)throw new HttpError('AUTH_REQUIRED');
    const session=this.sessions.get(token);
    if(!session||session.institutionId!==this.institutionId)throw new HttpError('AUTH_REQUIRED');
    this.limits.take('session:'+digest(token),120,60_000);
    const user=await this.repo.findById(session.userId);
    if(!this.valid(user)||fingerprint(user)!==session.fingerprint){
      this.sessions.revokeUser(session.userId,this.institutionId);throw new HttpError('AUTH_REQUIRED');
    }
    this.sessions.touch(token); // También detecta logout/expiración concurrente durante consulta.
    return {user,token,expiresAt:new Date(Math.min(session.createdAt+8*60*60_000,this.sessions.get(token)!.lastSeen+30*60_000)).toISOString()};
  }
  async session(token:string|undefined){const s=await this.authenticate(token);return {profile:profile(s.user),expiresAt:s.expiresAt,csrfToken:this.csrf(s.token)};}
  assertCsrf(token:string,supplied:string|undefined){
    if(!supplied||!this.sessions.get(token)||!/^[A-Za-z0-9_-]{43}$/.test(supplied))throw new HttpError('CSRF_FAILED');
    if(!timingSafeEqual(Buffer.from(this.csrf(token)),Buffer.from(supplied)))throw new HttpError('CSRF_FAILED');
  }
  async logout(token:string|undefined,csrf:string|undefined){const s=await this.authenticate(token);this.assertCsrf(s.token,csrf);this.sessions.revoke(s.token);}
  /** Hook para futuras mutaciones de rol/estado; no crea endpoints administrativos. */
  revokeUser(userId:string){this.sessions.revokeUser(userId,this.institutionId);}
  async changePassword(token:string|undefined,csrf:string|undefined,currentPassword:string,nextPassword:string){
    const s=await this.authenticate(token);this.assertCsrf(s.token,csrf);
    this.limits.take('password:'+s.user.id,5,15*60_000);
    if(!await this.hasher.verify(s.user.passwordHash,currentPassword))throw new HttpError('INVALID_CREDENTIALS');
    const hash=await this.hasher.hash(nextPassword);
    if(!this.sessions.get(s.token))throw new HttpError('AUTH_REQUIRED');
    if(!await this.repo.replacePassword(s.user,hash)){this.revokeUser(s.user.id);throw new HttpError('AUTH_REQUIRED');}
    this.revokeUser(s.user.id);
  }
}
