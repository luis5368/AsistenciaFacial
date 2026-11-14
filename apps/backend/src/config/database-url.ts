/** No imprime URLs ni credenciales. Rechaza red remota y parámetros que cambien destino. */
export function localDatabaseUrl(value: string | undefined, purpose: 'application' | 'migration'): string {
  const invalid = () => new Error('Configuración PostgreSQL local inválida; revise destino, rol y parámetros.');
  if (!value) throw invalid();
  let url: URL;
  try { url = new URL(value); } catch { throw invalid(); }
  const expectedRole = purpose === 'application' ? 'asistencia_app' : 'asistencia_migrator';
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || (url.port && url.port !== '5432')
    || url.pathname !== '/asistencia_facial'
    || url.username !== expectedRole
    || url.search !== '' || url.hash !== '') throw invalid();
  return value;
}
