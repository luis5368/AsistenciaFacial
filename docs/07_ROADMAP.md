# Roadmap por fases y entregables

**Actualización 2026-11-13:** el responsable aceptó técnicamente el ensayo de Fase 2
en sandbox (52/52 pruebas) y autorizó preparar la migración a principal, sin ejecutarla.
Android y validaciones complementarias de Fase 1 permanecen abiertos; no se completa
todavía la API. Ver [plan y puerta de autorización](fase-2-plan-migracion-principal.md).

**Horizonte orientativo:** 8–11 semanas para prototipo académico bajo condiciones favorables, **no plazo contractual**. La FASE 1 puede obligar a reajustar arquitectura.

| Fase | Propósito | Entregables | Aprobación |
|---|---|---|---|
| **0** | Preparación | Estructura frontend/backend, README, entornos, `AGENTS.md`, decisiones, esquema API/DB borrador | Usuario revisa plan y cambios |
| **1** | Viabilidad biométrica | PoC con cámara, modelo ONNX, métricas WASM/Android, offline real, informe Go/No-Go | Motor aceptado o alternativa documentada |
| **2** | Núcleo de servidor | PostgreSQL/Prisma, API, roles, instituciones, matrículas, sesiones, tests | Endpoints funcionales con seeds ficticios |
| **3** | Flujo de asistencia | UI enrolamiento experimental, escaneo, confirmación/fallback manual, auditoría | Pruebas de flujos y privacidad |
| **4** | Offline-First | PWA, precache, Dexie, cola, UUID, reconciliación, conflictos, estados UI | Ensayos de desconexión/reintentos |
| **5** | Validación y piloto | Seguridad, revisión legal, prueba controlada aprobada, rendimiento, documentación Capítulo V | Criterios de aceptación, riesgos residuales |

## Alcance exacto para el primer encargo a Codex

- Leer los documentos adjuntos y señalar contradicciones o pendientes.
- Preparar estructura de monorepo simple (`frontend/`, `backend/`, `docs/`), scripts raíz solo si aportan valor, y configuración sin credenciales.
- Dejar plantillas mínimas compilables **solo si el usuario autoriza instalar paquetes**, y no implementar todavía módulos de biometría ni acceso a datos reales.
- Registrar versiones seleccionadas en un lockfile al instalar, no copiar números arbitrarios de Internet.
- Proponer un diagrama C4 preliminar y contratos para la fase posterior.
- Ejecutar pruebas realmente disponibles, informar bloqueos y no simular éxitos.
- No publicar ni desplegar.

## Revisión al cierre de cada fase

1. Resumen de decisiones y requisitos satisfechos.
2. Archivos modificados y comandos ejecutados.
3. Pruebas: nombre, resultado real, entorno y problemas.
4. Riesgos abiertos y cambios contra la propuesta original.
5. Encargo recomendado para la siguiente fase, pendiente de autorización.

## Evidencia académica a recopilar para 5.1–5.7

- 5.1: diagramas de arquitectura y flujos.
- 5.2: ERD, estructura de tablas, migraciones y consistencia local-central.
- 5.3: prototipos UI y evaluación de uso.
- 5.4: protocolo facial, comparación de modelos y resultados cuantitativos.
- 5.5: algoritmo, estados, offline/reconexión e idempotencia.
- 5.6: modelo de amenazas, consentimiento, políticas, controles y revisión legal.
- 5.7: especificación de hardware, despliegue controlado, capacitación de 2 h y costos reales.
