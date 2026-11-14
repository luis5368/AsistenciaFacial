# Resultados de ejecución de Fase 1

## Conclusión

Laboratorio implementado y ejecución técnica de modelos comprobada en Chrome
de escritorio con entradas de control sin personas. **Aceptación biométrica
pendiente**: el usuario realizará el ensayo con adultos consentidos y Android.
No se declara completada la demostración de reconocimiento facial real.
No se reemplazaron modelos, ni se inició Fase 2.

## Entorno y dependencias exactas

Node `24.20.0`, npm `11.19.0`, Windows; navegador de ensayo
`HeadlessChrome/155.0.0.0`. Backend de inferencia: WASM, un hilo.

| Dependencia | Versión |
| --- | --- |
| React / React DOM | 19.3.1 |
| Vite | 8.3.4 |
| TypeScript | 7.0.2 |
| ONNX Runtime Web | 1.30.0 |
| Dexie | 4.4.6 |
| Tailwind / plugin Vite | 4.3.3 |
| vite-plugin-pwa | 2.0.0 |
| Vitest | 5.0.5 |
| Playwright Test | 1.64.1 |

Tipos de React/DOM y Node instalados como herramientas de desarrollo; versiones
completas en el lockfile. No se instaló Express, Prisma, PostgreSQL ni Supertest.
Los requisitos npm de Vite y Vitest admiten el Node instalado. La instalación,
compilación y ejecución verifican esta combinación; no se extrapola a otros OS.

## Modelos y recursos

YuNet 2023mar: 232589 bytes, licencia MIT. SFace 2021dec: 38696353 bytes,
licencia Apache-2.0. SHA-256 comprobados contra los punteros Git LFS oficiales;
valores exactos en `apps/frontend/public/models/manifest.json`. WASM y loader
copiados del paquete ORT instalado. Solo recursos públicos entran a Cache Storage.

## Comandos y resultados reales

| Comando / operación | Resultado |
| --- | --- |
| Lectura `Get-Content -Encoding UTF8`, inventario `rg`, `git status --short` | Documentos, contratos y criterios revisados antes de modificar código |
| Consultas `npm.cmd view` de versiones, engines y peers | Primera ejecución falló por EPERM en caché npm; repetida con permiso fuera del sandbox, exitosa |
| `npm.cmd install --workspace apps/frontend --save-exact react@19.3.1 react-dom@19.3.1 onnxruntime-web@1.30.0 dexie` | Instalación exitosa |
| `npm.cmd install --workspace apps/frontend --save-dev --save-exact vite@8.3.4 typescript@7.0.2 @types/react @types/react-dom vite-plugin-pwa@2.0.0 vitest@5.0.5 @playwright/test @tailwindcss/vite tailwindcss @types/node` | Instalación exitosa; 0 vulnerabilidades reportadas por npm en ese momento |
| `npm.cmd run assets` | Ambos hashes/tamaños correctos; dos archivos ORT copiados y licencias conservadas |
| `npm.cmd test` | 8 pruebas Vitest aprobadas: coseno, vectores inválidos, desconocido, ambigüedad, umbral, alineación y NMS |
| `npm.cmd run build` | Primer intento detectó incompatibilidad de tipos en salidas ONNX; corregida validando float32. Compilación posterior exitosa con PWA generada |
| Primera ejecución `npm.cmd run test:e2e` | Consentimiento/denegación pasó; carga falló por importación del loader WASM desde caché |
| `node scripts/diagnose-browser.mjs` con preview local | Reprodujo fallo; después de corregir caché confirmó carga de ambos modelos |
| `npm.cmd run build` y `$env:AF_EXTERNAL_SERVER='1'; npm.cmd run test:e2e` con preview local activo | 4 pruebas aprobadas, salida 0, 8.8 s |

La ruta automática de Playwright imprimió resultados pero quedó esperando al
cerrar su servidor hijo en este entorno Windows; se interrumpió con Ctrl+C.
La verificación final usó servidor separado, sin cambiar los modelos ni simular
salidas. Para reproducir ese modo: ejecutar preview en una terminal y, en otra,
asignar `AF_EXTERNAL_SERVER=1` antes de `npm.cmd run test:e2e`.

Advertencias observadas: `glob@11.1.0` obsoleto como dependencia transitiva;
postinstall de `protobufjs` no habilitado por npm (no fue necesario para estas
pruebas); SFace emite advertencias de inicializadores declarados como entradas,
que pueden limitar optimización. Se conservó el modelo original sin conversión.

El fallo de caché se corrigió guardando respuestas locales reconstruidas con
Content-Type y sin cabeceras de transporte `Vary`: fetch y la importación de
módulos no siempre envían las mismas cabeceras. La recarga offline lo comprueba.

## Evidencia del navegador

Cuatro recorridos pasaron:

1. Cámara deshabilitada sin consentimiento y error visible ante permiso denegado.
2. Carga de modelos reales; YuNet sobre cuadro gris sin personas; SFace sobre
   tensor gris produce 128 valores finitos; captura de cámara sintética; retiro
   de consentimiento; recarga sin red y repetición de inferencias. Cero solicitudes
   a otros orígenes y cero errores JavaScript no controlados en este recorrido.
3. Recursos ausentes offline: muestra error y no declara modelos cargados.
4. Viewport 390 × 844: sin desbordamiento horizontal. Esto no prueba Android real.

Capturas de escritorio y móvil inspeccionadas visualmente, sin imágenes personales.
Las capturas de QA permanecen en `apps/frontend/test-results/`, excluido de Git.

### Medición puntual reproducible

Registro completo en `fase-1-controles.json`, producido por la prueba, sin
imágenes, identificadores de personas ni vectores. Son ejecuciones individuales,
no promedios, p95 ni límites garantizados.

| Operación | Tiempo |
| --- | --- |
| Inicialización YuNet | 212.0 ms |
| Inicialización SFace | 191.5 ms |
| YuNet sobre control gris online | 197.9 ms |
| SFace sobre tensor gris online | 89.5 ms |
| YuNet sobre control gris después de recarga offline | 77.2 ms |
| SFace sobre tensor gris después de recarga offline | 86.3 ms |

Después del control offline: heap JS aproximado 59.65 MB; almacenamiento del
origen aproximado 55.05 MB. No incluye toda la memoria de inferencia. Comparación
entre perfiles reales aún no medida; el cero del control significa que no se
ejecutó comparación, no que sea instantánea.

## Criterios pendientes de aceptación

| Criterio | Estado y límite |
| --- | --- |
| Captura de cámara | API probada con cámara sintética y denegación; cámara física pendiente |
| Detección positiva de rostros | Implementada, sin prueba con adulto todavía |
| Embeddings de rostros y similitud | Inferencia SFace técnica probada y matemática de coseno probada; alineación/identidades reales pendientes |
| Personas desconocidas | Lógica de rechazo/ambigüedad probada con vectores de prueba, no con adultos desconocidos |
| Offline | Recarga y ambos modelos probados sin red con controles; cámara física y enrolamiento offline pendientes |
| Android, FMR/FNMR y liveness | No ensayados; no declarar viabilidad operativa ni resistencia a suplantación |

La próxima acción es revisar el laboratorio siguiendo `docs/fase-1.md`, no
iniciar Fase 2. Si la prueba de adultos falla, registrar el caso y el dispositivo
antes de proponer cambios; cualquier sustitución de modelo requiere autorización.

## Archivos entregados

- Frontend: entrada HTML, configuración TS/Vite/PWA/Playwright, UI React y estilos,
  motor ONNX, geometría/comparación, almacenamiento de métricas y pruebas unitarias.
- Recursos: icono, manifiesto de modelos y licencias; binarios locales ignorados.
- Herramientas: `scripts/prepare-assets.mjs`, `scripts/diagnose-browser.mjs`,
  pruebas en `tests/e2e/lab.spec.ts`, scripts npm y lockfile.
- Documentación: este informe, protocolo Fase 1, ADR 001; actualización de README,
  AGENTS, arquitectura, evaluación tecnológica, plan y README frontend.
- `.gitignore`: exclusión del runtime copiado; sin secretos añadidos.

Backend intacto. No se recopilaron datos biométricos humanos, se hicieron commits,
push, despliegues ni se inició la Fase 2.

Revisión final: `npm.cmd test` volvió a aprobar 8 pruebas; `npm.cmd run typecheck`
terminó con código 0. Se verificaron 20 enlaces locales Markdown y exclusiones
de modelos, WASM, resultados y `.env`. `git diff --check` no reportó errores,
con la limitación de que el repositorio aún tiene los archivos sin seguimiento.
Se detuvo con Ctrl+C el servidor de pruebas que había quedado pendiente de
cierre; no se deja un servicio publicado por esta tarea.
