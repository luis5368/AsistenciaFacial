# Verificación de Fase 0

Fecha: 16 de octubre de 2026. Entorno: Windows y PowerShell.

## Revisión posterior con documentos cargados

Esta sección actualiza el estado; la inspección inicial que sigue se conserva
como historial y no describe la disponibilidad actual de la propuesta.

Se encontraron y leyeron `README_INICIO.md`, los Markdown `00` a `09`, el nuevo
`AGENTS.md` y `docs/propuesta_original.docx`. Se usó `Get-Content -Encoding UTF8`
para evitar la interpretación incorrecta de acentos de PowerShell por defecto.
El DOCX se leyó sin modificarlo mediante `System.IO.Compression.ZipFile.OpenRead`,
`StreamReader` y XPath sobre `word/document.xml`; cero tablas y cero dibujos.
No se renderizó ni se verificó su diseño visual. Se consultó la guía de lectura
DOCX; no se instaló software ni se abrieron servicios externos.

El responsable eligió el roadmap cargado, con viabilidad biométrica primero,
y confirmó que el cambio académico de motor/métricas sigue pendiente. Esa
elección no autoriza iniciar Fase 1.

### Archivos de esta revisión

- Creados: `docs/conciliacion-fase-0.md` y `docs/contratos-fase-0.md`.
- Actualizados: `AGENTS.md`, `README.md`, `.gitignore`, `docs/arquitectura.md`,
  `docs/plan-desarrollo.md`, `docs/01_REQUISITOS_Y_TRAZABILIDAD.md`,
  `docs/02_EVALUACION_TECNOLOGIAS.md` y este informe.
- Conservados: DOCX original, estructura frontend/backend, manifiestos y
  `.env.example`; no requerían recreación. Las fuentes cargadas restantes se
  conservaron, con sus diferencias explicadas en la conciliación.

### Comprobaciones ejecutadas de nuevo

| Comando | Resultado |
| --- | --- |
| `rg --files --hidden -g '!.git' -g '!node_modules'` y `git status --short` | Inventario de documentos y estructura; todos siguen sin seguimiento de Git, sin commits creados |
| `node --version` / `npm.cmd --version` | `v24.20.0` / `11.19.0` |
| `node -e` con inventario Git, enlaces locales Markdown, `JSON.parse` y `DATABASE_URL` | 31 archivos inventariados, 11 enlaces locales válidos, 3 manifiestos privados válidos y URL de BD vacía |
| `git check-ignore .env apps/frontend/.env.local private_data/example data/example biometrics/example models/example.onnx uploads/example` | Siete rutas excluidas; ejemplos comprobados sin crearlos |
| `git check-ignore .env.example docs/propuesta_original.docx` | Sin salida: ambos se mantienen versionables; código 1 esperado |
| `git diff --check` | Sin errores, pero no revisa contenido de archivos nuevos no indexados |

La validación Node es estructural y no una auditoría exhaustiva de secretos.
La documentación recibida contiene espacios finales Markdown intencionales;
no se eliminaron masivamente. No se ejecutaron tests funcionales, compilación,
migraciones, cámara, red offline ni inferencia, porque siguen sin existir
implementaciones o dependencias instaladas. No se descargaron modelos.

Las escrituras se realizaron mediante `apply_patch` y una sustitución de texto
UTF-8 en `docs/plan-desarrollo.md` con PowerShell para retirar el orden descartado.
No hubo cambios de política del sistema, instalación, commit, push ni despliegue.

## Inspección inicial

- `Get-Location`, `rg --files --hidden -g '!.git' -g '!node_modules'` y
  `Get-ChildItem -Force`: raíz `C:/Projects/AsistenciaFacial`, solo `.git`.
- `git status --short`: sin cambios iniciales.
- `git rev-parse --show-toplevel`: confirmó la raíz del repositorio.
- `Test-Path docs/propuesta.docx`: `False`. No fue posible revisar la propuesta
  porque no está presente; no se atribuye contenido a ese documento.
- Se consultó la guía de herramientas DOCX para una eventual lectura, pero no
  fue necesario extraer ni renderizar documentos, al no existir el archivo.

## Comandos y resultados

| Comando o comprobación | Resultado real |
| --- | --- |
| `node --version` | `v24.20.0` |
| `npm --version` | Falló: PowerShell bloqueó `npm.ps1` por política de ejecución |
| `npm.cmd --version` | `11.19.0`; no se modificó la política de PowerShell |
| `node -e` con `JSON.parse` y comprobación de `private` para los tres `package.json` | Los tres manifiestos son JSON válido y privados |
| `git diff --check` | Sin salida; alcance limitado porque los archivos nuevos aún no están en el índice |
| `git check-ignore .env apps/frontend/.env.local node_modules/example data/example biometrics/example model.onnx` | Las seis rutas de ejemplo quedaron excluidas; no se crearon esos archivos |
| `git check-ignore .env.example` | Sin salida, código 1 esperado: el ejemplo no está excluido |
| `node -e` recorriendo `git ls-files --others --exclude-standard` | Revisión directa de espacios finales y enlaces Markdown locales; primera pasada detectó este informe todavía no creado, corregido al incorporarlo |
| `git status --short` | Solo archivos nuevos de preparación, sin archivos previos modificados |

La revisión directa de espacios y enlaces se repite después de incorporar este
informe. Los comandos de escritura fueron `apply_patch`; no se ejecutaron
instaladores, migraciones ni operaciones de despliegue.

## Pruebas que no aplican todavía

No se ejecutaron Vitest, Supertest, Playwright, compilación ni comprobación de
tipos: no existen código funcional, dependencias ni configuración de esos comandos.
No se probó cámara, funcionamiento offline, sincronización, PostgreSQL ni
inferencia ONNX. No hay evidencia de precisión biométrica ni de rendimiento.

## Límite de cierre

Preparación entregada para revisión. No se hicieron commits, push ni publicación.
La siguiente fase permanece pendiente de aprobación explícita.
