# Documento rector — inicio del desarrollo con Codex

**Proyecto:** Sistema automatizado de registro de asistencia mediante reconocimiento facial y arquitectura Offline-First (PWA/IndexedDB) para colegios privados en Guatemala.  
**Etapa:** Proyecto de Graduación II / Capítulo V, propuesta técnica.  
**Revisión tecnológica:** 16-10-2026.  
**Estado:** decisiones de diseño preliminares; no se han ejecutado pruebas de inferencia en dispositivos.

## 1. Qué proviene de `propuesta_original.docx`

El archivo original define el título y contexto en colegios privados guatemaltecos (Guatemala, Sacatepéquez, Quetzaltenango). Describe un conjunto de tareas para **redactar** el Capítulo V y exige: (5.1) seis capas técnicas; (5.2) PostgreSQL/IndexedDB; (5.3) tres interfaces; (5.4) reconocimiento facial; (5.5) sincronización offline; (5.6) seguridad biométrica; (5.7) despliegue e implementación.

**Advertencia sobre la fuente:** el DOCX original contiene un encargo de redacción, no un Capítulo V desarrollado, ni código, ni experimentos que demuestren precisión o rendimiento.

## 2. Decisión técnica recomendada

Desarrollar una PWA que procese rostros **localmente** en el dispositivo previamente autorizado; guarde eventos de asistencia pendientes en IndexedDB; y sincronice en forma segura, idempotente y auditable con una API institucional al reconectar. El trabajo debe ejecutarse en etapas con una *puerta de viabilidad* de biometría antes de incorporar datos reales de menores.

### Elementos seleccionados para comenzar
- **React + Vite + TypeScript** para frontend.
- **IndexedDB + Dexie.js** para persistencia de datos del dispositivo.
- **vite-plugin-pwa + Workbox** para aplicación instalable y gestión del caché.
- **Node.js + Express + TypeScript** para API REST.
- **PostgreSQL + Prisma** para datos centrales y migraciones.
- **ONNX Runtime Web** como primer motor a probar localmente en navegador, con CPU/WASM como base y WebGPU solo cuando el entorno lo soporte.
- **YuNet (detección) + SFace (reconocimiento)** como modelos candidatos; **no** declararlos definitivos hasta validar preprocesamiento, latencia, exactitud y licencias.

### Elementos rechazados o condicionados
- **`harmanrodee/OpenFaceUnlock v0.9.5`: descartado como dependencia web directa.** Proyecto nativo de inicio de sesión en Windows (C++/C#), no SDK web React.
- **`Background Sync API`: auxiliar**, no núcleo del mecanismo offline, por compatibilidad limitada.
- **Umbral “≥95 %”:** no es especificación suficiente de exactitud; calibrar según FMR/FNMR y escenarios reales.
- **BYOD sin controles:** no permitido; requerir dispositivo autorizado, mínimo privilegio, políticas de expiración y revocación.
- **Hospedaje comercial específico:** diferido; primero infraestructura local y ensayo de seguridad, después comparar servicios.

## 3. Límites del MVP

INCLUIDO: administración institucional mínima; matrícula/grupos; consentimiento y vía manual; pruebas de enrolamiento; reconocimiento local bajo condiciones controladas; registro offline; cola y sincronización; dashboard básico; bitácora; pruebas documentadas.

FUERA del primer MVP: control de puertas/torniquetes, vigilancia continua, detección masiva de personas a distancia, identificación de personas no matriculadas, seguimiento entre colegios, informes predictivos, despliegue en producción con biometría de menores.

## 4. Secuencia de trabajo

1. **FASE 0:** documentación, estructura, contratos, configuración de repositorio y entorno seguro.
2. **FASE 1:** prueba de viabilidad de webcam/PWA/modelos ONNX en navegadores y dispositivo Android real, con datos no sensibles.
3. **FASE 2:** API, PostgreSQL, autenticación, grupos y estudiantes ficticios.
4. **FASE 3:** enrolamiento experimental y asistencia, con confirmación humana y alternativa manual.
5. **FASE 4:** cacheado, modo offline y sincronización robusta.
6. **FASE 5:** privacidad, permisos, pruebas, evaluación académica y piloto autorizado.

La FASE 0 no debe implementar todo el sistema ni seleccionar como definitivo un modelo no probado. Cada fase termina con un reporte de pruebas y decisiones.

## 5. Fuente de la verdad

Si el requerimiento original y una recomendación difieren, registrar ambos en `01_REQUISITOS_Y_TRAZABILIDAD.md`. Los documentos técnicos pueden proponer cambios, pero no declarar alterado el proyecto académico hasta autorización del responsable.
