# ADR 002 — PostgreSQL local y preparación Prisma

Fecha: 2026-11-13. Estado: arquitectura autorizada; implementación preparada, migración **no aplicada**.

El usuario aprobó Node 24.20.0, PostgreSQL 18.6 y Prisma/client/adapter-pg 7.10.1.
Esta autorización sustituye la antigua prohibición de iniciar Fase 2 solo para
preparar archivos, dependencias y validaciones sin escritura de BD. No supone
cerrar Fase 1 ni aprobar el cambio académico de motor/métricas.

Decisiones:

- Una configuración `apps/backend/prisma.config.ts`, URLs fuera del esquema,
  cliente generado en `src/generated/prisma`, ignorado por Git; adaptador pg.
- Rol `asistencia_app` distinto de `asistencia_migrator`, destino local restringido.
  Credenciales no compartidas; permisos efectivos pendientes de consulta local.
- Claves compuestas institucionales y RLS forzada. Contexto transaccional desde
  autenticación futura; nunca aceptar institución o actor del cuerpo de un evento.
  RLS no protege frente a un servidor comprometido que pueda cambiar ese contexto.
- Evento manual v1 canónico, SHA-256 e idempotencia por institución/UUID; índice
  parcial de asistencia activa única; estado y versión corregibles con historial.
- Matrícula deriva año del grupo (no duplicarlo); docente se vincula 1:1 a usuario.
- Solo metadatos biométricos deshabilitados, sin vectores, imágenes ni claves.
  La columna de embedding cifrado del borrador de Fase 0 queda diferida por la
  restricción explícita actual. No habilitarla mediante campos de texto alternativos.
- SQL inicial generado desde vacío, complementado con CHECK, índice parcial,
  triggers y políticas RLS. No usar `migrate dev --create-only`: puede escribir en
  una base sombra. Validar SQL real posteriormente en PostgreSQL desechable autorizado.
- Pruebas unitarias del backend con el runner incluido en Node y tsx; se conserva
  Vitest/Playwright del frontend. Supertest se difiere hasta implementar endpoints.

Detalle, límites y procedimiento: [Fase 2 preparación](../fase-2-preparacion.md).
