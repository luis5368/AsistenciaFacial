# Propuesta de validación real — requiere autorización independiente

Este documento es un plan, no un procedimiento ejecutado. No autoriza conexiones, creación de bases, GRANT, fixtures ni activación. La principal `asistencia_facial` y `asistencia_facial_sandbox` permanecen fuera del ensayo propuesto.

## Entorno propuesto para revisión

| Recurso | Propuesta |
|---|---|
| Host/puerto | localhost:5432, exclusivamente local |
| Base nueva | asistencia_facial_api_lab; detener si existe, no reutilizar ni borrar |
| Propietario/migrador | Rol existente asistencia_migrator; sin privilegios globales adicionales |
| Runtime | Rol existente asistencia_app; permisos exclusivamente sobre la base nueva |
| Administración puntual | postgres solo para creación/verificación de base y permisos expresamente autorizados |
| Esquema | Reproducir las dos migraciones inmutables; no baselining de una base nueva |
| Datos | Dos instituciones ficticias A/B, dos ADMIN activos por institución, usuarios TEACHER activos/inactivos, perfiles y grupos sintéticos |
| Credenciales | Definidas localmente por responsable, sin contraseñas por defecto ni impresión; archivos privados ignorados y ACL restringida |
| Servicio | HTTPS loopback; instancias A/B con configuración fija, puertos distintos y cookies aisladas por contexto de navegador |

**Adaptación necesaria antes de ejecutar:** el validador de URL actual del runtime admite solo la principal. No debilitarlo ni cambiarlo para que el laboratorio pueda apuntar indistintamente a principal/sandbox. Preparar, tras autorización, un ejecutor de integración separado con validación estricta de `localhost:5432/asistencia_facial_api_lab`, rol asistencia_app, sin parámetros adicionales ni variables del migrador en runtime. El ejecutor debe verificar `current_database()`, `current_user`, servidor/puerto y esquema antes de cualquier fixture. Mantener `server.ts` sin rutas administrativas hasta la aprobación de activación.

Permisos propuestos: CONNECT y USAGE; matriz mínima de tablas/columnas ya revisada en el apartado 6 del plan de migración principal, aplicada **solo a esta base nueva**. Sin CREATE para app, sin DELETE/TRUNCATE, sin UPDATE de auditorías/correcciones, sin acceso a `_prisma_migrations` ni metadatos biométricos. No dar nuevos privilegios globales a roles existentes. El migrador crea estructuras y fixtures revisados en la base nueva; las pruebas se autentican efectivamente como asistencia_app, nunca simulan ese rol usando postgres. Inspeccionar permisos efectivos antes del ensayo.

## Secuencia propuesta

1. Obtener autorización explícita para nombre de base, creación, migraciones, permisos locales y datos ficticios. Confirmar que el nombre no existe y que principal/sandbox no se usan. No eliminar un recurso preexistente.
2. Revisar checksums; crear solo la base autorizada y aplicar las dos migraciones versionadas. Verificar 14 tablas de dominio, historial Prisma, RLS ENABLE/FORCE, restricciones y triggers. Registrar inventario, no secretos.
3. Aplicar y comprobar permisos locales mínimos. Configurar credenciales fuera de Git. Ejecutar preflight del migrador y de asistencia_app con consultas de identidad. Detener ante discrepancias.
4. Aprovisionar en transacción instituciones/usuarios ficticios explícitamente aprobados, UUID aleatorios, correo `example.test`, contraseñas introducidas privadamente y Argon2id del perfil probado. Nunca cuentas predeterminadas. Registrar conteos e identificadores técnicos mínimos en evidencia privada, no contraseñas/hashes. Los fixtures de matrículas, si se requieren para comprobar el filtro de estudiantes, deben autorizarse por separado en el mismo plan: no habilitar endpoints de matrícula.
5. Iniciar ejecutor de autenticación aislado como asistencia_app. Probar login, cuenta inexistente/inactiva, sesión, CSRF, límite, expiración y logout. Confirmar el usuario técnico mediante consulta, no solo inspección de URL. Ningún endpoint se monta en principal.
6. Probar A/B con filas que reutilicen UUID/correos cuando lo permite la clave compuesta; consultas sin contexto, contexto ajeno, transacciones consecutivas en la misma conexión del pool y aislamiento tras rollback. Distinguir filtrado RLS de autorización por rol/grupo.
7. Cambiar contraseña: comprobar nuevo hash y AuditEvent en la misma transacción; confirmar que la anterior no autentica y todos los tokens anteriores fallan. Forzar fallo de auditoría desde el arnés transaccional autorizado y comprobar ausencia de modificación; no cambiar triggers ni permisos para provocar el fallo.
8. Tras verificar auth, montar administración **solo en el ejecutor de la base de laboratorio**. Probar último ADMIN y ETag en dos conexiones realmente concurrentes, revocación tras COMMIT, usuario desactivado durante petición, referencias interinstitucionales, matrícula vigente y asignaciones inactivas. Sin SQL manual que evada el protocolo de bloqueo para declarar éxito.
9. Navegador: contexto aislado Playwright/Chrome con HTTPS local y confianza explícita limitada al ensayo. No instalar certificados en el sistema sin autorización. Si se usa `ignoreHTTPSErrors` únicamente en el contexto de ensayo, declararlo: no demuestra confianza PKI real. Verificar cookie HttpOnly/Secure/SameSite/Path/ausencia de Domain, inaccesibilidad desde JavaScript, envío a HTTPS, rechazo de origen ajeno, logout y eliminación. Para probar ausencia de envío por HTTP, considerar las excepciones de localhost del navegador y documentar lo observado, no suponerlo. No aceptar que Supertest sustituye esta prueba.
10. Recuperación: detener solo el proceso de ensayo, verificar pérdida de sesiones al reiniciar; simular error de conexión mediante el arnés, sin apagar PostgreSQL ni afectar otras bases. No exponer stacks/URLs. Forzar rollback y error de COMMIT controlado y registrar si el resultado es inequívoco; ante pérdida de confirmación, verificar estado persistido antes de reintentar, sin prometer semántica exactly-once administrativa.
11. Conservar base y evidencia para revisión; no borrar automáticamente. No copiar fixtures a principal. Obtener autorización de activación separada antes de modificar el montaje del runtime o avanzar a etapa 4.

## Criterios de aceptación y evidencia

- Identidad técnica y destino verificados en cada ejecutor; ningún acceso a principal/sandbox.
- Login y cambio de contraseña reales con asistencia_app; auditoría atómica y revocación comprobadas.
- RLS y reutilización de pool sin filtración, incluyendo contexto ausente/incorrecto.
- Dos transacciones concurrentes preservan un ADMIN activo; ETag obsoleto rechazado sin pérdida de cambios.
- Cookies comprobadas en navegador, con versión, tratamiento del certificado y limitaciones explícitos.
- Recuperación tras rollback/reinicio y fallos sanitizados; sin datos reales, fotos, embeddings, secretos o logs personales.
- Informe con comandos realmente ejecutados, versiones, casos, resultado esperado/observado, inventario y limitaciones. Las pruebas fallidas no se reetiquetan como satisfactorias.

La aceptación de la etapa 3 con dobles no autoriza este plan. Solicitar autorización independiente antes de crear la base o modificar permisos/datos de cualquier base existente.
