# Fase 1 Laboratorio de viabilidad

## Alcance y estado

Evidencia posterior: el [informe del 8 de noviembre de 2026](evidencias/informe-validacion-biometrica-fase-1.md)
analiza ensayos aportados por el usuario y propone aceptación técnica parcial,
con protocolos pendientes de offline verificable y Android. Las afirmaciones
de ausencia de ensayos humanos de las secciones iniciales describen el estado
histórico de la implementación, no este nuevo análisis.

Actualización de instrumentación: usar el [protocolo de reconocimiento y JSON v2](validacion-reconocimiento-fase-1.md).
El cero histórico de comparación era ambiguo. Ahora se registran operación,
estado de comparación, número de perfiles, coseno, umbral por intento, escenario,
revisión humana y condiciones de red. La aceptación de Fase 1 continúa pendiente.

El usuario autorizó explícitamente esta fase y la prueba local de YuNet/SFace.
Esa autorización sustituye las menciones históricas a «Fase 1 no autorizada»
de Fase 0; no autoriza Fase 2 ni cambios académicos definitivos. La sustitución
de FaceUnlock y del criterio «≥95 %» continúa pendiente de aprobación académica.

Se implementa un laboratorio, no un sistema de asistencia. El usuario realizará
la prueba con un adulto voluntario y Android al revisar. Hasta entonces no se
declaran validados cámara física, detección positiva, comparación de identidades,
rechazo de personas desconocidas ni rendimiento en Android.

## Ejecución reproducible

Desde la raíz, con Node 24 y npm:

```powershell
npm.cmd ci
npm.cmd run assets
npm.cmd run build
npm.cmd run preview
```

Abrir `http://127.0.0.1:4173`. Pulsar «Preparar y cargar modelos». La preparación
necesita internet para instalación/descarga inicial. El script de assets verifica
SHA-256 y copia el runtime de la versión instalada; los binarios se excluyen de
Git. `npm.cmd run dev` sirve para desarrollo en 5173, no valida la PWA offline.

Para pruebas automatizadas:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run test:e2e
```

E2E utiliza Chrome instalado, servidor preview local y una cámara sintética de
Chromium sin personas. No descarga otro navegador. Primero compilar. Las pruebas
no usan fotos ni perfiles reales y no simulan salidas de los modelos.

Si Playwright queda esperando al cerrar el servidor hijo en Windows, detenerlo
con Ctrl+C. Ejecutar `npm.cmd run preview` en una terminal y en otra:

```powershell
$env:AF_EXTERNAL_SERVER='1'
npm.cmd run test:e2e
```

Este fue el modo de ejecución final verificado. Detener preview al terminar.

## Protocolo de revisión con voluntarios adultos

1. Confirmar mayoría de edad y consentimiento de cada participante; evitar
   terceros en el encuadre. No escribir nombres ni capturar pantallas con rostros.
2. Preparar recursos y recargar hasta ver «PWA controla esta página». Registrar
   sistema, navegador, dispositivo, cámara, iluminación y contexto del ensayo.
3. Activar cámara; registrar adulto A con un fotograma frontal y después comparar
   capturas nuevas, variando moderadamente pose y luz. No usar la misma captura
   de enrolamiento como única evidencia de reconocimiento.
4. Sin registrar a B, comparar un adulto B consentido: anotar candidatos erróneos
   y rechazos. Si solo hay un adulto no se valida el caso desconocido entre personas.
5. Probar cuadro sin rostro y con varios adultos consentidos; no debe enrolar.
6. Desconectar red y repetir. Recargar offline, cargar modelos de caché y registrar
   de nuevo (los perfiles se borran al recargar). Probar cámara e inferencia.
7. Retirar consentimiento: comprobar cámara detenida y contador en cero.
8. Exportar mediciones técnicas, sin imágenes/embeddings. No publicar reportes
   que vinculen horarios o resultados con identidad. Borrar mediciones al terminar.

Android requiere un origen seguro accesible desde el teléfono. `localhost` en
el teléfono no es la computadora. Una IP LAN con HTTP no basta para la cámara:
usar HTTPS local con certificado confiable o reenvío USB de puerto de desarrollo
configurado por el responsable. Esta entrega no despliega servicios ni configura
certificados o dispositivos personales. Safari/iOS queda pendiente de prueba.

## Métricas e interpretación

- Carga: inicialización de cada sesión ONNX, incluyendo acceso local al archivo;
  la descarga/preparación es una operación separada y no está incluida.
- Detección: preproceso, inferencia YuNet y postproceso.
- Embedding: conversión RGB e inferencia SFace; alineación previa no incluida.
- Comparación: similitud y selección entre perfiles temporales.
- Recursos: heap JS si el navegador lo expone; almacenamiento aproximado del
  origen. No equivalen a RAM total, memoria WASM/GPU, CPU o consumo energético.

Hacer al menos 20 repeticiones por escenario y separar primera ejecución y
ejecuciones calientes. Mediana y p95 deben calcularse sobre un conjunto declarado,
no sobre una sola medición. Los presupuestos de latencia y tasas FMR/FNMR siguen
pendientes: esta fase puede demostrar ejecución, no viabilidad operativa completa.

## Decisiones y riesgos

Consultar [ADR 001](decisiones/ADR-001-laboratorio-biometrico.md). Persistencia
biométrica deshabilitada hasta diseñar claves y amenazas. Caché puede perderse;
no se promete disponibilidad permanente. Falta de modelo, permisos o espacio
debe mostrar error. No hay liveness, precisión validada ni resistencia a fotos.
Las muestras de esta PoC no constituyen validación de menores o población escolar.

El informe de ejecución y resultados está en
[evidencias de Fase 1](evidencias/fase-1-resultados.md).
