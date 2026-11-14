import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../../http/errors.js';

// Perfil único de laboratorio. No aceptar parámetros arbitrarios de un hash no confiable.
export const ARGON_PROFILE = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 } as const;
export class PasswordHasher {
  private running = 0;
  private async derive(password: string, salt: Buffer): Promise<Buffer> {
    if (this.running >= 2) throw new HttpError('SERVICE_UNAVAILABLE');
    this.running++;
    try {
      return await new Promise<Buffer>((resolve, reject) => argon2('argon2id', {
        ...ARGON_PROFILE, message: password, nonce: salt,
      }, (error, result) => error ? reject(new HttpError('SERVICE_UNAVAILABLE')) : resolve(result)));
    } finally { this.running--; }
  }
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const result = await this.derive(password, salt);
    return `$argon2id$v=19$m=19456,t=2,p=1$${salt.toString('base64').replace(/=+$/, '')}$${result.toString('base64').replace(/=+$/, '')}`;
  }
  async verify(encoded: string, password: string): Promise<boolean> {
    const match = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(encoded);
    if (!match) { await this.derive(password, Buffer.alloc(16)); return false; }
    const salt = Buffer.from(match[1]!, 'base64');
    const expected = Buffer.from(match[2]!, 'base64');
    const actual = await this.derive(password, salt);
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  }
}
