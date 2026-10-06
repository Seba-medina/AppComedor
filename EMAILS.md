# Correos automáticos del comedor

**Remitente elegido: `comedorunerfcal@gmail.com`.** Ver `GMAIL.md` para la configuración actual, que no necesita dominio. Resend sigue disponible como alternativa futura.

## Estado

Implementación preparada; no se enviaron correos reales. No activar `EMAIL_JOBS_ENABLED` hasta completar las credenciales, las reglas y una prueba con un proyecto/cuentas de prueba. La conexión disponible a Vercel no autoriza consultar o modificar la configuración del equipo del proyecto: no se cargaron secretos ni se activó el servicio.

- Excel `.xlsx` solo a Sebastián y María Laura, los administradores de `domain.mjs`.
- Recordatorios para todos los perfiles registrados sin reserva, excepto administradores y quienes desactivaron `reminderEmails`. Los perfiles anteriores tienen recordatorios habilitados por defecto.
- No recuerda días sin habilitar, bloqueados, sábados ni domingos. Una reserva activa en cualquier turno o una cancelación expresa en la generación vigente evita el recordatorio. Reserva de generaciones anteriores no cuenta.
- Hora de Argentina: recordatorios de lunes a viernes entre 09:00 y antes de 10:00 para el mismo día; reporte a partir de 10:05. No acepta fecha, destinatario ni contenido externo: calcula el día en el servidor.
- Mi perfil permite desactivar y reactivar; el enlace firmado del correo abre una confirmación. Solo POST desactiva, para que los escáneres de enlaces no den de baja automáticamente.
- El proveedor recibe un correo individual por alumno; no se comparte una lista de destinatarios. Dos correos individuales con el mismo Excel para administradores.

## 1. Alternativa futura: remitente y Resend

Crear una cuenta de Resend, verificar un dominio propio con sus registros DNS y definir un remitente, por ejemplo `Comedor <reservas@DOMINIO-VERIFICADO>`. El dominio `vercel.app` y una dirección Gmail personal no se pueden usar como dominio remitente propio. El remitente de pruebas `onboarding@resend.dev` no sirve para enviar a todos los alumnos: tiene restricciones de destinatarios.

Crear una API key de envío limitada al dominio verificado. Revisar que el cupo diario/mensual alcance: un correo por alumno sin reserva, más dos reportes por día hábil. El volumen y el plan del proveedor se comprueban antes de activar; no se contrató ningún plan.

## 2. Firebase del servidor

Crear una cuenta de servicio dedicada en `appcomedor-6b4f7`, con permisos mínimos de lectura/escritura de Firestore (rol Cloud Datastore User), y generar una clave JSON. Guardar el JSON solamente como variable sensible de Production en Vercel. No subirlo a Git, Drive público, HTML ni archivos de la página, ni enviarlo por chat. El servidor comprueba el ID del proyecto.

Este servicio utiliza Admin SDK, que no usa las reglas del cliente: las rutas de envío exigen un secreto, calculan destinatarios internamente y nunca aceptan listas ni contenido arbitrario. Las colecciones `emailDeliveries`, `emailJobProgress` y `emailJobLocks` no admiten acceso desde la app, ni para administradores de la interfaz.

## 3. Variables de Production en Vercel

Para Gmail, seguir la tabla de `GMAIL.md`; `RESEND_API_KEY` y `EMAIL_FROM` de esta tabla solo aplican a Resend.

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | Clave secreta de envío de Resend |
| `EMAIL_FROM` | Remitente del dominio verificado |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON privado de la cuenta de servicio |
| `CRON_SECRET` | Secreto aleatorio de al menos 32 caracteres |
| `UNSUBSCRIBE_SECRET` | Otro secreto aleatorio de al menos 32 caracteres |
| `EMAIL_JOBS_ENABLED` | `false` durante preparación; `true` al activar |

Generar cada secreto por separado con `openssl rand -hex 32`. No rotar `UNSUBSCRIBE_SECRET` sin considerar los enlaces anteriores, que dejarán de ser válidos. Los secretos no deben ser variables públicas ni compartirse con previews. Volver a desplegar tras modificarlos.

Publicar el archivo `firestore.rules` completo: admite el booleano opcional `reminderEmails` sin bloquear los perfiles anteriores. Publicar también `firestore.indexes.json`: excluye de los índices el payload de correos, que puede contener el Excel. Ejemplo de CLI desde una cuenta autorizada: `firebase deploy --only firestore:rules,firestore:indexes --project appcomedor-6b4f7`.

## 4. Programación y volumen

`vercel.json` incluye dos disparadores diarios en UTC: 12:00 (09:00 Argentina) y 13:05 (10:05 Argentina). El servidor omite fines de semana. Vercel Hobby puede ejecutar dentro de la hora, no garantiza el minuto; tampoco reintenta automáticamente fallos. **No usar solo estos dos disparadores para una lista grande o cuando se necesite puntualidad y reintentos.**

Método recomendado para el comedor: un programador HTTPS que invoque `/api/cron/reminders` cada minuto entre 09:00 y 09:59 Argentina y `/api/cron/reservations` desde 10:05, con reintentos ante respuestas 500/503. Enviar `Authorization: Bearer <CRON_SECRET>` por cabecera, nunca por URL. Configurar timezone America/Argentina/Buenos_Aires, usar un timeout de 30 segundos y verificar los registros del programador.

Alternativa Vercel Pro, previa decisión sobre el plan: sustituir las dos expresiones de cron por `* 12 * * 1-5` y `5-59 13 * * 1-5`. No cambiar de plan ni contratar servicios automáticamente. El cron de Excel puede repetirse durante esa hora: el registro de envío evita duplicados.

Los recordatorios trabajan en lotes de unos 10 segundos antes de iniciar otro envío y guardan cursor por usuario. Un lote incompleto devuelve 200 con `more: true`; el programador debe ejecutar cada minuto; el siguiente continúa desde el cursor. Si solo se ejecuta una vez, puede quedar incompleto. Los alumnos añadidos antes del cursor durante el proceso o después de completarse la lista entran al siguiente día. Antes de cada envío se vuelve a comprobar baja, reserva, bloqueo y eliminación. Una reserva hecha al mismo instante en que el proveedor acepta el correo puede cruzarse con el aviso; no existe una transacción atómica entre Firestore y el proveedor.

Con el transporte Resend, la API usa una clave estable por día/tipo/destinatario y conserva el payload exacto del primer intento. Su idempotencia dura 24 horas. El registro de Firestore conserva el estado enviado; una ejecución ya completada no vuelve a enviar. Si el proveedor acepta y falla la escritura del estado, el reintento en la misma jornada reutiliza la misma clave y contenido. Errores de cupo/proveedor detienen el lote y requieren reintentos/atención del operador.

## 5. Verificación antes de activar en producción

En proyecto y cuentas de prueba, comprobar:

1. Que sin cabecera secreta ambas rutas respondan 401.
2. Que el alumno pueda guardar el check de Mi perfil y que el correo no salga cuando está desmarcado.
3. Que un alumno sin reserva reciba una sola notificación y otro con reserva no la reciba.
4. Que el enlace GET no dé de baja y su confirmación POST sí; un token modificado debe rechazarse.
5. Que ambos administradores reciban un Excel con Mediodía, Noche y Resumen; comparar cantidades con el panel.
6. Que repetir el job no genere otros correos y que un lote pendiente continúe desde su cursor.
7. Que los avisos se omitan después de las 10:00 y en días bloqueados/no habilitados.

Las pruebas locales del código simulan al proveedor: **no verifican entrega real**, reputación del remitente, DNS, bandeja de entrada ni credenciales de producción. No llamar a los endpoints de producción como "prueba" sin considerar que, una vez habilitados, envían a todos los destinatarios elegibles.

## Datos operativos y respaldo

El respaldo manual sigue incluyendo perfiles y su opción de correo. No exporta payloads ni enlaces privados de `emailDeliveries`: son datos operativos del servidor, con direcciones, contenido y enlaces de baja. El respaldo nativo de la base puede incluirlos. Conservar el registro de envíos al restaurar para evitar reenviar. El bloqueo de eliminación del perfil impide nuevos avisos mientras se borra; los registros previos del proveedor/servidor requieren limpieza separada según la política del comedor.

Documentación: https://resend.com/docs/api-reference/emails/send-email · https://resend.com/docs/dashboard/emails/idempotency-keys · https://vercel.com/docs/cron-jobs/manage-cron-jobs

Recordatorios: lunes a viernes, 09:00–09:59 Argentina, dirigidos a quienes no reservaron para hoy. Excel: lunes a viernes, 10:05–10:59, reservas del día.
