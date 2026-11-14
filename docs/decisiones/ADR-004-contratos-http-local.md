# ADR 004 — contratos e infraestructura HTTP local

Estado: etapas 0/1 autorizadas e implementadas para revisión.

Mantener la fábrica Express sin conexión automática a BD, con una única ruta
de salud v1. Generar OpenAPI desde DTO Zod estrictos y marcar explícitamente
operaciones futuras como no implementadas; no montar rutas ficticias de login.

Separar `.env.application` del entorno privado de CLI Prisma. Validar institución
y calendario sin defaults de identidad; no consultar existencia institucional
hasta la etapa autorizada de servicios de datos. Bind exclusivo 127.0.0.1.

Usar Supertest y dobles transaccionales para HTTP/contratos; no utilizar las bases
existentes como fixtures. Preservar contrato manual y hashes v1. Zod/Supertest
se fijan a versiones exactas tras revisión de metadatos y audit aislado.

Los logs se limitan a requestId/status/duración. Errores HTTP no reflejan mensajes
de librerías ni cuerpos. ETag/paginación son contratos preparados, no concurrencia
de negocio implementada. Detalles, evidencia y límites en
[informe de etapas 0/1](../evidencias/fase-3-etapas-0-1.md).
