# Fase 3, etapa 2 — autenticación local

Implementación para revisión, 13 de noviembre de 2026 (Guatemala). Exclusivamente laboratorio. No se abrió conexión a PostgreSQL, no se aprovisionaron cuentas y no se modificaron esquema, migraciones, permisos, frontend ni biometría. No constituye validación de autenticación real contra PostgreSQL.

## Arquitectura y alcance

Controladores Express → AuthService → AuthRepository → adaptador Prisma. Cada operación del adaptador utiliza `withInstitution` y contexto transaccional RLS. El runtime admite exclusivamente `asistencia_app`, institución del servidor y HTTPS loopback; comprueba existencia de la institución antes de escuchar. Una base sin institución no permite arrancar. No hay autorregistro ni credenciales predeterminadas.

| Método | Ruta habilitada | Resultado |
|---|---|---|
| POST | /api/v1/auth/login | Perfil y cookie; nunca token en JSON |
| GET/HEAD | /api/v1/auth/session | Perfil actual, expiración, token CSRF (HEAD sin cuerpo) |
| POST | /api/v1/auth/logout | 204, revoca sesión y borra cookie |
| POST | /api/v1/auth/password-change | 204, CAS de contraseña con auditoría transaccional y revocación de todas las sesiones |

Continúa GET/HEAD `/api/v1/health`. Catálogos y sincronización siguen deshabilitados. OpenAPI distingue operaciones implementadas y contratos futuros.

## Contraseñas y sesiones

Argon2id asíncrono nativo de Node 24.20.0, sal aleatoria de 16 bytes, salida de 32 bytes, memoria 19 MiB, dos pasadas, paralelismo 1. Formato PHC acotado al perfil revisado; hashes desconocidos fallan cerrado. Comparación constante de buffers. Máximo dos derivaciones concurrentes por servicio; saturación devuelve 503. No se instala dependencia nueva ni se cambia lockfile por esta etapa.

Perfil basado en [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); API contrastada con [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback). La documentación online corresponde a una revisión posterior de Node 24; la ejecución comprobada aquí fue 24.20.0. No asumir compatibilidad con todas las versiones 24.0: requiere la API Argon2 incorporada desde 24.7. Se verifica además el vector independiente de [RFC 9106, sección 5.3](https://www.rfc-editor.org/rfc/rfc9106.html#section-5.3).

Diez muestras secuenciales después de calentamiento: hash medio **32.617 ms**, verificación **32.699 ms**. Datos completos en `fase-3-argon2-mediciones.json`; RSS expresa bytes del proceso, no memoria máxima atribuible a Argon2. No es ensayo de carga ni calibración para producción.

Sesiones con token aleatorio de 32 bytes y solo SHA-256 del identificador en el mapa. El token sin hash existe transitoriamente durante respuesta/solicitud; no se conserva en registros. Inactividad 30 minutos, máximo absoluto 8 horas, máximo cinco sesiones por usuario y mil globales. Reiniciar elimina sesiones y límites. Cookie `__Host-af_session`: HttpOnly, Secure, SameSite=Lax, Path=/, sin Domain. CSRF HMAC ligado a sesión, origen exacto obligatorio en mutaciones, rechazo cross-site y HTTP.

Login limita todos los intentos (también éxitos): 5/cuenta/15 minutos y 30/IP/15 minutos. Sesión: 120 solicitudes/minuto. Cambio de contraseña: 5/usuario/15 minutos. Claves del limitador almacenadas como digest; capacidad global acotada. Retry-After conservador de 900 segundos. Respuestas idénticas para cuenta inexistente, inactiva o contraseña incorrecta; no se afirma resistencia temporal demostrada estadísticamente.

Logout y cambio de contraseña revocan inmediatamente. El hook `revokeUser` permite revocación inmediata desde futuros servicios de administración. Cambios externos de rol, estado o hash se detectan y rechazan antes de autorizar la siguiente solicitud consultando al repositorio. **No existe observador de cambios externos ni endpoint administrativo en esta etapa**: la invalidación del mapa en el instante de una modificación externa queda pendiente; ninguna sesión detectada con identidad obsoleta se acepta. Los servicios futuros deberán invocar el hook al confirmar su transacción.

## Archivos

- Nuevos: `apps/backend/src/modules/auth/{password,memory,repository,service}.ts`, `src/repositories/auth.ts`, `src/http/controllers/auth.ts`, `test/auth.test.ts`, `scripts/benchmark-auth.mjs`.
- Modificados en backend: `src/app.ts`, `src/server.ts`, `src/http/{contracts,errors}.ts`, `src/modules/auth/ports.ts`, `.env.application.example`, `scripts/openapi.mjs`, `test/contracts.test.ts`.
- Preparación TLS: `scripts/prepare-auth-tls.ps1`; certificado y clave privados exclusivamente en `.tmp/tls-auth/`, ignorados por Git.
- Documentación: OpenAPI, arquitectura, ADR 005, evaluación de tecnologías, README, AGENTS e informe presente.

## Ejecución reproducible y resultados

Desde la raíz:

```powershell
# Una vez, en terminal local cuya política permita el script revisado:
./scripts/prepare-auth-tls.ps1
npm.cmd run openapi -w apps/backend
npm.cmd run typecheck -w apps/backend
npm.cmd run test -w apps/backend
node apps/backend/scripts/benchmark-auth.mjs
npm.cmd run typecheck -w apps/frontend
npm.cmd run test -w apps/frontend
```

El preparador se niega a sobrescribir un directorio existente. No instalar certificados en el sistema ni desactivar globalmente la validación TLS. Para repetir en esta máquina ya existen los archivos privados; omitir preparación. Requiere OpenSSL de Git en la ruta documentada en el script. Los tests se ejecutan con la misma cuenta que puede leer la clave.

| Verificación ejecutada | Resultado |
|---|---|
| Backend TypeScript/build y generación OpenAPI | Satisfactorios |
| Backend: 27 pruebas anteriores + 10 nuevas | 37/37 satisfactorias |
| Frontend TypeScript | Satisfactorio |
| Frontend Vitest | 16/16 satisfactorias |
| Argon2 real y vector RFC | Satisfactorios |
| HTTPS Supertest con certificado explícitamente confiado | Satisfactorio, sin desactivar validación TLS |
| Atributos de cookie, CSRF, origen, HTTP rechazado | Satisfactorios |
| Revocación, expiración, límites, reinicio, aislamiento | Satisfactorios con dobles/reloj controlado |
| Adaptador Prisma: contexto, CAS y auditoría | Orden y argumentos verificados con doble; no integridad real PostgreSQL |
| Esquema y dos migraciones | SHA-256 idénticos a evidencia previa |

Incidencias reales: la política local bloqueó ejecutar el archivo PowerShell; se ejecutaron sus instrucciones explícitas sin cambiar dicha política. La cuenta restringida generó el certificado con ACL privada y la cuenta de pruebas inicialmente no podía leerlo (EPERM); se concedió lectura a la cuenta local del usuario, conservando ACL restringida. El ejecutor restringido también reproduce `uv_os_get_passwd ENOMEM` en tsx; la ejecución autorizada bajo la cuenta local pasó. Ninguno de esos fallos se contabiliza como prueba aprobada.

Supertest prueba TLS real con repositorio doble y envía manualmente la cookie. **No prueba el almacén de cookies ni las políticas de un navegador real**. No se instaló confianza en Windows. Pendiente ensayo de navegador con consentimiento para la confianza local que corresponda.

## Integridad y pendientes

Hashes SHA-256 preservados:

| Archivo | SHA-256 |
|---|---|
| schema.prisma | 61cc948e724be0258637b8c48ea4d7bf6868453c466465b8119eccacb39a66bf |
| migración inicial | dc3a10d34f0d795fabe8ca6f769ccbc54c8e04ba655dc582b6f366a417a471bd |
| migración correctiva | 4fd264537d9399f122b709c0368c51744c7344be03ed0802b671855cb29a6f2b |

Las ocho alertas npm previamente documentadas permanecen pendientes; no se ejecutó audit fix ni se afirma una nueva auditoría limpia. No hay dependencias npm nuevas ni transitivas añadidas por autenticación.

Antes del aprovisionamiento ficticio se requiere autorización separada que defina base permitida, institución, cuentas sintéticas, responsable, credenciales introducidas privadamente y eliminación/revocación. El correo se normaliza a minúsculas; el aprovisionamiento futuro debe usar esa misma convención. Ninguna cuenta se creó. Configurar `.env.application` privado siguiendo el ejemplo, con usuario de aplicación, institución existente y rutas TLS; solo entonces `npm.cmd run start:local -w apps/backend`. **Ese arranque real no se ejecutó aquí**.

Pendientes: ensayo real PostgreSQL/RLS/CAS/auditoría bajo autorización; navegador; pruebas de carga y temporización; política de contraseñas comunes/comprometidas; recuperación de contraseña y MFA fuera de alcance; almacén compartido de sesiones y límites antes de múltiples procesos/producción; integración del hook de revocación en futuras mutaciones de rol/estado. No se declara terminada Fase 1 ni se inicia etapa 3. Recomendación: revisar y aceptar el alcance probado con dobles, manteniendo estos límites explícitos.
