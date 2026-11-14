# ADR 001 Laboratorio biométrico local

Estado: implementación experimental autorizada por el usuario; aceptación
biométrica y aprobación académica del cambio respecto al DOCX pendientes.

## Decisión

Conservar React/Vite/TypeScript y ONNX Runtime Web con backend WASM de un hilo.
No se reemplazan YuNet ni SFace. Usar YuNet `2023mar` (entrada fija 640 × 640)
y SFace `2021dec` (entrada 112 × 112) con hashes del repositorio OpenCV Zoo.
El export dinámico YuNet `2026may` aparece en la documentación oficial; no es
necesario para esta PoC de tamaño fijo. No se modifican los binarios descargados.

Preprocesamiento: RGB de canvas a BGR CHW sin normalización externa para YuNet;
redimensionar preservando proporción y rellenar con negro a derecha/abajo.
Decodificar salidas cls/obj/bbox/kps por strides 8, 16 y 32 y aplicar NMS.
SFace recibe RGB CHW tras alinear cinco landmarks por mínimos cuadrados con
transformación de similitud sin reflexión. La normalización del modelo se
conserva interna, según la ruta de referencia de OpenCV. No se identifica con
múltiples caras ni con vectores inválidos.

La implementación geométrica propia requiere contraste con rostros autorizados;
las pruebas algebraicas no prueban equivalencia de interpolación con OpenCV.

## Privacidad y persistencia

Perfiles de adultos solo en memoria de la pestaña, identificados por ordinales,
sin nombres. No se guardan fotos ni embeddings en IndexedDB, Cache Storage,
localStorage, exportaciones o servidor. Retirar consentimiento borra perfiles y
detiene cámara. Recargar pierde los perfiles deliberadamente. El borrado de
arrays reduce exposición pero no promete borrado forense de memoria administrada.

Dexie conserva únicamente las últimas 100 mediciones técnicas; caché persistente
guarda modelos públicos y runtime. Preparación explícita, hashes de modelos y
Service Worker Workbox para arranque offline. No hay backend biométrico.

## Alcance de reconocimiento

Identificación experimental 1:N, máximo diez perfiles, una muestra por perfil.
Umbral inicial 0.50 y margen de ambigüedad 0.05 son parámetros exploratorios,
no valores calibrados ni porcentajes. Salida: candidato, desconocido, ambiguo
o sin rostro. El candidato requiere revisión humana; no registra asistencia.
El enrolamiento académico de 5–10 imágenes queda fuera de este experimento.

La captura se procesa por botón, sin vigilancia continua. El hilo único puede
bloquear brevemente la UI: medir en Android antes de evaluar worker/aceleración.
No se implementa prueba de vida. La alternativa manual explica el procedimiento
externo porque el dominio de asistencia aún no existe.

## Fuentes primarias consultadas

- [ORT Web y ejecución WASM](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
- [Distribución del runtime](https://onnxruntime.ai/docs/tutorials/web/deploy.html)
- [YuNet y tamaños de entrada](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet)
- [SFace](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface)
- [Postproceso YuNet en OpenCV](https://github.com/opencv/opencv/blob/4.x/modules/objdetect/src/face_detect.cpp)
- [Alineación y preproceso SFace en OpenCV](https://github.com/opencv/opencv/blob/4.x/modules/objdetect/src/face_recognize.cpp)
- [Requisitos de Node para Vite](https://vite.dev/guide/)

Se preservan las licencias MIT de YuNet y Apache-2.0 de SFace en
`apps/frontend/public/licenses/`. Los hashes y tamaños están en
`apps/frontend/public/models/manifest.json`. Compatibilidad documental no implica
precisión, consentimiento para datos de entrenamiento ni validación de población.
