# Fase 3 — etapas 0 y 1: contratos e infraestructura HTTP

13 de noviembre de 2026, America/Guatemala. **Implementadas para revisión;
autenticación y operaciones académicas no habilitadas.**

## Resultado y alcance

Única ruta funcional: **GET /api/v1/health**, y HEAD equivalente automático de
Express. Responde exactamente `{"status":"ok"}`; comprueba vida del proceso,
no conectividad de BD. La ruta anterior `/health`, que exponía etapa/estado de BD,
se sustituyó por la ruta v1 mínima. Login, usuarios, sincronización y restantes
rutas devuelven 404; no se monta Swagger UI ni se sirve el contrato como endpoint.

El servidor escucha únicamente 127.0.0.1. No se ejecutó un servidor persistente;
Supertest abrió/cerró puertos efímeros para las pruebas. No se conectó a PostgreSQL:
se usaron dobles para transacciones y los tests previos de fábrica Prisma no
ejecutan consultas. No se ejecutaron psql, migraciones, roles, seeds o fixtures.

## Archivos creados o modificados

| Archivos | Responsabilidad |
| --- | --- |
| apps/backend/src/config/application.ts | Configuración requerida de institución/calendario; parámetros experimentales y límites |
| apps/backend/src/http/contracts.ts | DTO Zod estrictos para catálogo v1, evento manual, corrección, lote, fechas y paginación |
| apps/backend/src/http/errors.ts, validation.ts, security.ts | Errores seguros, ETag, requestId, cabeceras y rechazo de contexto cliente |
| apps/backend/src/http/controllers/health.ts, routes.ts | Controlador/ruta de salud exclusivamente |
| apps/backend/src/modules/health/service.ts | Servicio de salud sin dependencias de datos |
| apps/backend/src/modules/auth/ports.ts | Interfaces de identidad/auth/autorización; sin implementación o sesión activa |
| apps/backend/src/repositories/context.ts | Adaptador de transacción que exige principal de institución configurada |
| apps/backend/src/app.ts, server.ts | Composición HTTP y arranque local sin cliente Prisma |
| apps/backend/.env.application.example | Plantilla vacía de institución/calendario, sin cuentas ni secretos |
| apps/backend/scripts/openapi.mjs, docs/openapi-v1.json | Contrato OpenAPI 3.1 reproducible, rutas futuras marcadas x-implemented=false |
| apps/backend/test/contracts.test.ts, http.test.ts | Pruebas de contratos, configuración, aislamiento con doble y HTTP |
| apps/backend/package.json, package-lock.json | Dependencias exactas y scripts start:local/openapi |
| .gitignore | Excepción para plantilla .env.application.example; entornos privados siguen ignorados |
| Documentación de arquitectura, ADR 004 y este informe | Estado y límites de las etapas aprobadas |

Se conservaron los cambios existentes (repositorio sin seguimiento desde el inicio).
No se modificaron src/domain/attendance.ts, schema.prisma ni las migraciones.

## Configuración y ejecución local posterior

Desde apps/backend: preparar manualmente `.env.application` a partir de la
plantilla; no copiar `.env` del migrador. API_INSTITUTION_ID requiere UUID válido,
sin valor predeterminado. API_CALENDAR_JSON requiere array de schoolYear,
startsAt/endsAt UTC canónicos, períodos ordenados no superpuestos y años únicos.
No se crearon archivos privados ni se aprovisionó ninguna institución o cuenta.

Las ventanas por defecto son 24 h/5 min, configurables dentro de límites de
laboratorio (1–168 h y 1–60 min). Son configuración preparada, no sincronización
implementada. Solo development/test; producción se rechaza. API_ORIGIN debe ser
local y sin credenciales, query ni fragmento. Config inválida falla sin imprimir
valores ni abrir listener. Los errores del puerto tampoco exponen configuración.

```powershell
npm.cmd run build -w apps/backend
npm.cmd run start:local -w apps/backend
# En otra terminal, solo después de configurar el entorno local:
curl.exe http://localhost:3001/api/v1/health
```

Arranque de salud local HTTP, sin login: no afirma TLS configurado. La etapa 2
requerirá HTTPS local antes de cookies Secure. El runtime carga explícitamente
`.env.application`; Prisma conserva su única configuración y `.env` para
migraciones, que no se carga desde server.ts. La futura app requerirá una
DATABASE_URL de asistencia_app, nunca la del migrador. Salud no necesita URL.

**Límite intencional:** validar UUID/configuración no demuestra existencia de la
institución. La comprobación contra BD al activar servicios autenticados se
difiere; no debilitar RLS ni crear instituciones automáticamente para resolverla.

## Seguridad y contratos

- requestId aleatorio generado en servidor por petición; no se confía en el ID
  entrante. Logs opcionales solo contienen requestId/status/duración, nunca URL,
  cuerpo, cookie o error original. Error desconocido siempre 500 genérico.
- no-store, nosniff, CSP restrictiva, DENY framing, referrer-policy y permissions-policy
  para la API; no se alteraron políticas de cámara del frontend.
- CORS sin habilitar; rechazar Origin distinto y Fetch Metadata cross-site.
  No se considera esto una implementación CSRF completa para autenticación futura.
- JSON estricto ≤256 KiB, sin compresión de cuerpos; errores 400/413/415 seguros.
  Rechazar cabeceras de institución/usuario/rol e If-Match malformado. El requestId
  externo se ignora. Express puede rechazar HTTP malformado antes del middleware;
  no se promete error JSON para errores del parser HTTP de Node.
- DTO con additionalProperties=false; no incorporar institutionId/actor/embedding
  en evento manual. Contrato y hash v1 se conservan, incluidos UUID y UTC estrictos.
- Paginación default 50/máximo 100 y cursor opaco acotado; ETag fuerte sobre array
  canónico. 428 sin precondición, 400 malformada, 412 no coincidente. A→B→A y
  validación del cursor frente a consultas siguen siendo tareas de servicio.
- Transacciones solo por inPrincipalTransaction → withInstitution, con
  TransactionClient en repositorios; identidad se recibirá de auth servidor,
  no hay conversión HTTP→Principal ni auth falsa implementada.

OpenAPI contiene 30 paths con operaciones previstas; únicamente salud se marca
implementada. Los esquemas se generan desde Zod. Las restricciones entre campos
(orden/rango de fechas, PATCH no vacío) se aplican en Zod pero JSON Schema no
representa todos los refinamientos: deben validarse también en servidor. Integridad
referencial, permisos, auditoría, unicidad, ventanas y contenido del ETag dependen
del servicio transaccional aún no implementado. Los futuros listados por período
deberán componer DateRange/Pagination con los filtros autorizados por ruta.

## Dependencias evaluadas antes de instalar

| Paquete exacto | Uso | Compatibilidad/licencia |
| --- | --- | --- |
| zod 4.6.7 | Runtime, DTO y exportación JSON Schema | MIT; TS ≥5.5, proyecto TS7 strict; sin dependencias externas |
| supertest 7.3.2 | Solo desarrollo, pruebas HTTP | MIT; Node ≥14.18, probado con Node24.20 |
| @types/supertest 7.2.1 | Solo desarrollo | MIT; tipos para Supertest |

Fuentes: [Zod](https://zod.dev/) y [Supertest](https://github.com/forwardemail/supertest),
metadatos npm version/license/engines y lockfile aislado previo a instalación.
Audit del grafo aislado previo: 0 vulnerabilidades conocidas; no equivale a
garantía de seguridad. Instalación con --save-exact --ignore-scripts. No se
instaló Argon2 ni middleware de sesión: corresponden a la etapa 2.

Audit completo posterior: **8 paquetes afectados, 5 moderados/3 bajos**, sin
altos/críticos. [Salida real](fase-3-audit.json). Incluye fast-uri y cadenas
PWA/Workbox (glob/minimatch/deepmerge/serialize-javascript). No son 8 fallos
independientes ni prueba de alcance remoto en salud. Las nuevas dependencias
directas no aparecen en ese informe. La variación frente a los 15 históricos
depende del grafo/reporte consultado: no se declara que hayan sido corregidos.
No se ejecutó audit fix ni se cambiaron dependencias biométricas deliberadamente;
mantener revisión de alcance y compatibilidad antes de cualquier actualización.

## Verificaciones reales

| Verificación | Resultado |
| --- | --- |
| Backend node:test, incluyendo contratos/HTTP | 27/27 satisfactorias |
| Frontend Vitest existente | 16/16 satisfactorias |
| TypeScript backend/frontend | Exit 0 en ambos |
| Build backend y generación OpenAPI | Exit 0 |
| Referencias internas OpenAPI | Sin referencias faltantes |
| Hash esquema y dos migraciones | Coinciden con aprobados; sin cambios |
| Audit previo aislado / completo posterior | Exit 0 / exit 1 por 8 avisos; sin arreglos automáticos |

Comandos ejecutados: npm view con caché local; install --package-lock-only en
.tmp/api-dependency-review; audit aislado; install -w apps/backend --save-exact
zod@4.6.7 y --save-dev supertest@7.3.2 @types/supertest@7.2.1; npm run openapi,
typecheck/build backend, typecheck frontend y test en ambos workspaces.

Incidencias resueltas: npm no pudo acceder a su caché de usuario (EPERM), se usó
.tmp/npm-cache; la carpeta de revisión inicial debía crearse antes del lockfile.
Un error de sintaxis del generador OpenAPI causó inicialmente 26/27 pruebas;
se corrigió y se repitió la suite. Los tests tsx se ejecutaron con contexto Windows
compatible para evitar el fallo de identidad ENOMEM previamente conocido, sin
suprimir verificaciones. No hubo pruebas funcionales de BD, E2E biométrico ni
pruebas humanas: no corresponden a las etapas autorizadas.

## Pendientes y parada

Interfaces de auth/roles preparadas, sin proveedor ni login. El API futuro deberá
comprobar usuario/rol activo dentro de la transacción; el helper actual solo
comprueba coincidencia de institución y establece contexto. No afirmar seguridad
funcional de autorización completa a partir de dobles.

Etapa 2 requiere autorización explícita: selección/revisión Argon2id, sesiones
volátiles acotadas, HTTPS local, CSRF, límites de login y aprovisionamiento ficticio
separado. No avanzar automáticamente, no conectar principal para tests, no crear
cuentas ni ejecutar migraciones. Biometría y sus pendientes humanos siguen separados.
