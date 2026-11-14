# ADR 006 — módulos administrativos aislados

Estado: implementado con dobles, pendiente de revisión y activación.

Se agrupan catálogos en un servicio con puertos tipados, políticas y proyecciones explícitas. Prisma opera solo dentro de withInstitution. Las operaciones administrativas adquieren bloqueo institucional y vuelven a verificar al actor; ReadCommitted explícito permite que el conteo de ADMIN después de esperar el bloqueo observe el cambio previo. ETag se verifica bajo el mismo bloqueo. La auditoría se confirma junto con la escritura y la revocación de sesiones ocurre después del COMMIT.

Se agrega lectura individual de asignación para obtener ETag. Teacher no tiene active: vigencia derivada de usuario/asignación. Consulta de estudiantes usa episodios existentes sin implementar el módulo de matrícula. Cursores firmados por proceso, ligados a institución/actor/recurso. No hay DELETE, reset administrativo de contraseña ni creación HTTP de institución.

El runtime no monta el router administrativo ni construye su adaptador Prisma. El ensayo HTTPS usa dobles y las migraciones no cambian. Bloqueos reales, RLS, permisos, navegador y fallos PostgreSQL exigen el [plan separado](../fase-3-plan-validacion-real.md). No se afirma que los dobles prueben esas garantías físicas.

Consecuencias: serialización amplia reduce concurrencia; ETag no detecta A→B→A; auditoría de asignación no representa su clave compuesta completa; cursores/sesiones se pierden al reiniciar. Los escritores externos que no sigan el bloqueo pueden romper la regla del último administrador; no se añadió restricción de BD. Ver [resultados](../evidencias/fase-3-etapa-3-administracion.md).
