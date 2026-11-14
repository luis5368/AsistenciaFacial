import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { etagSchema } from './contracts.js';
import { HttpError } from './errors.js';

export function parseDto<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new HttpError('INVALID_REQUEST');
  return result.data;
}
/** El servicio futuro proporciona un array de campos canónicos con orden explícito. */
export function makeEtag(fields: readonly (string | number | boolean | null)[]): string {
  return `"${createHash('sha256').update(JSON.stringify(fields)).digest('hex')}"`;
}
export function requireIfMatch(value: string | undefined, expected: string): void {
  if (value === undefined) throw new HttpError('PRECONDITION_REQUIRED');
  if (!etagSchema.safeParse(value).success) throw new HttpError('INVALID_HEADER');
  if (value !== expected) throw new HttpError('PRECONDITION_FAILED');
}
