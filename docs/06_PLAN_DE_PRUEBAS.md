# Plan de pruebas y validación experimental

## FASE 1 — Puerta de viabilidad biométrica (prioritaria)

**Objetivo:** comprobar en navegador real, en modo desconectado, que una imagen obtiene un embedding comparable en hardware representativo. La revisión documental por sí sola no valida esa ruta.

### Ambiente de prueba

- PC Windows (Chrome/Edge), teléfono Android de gama media (Chrome), iPhone/Safari como candidato condicionado.
- Servir por `localhost` o HTTPS para cámara. Si se prueba desde un celular contra IP de la laptop, normalmente se requiere HTTPS y autorización adecuada.
- Datos ficticios para flujos administrativos y muestras de **voluntarios adultos con consentimiento** si se necesita medir comparación de identidad.
- Registrar: navegador/versión, dispositivo/SoC, memoria estimada, cámara, iluminación, tamaño del modelo, latencia mediana y percentil 95, consumo aproximado de memoria, fallos y batería cuando sea medible.

### Experimentos

| ID | Qué ejecutar | Criterio de salida |
|---|---|---|
| POC-01 | Cámara y permisos | Captura visible y manejo de denegación sin caídas |
| POC-02 | Cargar YuNet `.onnx` con ORT Web | Modelo inicia sin errores en WASM; documentar salida y shape |
| POC-03 | Localizar rostro + landmarks | Cajas correctas en una pequeña colección controlada, con errores documentados |
| POC-04 | Alineación y SFace | Embeddings reproducibles; similares/diferentes separables bajo conjunto controlado |
| POC-05 | Sin red después de preparar PWA | Recargar/abrir y completar inferencia sin solicitudes remotas indispensables |
| POC-06 | Dispositivo Android real | Registro de latencia, memoria y temperatura percibida; identificar cuellos |
| POC-07 | Retrato impreso/video | Registrar vulnerabilidad; **no** afirmar liveness segura sin detector validado |
| POC-08 | Borrado/cache y espacio | Informar cuando falten modelos o IndexedDB, sin resultados falsos |

**Go/No-Go:** si ORT Web+modelos no funciona de manera consistente o tarda demasiado, documentar obstáculo y comparar alternativa (MediaPipe detección u otro reconocedor con licencia verificada), antes de programar el resto del sistema biométrico.

## Pruebas biométricas para fase piloto autorizado

- Construir un protocolo reproducible con pares de misma/diferente persona, condiciones de iluminación y poses.
- Medir **FMR** (false match rate), **FNMR** (false non-match rate) y distribución de similitud por umbral; separar resultados por dispositivo/escenario.
- Priorizar tasa de falso positivo baja; un umbral coseno `0.95` **no significa** “95 % de confianza” ni precisión.
- Documentar el tamaño de muestra, límites estadísticos y consentimiento. No reportar exactitud estadística sólida con una muestra demasiado reducida.
- Medir exactitud de identificación 1:N en el grupo, no solo verificación 1:1 entre dos fotos.

## Pruebas Offline-First y de API

| ID | Escenario | Resultado esperado |
|---|---|---|
| OFF-01 | Registrar 10 eventos sin internet | Los 10 quedan locales con UUID persistentes |
| OFF-02 | Cerrar/recargar app sin red | Registro continúa tras bootstrap previo (según navegador) |
| OFF-03 | Enviar evento y perder respuesta | Reenvío con mismo UUID no crea doble evento |
| OFF-04 | 2 docentes registran mismo estudiante/sesión | Conflicto controlado y auditado, no Last-Write-Wins silencioso |
| OFF-05 | App reconecta tras 48 h de ensayo | Sincroniza o marca revalidación según política; no pierde eventos |
| OFF-06 | Sesión vencida/dispositivo revocado | Bloquea operaciones no permitidas y conserva pendientes conforme política |
| OFF-07 | Almacenamiento lleno o borrado | Informa falla de persistencia; no indica asistencia confirmada |
| SEC-01 | Acceso cruzado entre instituciones | API responde denegación independientemente del frontend |
| SEC-02 | Revocación de consentimiento | No permite nuevo enrolamiento/comparación tras aplicar revocación |
| SEC-03 | Corrección manual | Guarda actor, motivo, cambio y sello temporal |

## Automatización

- Vitest: reglas, serialización de cola, reintentos, validación de estados.
- Supertest: endpoints, permisos, idempotencia, validación y error handling.
- Playwright: navegación, permisos simulables y estados online/offline; complementar con Android real para cámara/inferencia.
- Anotar comandos exactos, resultados y logs libres de datos sensibles en `docs/evidencias/` cuando exista esa carpeta.
