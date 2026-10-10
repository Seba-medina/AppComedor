# Revisión de seguridad — AppComedor

Fecha: 9 de octubre de 2026 (Argentina). Alcance: repositorio `Seba-medina/AppComedor`, reglas actuales y candidatas, dependencias de producción, API y salida estática. Esta revisión no sustituye una prueba de penetración ni acredita ajustes de consola que no se pudieron consultar.

## Cambios implementados

- Límites compartidos y transaccionales por UID verificado en las API de alumnos: 90 lecturas de preferencias en 5 minutos, 30 cambios de «No voy» en 5 minutos y 5 solicitudes de bienvenida en 10 minutos. Respuesta 429 y Retry-After. Un documento estable por UID/operación, sin guardar IP ni correo. Una IP compartida por la facultad no bloquea a todos sus alumnos.
- Las solicitudes sin token válido se rechazan antes de consultar el limitador. El límite no cubre llamadas directas a Firestore ni la carga previa de tráfico no autenticado: esas superficies necesitan App Check, cuotas y controles de plataforma.
- App Check preparado también para `/api/day-response` y `/api/welcome`: el cliente envía la atestación si está configurada y el servidor verifica firma, proyecto y aplicación esperada cuando `APP_CHECK_ENFORCED=true`. La verificación no se activa aún porque la site key sigue vacía. El estado desactivado conserva el acceso actual.
- GET de preferencias comprueba que el correo del perfil corresponda al token. Tokens con UID de tipo incorrecto y emails excesivos se rechazan.
- Reglas de menú ajustadas a `signedIn()`, también en la copia completa y la migración candidata. **Requieren publicación manual en Firebase**. Un despliegue de Vercel no publica reglas de Firestore.
- Override exacto `uuid@11.1.1`, compatible con las llamadas v4 revisadas en ExcelJS y librerías Google. Elimina el aviso GHSA-w5hq-g745-h8pq sin degradar ExcelJS ni cambiar de versión mayor Firebase Admin. La misma protección se prepara en `scripts/package.json`.
- Escáner de patrones de credenciales para el código y exclusión de certificados privados en Git. Nunca imprime valores encontrados. Los fixtures de pruebas quedan fuera y la configuración pública Firebase no se considera un secreto.
- GitHub Actions ejecuta auditoría de dependencias, búsqueda de secretos y pruebas en push/PR y semanalmente. No hace actualizaciones automáticas de dependencias.
- HSTS explícito, conservando el valor servido por Vercel. CSP, nosniff, anti-iframe y restricciones de funciones del navegador se mantienen.

## Los 20 puntos

| # | Pedido | Estado / implementación |
|---|---|---|
| 1 | Ocultar API keys | Credenciales Gmail/Admin/cron solo en servidor. La API key de Firebase identifica el proyecto y es pública; ocultarla no concede seguridad. Restricciones de APIs en Google Cloud pendientes de comprobar. |
| 2 | Eliminar secretos de Git | Escaneo por patrones de 49 commits y 200 blobs de código/documentación: sin hallazgos fuera de fixtures. Sin reescribir historial innecesariamente. No es garantía de ausencia de todo tipo de secreto. |
| 3 | Key pública para DB | Configuración pública Firebase para cliente; Admin SDK nunca se publica. No existe una anon key de SQL en esta arquitectura. |
| 4 | Row-Level Security | Equivalente: reglas Firestore por UID, propietario, rol y operación, con denegación final. Custom Claims preparada, pendiente de activar. |
| 5 | Encriptar datos sensibles | Firestore cifra en reposo; HTTPS/TLS en tránsito. No hay cifrado por campo ni de extremo a extremo. PDF, Excel y respaldos descargados contienen datos personales y necesitan almacenamiento privado. |
| 6 | Forzar autenticación | Interfaz exige Google verificado y perfil. APIs verifican el token. Menú antes accesible anónimamente: reglas corregidas, publicación pendiente. |
| 7 | Restringir acceso a registros | Propietario accede a su información; administradores tienen acceso operativo. Colecciones internas de correo/limitadores bloqueadas al navegador por denegación final. |
| 8 | Bloquear manipulación de campos | hasOnly, tipos, UID/email, campos inmutables, límite de 2 porciones, hora del servidor y generaciones al bloquear días. |
| 9 | Proteger session cookies | No hay cookie de sesión propia: Firebase Auth maneja tokens y persistencia. HTTPS y CSP reducen riesgos; no se puede afirmar HttpOnly para tokens accesibles al SDK. |
| 10 | Hashear contraseñas | No se recopilan contraseñas propias: Google autentica al usuario. Contraseña de aplicación Gmail solo en el servidor. |
| 11 | Rate limiting | Añadido por UID para nuevas APIs, más cuota de 200 nuevas bienvenidas/día y envío único por UID. No es protección general contra DDoS o escrituras directas Firestore. |
| 12 | Protección contra bots | App Check cliente+API preparada. Falta site key y enforcement Firestore/API. No habilitar exigencia sin probar primero tokens válidos. |
| 13 | Parametrizar queries | SDK Firestore con valores separados de consultas, sin SQL concatenado. No hay motor SQL. |
| 14 | Validar inputs | Validaciones de campos/tipos/longitudes del servidor y reglas. Origen contrastado cuando viene presente; autorización real por token, no por Origin. |
| 15 | Sanitizar contenido | Datos dinámicos escapados en HTML y correos; nombres como texto en Excel; neutralización de fórmulas en CSV. |
| 16 | Restringir archivos | Menús solo admin, JPG/PNG/WebP hasta 500 KB; reglas restringen data URI y tamaño. No permite SVG/HTML ni archivos ejecutables. No se hace análisis antivirus del archivo. |
| 17 | Devolver datos necesarios | APIs devuelven estado/días propios, nunca destinatarios arbitrarios ni credenciales. Admin tiene acceso a datos operativos. |
| 18 | Security headers | CSP, X-Frame-Options, nosniff, Permissions-Policy, Referrer-Policy, COOP y HSTS. CSP permite inline styles; no permite inline scripts. |
| 19 | Forzar HTTPS | Vercel/TLS y upgrade-insecure-requests; HSTS explícito. |
| 20 | Escanear dependencias | npm audit de producción: 9 avisos moderados antes, 0 después. Escaneo periódico en GitHub Actions. |

## Activaciones externas pendientes

1. Publicar **el archivo raíz `firestore.rules` completo** en Firebase → Firestore Database → Reglas. No publicar todavía `security/claims/firestore.rules`: primero asignar los roles y claims a ambos administradores con el procedimiento ADMIN-CLAIMS.md.
2. Completar la migración de los dos administradores a Custom Claims + registro protegido de UID. Hoy producción sigue usando emails verificados. No retirar acceso hasta comprobar los dos roles.
3. Crear/registrar reCAPTCHA Enterprise para el dominio real, completar `RECAPTCHA_ENTERPRISE_SITE_KEY`, desplegar y comprobar métricas de App Check. Después activar enforcement Firestore y `APP_CHECK_ENFORCED=true` en Vercel/redeploy para las API de alumnos.
4. Revisar APIs permitidas de la API key, dominios autorizados Auth, permisos IAM de la cuenta de servidor, verificación en dos pasos de ambos administradores y alertas/cuotas de uso. No copiar claves privadas a Git ni al chat. No ampliar el IAM del emisor de correos para ejecutar la migración.
5. La validación estándar de ID token no consulta revocación/deshabilitación inmediata de Auth. No se cambió a `verifyIdToken(token,true)` sin comprobar IAM para no romper correos y API; Firestore mantiene sus controles propios y bloqueo de cuenta de la app.

## Evidencia y límites

- npm audit de dependencias de producción: cero vulnerabilidades detectadas tras la actualización.
- Escaneo de secretos por patrones: sin hallazgos en 49 commits / 200 blobs revisados, excluyendo fixtures. No se encontraron credenciales que exigieran rotación o limpieza de historial.
- 48 pruebas unitarias pasaron; interfaz actual y candidata a Custom Claims comprobadas con SDK simulado. Reglas actuales y candidata probadas en emulador. Transacciones reales del emulador comprobaron cancelación de ambos turnos, límite de bienvenida y envío único.
- Las pruebas de servidor usan tokens y SMTP simulados; no se mandan correos reales durante esta revisión.
- Las pruebas de Firestore se ejecutan en emulador, no escriben datos de alumnos en producción.
- La configuración efectiva de Firebase/Vercel, las cookies externas de Google y el IAM no se verifican leyendo el repositorio. Los pendientes de consola no deben presentarse como completados.
- Estas medidas no garantizan que el sitio sea invulnerable o que nunca pueda tener sobrecarga.

Referencias oficiales: https://firebase.google.com/support/guides/security-checklist · https://firebase.google.com/docs/projects/api-keys · https://firebase.google.com/docs/firestore/cmek · https://firebase.google.com/docs/app-check/custom-resource-backend · https://github.com/advisories/GHSA-w5hq-g745-h8pq
