# AsistenciaFacial

Proyecto de graduación: Sistema Automatizado de Registro de Asistencia mediante
Reconocimiento Facial y Arquitectura Offline-First para colegios privados en Guatemala.

## Estado

Fase 1 autorizada: laboratorio local React con YuNet/SFace y ONNX Runtime Web.
Hay una aplicación ejecutable con cámara, perfiles temporales y recursos offline.
Se verificó inferencia sobre controles sin personas; la detección positiva y
el reconocimiento de adultos aún requieren el ensayo consentido del responsable.
No hay precisión validada, API académica ni PostgreSQL. Fase 2 no autorizada.

## Ejecutar el laboratorio

```powershell
npm.cmd ci
npm.cmd run assets
npm.cmd run build
npm.cmd run preview
```

Abrir `http://127.0.0.1:4173`, preparar modelos y seguir
el [protocolo de Fase 1](docs/fase-1.md). Node 24 requerido.
No se guardan fotos ni embeddings permanentemente: perfiles solo en memoria.
La aplicación exporta mediciones sin biometría. Recargar borra los perfiles.
La prueba offline requiere la versión compilada y preparación previa.

En la primera preparación el repositorio solo contenía `.git`. Posteriormente
se incorporaron `docs/propuesta_original.docx`, `README_INICIO.md` y los documentos
numerados `00` a `09`. Se leyó el texto completo del cuerpo del DOCX mediante
OOXML: contiene un encargo para redactar las secciones 5.1–5.7, no un capítulo
terminado ni evidencia experimental. No se verificó su presentación visual.
La revisión y las diferencias pendientes están en
[conciliación documental](docs/conciliacion-fase-0.md).

## Objetivos

1. Registrar asistencia sin internet después de la preparación inicial del dispositivo.
2. Evaluar inferencia facial local en el navegador, sin prometer precisión.
3. Sincronizar registros mediante reintentos seguros y controles de duplicados.
4. Conservar registro manual y controles de privacidad para menores.

Durante el prototipo no se utilizará biometría real de menores. Las pruebas
funcionales usarán identidades ficticias; cualquier evaluación biométrica con
adultos o conjuntos autorizados requerirá definir procedencia, permisos y protocolo.

## Stack previsto

| Área | Tecnologías |
| --- | --- |
| Interfaz | React, Vite, TypeScript, Tailwind CSS |
| Operación offline | Workbox, Service Workers, IndexedDB, Dexie.js |
| Experimento biométrico | ONNX Runtime Web; candidatos YuNet y SFace |
| API | Node.js, Express, TypeScript |
| Persistencia central | PostgreSQL, Prisma |
| Pruebas | Vitest y Playwright; Supertest reservado para el futuro backend |

Versiones exactas en `apps/frontend/package.json` y `package-lock.json`.
Los modelos se descargan con comprobación SHA-256 mediante `npm.cmd run assets`.
Los binarios se excluyen de Git; sus licencias y manifiesto sí se conservan.

## Estructura

```text
apps/frontend/     Laboratorio React, motor ONNX, métricas Dexie y PWA
apps/backend/      Espacio de la API y esquema Prisma
docs/             Arquitectura, fases y verificación
tests/e2e/        Pruebas de navegador con controles sin personas
scripts/          Descarga verificada de recursos y diagnóstico
```

Los workspaces siguen siendo privados. `npm.cmd test` ejecuta Vitest;
`npm.cmd run typecheck` comprueba tipos y `npm.cmd run test:e2e` ejecuta
Playwright con Chrome instalado después de compilar. Ver limitaciones y
resultados en [el informe de Fase 1](docs/evidencias/fase-1-resultados.md).

## Configuración futura

`.env.example` contiene valores locales de referencia y una URL de base de datos
vacía; no contiene credenciales. No hace falta copiarlo para esta fase.
El laboratorio no necesita variables de entorno ni conexión a una base de datos.
Nunca colocar secretos en variables `VITE_*`, que serán públicas en el cliente.

## Documentación

- [Informe de ensayos biométricos y criterios pendientes](docs/evidencias/informe-validacion-biometrica-fase-1.md)

- [Validación de reconocimiento y métricas v2](docs/validacion-reconocimiento-fase-1.md)

- [Arquitectura propuesta](docs/arquitectura.md)
- [Fases y criterios de aceptación](docs/plan-desarrollo.md) — Fase 1 autorizada; Fase 2 pendiente
- [Laboratorio de Fase 1](docs/fase-1.md)
- [Documentación rectora cargada](docs/00_LEER_PRIMERO.md)
- [Contratos preliminares](docs/contratos-fase-0.md)
- [Registro de verificaciones](docs/verificacion-fase-0.md)
- [Instrucciones para colaboradores](AGENTS.md)

No se ha desplegado, publicado ni creado ningún commit como parte de esta preparación.

## Autenticaci�n local (Fase 3, etapa 2)
El runtime backend ahora exige HTTPS local e instituci�n existente antes de escuchar. No ejecutar las instrucciones hist�ricas HTTP como autenticaci�n. Preparaci�n TLS, comandos, pruebas con dobles y pendientes en [informe de autenticaci�n](docs/evidencias/fase-3-etapa-2-autenticacion.md). No se crearon cuentas ni se prob� autenticaci�n real PostgreSQL.
