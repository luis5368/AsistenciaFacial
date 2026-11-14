/** Guard exclusivo del laboratorio. No altera la configuración del runtime principal. */
export function apiLabUrl(value: string | undefined, role: 'asistencia_app' | 'asistencia_migrator'): string {
  try {
    if (!value) throw Error();
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
      || parsed.hostname !== 'localhost' || parsed.port !== '5432'
      || parsed.username !== role || parsed.pathname !== '/asistencia_facial_api_lab'
      || parsed.search || parsed.hash) throw Error();
    return value;
  } catch { throw new Error('Destino o rol de laboratorio API no autorizado.'); }
}
