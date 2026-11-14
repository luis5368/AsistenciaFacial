# Informe de validación biométrica de Fase 1

Fecha de análisis: 8 de noviembre de 2026. Proyecto AsistenciaFacial.

## Conclusión y recomendación

Las exportaciones aportan evidencia de ejecución de comparación facial y
separación de puntuaciones en los bloques que el usuario identifica como
registrado y desconocido, con umbral experimental **0.50**. Se confirman los
conteos y medias comunicados: 12 candidatos de 12, 15 rechazos de 15 y 12
candidatos de 12 en el bloque declarado sin red. Son decisiones del motor,
no identidades correctas verificadas independientemente.

Se recomienda **aceptación técnica parcial de la ruta experimental de inferencia
y comparación**, condicionada a completar trazabilidad humana, desconexión
verificable y Android. **No cerrar ni declarar aprobada íntegramente Fase 1**
todavía. No se autoriza Fase 2 ni uso escolar real. No se afirma precisión
general del 100 %, ni se cambia el umbral, modelos o dependencias.

## Fuentes, integridad y metodología

Se leyeron los cuatro originales locales bajo `Puebas/`, excluidos de Git.
No se modificaron ni copiaron al repositorio de evidencias. Todos declaran
`schemaVersion=2` y `modelVersion=yunet-2023mar_sface-2021dec`, aunque contienen
15 filas históricas sin clasificación. Los nombres «fase-2», «fase-3» y «fase-4»
identifican archivos de ensayos, **no fases de desarrollo autorizadas**.

Se comparó cada fila completa del prefijo, conservando orden y valores y
normalizando únicamente el orden de claves JSON. El historial de cada archivo
es prefijo exacto del siguiente. No se deduplicó por coseno, por redondeo o por
similitud entre mediciones: dos capturas legítimas pueden dar resultados iguales.
No se eliminaron filas dentro de un bloque.

| Original | Filas totales | Prefijo ya contado | Filas nuevas | Posición en historial consolidado (base 1) |
| --- | ---: | ---: | ---: | --- |
| `mediciones-fase-1.json` | 28 | 0 | 28 | 1–28 |
| `mediciones-fase-2.json` | 40 | 28 | 12 | 29–40 |
| `mediciones-fase-3.json` | 55 | 40 | 15 | 41–55 |
| `mediciones-fase-4 sin red.json` | 67 | 55 | 12 | 56–67 |
| Total | 190 | 123 | 67 | 1–67 |

«67 únicas» significa posiciones distintas después de quitar prefijos
acumulados; no significa 67 personas ni prueba de independencia de capturas.
Sin IDs de evento no puede probarse la ausencia de duplicados de origen dentro
del mismo bloque. La coincidencia exacta de secuencias completas fundamenta la
consolidación, pero los JSON no están firmados y no certifican su procedencia.

El archivo actual `mediciones-fase-1.json` tiene 28 filas; no es el original de
cuatro filas analizado en el informe histórico de instrumentación. Sus
conclusiones históricas no se trasladan a esta nueva versión del archivo.

Reproducción, sin conexión a bases de datos ni instalaciones:

```powershell
node scripts/analyze-phase1.mjs
```

El script falla si un prefijo deja de coincidir y requiere conciliación; no
fusiona silenciosamente historiales distintos. El [resumen agregado JSON](resumen-validacion-biometrica-fase-1.json)
conserva SHA-256 completos de los cuatro originales, conteos y estadísticos
sin imágenes, vectores, nombres, IDs personales ni tiempos absolutos.

Media: suma/n. Mediana: centro ordenado (promedio de dos centros si n par).
p95: rango más cercano, posición `ceil(0.95*n)`; con estos bloques pequeños
coincide con el máximo. Se filtraron exclusivamente filas
`operation=recognition` y `comparisonStatus=executed` para métricas de comparación.
No se convierten nulos o históricos en ceros. No se atribuyen escenarios a partir
del resultado del motor: la asociación de bloques procede de la declaración
del usuario, en el orden presentado en su solicitud.

## Resultados medidos sin duplicar

| Bloque | Escenario según usuario | Comparaciones | Candidatos | Rechazos `unknown` | Coseno medio | Mediana | Mínimo–máximo |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1–28, exploratorio | No clasificado | 7 | 1 | 6 | 0.3483 | 0.3274 | 0.1519–0.5883 |
| 29–40 | Usuario registrado | 12 | 12 | 0 | 0.9288 | 0.9394 | 0.8569–0.9558 |
| 41–55 | Usuario desconocido | 15 | 0 | 15 | 0.1621 | 0.1616 | 0.1241–0.2018 |
| 56–67 | Registrado, sin red declarada | 12 | 12 | 0 | 0.9014 | 0.9024 | 0.8715–0.9166 |

El primer archivo no se descarta: además de sus siete comparaciones contiene
15 filas `legacy_unspecified`, una carga, dos enrolamientos y tres intentos
`no_profiles`. No se clasifican sus seis rechazos como errores ni su candidato
como acierto porque se desconoce la condición de esas capturas.

Total consolidado: **49 intentos de reconocimiento**, de los que **46 ejecutaron
comparación** y tres no tenían perfiles. Las 46 comparaciones producen 25
candidatos y 21 rechazos; los tres bloques comunicados por el usuario son un
subconjunto de 39 comparaciones. Todas las comparaciones ejecutadas registran
un rostro, un perfil comparado, umbral 0.50 y margen 0.05. No hubo selección
entre varios perfiles ni evidencia de comportamiento a escala de una clase.
No se detectaron contradicciones entre resultado y umbral en esas filas.

La separación observada entre el máximo del bloque desconocido (0.2018) y el
mínimo del bloque registrado (0.8569) es favorable **en estos bloques**. No
demuestra calibración del umbral ni cobertura de otras personas, cámaras,
iluminaciones, edades o intentos de suplantación.

### Tiempos registrados

| Bloque | Detección media ms | Embedding medio ms | Comparación media ms | Mediana comparación ms | Suma media ms | Mediana suma ms | p95 suma ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Exploratorio | 80.871 | 80.243 | 0.0571 | 0 | 161.171 | 162.4 | 206.7 |
| Registrado | 77.975 | 81.775 | 0.0750 | 0.100 | 159.825 | 159.7 | 171.5 |
| Desconocido | 78.380 | 85.127 | 0.0067 | 0 | 163.513 | 162.8 | 183.0 |
| Sin red declarada | 81.792 | 86.075 | 0.0083 | 0 | 167.875 | 164.2 | 196.7 |

La suma se calcula por fila: detección + embedding + comparación. No es latencia
total cámara-a-pantalla: no incluye captura, toda la alineación ni persistencia
de mediciones. No hay base para convertirla en FPS de video continuo.
En los bloques hay respectivamente 5/7, 5/12, 14/15 y 11/12 duraciones de
comparación iguales a cero. Aquí `executed`, `comparedCount=1` y coseno medido
permiten distinguir ejecución de omisión; los ceros son compatibles con la
resolución del reloj, no prueba de coste computacional nulo.

## Qué se midió, qué se declaró y qué se revisó

| Evidencia | Estado |
| --- | --- |
| Resultado automático, coseno, umbral, número de perfiles, tiempos | Presentes en las 46 comparaciones ejecutadas |
| Escenario conocido/desconocido en JSON | Todas las 67 filas dicen `unspecified`; la clasificación de los tres bloques viene del mensaje del usuario |
| Revisión humana en JSON | Todas las 67 filas dicen `not_reviewed`; no hay confirmaciones por intento registradas |
| Adultos voluntarios y consentimiento | Declarados por el usuario; el JSON técnico no incluye ni verifica documentos de consentimiento |
| Desconexión en último bloque | `offlineTestDeclared=true` en 12/12; ambos `browserOnline` son `true` en 12/12 |
| Control de Service Worker | `true` en las 52 filas modernas, incluidas las 12 últimas; las históricas tienen null |
| Detención del servidor y recarga sin red en último bloque | Sin evidencia en los archivos; ese bloque no añade una carga ni un enrolamiento |
| Hardware físico y Android | No identificados en los JSON v2; no se puede atribuir rendimiento a Android |

El indicador de red puede permanecer verdadero en una LAN sin internet; tampoco
estar controlado por un Service Worker demuestra que los recursos se sirvieron
desde caché. Por tanto, no se acusa una declaración falsa ni se certifica offline.
Se requiere el ensayo siguiente. Referencia: [MDN, límites de navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine).

No se calculan FMR/FNMR poblacionales ni precisión general: faltan verdad de
referencia por ensayo, número de adultos independientes y diseño de muestreo.
12/12 y 15/15 describen decisiones observadas en bloques declarados; no equivalen
a 100 % de precisión. Las repeticiones del mismo adulto no son nuevas identidades.

## Protocolo offline verificable, pendiente de ejecución humana

1. Preparar un bloque nuevo, con consentimiento de adultos y sin menores en
   cámara. Exportar el historial previo antes de limpiar mediciones. Fijar umbral
   0.50 y elegir escenario antes de cada comparación. No cambiar parámetros para
   corregir resultados durante el bloque.
2. Ejecutar `npm.cmd run build` y `npm.cmd run preview`. Usar el mismo origen
   exacto, por ejemplo `http://127.0.0.1:4173`, sin alternar host o puerto. Preparar
   modelos, recargar y comprobar que la página esté controlada por el Service Worker.
   Registrar en una ficha técnica sin identidades: versión de app/modelos,
   navegador, tipo de dispositivo y condiciones de luz.
3. En DevTools, comprobar que `navigator.serviceWorker.controller` existe y
   que Cache Storage contiene shell, modelos y WASM. Abrir Network con registro
   preservado; no usar «Bypass for network» ni eliminar almacenamiento. Realizar
   un control inicial para comprobar que los modelos cargan.
4. Detener **solo el servidor de este ensayo** con Ctrl+C en su terminal. Verificar
   desde PowerShell, fuera del navegador/Service Worker:

   ```powershell
   Test-NetConnection 127.0.0.1 -Port 4173 -InformationLevel Quiet
   ```

   Debe devolver `False`. Si hay otro proceso escuchando, no continuar afirmando
   servidor detenido ni cerrarlo sin identificarlo. Guardar únicamente el
   resultado técnico, sin credenciales, rutas personales o procesos ajenos.
5. Desactivar Wi-Fi, datos móviles y otras interfaces de salida relevantes.
   El bloqueo offline de DevTools puede complementar la prueba, pero se registra
   como simulación, no sustituto de la desconexión física. Marcar en UI la
   declaración de ensayo offline. Mantener el mismo perfil de navegador.
6. Recargar normalmente desde ese mismo origen con servidor detenido. La
   aplicación debe abrir desde Service Worker y cargar modelos. Comprobar en
   Network los recursos atendidos por Service Worker, sin respuestas de servidor
   ni solicitudes remotas exitosas. Conservar captura técnica sin vista de rostro;
   no exportar un HAR sin revisar porque podría contener datos innecesarios.
7. La recarga elimina perfiles por diseño: renovar consentimiento, enrolar al
   adulto conocido localmente, obtener capturas nuevas y realizar comparaciones.
   Con un segundo adulto no enrolado, repetir el caso desconocido. Registrar al
   menos 20 intentos por escenario, incluidos fallos, con revisión humana de cada
   resultado antes de pasar al siguiente. Es una muestra exploratoria, no un
   requisito suficiente de validez estadística general.
8. Exportar JSON v2 por bloque antes del límite de 100 filas. Adjuntar ficha
   técnica que confirme puerto cerrado, interfaces desconectadas y recarga desde
   SW. No guardar fotografías, vectores, nombres ni documentos de identidad.
9. Control negativo separado: en un perfil de navegador nuevo, sin preparación,
   el origen con servidor detenido no debe funcionar. No borrar la caché del
   perfil de ensayo para demostrar este control. Restablecer conectividad al
   concluir y retirar consentimiento/borrar perfiles.

Aceptación offline: recarga + carga de ambos modelos + cámara física + nuevo
enrolamiento y comparación conocidos/desconocidos con servidor detenido y
desconexión documentada. Una sesión ya abierta que siga funcionando no satisface
por sí sola el requisito de arranque offline.

## Protocolo Android con HTTPS y consentimiento

Plan de ensayo, no despliegue realizado ni autorización para publicar.

1. Elegir un Android físico y Chrome; anotar modelo comercial, versión de Android
   y navegador, resolución de cámara y condiciones de luz. No registrar serie,
   IMEI, cuenta, IP pública ni identificadores de los adultos. Preparar consentimiento
   informado y revocable de cada adulto fuera del conjunto técnico; ofrecer vía manual.
2. Preparar un origen **HTTPS de laboratorio privado** que sirva el build y
   recursos en el mismo origen. El certificado debe ser válido para el nombre
   usado y confiable para ese Android, mediante infraestructura de laboratorio
   autorizada. No saltar advertencias TLS ni desactivar seguridad del navegador.
   No generar/subir claves privadas al repositorio ni instalar certificados sin
   autorización del propietario. Si no existe infraestructura, el ensayo queda
   pendiente de su preparación aprobada; no utilizar un túnel público por defecto.
3. Abrir HTTPS, comprobar `window.isSecureContext === true`, permitir cámara y
   probar también denegación y revocación. HTTPS y permiso son requisitos del
   acceso a cámara: [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
4. Preparar app/modelos en el teléfono, comprobar SW activo, renovar página para
   usar la versión correcta y ejecutar controles. No usar la emulación de viewport
   de escritorio como sustituto de Android. Desconectar depuración por USB si
   pudiera habilitar una ruta de red alternativa durante el ensayo offline.
5. Crear bloques separados de conocido y desconocido: antes de comparar, seleccionar
   `known_person` o `unknown_person`. Registrar a A y mantener B fuera de los
   perfiles, con consentimiento de ambos. Revisar candidato mostrado en pantalla
   sin exportar su ordinal; marcar revisión correcta/incorrecta/inconclusa.
6. Mantener umbral 0.50 y margen 0.05. Repetir al menos 20 capturas nuevas por
   escenario, con luz y distancia documentadas. Registrar fallos y condiciones
   desfavorables; no seleccionar solo intentos exitosos. Separar cualquier ensayo
   de calibración de la evaluación posterior.
7. Detener el servicio HTTPS del laboratorio, verificar desde un cliente ajeno
   al SW que el puerto ya no responde, desactivar Wi-Fi/datos y repetir el protocolo
   offline anterior en el mismo origen HTTPS. No permitir fallback a HTTP.
8. Exportar métricas agregables, registrar calentamiento/fallos sin afirmar consumo
   energético medido si no hay herramienta, y revisar mediana/p95 por dispositivo.
   Exportar antes de 100 filas. Retirar consentimiento, detener cámara y eliminar
   perfiles al terminar; aplicar la retención acordada a reportes técnicos.

## Registro de escenarios y revisión sin identidad persistente

La UI existente ya permite declarar escenario y revisar la última comparación
guardada. Debe usarse antes del próximo intento: el resultado automático nunca
rellena ni corrige la verdad de referencia. `candidate` no se transforma por sí
solo en `correct_candidate`; una persona puede dar falsa aceptación. `no_profiles`
y `no_face` no cuentan como rechazo biométrico correcto de un desconocido.

El ID interno Dexie permite actualizar la revisión, pero se excluye de la
exportación junto con nombres, ordinales de perfiles, timestamps exactos,
user-agent, fotografías y embeddings. La revisión persiste solo como categoría.
No se cambiaron los originales a posteriori para completar `unspecified` o
`not_reviewed`. Si el responsable aporta una aclaración retrospectiva, debe
guardarse como declaración externa por bloque, nunca como medición original.

Mejora propuesta para futuros ensayos: identificador aleatorio **de lote técnico**
y ordinal de intento, sin vínculo a una persona, para deduplicar cuando cambie
la revisión humana o se trunque el historial. No implementado en esta entrega.
No usar hash de embedding, cara o identidad como clave de deduplicación. El
protocolo actual requiere exportar tras revisar y antes de borrar/alcanzar 100 filas.

## Pruebas ejecutadas en esta revisión

| Comando/actividad | Resultado real |
| --- | --- |
| `git status --short`, lectura de instrucciones/documentos y JSON | Cambios existentes conservados; originales privados no modificados |
| `node scripts/analyze-phase1.mjs` | Cuatro archivos válidos; tres prefijos completos coinciden; 190 filas, 67 posiciones consolidadas, 123 repeticiones |
| Comprobación Node de comparaciones | 46 filas ejecutadas, un perfil y un rostro por fila; sin contradicciones resultado/umbral |
| `npm.cmd test` | 16 pruebas unitarias aprobadas |
| `npm.cmd run build` | Tipos, Vite y generación PWA correctos |
| `$env:AF_EXTERNAL_SERVER='1'; npm.cmd run test:e2e` | 4 pruebas Playwright aprobadas, 10.7 s |

El puerto 4173 ya tenía un servidor; se comprobó que su HTML coincidía con el
build local antes de usarlo en pruebas aisladas de navegador. El preview iniciado
por esta tarea eligió 4174 y se detuvo; el servidor preexistente no fue detenido.
Por tanto, esta ejecución **no** realizó el nuevo protocolo de servidor apagado.

Las pruebas automatizadas verifican matemáticas con vectores de prueba,
instrumentación/exportación, permisos con cámara sintética, controles reales
ONNX sin personas, recarga mediante `context.setOffline(true)`, recursos ausentes
y layout móvil. No sustituyen los ensayos humanos aportados ni prueban Android,
consentimiento, identidad correcta o desconexión física. No se capturaron nuevos
rostros en esta revisión. No se instalaron paquetes ni se alteraron modelos.

## Criterios pendientes para cierre

| Criterio | Valoración |
| --- | --- |
| Inferencia y comparación con umbral 0.50 | Evidencia funcional favorable en registros suministrados; aceptación parcial experimental |
| Conocido/desconocido con verdad de referencia | Conteos compatibles con la declaración, pero faltan escenarios/revisiones por intento; repetir o documentar revisión externa con sus límites |
| Arranque offline con servidor detenido | Pendiente del protocolo verificable; declaración e indicador SW no bastan |
| Android físico mediante HTTPS | Pendiente; no inferible de estos JSON |
| Desempeño de varios perfiles y calibración | Pendiente; solo un perfil por comparación y muestra pequeña/correlacionada |
| Sesgo, FMR/FNMR, liveness | Sin validación; no prometer precisión poblacional ni resistencia a fotos/videos |
| Aprobación académica de cambio de motor | Sigue pendiente según decisiones anteriores |

La evidencia justifica continuar la evaluación dentro de Fase 1. El responsable
debe revisar estos límites y aprobar expresamente cualquier fase posterior.
