/** Destino exclusivo del ensayo; nunca revela datos de autenticación en errores. */
export function sandboxMigrationUrl(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error('URL sandbox inválida.'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.hostname !== 'localhost'
    || parsed.port !== '5432' || parsed.username !== 'asistencia_migrator'
    || parsed.pathname !== '/asistencia_facial_sandbox' || parsed.hash
    || [...parsed.searchParams].length > 1
    || [...parsed.searchParams].some(([key, setting]) => key !== 'schema' || setting !== 'public')) {
    throw new Error('URL sandbox fuera del destino autorizado.');
  }
  return value;
}
