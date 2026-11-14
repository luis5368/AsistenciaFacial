# Backend — preparación Fase 2

Actualización API etapas 0/1: GET/HEAD `/api/v1/health` sin acceso a BD.
Configurar manualmente `.env.application` desde `.env.application.example`,
ejecutar `npm.cmd run build -w apps/backend` y `npm.cmd run start:local -w apps/backend`.
Solo loopback; sin login. El entorno Prisma `.env` permanece separado.
Contrato: [OpenAPI](../../docs/openapi-v1.json); regenerar con
`npm.cmd run openapi -w apps/backend`. Ver [resultados y limitaciones](../../docs/evidencias/fase-3-etapas-0-1.md).

Node 24.20.0, Express/TypeScript y Prisma/client/adapter-pg 7.10.1 exactas.
PostgreSQL 18.6 local comprobado. **Inicial y correctiva aplicadas solo en
asistencia_facial_sandbox**, con historial Prisma verificado y 52 pruebas reales
satisfactorias. La principal no se ha modificado. Véase el
[informe vigente](../../docs/evidencias/ensayo-postgresql-fase-2.md).
No hay endpoints de escritura ni servidor en ejecución.

Desde la raíz, después de instalar las dependencias del lockfile:

```powershell
npm.cmd run prisma:validate -w apps/backend
npm.cmd run prisma:generate -w apps/backend
npm.cmd run typecheck -w apps/backend
npm.cmd run build -w apps/backend
npm.cmd run test -w apps/backend
```

`prisma:generate` es necesario antes de compilar/probar en una instalación nueva.
El cliente generado y `dist/` no se versionan. Las pruebas no requieren `.env` ni
servidor PostgreSQL. Usan el runner de Node, sin consultas de BD.

- `prisma.config.ts`: única configuración de CLI; carga `.env` del backend.
  Solo con `PRISMA_SANDBOX=1` carga también el archivo privado `.env.sandbox` y
  valida `SANDBOX_MIGRATION_DATABASE_URL` para el destino autorizado. Ejecutar
  la CLI desde este directorio; no imprimir la variable ni versionar el archivo.
- `.env.example`: variables vacías; no colocar credenciales en Git.
- `prisma/schema.prisma`: 14 modelos y relaciones institucionales.
- `prisma/migrations/20261113000000_initial_review/migration.sql`: SQL para revisar,
  con CHECK, índice parcial, triggers y RLS; **no ejecutar sin autorización**.
- `prisma/invariants.sql`: fuente del bloque adicional incorporado a la migración;
  no ejecutar por separado ni modificar migraciones ya aplicadas.
- `prisma/preflight-readonly.sql`, `verify-readonly.sql`: consultas futuras de verificación.
- `prisma/roles-review.sql`, `permissions-review.sql`: planes de privilegios previos/posteriores.
- `src/infrastructure/database.ts`: fábrica pg/Prisma sin apertura automática;
  contexto institucional transaccional. El consumidor deberá llamar `$disconnect()`
  al cerrar su ciclo de vida y cargar su entorno explícitamente.
- `src/domain/attendance.ts`: contrato manual v1, hash y reglas puras de corrección.
- `src/app.ts`: app Express exportada con `/health`, sin conexión ni `listen()`.

Permisos efectivos, migración real, autenticación, repositorios y endpoints quedan
pendientes. Fase 1 tampoco está concluida. Procedimiento completo, respaldo,
reversión y resultados: [Fase 2 preparación](../../docs/fase-2-preparacion.md).
