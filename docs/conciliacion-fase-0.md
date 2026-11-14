# Conciliación documental de Fase 0

## Fuentes y alcance de lectura

Se revisaron `AGENTS.md`, `README_INICIO.md`, los diez Markdown numerados
`00_LEER_PRIMERO.md` a `09_REFERENCIAS.md` y el cuerpo completo de
`propuesta_original.docx`. Se conservaron los documentos cargados como fuentes;
las aclaraciones siguientes no equivalen a aceptación académica de cambios.

El DOCX se abrió como paquete ZIP en modo lectura y se extrajeron los párrafos
de `word/document.xml`, concatenando sus fragmentos de texto en orden. Contiene
las instrucciones de redacción del Capítulo 5, con secciones 5.1 a 5.7. El
inventario no contiene imágenes, comentarios, notas al pie ni encabezados
externos; el cuerpo tiene cero tablas y cero elementos `w:drawing`.
No se renderizó: no se verifican paginación, tipografía ni disposición visual.
No se modificó el DOCX ni se generó un Capítulo V nuevo.

Las referencias web del paquete no se volvieron a comprobar en esta revisión
local. Sus afirmaciones de revisión documental pertenecen al material recibido,
no a experimentos realizados por este agente. Antes de instalar o decidir sobre
licencias, compatibilidad o normas vigentes deberá verificarse la fuente oficial.

## Diferencias y decisiones

| Tema | Fuente original o documento cargado | Tratamiento de Fase 0 |
| --- | --- | --- |
| Motor facial | DOCX: FaceUnlock v0.9.5, MTCNN/RetinaFace; solicitud del usuario: evaluar ONNX Runtime Web, YuNet/SFace | Mantener el stack solicitado como investigación; registrar sustitución académica pendiente, sin afirmar compatibilidad ni validar el descarte por experimento |
| Umbral | DOCX: «≥95 %» | La similitud no equivale a precisión; definir protocolo, FMR/FNMR e identificación 1:N cuando aplique; cambio de especificación académica pendiente |
| Orden de trabajo | Plan previo: base técnica/manual antes de biometría; paquete nuevo: PoC biométrica en Fase 1 | El usuario eligió expresamente el roadmap cargado; plan actualizado sin iniciar la siguiente fase |
| Conflictos | DOCX ejemplifica Last-Write-Wins o timestamps; paquete propone idempotencia y revisión | Mantener propuesta de UUID y unicidad transaccional; documentar resolución auditada, sin presumir aprobado el cambio académico |
| Background Sync | DOCX asigna sincronización a Service Workers/Background Sync | Propuesta: cola propia y varios disparadores; Background Sync opcional, sujeto a pruebas |
| Datos de menores | Algunos documentos permiten excepciones mediante autorización | Prevalece la prohibición explícita del usuario durante este prototipo; un piloto futuro no queda autorizado por estos documentos |
| Cifrado y legalidad | DOCX pide AES-256, TLS 1.3 y cumplimiento legal | Son requisitos por diseñar y revisar; ninguna certificación de cumplimiento ni custodia de claves implementada |
| BYOD y hosting | DOCX propone dispositivos docentes y Render/Vercel | Evaluación de dispositivos autorizados y proveedor diferida; no desplegar |
| Carpetas | Paquete sugiere `frontend/` y `backend/`; ya existen `apps/frontend/` y `apps/backend/` | Conservar ubicación existente y workspaces privados, sin duplicar estructura |
| Unicidad de asistencia | Plan previo incluye tipo de marcación; paquete plantea estudiante/sesión | Contrato borrador adopta una asistencia activa por estudiante/sesión dentro de institución; entradas/salidas múltiples requieren decisión explícita antes del esquema definitivo |

## Trazabilidad y aceptación de preparación

- 5.1: `arquitectura.md` y `03_ARQUITECTURA.md`, seis capas y fronteras.
- 5.2: `04_MODELO_DE_DATOS.md` y `contratos-fase-0.md`, entidades, stores y mapeo.
- 5.3: `01_REQUISITOS_Y_TRAZABILIDAD.md`, tres pantallas requeridas, aún sin UI.
- 5.4: `02_EVALUACION_TECNOLOGIAS.md` y `06_PLAN_DE_PRUEBAS.md`, hipótesis y ensayos pendientes.
- 5.5: `contratos-fase-0.md`, estados, ACK y errores propuestos.
- 5.6: `05_SEGURIDAD_Y_PRIVACIDAD.md`, controles propuestos bajo la restricción de no usar menores.
- 5.7: `07_ROADMAP.md`, evaluación y capacitación futura; hosting sin decidir.

Fase 0 entrega documentos y estructura. No demuestra capacidad offline,
precisión, seguridad, compatibilidad de modelos ni funcionamiento de API/BD.

## Preguntas pendientes al responsable

1. Autorizar por separado el inicio de Fase 1; la secuencia del roadmap cargado ya fue elegida.
2. Obtener aprobación académica de la sustitución de motor y métricas: el usuario confirmó que sigue pendiente.
3. Antes de la PoC: identificar Android real disponible, consentimiento adulto
   si se necesitara, datos permitidos y presupuestos de evaluación.
