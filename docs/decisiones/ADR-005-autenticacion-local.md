# ADR 005 — autenticación local en memoria

Estado: implementado para revisión bajo autorización de etapa 2.

Se usa Argon2id nativo de Node 24.20.0, sin nuevas dependencias. Perfil y vector independiente comprobados; no se presupone compatibilidad con Node 24.0. Sesiones opacas con digest en memoria, CSRF, origen exacto, HTTPS loopback y repositorio institucional transaccional.

Se conserva la separación entre aplicación y migrador. No se crean cuentas ni se ejecuta autenticación real contra PostgreSQL. El runtime falla cerrado si no existe institución. Los futuros servicios de cambio de rol/estado deben invocar revocación al confirmar transacción; cambios externos se rechazan al siguiente uso de sesión.

Las sesiones y límites no sobreviven reinicios ni sirven para múltiples procesos. Evidencia, mediciones, pruebas y pendientes en [informe de etapa 2](../evidencias/fase-3-etapa-2-autenticacion.md).
