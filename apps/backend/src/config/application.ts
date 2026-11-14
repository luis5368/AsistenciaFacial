import { z } from 'zod';
import { utc, uuid } from '../http/contracts.js';

const calendarSchema = z.array(z.strictObject({ schoolYear: z.number().int().min(2000).max(2200),
  startsAt: utc, endsAt: utc })).min(1).max(20).refine(rows =>
  new Set(rows.map(r => r.schoolYear)).size === rows.length && rows.every(r => r.startsAt < r.endsAt)
  && rows.every((a,i) => rows.every((b,j) => i === j || a.endsAt <= b.startsAt || b.endsAt <= a.startsAt)));
export interface ApplicationConfig {
  readonly institutionId: string;
  readonly calendar: ReadonlyArray<Readonly<{schoolYear: number; startsAt: string; endsAt: string}>>;
  readonly syncMaxAgeHours: number;
  readonly futureToleranceMinutes: number;
  readonly origin: string;
  readonly port: number;
}
export function loadApplicationConfig(env: NodeJS.ProcessEnv): ApplicationConfig {
  try {
    if (env.NODE_ENV && !['development', 'test'].includes(env.NODE_ENV)) throw Error();
    const institutionId = uuid.parse(env.API_INSTITUTION_ID).toLowerCase();
    const calendar = calendarSchema.parse(JSON.parse(env.API_CALENDAR_JSON ?? ''));
    const number = (value: string | undefined, fallback: number, max: number) => {
      if (value !== undefined && !/^[1-9]\d*$/.test(value)) throw Error();
      const n = value === undefined ? fallback : Number(value);
      if (!Number.isSafeInteger(n) || n > max) throw Error();
      return n;
    };
    const port = number(env.API_PORT, 3001, 65535);
    const origin = new URL(env.API_ORIGIN ?? `http://localhost:${port}`);
    if (!['http:', 'https:'].includes(origin.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
      || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw Error();
    return Object.freeze({ institutionId, calendar: Object.freeze(calendar.map(r => Object.freeze(r))),
      syncMaxAgeHours: number(env.SYNC_MAX_AGE_HOURS, 24, 168),
      futureToleranceMinutes: number(env.SYNC_FUTURE_TOLERANCE_MINUTES, 5, 60), origin: origin.origin, port });
  } catch { throw new Error('Configuración de aplicación inválida; revise los campos requeridos localmente.'); }
}
