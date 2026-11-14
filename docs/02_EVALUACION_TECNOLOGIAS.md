# Evaluación comparativa de tecnologías y decisiones

Actualización API etapa 3: catálogos administrativos implementados y probados con dobles, sin dependencias nuevas ni acceso a PostgreSQL. ReadCommitted explícito, bloqueo institucional, auditoría transaccional y revocación posterior al COMMIT; [ADR 006](decisiones/ADR-006-administracion-aislada.md). Runtime administrativo deshabilitado; [evidencias y pendientes](evidencias/fase-3-etapa-3-administracion.md). Las notas inferiores conservan decisiones históricas.

Etapas 0/1 API: DTO con Zod y pruebas HTTP con Supertest, versiones exactas y
evaluación registradas en [ADR 004](decisiones/ADR-004-contratos-http-local.md)
y [evidencias](evidencias/fase-3-etapas-0-1.md). Sin integración biométrica ni auth activa.

Actualización 2026-11-13: preparación de Fase 2 autorizada con PostgreSQL 18.6
local, Node 24.20.0 y Prisma/client/adapter-pg 7.10.1. Esquema, cliente y SQL
preparados y posteriormente validados en sandbox con 52/52 pruebas y aceptación
técnica del responsable. Principal permanece vacía; solo se ha autorizado el
[plan de migración](fase-2-plan-migracion-principal.md), no su ejecución.
Ver [ADR 002](decisiones/ADR-002-prisma-local-preparacion.md) y
[verificaciones y avisos de dependencias](fase-2-preparacion.md).
Esta autorización no cierra Fase 1 ni resuelve su aprobación académica pendiente.

**Revisión documental:** 16-10-2026.  
**Importante:** “verificado documentalmente” significa que se consultaron páginas oficiales o repositorios; NO significa que se instaló y probó en un dispositivo del colegio.

## Matriz de selección

| Necesidad | Opciones | Decisión inicial | Estado y motivo |
|---|---|---|---|
| SPA/PWA | React/Vite, Next.js | **React + Vite + TypeScript** | Seleccionado: app cliente ligera, compatible con desarrollo PWA; verificar versiones LTS al instalar |
| UI | Tailwind CSS, CSS Modules | **Tailwind CSS** | Preferido: rapidez para tres interfaces; ajustable tras revisión UI |
| Estado local | IndexedDB directo, Dexie.js | **Dexie.js** | Seleccionado: API sobre IndexedDB, transacciones e índices; revisar almacenamiento en Safari |
| Caché PWA | Service Worker manual, Workbox | **vite-plugin-pwa + Workbox** | Seleccionado: precache y versiones; requiere prueba de cacheo de `.onnx`, `.wasm` y assets grandes |
| Motor de inferencia | ONNX Runtime Web, TensorFlow.js, WASM personalizado | **ONNX Runtime Web** | Candidato principal documentado; requiere PoC con modelos elegidos |
| Backend | Express, Fastify | **Express + TypeScript** | Seleccionado por simplicidad y stack académico |
| Datos centrales | PostgreSQL, MySQL | **PostgreSQL** | Conserva el requisito original; permite transacciones y restricciones |
| Migraciones ORM | Prisma, SQL manual | **Prisma** | Preferido, comprobar versión y compatibilidad con Node/PostgreSQL |
| Pruebas | Vitest, Supertest, Playwright | **Los tres por responsabilidad** | Vitest lógica, Supertest API, Playwright recorridos UI; biometría exige ensayos reales aparte |
| Hosting | Vercel, Render, proveedor institucional | **Posponer** | Primero Docker/PostgreSQL local; hosting se decide con requisitos de privacidad, backups y costos |

## Por qué NO usar OpenFaceUnlock v0.9.5 como librería React

- La propuesta original lo nombra como `harmanrodee/FaceUnlock v0.9.5`.
- El repositorio verificable se identifica como **OpenFaceUnlock — Native Face Login for Windows 10/11** y describe una utilidad en C++/C# integrada al inicio de sesión de Windows.
- No es una API JavaScript para navegadores ni resuelve la PWA. **Descartar como dependencia directa.** Puede servir solo como referencia técnica no vinculante.
- Fuente: https://github.com/harmanrodee/OpenFaceUnlock---Native-Face-Login-for-Windows-10-11

## Candidatos de biometría

| Componente | Alternativa A | Alternativa B | Evaluación preliminar |
|---|---|---|---|
| Detección de rostro | **YuNet (OpenCV Zoo)** | MediaPipe Face Detector | Probar YuNet por modelo ONNX y licencia MIT; MediaPipe como respaldo si integración o rendimiento falla |
| Embedding/identificación | **SFace (OpenCV Zoo)** | Otro modelo de reconocimiento con licencia verificable | SFace aporta modelo ONNX y licencia Apache-2.0 en su directorio; debe verificarse que ONNX Runtime Web soporte operadores/preprocesamiento |
| Ejecución | **WASM (CPU)** | WebGPU | WASM base por compatibilidad; WebGPU solo aceleración opcional si el dispositivo la soporta |
| Similitud | Coseno sobre vectores alineados | Distancia L2 | Evaluar distribución empírica, FMR/FNMR y umbral; no asumir 95 % de acierto |

**Advertencia de integración:** los ejemplos oficiales de YuNet/SFace muestran principalmente OpenCV en Python/C++; **no hay una implementación React/Web lista para este proyecto demostrada por las fuentes revisadas**. Implementar preprocesamiento, escala, normalización, landmarks, alineación, decodificación de tensores y postproceso es parte de la PoC. Un `.onnx` descargado no equivale a reconocimiento funcional.

**Licencias de candidatos:** YuNet licencia MIT (directorio del modelo), SFace licencia Apache 2.0 (directorio del modelo). Comprobar licencia exacta de los artefactos binarios que se utilicen y conservar avisos de terceros.

## Offline-First: estrategia seleccionada

- **Dexie + cola propia**: crear, reintentar y confirmar eventos de modo predecible y observable.
- **Workbox**: almacenar el *app shell*, código, estilos y modelos autorizados; medir cuotas y tamaño. No precachear indefinidamente datos biométricos confidenciales en Cache Storage.
- **Background Sync**: accesorio si existe soporte; NO único disparador. Sincronizar también al iniciar la app, volver al primer plano, pulsar botón y comprobar conectividad real mediante ping autenticado al servicio.
- La conectividad de `navigator.onLine` es solo un indicio; confirmar con API real.
- Cargar todos los recursos del motor antes de quitar internet, probar una recarga y registrar fallos de caché.

## Pendientes / puertas de decisión

Actualización del 8 de noviembre de 2026: se analizaron cuatro exportaciones
humanas acumulativas (67 posiciones consolidadas, 46 comparaciones ejecutadas).
Los bloques comunicados muestran separación de cosenos al umbral experimental
0.50, pero todas las filas carecen de escenario y revisión humana completados.
Se recomienda aceptación parcial experimental, no cierre de Fase 1. Véase el
[informe de validación biométrica](evidencias/informe-validacion-biometrica-fase-1.md).
Offline con servidor detenido y Android físico siguen pendientes.

- **DT-07: Evidencia de reconocimiento:** instrumentación v2 separa enrolamiento,
  comparación omitida/ejecutada, escenario declarado y revisión humana. No cambia
  modelos ni umbrales. Ensayos positivos/desconocidos con adultos pendientes;
  ver [protocolo y verificaciones](validacion-reconocimiento-fase-1.md).

- **DT-00: Aprobación académica:** la sustitución de FaceUnlock y del criterio «≥95 %» sigue pendiente. El usuario autorizó posteriormente la PoC de Fase 1, sus dependencias y modelos. Véanse [ADR 001](decisiones/ADR-001-laboratorio-biometrico.md) y [evidencias](evidencias/fase-1-resultados.md): ejecución WASM con controles sin personas no implica precisión facial validada.

- **DT-01: Compatibilidad YuNet+SFace+ORT Web:** pendiente ensayo real, incluidas salidas de red y consumo de memoria.
- **DT-02: Calidad biométrica:** pendiente cohorte voluntaria permitida, FMR/FNMR, sesgo y condiciones de iluminación.
- **DT-03: Antispoofing/liveness:** pendiente comparación y pruebas; no prometer resistencia a fotos o videos sin evaluación.
- **DT-04: Compatibilidad Android/iOS:** pendiente batería de dispositivos.
- **DT-05: Política de claves offline:** pendiente diseño revisable con amenaza de pérdida/robo del dispositivo.
- **DT-06: Servicios en nube:** pendiente análisis contractual, privacidad, respaldo, latencia y costos.

## Fuentes mínimas revisadas

La preparación PostgreSQL/Prisma y el ensayo correctivo autorizado se documentan
en [ADR 003: integridad y episodios](decisiones/ADR-003-integridad-episodios.md).
Prisma 7.10.1 y PostgreSQL 18.6 se comprobaron en sandbox con historial coherente;
esto no cambia el estado experimental de biometría ni autoriza migrar la principal.

- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
- Compatibilidad por navegador: https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- YuNet: https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
- SFace: https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface
- OpenFaceUnlock: https://github.com/harmanrodee/OpenFaceUnlock---Native-Face-Login-for-Windows-10-11
- Dexie API: https://dexie.org/docs/API-Reference
- Background Sync MDN: https://developer.mozilla.org/es/docs/Web/API/Background_Synchronization_API

**Conclusión:** la pila general sí está seleccionada para empezar. La combinación de modelos faciales es una **hipótesis técnica por validar** en la FASE 1, no una dependencia irrevocable.

## Autenticación local, etapa 2
Argon2id nativo Node 24.20.0, sin paquetes nuevos; véanse [ADR 005](decisiones/ADR-005-autenticacion-local.md) y [pruebas y límites](evidencias/fase-3-etapa-2-autenticacion.md).
