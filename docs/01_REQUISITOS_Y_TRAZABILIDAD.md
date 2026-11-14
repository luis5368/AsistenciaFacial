# Requisitos, alcance y trazabilidad al documento original

Los enunciados **ORIGEN** son los que aparecen en `propuesta_original.docx`. Los textos **PROPUESTA** son elaboración técnica para implementar el proyecto; requieren aceptación académica cuando cambien una especificación original.

Revisión de Fase 0: contrastado con el texto del cuerpo del DOCX, sin revisión visual. El responsable mantiene pendiente la aprobación académica del cambio de motor y métricas. Durante este prototipo se prohíbe biometría real de menores, aunque otros documentos describan un piloto futuro sujeto a autorización. Véase [conciliación documental](conciliacion-fase-0.md).

| Sección | ORIGEN: exigencia del DOCX | PROPUESTA: implementación | Evidencia verificable |
|---|---|---|---|
| 5.1 | PWA React; motor FaceUnlock; IndexedDB; Service Workers; API Node; PostgreSQL | Mantener capas, reemplazar FaceUnlock nativo por adaptador web de ONNX validado | Diagrama + pruebas de navegador |
| 5.2 | Estudiantes, Docentes, Asistencias, Embeddings_Faciales, Sesiones; stores `students_cache`, `attendance_queue`, `sync_metadata` | Añadir institución, matrículas, consentimiento, dispositivos, bitácora, claves UUID | Diagrama ER y migraciones |
| 5.3 | Enrolamiento 5–10 imágenes, escaneo de asistencia, dashboard | Tres pantallas con accesibilidad, calidad de imagen, resultado claro y modo manual | Prototipos y pruebas de flujo |
| 5.4 | FaceUnlock v0.9.5, detección MTCNN/RetinaFace, CNN, similitud coseno, “≥95 %” | Comparativa de motores, PoC en navegador, umbral experimental calibrado | Latencia, FMR, FNMR y matriz de ensayos |
| 5.5 | Cola IndexedDB, Service Worker, Background Sync, conflictos y pseudocódigo | Cola transaccional, UUID e idempotencia; reintentos con UI; Background Sync auxiliar | Ensayo con desconexión y reenvío |
| 5.6 | AES-256, HTTPS/TLS 1.3, Decreto 27-2003, habeas data, retención | AES-GCM y manejo de claves por diseño; consentimiento, revocación, permisos, borrado; revisión legal independiente | Controles de seguridad, evidencia de consentimiento y pruebas de revocación |
| 5.7 | PWA BYOD, requisitos de cámara/navegador, talleres de 2 h, Render/Vercel/PostgreSQL | Dispositivos registrados y probados, capacitación de 2 h, infraestructura local inicial, despliegue posterior sujeto a evaluación | Matriz de dispositivos y prueba piloto |

## Requisitos funcionales propuestos

- **RF-01:** el administrador mantiene instituciones, usuarios, grupos, matrículas y horarios.
- **RF-02:** el sistema registra una autorización biométrica revocable antes del enrolamiento.
- **RF-03:** el administrador enrola un estudiante con varias muestras válidas, sin persistir fotografías por defecto.
- **RF-04:** el docente puede obtener identidad sugerida por comparación local contra estudiantes asignados al grupo.
- **RF-05:** los resultados dudosos se rechazan o pasan a confirmación manual; nunca deben asignar identidad silenciosamente.
- **RF-06:** permite asistencia manual equivalente para estudiantes que no participen en biometría.
- **RF-07:** permite registrar asistencias sin conexión tras la preparación del dispositivo.
- **RF-08:** sincroniza sin duplicados, confirma por ID de evento y conserva errores revisables.
- **RF-09:** dashboard de asistencias y pendientes; deja trazabilidad de ajustes manuales.
- **RF-10:** bloqueo/revocación de dispositivo y eliminación de datos biométricos locales/centrales según política.

## Requisitos no funcionales propuestos

- **RNF-01 — Portabilidad:** probar como mínimo Android Chrome y escritorio Chrome/Edge; Safari/iOS queda condicionado a prueba real.
- **RNF-02 — Privacidad:** minimización de datos, autorización, cifrado, retención y alternativa no biométrica.
- **RNF-03 — Integridad:** ningún reintento de red puede duplicar el mismo evento; cambios deben auditarse.
- **RNF-04 — Disponibilidad local:** el dispositivo precargado debe permitir un turno de registro sin red, condicionado a espacio, permisos y sesión autorizada.
- **RNF-05 — Seguridad:** permisos por grupo/institución, validación server-side, protección de tokens y HTTPS para producción.
- **RNF-06 — Rendimiento:** objetivos cuantitativos se fijan después de la FASE 1 en teléfonos representativos; no inventar milisegundos garantizados.
- **RNF-07 — Calidad:** pruebas automatizadas para API/sincronización y registro reproducible de experimentos biométricos.

## Historias de usuario base

1. Como docente autorizado quiero ver mi grupo y registrar asistencias sin internet para no interrumpir clases.
2. Como administrador quiero obtener y revocar consentimiento antes de enrolar para respetar la autonomía de las familias.
3. Como docente quiero confirmar manualmente los resultados ambiguos para evitar atribuir asistencia a la persona incorrecta.
4. Como administrador quiero revisar registros sincronizados y corregidos para detectar conflictos o ediciones indebidas.

## Reglas del dominio propuestas

- Un evento de asistencia posee `event_uuid` inmutable, `student_id`, `session_id`, `occurred_at`, `device_id`, `created_by`, `method` y estado de sincronización local.
- La API hace idempotente `event_uuid`; una restricción adicional de asistencia activa por `(student_id, session_id)` evita duplicidad lógica, con flujo explícito para correcciones.
- La hora del dispositivo se considera declarativa, **no una prueba de tiempo confiable**; conservar hora del servidor al recibir y señales de reloj anómalo.
- Rechazar identidades no incluidas en la clase autorizada. No retener registros de estudiantes ajenos.
- Revocaciones de consentimiento y permisos requieren actualización cuando haya red; definir una caducidad offline razonable y documentar esa ventana de riesgo.
