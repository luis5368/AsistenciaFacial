# ADR 003 — Correcciones coherentes y episodios de matrícula

Estado: autorizado y comprobado exclusivamente en sandbox, 13 de noviembre de
2026. No autoriza migrar la principal. Evidencia y comandos en el
[informe del ensayo](../evidencias/ensayo-postgresql-fase-2.md).

## Problema

El diseño inicial permitía insertar una corrección sin actualizar la asistencia
y bloqueaba una reinscripción del mismo estudiante en el mismo grupo. Se conserva
la migración original; la solución se entrega en una migración adicional.

## Decisión

Los triggers diferidos comprueban asistencia, corrección y auditoría en ambos
sentidos, con estados y versiones coincidentes en la misma transacción. PostgreSQL
asigna el identificador de transacción. Se permite como máximo una transición
por asistencia y transacción; el historial y el contenido original son inmutables.

Cada matrícula es un episodio con intervalo semiabierto `[inicio, fin)`. Para
institución/estudiante/grupo no se admiten solapamientos. Un trigger serializa
las escrituras sobre el estudiante padre, sin instalar extensiones. La asistencia
referencia explícitamente su episodio mediante FK compuesta institucional; las
nuevas inserciones deben ocurrir dentro de su período. Los límites del episodio
no pueden cambiar para excluir asistencias existentes.

El evento manual v1 no cambia: el backend resolverá el episodio por fecha y
contexto autenticado dentro de la transacción. No se implementa todavía esa API.
Las correcciones preservan su episodio; no reasignan históricos al episodio vigente.

## Consecuencias y validación

52 pruebas de integración satisfactorias, incluyendo concurrencia, RLS,
idempotencia, rollback y correcciones aisladas. Los conflictos de serialización
`40001` exigen reintento completo; los solapamientos `23P01` son conflictos de
dominio. La serialización por estudiante necesita evaluación de carga futura.

Se conserva una anomalía temporal ficticia del ensayo previo, identificada en el
informe. No se saneó silenciosamente ni se atribuye a una nueva escritura aceptada.
Para datos preexistentes se requiere prevalidación y una remediación aprobada.

La correspondencia de SQL versionado y esquema físico se verificó por replay
transaccional desde vacío dentro de sandbox; luego se registraron ambas migraciones
mediante Prisma resolve. El diff de Prisma es vacío; las funciones, políticas y
triggers se verifican además por catálogo, pues el diff del ORM no basta para ellos.
No se debe editar el SQL ya aplicado ni usar reset/db push para revertirlo.
