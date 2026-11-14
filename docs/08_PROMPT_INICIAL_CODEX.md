# Prompt inicial para Codex — pegar en la extensión de VS Code

Copia el texto siguiente, incluyendo delimitadores opcionales si deseas:

---

Eres un arquitecto de software e ingeniero full-stack senior. Vamos a iniciar un proyecto académico de **asistencia escolar con reconocimiento facial y enfoque Offline-First para Guatemala**. Trabaja únicamente en la carpeta actual `AsistenciaFacial`.

**ANTES DE PROGRAMAR:** lee `AGENTS.md`, `README_INICIO.md`, `docs/00_LEER_PRIMERO.md`, `docs/01_REQUISITOS_Y_TRAZABILIDAD.md`, `docs/02_EVALUACION_TECNOLOGIAS.md`, `docs/03_ARQUITECTURA.md`, `docs/04_MODELO_DE_DATOS.md`, `docs/05_SEGURIDAD_Y_PRIVACIDAD.md`, `docs/06_PLAN_DE_PRUEBAS.md` y `docs/07_ROADMAP.md`. Revisa `docs/propuesta_original.docx` si puedes abrirlo; si no, trabaja desde la transcripción del documento original que se incluye en `docs/01_REQUISITOS_Y_TRAZABILIDAD.md`, e informa esa limitación.

**FASE ACTUAL: FASE 0 ÚNICAMENTE.**

Tareas:
1. Verifica la estructura disponible y explica cualquier contradicción relevante entre el DOCX y la documentación técnica.
2. Propón estructura `frontend/` y `backend/` con React/Vite/TypeScript y Node/Express/TypeScript; PostgreSQL/Prisma será la base central en la fase posterior. No reemplacés arbitrariamente el stack.
3. Prepara los archivos mínimos de arranque y documentación de ejecución. No implementes todavía reconocimiento facial ni enrolamiento real.
4. Si sugieres instalar dependencias, primero lista comandos/paquetes y justifica versiones y compatibilidad. No descargues modelos faciales sin aprobar la PoC.
5. Diseña interfaces y contratos mínimos de adaptadores `BiometricEngine`, `LocalAttendanceStore` y `SyncService` solo a nivel de documento o tipos sencillos, sin presumir que están validados.
6. Agrega `.gitignore` y `.env.example` sin secretos ni datos reales. No generes fotos ni embeddings reales de menores.
7. Si se ejecutan verificaciones, reporta exactamente cuáles pasaron o fallaron; no inventes resultados.
8. Resume archivos creados/modificados, riesgos abiertos, dependencias por validar y próxima fase sugerida.

**Restricciones:** no hagas commits, pushes, despliegues, borrados masivos, llamadas a servicios de pago ni recopiles biometría. No des por definitiva YuNet/SFace: requieren prueba real ONNX/WebAssembly y evaluación de precisión. No equipares umbral de similitud 0.95 con precisión del 95 %. Usa sincronización propia con UUID y API idempotente; Background Sync es opcional. Responde en español. Detente al terminar FASE 0 y solicita autorización antes de FASE 1.

---

## Tras ejecutar el prompt

1. Revisar qué creó Codex; no aceptar cambios de dependencia no justificados.
2. Entregar en esta conversación el resumen, árbol de archivos y cualquier error de terminal.
3. Diseñar entonces el encargo de la FASE 1 para probar cámara, YuNet/SFace y ONNX Runtime Web con dispositivos concretos.
