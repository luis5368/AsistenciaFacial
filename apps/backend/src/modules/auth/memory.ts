import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '../../http/errors.js';
export type Clock = () => number;
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export interface SessionRecord { userId: string; institutionId: string; fingerprint: string; createdAt: number; lastSeen: number }
export class MemorySessions {
  private readonly records = new Map<string, SessionRecord>();
  constructor(private readonly now: Clock = Date.now, private readonly max = 1000) {}
  private expired(s: SessionRecord) { const n=this.now(); return n < s.lastSeen || n-s.lastSeen >= 30*60_000 || n-s.createdAt >= 8*60*60_000; }
  private sweep() { for (const [key,s] of this.records) if (this.expired(s)) this.records.delete(key); }
  issue(userId: string, institutionId: string, fingerprint: string): string {
    this.sweep();
    const own=[...this.records.entries()].filter(([,s])=>s.userId===userId&&s.institutionId===institutionId);
    if(own.length>=5) this.records.delete(own[0]![0]);
    if(this.records.size>=this.max) throw new HttpError('SERVICE_UNAVAILABLE');
    const token=randomBytes(32).toString('base64url');
    this.records.set(digest(token),{userId,institutionId,fingerprint,createdAt:this.now(),lastSeen:this.now()});
    return token;
  }
  get(token: string): SessionRecord | undefined {
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))return;
    const key=digest(token), s=this.records.get(key);
    if(s&&this.expired(s)){this.records.delete(key);return;}
    return s ? {...s} : undefined;
  }
  touch(token:string) { const s=this.get(token);if(!s)throw new HttpError('AUTH_REQUIRED');this.records.set(digest(token),{...s,lastSeen:this.now()}); }
  revoke(token:string) {this.records.delete(digest(token));}
  revokeUser(userId:string,institutionId:string) {for(const [key,s] of this.records)if(s.userId===userId&&s.institutionId===institutionId)this.records.delete(key);}
}
export class MemoryRateLimit {
  private readonly buckets=new Map<string,{count:number;until:number}>();
  constructor(private readonly now:Clock=Date.now,private readonly max=10_000){}
  take(key:string,limit:number,windowMs:number) {
    const n=this.now();for(const [k,v] of this.buckets)if(v.until<=n)this.buckets.delete(k);
    const hashed=digest(key),bucket=this.buckets.get(hashed);
    if(bucket&&bucket.count>=limit)throw new HttpError('RATE_LIMITED');
    if(!bucket&&this.buckets.size>=this.max)throw new HttpError('SERVICE_UNAVAILABLE');
    this.buckets.set(hashed,{count:(bucket?.count??0)+1,until:bucket?.until??n+windowMs});
  }
}
