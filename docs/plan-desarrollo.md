# Plan de desarrollo

Cada fase exige evidencia revisable y aprobación explícita antes de comenzar
la siguiente. Completar documentos no autoriza desarrollo posterior ni despliegue.

## Conciliación del orden de fases

El responsable eligió la secuencia de [07_ROADMAP.md](07_ROADMAP.md): viabilidad biométrica primero. Posteriormente autorizó explícitamente Fase 1, sin autorizar Fase 2. Se mantienen los siguientes criterios complementarios:

| Fase | Alcance | Evidencia de aceptación |
| --- | --- | --- |
| 0 | Preparación y contratos | Fuentes leídas, diferencias documentadas, estructura y configuración sin secretos; contratos borrador revisables |
| 1 | Viabilidad biométrica | POC-01 a POC-08 de `06_PLAN_DE_PRUEBAS.md`, evidencia de escritorio y Android real, permisos y recarga offline, informe Go/No-Go; sin menores |
| 2 | Núcleo servidor | API con validación, autorización por institución/grupo, migraciones y datos ficticios; pruebas Supertest y PostgreSQL aislado |
| 3 | Flujo de asistencia | Enrolamiento experimental permitido, confirmación humana, vía manual equivalente y auditoría; pruebas de interfaz |
| 4 | Offline y sincronización | OFF-01 a OFF-07; idempotencia ante ACK perdido, concurrencia y reinicio, conflictos visibles y actualización con cola pendiente |
| 5 | Validación y piloto | SEC-01 a SEC-03, métricas y límites documentados; piloto sujeto a aprobación específica, sin habilitar biometría de menores en este prototipo |

Los presupuestos de rendimiento y criterios cuantitativos de Go/No-Go deben
definirse antes del ensayo decisorio; medir latencia sin criterio no valida
viabilidad. La referencia a 48 h en OFF-05 es un escenario de ensayo, no una
vigencia offline aprobada. El plan previo de base técnica/manual antes de biometría queda sustituido por decisión explícita del responsable.

## Estrategia de pruebas

En Fase 0 solo se revisan estructura, documentación, manifiestos y exclusiones.
No se crean pruebas vacías ni se declara que hay suites aprobadas.
Vitest cubrirá lógica y estados; Supertest el contrato HTTP; las garantías de
unicidad requerirán PostgreSQL real de prueba. Playwright cubrirá los flujos del
navegador y offline con recursos previamente descargados.

Las pruebas nunca apuntarán a bases productivas. Se usarán fixtures ficticios
reproducibles y bases aisladas. Las pruebas de reconocimiento se separarán de
las pruebas funcionales. Quedan por acordar los límites de latencia, volumen,
duración offline y tasas de error; no se inventan metas académicas como aprobadas.

## Riesgos y validación propuesta

| Riesgo | Consecuencia | Mitigación o experimento |
| --- | --- | --- |
| ONNX incompatible o lento en navegador | Bloqueo o experiencia inutilizable | Probar modelos concretos, WASM y aceleración disponible en dispositivos objetivo; mantener vía manual |
| Variación de iluminación, pose o población | Falsos rechazos o coincidencias | Protocolo separado de calibración y evaluación; reportar límites sin extrapolar a menores |
| Foto o video usado para suplantar | Asistencia incorrecta | Evaluar amenaza y supervisión; no declarar prueba de vida implementada |
| IndexedDB eliminado o cuota agotada | Pérdida de eventos no sincronizados | Manejo explícito de errores, estado pendiente y procedimiento de recuperación acordado |
| Reintentos y terminales concurrentes | Duplicación de asistencia | Identificador estable, restricciones transaccionales y pruebas de carrera |
| Reloj incorrecto y reglas ambiguas | Jornada o puntualidad incorrectas | Sesiones explícitas, hora de recepción y conciliación; aprobar reglas escolares |
| Actualización de PWA o esquema local | Cliente incompatible o pérdida de cola | Versionar contratos y migraciones; probar actualización con registros pendientes |
| Permisos offline revocados | Uso de acceso desactualizado | Definir vigencia local y revalidación en servidor; conflictos visibles |
| Exposición de biometría o datos escolares | Afectación de privacidad | Minimización, datos ficticios, control de acceso y política de retención previa al piloto |
| Licencias o datos de evaluación insuficientes | Experimento no reproducible | Revisar procedencia y permisos antes de descargar o usar modelos y muestras |

## Decisiones necesarias para aprobar Fase 1

1. Obtener aprobación académica del cambio de motor y métricas; la propuesta ya fue leída.
2. Acordar dispositivos y navegadores objetivo y escala aproximada del colegio.
3. Confirmar monorepo con npm workspaces y selección de versiones en Fase 1.

Antes de fases de dominio y biometría deben resolverse reglas de marcación,
roles, duración offline, retención, modalidad 1:1 o 1:N, datos autorizados y
criterios cuantitativos. No todas estas decisiones bloquean la preparación actual.
