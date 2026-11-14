# Arquitectura técnica propuesta (corresponde a 5.1 y 5.5)

## Capas y componentes

```text
  Dispositivo autorizado (profesor)
  ┌───────────────────────────────────────────────────────────┐
  │ PWA React + Vite + UI                                   │
  │ ├── UI cámara, consentimiento, asistencia, panel         │
  │ ├── módulo biométrico (adaptador ONNX Runtime Web)        │
  │ ├── servicio offline (IndexedDB/Dexie)                   │
  │ ├── cola de eventos y motor de reconciliación             │
  │ └── service worker (cache app/modelos; Background Sync?) │
  └──────────────────────────┬────────────────────────────────┘
                             │ HTTPS, autenticación
                             ▼
  ┌───────────────────────────────────────────────────────────┐
  │ API REST Node/Express/TypeScript                         │
  │ autenticación, autorización, validación, idempotencia,    │
  │ consentimientos, auditoría, sincronización               │
  └──────────────────────────┬────────────────────────────────┘
                             ▼
  ┌───────────────────────────────────────────────────────────┐
  │ PostgreSQL (instituciones, estudiantes, sesiones,         │
  │ asistencias, plantillas faciales cifradas, bitácora)      │
  └───────────────────────────────────────────────────────────┘
```

## Flujo de preparación inicial (en línea)

1. Docente inicia sesión en el servidor, registra o autoriza el dispositivo.
2. API devuelve únicamente grupos/sesiones asignados, versiones y políticas vigentes.
3. App descarga activos PWA + archivos WASM/ONNX exactos y verifica su disponibilidad offline.
4. Bajo autorización vigente, obtiene perfiles autorizados mínimos para comparación en ese grupo; almacenar solo embeddings cifrados con plazo definido.
5. App comprueba espacio, cámara y permisos. Muestra “listo para modo sin conexión” solo tras prueba de integridad local.

## Flujo del reconocimiento

1. `getUserMedia()` abre cámara en contexto seguro (localhost/HTTPS) previa autorización.
2. Detectar rostro, verificar calidad/alineación; descartar capturas inválidas.
3. Extraer embedding localmente; no enviar fotograma al servidor por defecto.
4. Comparar solo frente a plantillas del grupo y consentimiento activos, usando umbral empírico.
5. Confirmación humana cuando corresponda; identidad ambigua -> alternativa manual.
6. Crear evento de asistencia en la cola local, sin bloquearse por red.

## Cola de sincronización (propuesta)

Estados locales: `PENDING`, `SENDING`, `ACKED`, `RETRYABLE_ERROR`, `NEEDS_REVIEW`.

1. Crear `event_uuid` (UUIDv4) y guardar evento transaccionalmente en `attendance_queue`.
2. Cuando haya conectividad confirmada y credenciales válidas, enviar lote ordenado de eventos, sin dependencias circulares.
3. API verifica rol, institución, curso, consentimiento cuando aplique, límites, vigencia y consistencia temporal.
4. API resuelve `event_uuid` de forma idempotente: si ya existe, responde con el mismo resultado sin nuevo registro.
5. Restricción lógica `(student_id, session_id)` previene asistencias simultáneas. Las correcciones requieren endpoint propio y bitácora.
6. Cliente marca `ACKED` tras respuesta persistida; fallas de red mantienen la copia pendiente y programan reintentos con backoff.
7. `NEEDS_REVIEW` conserva información mínima y expone motivo de conflicto al usuario; nunca se elimina silenciosamente.

**No adoptar Last-Write-Wins de manera general.** En asistencia, un evento posterior no necesariamente es el verdadero. Registrar la resolución y su autor.

## Contratos de API sugeridos (no implementados)

- `POST /api/auth/login`
- `GET /api/bootstrap` — datos mínimos, versiones y autorizaciones para operación local.
- `GET /api/groups/:id/students`
- `POST /api/consents` / `POST /api/consents/:id/revoke`
- `POST /api/biometrics/enroll` — acceso controlado, nunca abierto al docente ordinario.
- `DELETE /api/biometrics/students/:id` — borrado sujeto a política.
- `POST /api/sync/attendances` — recibe lote con UUID, devuelve ACK/revisión.
- `GET /api/reports/attendance` — filtros protegidos por alcance institucional.

Los contratos finales requerirán OpenAPI, validación del cuerpo y tests.

## Amenazas técnicas a diseñar desde el inicio

- App sin conexión durante revocación de permisos: políticas con caducidad local y nueva autorización.
- Robo o desbloqueo del teléfono: sesiones limitadas, cifrado y borrado al reconectar (sin prometer borrado remoto instantáneo offline).
- Desfase de reloj: conservar `occurred_at_client` y `received_at_server`.
- Falta de espacio y limpieza del almacenamiento: estado de salud y reintentos; nunca confirmar “guardado” sin transacción exitosa.
- Duplicados: UUID, índice único en API y semántica clara de reconciliación.
- Actualización de modelos: versionar plantilla, versión de embedding y modelo; no comparar vectores de versiones incompatibles.
- Service Workers: datos secretos no deben quedar expuestos en caché público o compartido.

## Diagramas del Capítulo V a generar más adelante

- Diagrama C4: contexto, contenedores y componentes.
- MER y diagrama de clases de dominio.
- Secuencia: enrolamiento, asistencia offline y reconciliación.
- Flujos UI: enrolamiento, escaneo, dashboard, fallback manual.
