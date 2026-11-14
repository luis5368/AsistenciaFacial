# Instrumentación y validación de reconocimiento de Fase 1

Estado: instrumentación corregida; **Fase 1 no aprobada**. No se realizaron
ensayos humanos en esta revisión. YuNet, SFace y ONNX Runtime Web no cambiaron.

## Diagnóstico de comparisonMs igual a cero

El usuario incorporó `Puebas/mediciones-fase-1.json` durante esta revisión.
Se leyó sin modificarlo. Contiene dos cargas y dos filas `inference`, ambas con
`faces=1` y `comparisonMs=0`:

| Fila de inferencia | Detección | Embedding | Suma |
| --- | --- | --- | --- |
| Primera | 88.0 ms | 59.9 ms | 147.9 ms |
| Segunda | 66.5 ms | 60.0 ms | 126.5 ms |

Promedio de detección más embedding: **137.2 ms**, confirmado mediante Node.
El archivo indica el modelo esperado y umbral global 0.5. En la implementación
anterior ese umbral era el valor de UI al exportar, no evidencia de su aplicación
en cada intento. No se reproducen timestamps, IDs ni información del dispositivo.

El código anterior inicializaba `comparisonMs = 0` en todos los ensayos:

- Enrolamiento: generaba un embedding y guardaba el perfil en memoria, sin comparar.
- Control sin personas: ejecutaba controles YuNet/SFace, sin comparar perfiles.
- Sin rostro o con varios: no se llegaba a comparar.
- Reconocimiento: llamaba `choose(embedding, profiles, threshold)`, que calcula
  realmente coseno para cada perfil. Con cero perfiles solo seleccionaba sobre
  una lista vacía; no había comparaciones de vectores.
- Con perfiles, la diferencia de `performance.now()` podía ser cero por la
  resolución del reloj. No se introduce un mínimo artificial para ocultarlo.

La exportación anterior no conservaba operación, número de perfiles, similitud
ni decisión. Por tanto, **cero no permite distinguir esas causas**. Inferencia
o tiempo de embedding por sí solos tampoco prueban reconocimiento.

En este archivo concreto, `kind=inference`, `faces=1` y `embeddingMs>0`
descartan los caminos de control gris y ausencia/multiplicidad de rostros del
código revisado. Quedan como posibilidades enrolamiento, falta de perfiles o
comparación bajo resolución del reloj. Dos cargas son compatibles con reinicios
que vacían perfiles, pero no lo demuestran. No es posible adjudicar una causa
única retroactivamente ni afirmar reconocimiento positivo con esas filas.

## Flujo corregido

«Detectar y comparar» captura un fotograma nuevo, ejecuta el motor existente y,
solo con un embedding válido, llama `compareMeasured`. Esta función llama el
mismo `choose`/`cosine` contra los perfiles temporales; no fabrica puntuaciones.
Si no hay perfiles, informa `no_profiles`, sin presentarlo como desconocido.
El resultado se guarda junto con su umbral, no con el valor del control de UI
en el momento posterior de exportar. El escenario no modifica la decisión.

El candidato se muestra únicamente en pantalla con su ordinal temporal. No se
exporta ese ordinal ni un identificador estable. El operador puede revisar la
última comparación guardada antes de ejecutar otra operación. Su evaluación
se conserva aparte del resultado automático; no equivale a validación estadística.

## Contrato JSON v2

| Campo por medición | Significado |
| --- | --- |
| `operation` | `load`, `enrollment`, `recognition`, `control`; históricos: `legacy_unspecified` |
| `scenario` | Declaración previa: `known_person`, `unknown_person` o `unspecified`; no es verdad inferida por el motor |
| `outcome` | `enrolled`, `candidate`, `unknown`, `ambiguous`, `no_face`, `multiple_faces`, `no_profiles`, `profile_limit`, `error`, `loaded` o `control` |
| `comparisonStatus` | `executed` o motivo por el que no se comparó; históricos: `legacy_unknown` |
| `candidateCount` | Número de perfiles disponibles al iniciar el ensayo, no número de coincidencias aceptadas |
| `comparedCount` | Cantidad de perfiles cuyos vectores se compararon; cero cuando se omitió la comparación |
| `comparisonMs` | Duración del coseno y selección; `null` si no aplica o no es reconstruible; cero permitido solo como duración medida |
| `bestCosine` | Mejor puntuación, incluso si se rechaza por umbral; `null` si no se comparó |
| `thresholdApplied`, `ambiguityMargin` | Parámetros realmente utilizados; `null` cuando no se aplicaron |
| `humanReview` | `not_reviewed`, `correct_candidate`, `incorrect_candidate`, `correct_rejection`, `incorrect_rejection`, `inconclusive` |
| `offlineTestDeclared` | Operador declara que desconectó la red; se puede combinar con enrolamiento o reconocimiento |
| `browserOnlineAtStart`, `browserOnlineAtEnd` | Indicio de `navigator.onLine` al inicio/fin; no prueba ausencia de red |
| `serviceWorkerControlled` | Si el Service Worker controlaba la página |

Se mantienen duraciones de detección/embedding/carga y estimaciones de recursos.
La carga no contiene comparación y se exporta con duración de comparación nula.
Las filas conservan orden pero no marcas de tiempo absolutas ni IDs exportados.

Una exportación v2 proyecta únicamente campos técnicos permitidos: excluye
fotografías, embeddings, nombres, IDs de perfil, texto libre, ID interno Dexie,
timestamps exactos, user-agent y huella de hardware. Las nuevas filas guardadas
también usan esta proyección. Las filas antiguas no se destruyen: su exportación
conserva duraciones de inferencia, pero marca la comparación como desconocida
en lugar de inventar evidencia. «Borrar mediciones» elimina el historial local.

Conservar solo las últimas 100 filas sigue siendo el límite. Exportar por bloque
antes de superarlo; las revisiones actualizan su fila sin crear otra. Estos datos
siguen siendo resultados de un experimento: no vincularlos externamente a personas.

## Protocolo humano reproducible

1. Obtener consentimiento de al menos dos adultos; ningún menor ni tercero en
   cámara. Gestionar el consentimiento fuera del reporte técnico y no incluir
   nombres, fotografías ni documentos personales. A y B son roles del ensayo,
   no etiquetas para exportar.
2. Compilar con `npm.cmd run build` y servir con `npm.cmd run preview`. Cerrar
   pestañas antiguas para activar la nueva versión de la PWA; reabrir y comprobar
   que la exportación indica `schemaVersion: 2`. Preparar modelos con conexión.
3. Exportar el historial anterior si se desea conservarlo y borrar mediciones.
   Retirar consentimiento para limpiar perfiles, y renovarlo con el adulto
   participante. No cerrar la pestaña durante el bloque salvo la prueba de recarga.
4. Enrolar A mediante «Registrar adulto». Verificar `operation=enrollment`,
   `outcome=enrolled`, `comparisonMs=null` y `comparedCount=0`. Enrolar no prueba
   reconocimiento positivo. No enrolar B todavía.
5. Elegir «Persona previamente enrolada». Mantener umbral 0.50 y margen 0.05
   durante el bloque (exploratorios, sin calibración). Con A delante de la cámara,
   pulsar «Detectar y comparar» para obtener una captura distinta del enrolamiento.
   Verificar `comparisonStatus=executed`, `comparedCount>=1`, coseno y umbral.
   Revisar en la pantalla si el candidato es el correcto y seleccionar la revisión
   humana correspondiente **antes del siguiente intento**. Si se rechaza, registrar
   el rechazo incorrecto o resultado inconcluso; no ocultar fallos.
6. Elegir «Persona no enrolada (desconocido)». Con B consentido en cámara y sin
   enrolarlo, repetir. Un `outcome=unknown` con `correct_rejection` registra un
   rechazo verificado por operador. `candidate` con `incorrect_candidate` registra
   un falso positivo. `no_profiles` y `no_face` no prueban rechazo de desconocidos.
7. Hacer 20 intentos por escenario con capturas nuevas; exportar cada bloque.
   No modificar umbral para acertar cada caso. Separar calibración de evaluación;
   cualquier cambio de umbral exige otro bloque documentado. El tamaño propuesto
   sirve para exploración, no para afirmar tasas poblacionales fiables.
8. Desconectar físicamente Wi-Fi/datos o activar modo avión. Marcar «Ensayo con
   red desconectada por el operador» y repetir pasos 5 y 6 conservando perfiles.
   Registrar declaración y ambos indicios de conectividad, sin asumir que estos
   demuestran desconexión. En DevTools puede verificarse que no hay tráfico remoto.
9. Recargar offline: los perfiles desaparecen deliberadamente. Preparar/cargar
   desde caché, renovar consentimiento y enrolar A otra vez offline; repetir
   conocidos y desconocidos. El caso sin perfiles debe informar que no comparó.
10. Exportar JSON v2 de cada bloque. Revisar filas `recognition` y
    `comparisonStatus=executed`, separando escenario, revisión y condiciones de
    red. No sumar controles/enrolamientos a las métricas de reconocimiento.
    Retirar consentimiento y borrar mediciones al cerrar la sesión.

La misma prueba debe repetirse en Android real con origen seguro, según
[instrucciones de Fase 1](fase-1.md). La precisión no se deduce del coseno ni
de la latencia. No declarar aprobada Fase 1 sin revisar exportaciones humanas
con candidatos correctos, desconocidos y errores, además de la ejecución offline.

## Verificación automatizada de esta revisión

- `npm.cmd test`: 16 pruebas aprobadas. Ocho previas de matemáticas/geometría y
  ocho nuevas de instrumentación: comparación real de vectores numéricos de
  prueba, duración cero, ausencia de perfiles, rechazo, ambigüedad, umbral por
  fila, separación escenario/resultado, exportación sin campos privados e
  interpretación conservadora del historial.
- `npm.cmd run build`: TypeScript y Vite/PWA correctos.
- Con preview separado: `$env:AF_EXTERNAL_SERVER='1'; npm.cmd run test:e2e`:
  cuatro pruebas aprobadas en 8.3 s. Cámara sintética sin personas; modelos
  reales; fila `recognition/no_face` etiquetada como ensayo de desconocido,
  controles de inferencia online/offline, descarga y análisis del JSON v2,
  ausencia de campos privados, permiso denegado, recursos ausentes y viewport móvil.

Los vectores de pruebas unitarias no son embeddings de voluntarios. El recorrido
de navegador no produjo candidatos faciales positivos: no se inyectaron perfiles
ni puntuaciones para aparentar reconocimiento. La combinación de inspección del
handler y pruebas del adaptador demuestra la ruta de comparación, pero **su uso
con embeddings faciales humanos requiere el protocolo anterior**.

El archivo de control automatizado se conserva en
`docs/evidencias/fase-1-exportacion-v2-controles.json`. No es la exportación
humana citada por el usuario. Los resultados anteriores permanecen como historial.

## Cambios y pendientes

Creado `src/measurement.ts` y sus pruebas; actualizados `src/main.tsx`,
`src/storage.ts` y `tests/e2e/lab.spec.ts`; documentación/protocolo actualizado.
No se instalaron dependencias ni se modificó el motor, modelos o backend.
Pendientes: nuevas exportaciones v2 de ensayos consentidos conocidos/desconocidos/offline, revisión de Android y de
la evidencia. No se hizo commit, push ni despliegue; Fase 2 no autorizada.

Verificación final de tipos detectó inicialmente que el fixture de privacidad
incluía propiedades ajenas al tipo de producción. Se corrigió el tipo del fixture
sin ampliar los campos permitidos en producción; la compilación posterior pasó.
La ejecución final volvió a aprobar las 16 pruebas unitarias y la comprobación
de tipos; 24 enlaces Markdown locales válidos. `git diff --check` no informó
errores (los archivos siguen sin seguimiento). El archivo original se preservó
y se excluyó de Git mediante `.gitignore`, por contener metadatos de la sesión.
