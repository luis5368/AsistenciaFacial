# Seguridad, protección biométrica y menores — propuesta de control (5.6)

**Advertencia:** es una propuesta técnica, NO dictamen legal ni certificación de cumplimiento.

## Principios obligatorios

- Consentimiento informado verificable y revocable de la persona representante antes del enrolamiento biométrico, con alternativa manual sin perjuicio para el estudiante.
- Finalidad estricta de **asistencia**; prohibido reutilizar datos para vigilancia, analítica de conducta o reconocimiento fuera del centro.
- Minimización: procesar imágenes en memoria; conservar embeddings únicamente cuando se justifique y bajo consentimiento. Las plantillas no son datos anónimos.
- Acceso por institución, grupo, rol y dispositivo; registrar accesos privilegiados y modificaciones, sin registrar embeddings en logs.
- Prohibir usar datos reales de menores en desarrollo y demo sin autorizaciones institucionales/legales documentadas.

## Cifrado y manejo de claves

- Proponer **AES-256-GCM** para datos biométricos en reposo, siempre que el diseño de claves y las APIs disponibles lo permitan; claves no embebidas en fuente ni `.env` del frontend.
- Backend: claves protegidas mediante sistema de gestión adecuado (KMS o alternativa institucional revisada), política de rotación, copias de seguridad cifradas y separación de responsabilidades.
- Frontend: considerar seriamente límites del cifrado en BYOD. Si el dispositivo expone sesión/desbloqueo o ejecución de scripts maliciosos, la información descifrada puede ser atacada; documentar modelo de amenazas y caducidad.
- HTTPS obligatorio en producción; exigir TLS 1.3 cuando el entorno lo soporte y sin degradar la seguridad. Cámara y Web Crypto requieren contexto seguro; localhost válido en desarrollo para cámara.
- Protección de API contra acceso horizontal entre colegios, inyección, XSS, CSRF cuando aplique, rate limits y filtrado de datos por `institution_id` impuesto en servidor.

## Retención, revocación y eliminación

- Definir junto con institución/asesoría legal: períodos de vigencia del consentimiento, caducidad de plantillas, egreso del estudiante, backups y trazabilidad de borrado.
- Revocación: deshabilitar nuevas comparaciones inmediatamente en servidor; los dispositivos offline poseen una ventana hasta expiración/reconexión — reducirla por política.
- Al eliminar perfil, invalidar plantilla central y emitir revocación a caches autorizadas; conservar registros mínimos de auditoría sin embedding cuando corresponda.
- Registrar fecha/actor/motivo de cambios; no mantener imagen cruda “por si acaso”.

## Marco legal a revisar (Guatemala)

- **Decreto 27-2003:** Ley de Protección Integral de la Niñez y Adolescencia. Texto/referencia del Congreso: https://www.congreso.gob.gt/detalle_pdf/decretos/220
- **Decreto 57-2008:** Ley de Acceso a la Información Pública, que incluye disposiciones de habeas data para sujetos obligados: https://www.congreso.gob.gt/detalle_pdf/decretos/13082
- **Iniciativa 6464** sobre protección de datos personales: el Congreso reportó debate en julio de 2026; **una iniciativa no debe tratarse como ley vigente** sin comprobar su estado parlamentario actual: https://www.congreso.gob.gt/noticias_congreso/16492/2026/3

La extensión aplicable a un colegio **privado** y el régimen exacto de consentimiento/biometría requieren asesoría jurídica local. No afirmar automáticamente “cumple con la ley” por incluir TLS y AES.

## Controles previos a piloto con estudiantes

- [ ] Aprobación institucional y de la investigación.
- [ ] Evaluación de necesidad y proporcionalidad; considerar si identificación biométrica es indispensable.
- [ ] Consentimiento y alternativa equivalente manual.
- [ ] Avisos transparentes, respuesta a solicitudes de retiro y medidas contra discriminación.
- [ ] Evaluación de seguridad de dispositivos y claves; plan ante pérdida/robo.
- [ ] Pruebas de FMR/FNMR, grupos y condiciones de iluminación; análisis de falsos positivos.
- [ ] Política de retención, transferencia de datos, soporte y backups.
- [ ] Revisión legal y ética independiente antes de recolectar datos de menores.
