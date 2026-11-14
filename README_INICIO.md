# Documentación inicial para Codex — Asistencia Facial Offline-First

**Fecha de revisión técnica:** 16 de octubre de 2026  
**Tipo de entrega:** documentación de decisiones y planificación, NO código funcional.

## Cómo usar este paquete

1. Extraer el ZIP dentro de `C:\Projects\AsistenciaFacial\` para que queden `AGENTS.md` y `docs/` en la **raíz del proyecto**.
2. Verificar que exista `C:\Projects\AsistenciaFacial\docs\00_LEER_PRIMERO.md` (evitar la ruta incorrecta `docs\docs\`).
3. Abrir la **carpeta raíz** `AsistenciaFacial` en VS Code y abrir el panel de Codex.
4. Pedir a Codex que lea `AGENTS.md`, `docs/00_LEER_PRIMERO.md` y `docs/08_PROMPT_INICIAL_CODEX.md` antes de crear código.
5. Solicitar únicamente la FASE 0. Revisar el plan antes de autorizar la prueba técnica (fase 1).

## Archivos

- `docs/propuesta_original.docx`: documento suministrado por el usuario, copiado **sin alteraciones**.
- `docs/00_LEER_PRIMERO.md`: contexto, alcance y decisiones vigentes.
- `docs/01_REQUISITOS_Y_TRAZABILIDAD.md`: necesidades originales y propuesta ampliada, claramente diferenciadas.
- `docs/02_EVALUACION_TECNOLOGIAS.md`: comparativa y estado real de validación.
- `docs/03_ARQUITECTURA.md`: capas, límites y diseño offline-first.
- `docs/04_MODELO_DE_DATOS.md`: propuesta preliminar SQL/IndexedDB.
- `docs/05_SEGURIDAD_Y_PRIVACIDAD.md`: protección de biometría y menores.
- `docs/06_PLAN_DE_PRUEBAS.md`: experimentos, métricas y criterios de aceptación.
- `docs/07_ROADMAP.md`: fases y entregables.
- `docs/08_PROMPT_INICIAL_CODEX.md`: encargo listo para pegar.
- `docs/09_REFERENCIAS.md`: fuentes revisadas y enlaces.
- `AGENTS.md`: instrucciones de proyecto para Codex.

**No contiene** un prototipo facial validado, modelos ONNX descargados ni afirmaciones de cumplimiento jurídico. Esas tareas quedan pendientes para las siguientes fases.
