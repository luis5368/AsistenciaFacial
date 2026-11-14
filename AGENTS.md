# Instrucciones para Codex — Asistencia Facial Offline-First

## Contexto y precedencia
- Estado vigente: etapa 2 aceptada y etapa 3 administrativa autorizada exclusivamente de forma aislada. Ver `docs/evidencias/fase-3-etapa-3-administracion.md`. No montar administración contra PostgreSQL, aprovisionar bases/cuentas ni avanzar a etapa 4 sin nueva autorización. Las entradas de estado inferiores son históricas; autenticación real y navegador siguen pendientes.
- Proyecto académico: sistema de asistencia por reconocimiento facial con operación desconectada para colegios privados de Guatemala.
- Lee primero `docs/00_LEER_PRIMERO.md`, `docs/01_REQUISITOS_Y_TRAZABILIDAD.md`, `docs/02_EVALUACION_TECNOLOGIAS.md` y `docs/07_ROADMAP.md`.
- La fuente primaria del alcance original es `docs/propuesta_original.docx`. Las propuestas de mejora están marcadas como **decisión técnica propuesta** en los archivos Markdown. Ante contradicción no resuelvas silenciosamente: documenta la diferencia y pide decisión.
- No interpretes el archivo original como Capítulo V terminado: contiene instrucciones para redactarlo, no el capítulo completo.

## Tecnologías preferidas (sujetas a validación cuando corresponda)
- Frontend: React, Vite, TypeScript; UI Tailwind CSS (preferida, no obligatoria).
- PWA: vite-plugin-pwa/Workbox, precarga local controlada de activos y modelos.
- Persistencia local: IndexedDB mediante Dexie.js.
- Biometría: investigar ONNX Runtime Web y comparar YuNet + SFace; NO afirmar compatibilidad operativa o precisión sin prueba reproducible en navegador/dispositivo.
- Backend: Node.js, Express, TypeScript; PostgreSQL, Prisma (propuestas seleccionadas, revisar compatibilidad de versiones al instalarlas).
- Pruebas: Vitest, Supertest, Playwright; pruebas de dispositivos reales para biometría.

## Restricciones obligatorias
1. Durante todo este prototipo está prohibido usar imágenes/embeddings reales de menores, conforme a la restricción explícita del usuario. Datos ficticios para flujos; adultos voluntarios con consentimiento solo en un experimento aprobado. La carga de documentos no autoriza recolección biométrica.
2. No subir fotos, vectores biométricos, datos personales, secretos, credenciales, volúmenes de BD o archivos `.env` a Git.
3. No almacenar fotos faciales crudas por defecto. Minimizar los datos sensibles, con alternativa de asistencia manual.
4. No codificar una comparación de similitud 0.95 como «95 % de precisión»; los umbrales requieren calibración y métricas FMR/FNMR.
5. Background Sync debe ser opcional; la cola propia con UUID, idempotencia en API y reintentos es obligatoria.
6. Para PWA offline, verificar descarga previa de app/modelos, cámara, permisos, disponibilidad de espacio y funcionamiento real tras cortar la red.
7. Para datos biométricos, realizar un diseño de claves de cifrado revisable; no suponer que cifrar IndexedDB resuelve la seguridad frente a extracción de dispositivos o ejecución maliciosa.
8. Controlar acceso multiinstitución por servidor, con roles, auditoría, revocación y borrado sincronizado.
9. No hacer `git push`, despliegues, commits, borrados masivos ni instalar paquetes de forma sorpresiva sin autorización del usuario.
10. Realizar únicamente la fase solicitada. Antes de una nueva fase, informar archivos cambiados, pruebas ejecutadas y decisiones aún pendientes. Responder siempre en español.

## Convenciones y calidad
- Preferir código mantenible y tipado; separar dominio, infraestructura, UI y adaptadores de biometría/sincronización.
- Tests para reglas de negocio e idempotencia; validación de entradas y manejo de errores en API.
- `.env.example` sin credenciales y `.gitignore` adecuado.
- Anotar decisiones importantes en `docs/02_EVALUACION_TECNOLOGIAS.md` y en un registro de decisiones arquitectónicas cuando exista código.
- Si no se puede procesar el DOCX, usar los requisitos transcritos en `docs/01_REQUISITOS_Y_TRAZABILIDAD.md` e indicar la limitación, sin adivinar contenido.

## Estado de preparación
- API etapas 0/1 autorizadas: contratos y configuración, infraestructura HTTP y solo salud v1. Ver `docs/evidencias/fase-3-etapas-0-1.md`. Etapa 2/login NO autorizada todavía. Ninguna consulta o escritura de BD en estas pruebas; no iniciar API académica ni aprovisionar cuentas.
- Estado más reciente: ambas migraciones aplicadas en principal; permisos mínimos de app completados y CREATE temporal del migrador retirado. Validación final satisfactoria, 14 tablas de dominio vacías, status correcto y diff vacío. No repetir deploy ni tratar principal como estructura vacía. Consultar `docs/evidencias/migracion-principal-fase-2.md`; esperar revisión y autorización antes de iniciar API u operaciones de negocio. Las restricciones de principal de entradas históricas inferiores fueron superadas únicamente para la migración y permisos ya completados.
- La sandbox fue aceptada técnicamente por el responsable (52/52). Autorizado solo preparar el plan de migración a principal y diagnósticos de lectura: `docs/fase-2-plan-migracion-principal.md`. No ejecutar grants, migraciones, restauraciones ni crear la base de recuperación sin autorización nueva. Preservar la anomalía ficticia y los datos de sandbox.
- FASE 2: autorizados crear solo `asistencia_migrator` (LOGIN sin privilegios administrativos globales) y `asistencia_facial_sandbox` propiedad de ese migrador, configurar mínimos privilegios de app en sandbox y ejecutar allí el ensayo. Verificar destino y objetos preexistentes antes de crear; detenerse ante configuración inesperada. Contraseña por procedimiento local interactivo, nunca en respuestas/registros. Prohibido modificar `asistencia_facial` o crear otros roles/bases. No borrar la sandbox ni migrar la principal. Consultar `docs/evidencias/ensayo-postgresql-fase-2.md`.
- FASE 1 no concluida: Android físico y validaciones complementarias siguen pendientes. No alterar YuNet/SFace. La aprobación académica del cambio respecto al DOCX sigue pendiente.
- Estado Fase 2: correctiva adicional de integridad/episodios autorizada y aplicada solo en sandbox; SQL inicial intacto. Integridad bidireccional, máximo una transición por asistencia/transacción y episodios sin solapamiento; 52 pruebas reales satisfactorias. Ambas migraciones registradas mediante baseline Prisma verificado. No repetir creación/aplicación ni borrar sandbox. Una anomalía temporal ficticia heredada se conserva para revisión. Esperar autorización nueva para cualquier operación de escritura en principal. Véase la sección vigente del informe.
- Se conserva el monorepo existente en `apps/frontend` y `apps/backend`; no crear carpetas raíz duplicadas.
- Los contratos de asistencia/sincronización de `docs/contratos-fase-0.md` siguen siendo borradores; Fase 1 implementa solo el experimento biométrico. Consultar `docs/fase-1.md`.

<!-- postman-cli:installation:start -->
Postman CLI está instalado y puede utilizarse para trabajo de ingeniería de API.
<!-- postman-cli:installation:end -->

## Estado vigente: Fase 3, etapa 2
Autenticación local autorizada e implementada para revisión; consultar docs/evidencias/fase-3-etapa-2-autenticacion.md. No iniciar etapa 3 ni aprovisionar cuentas sin autorización. Los estados anteriores se conservan como historia; Fase 1 mantiene validaciones pendientes.
