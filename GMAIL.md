# Activar correos desde Gmail

Remitente fijo: `comedorunerfcal@gmail.com`. Preparado y probado con proveedor simulado; no se cargaron credenciales ni se enviaron correos reales. Los destinatarios del Excel siguen siendo los dos administradores, no la cuenta remitente.

## Paso 1: contraseña de aplicación

Entrar en Google con esta cuenta. En Seguridad activar Verificación en dos pasos. Después abrir https://myaccount.google.com/apppasswords y crear una contraseña de aplicación llamada `Comedor Vercel`. Esta opción puede no aparecer en cuentas restringidas o con Protección Avanzada. Si no aparece, revisar la configuración de la cuenta o usar OAuth2; no usar la contraseña normal.

No enviar la contraseña por chat ni subirla al repositorio. Se carga directamente como variable sensible de Production en Vercel. Google suele mostrarla en grupos de cuatro caracteres: el código elimina los espacios.

## Paso 2: variables en Vercel

Proyecto `appcomedoruner` → Settings → Environment Variables → Production.

| Variable | Valor |
|---|---|
| `EMAIL_TRANSPORT` | `gmail` |
| `GMAIL_USER` | `comedorunerfcal@gmail.com` |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación de 16 caracteres |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON privado de cuenta de servicio del proyecto `appcomedor-6b4f7` |
| `CRON_SECRET` | Secreto aleatorio de al menos 32 caracteres |
| `UNSUBSCRIBE_SECRET` | Otro secreto aleatorio de al menos 32 caracteres |
| `EMAIL_JOBS_ENABLED` | `false` hasta completar las pruebas; `true` para activar |

No hace falta `RESEND_API_KEY` ni `EMAIL_FROM`. El remitente se fija en el servidor y no puede sustituirse por datos de una solicitud. El acceso SMTP usa TLS y los adjuntos se generan en memoria.

La cuenta de servicio Firebase debe tener permisos mínimos de Firestore y se guarda solo en Vercel. Ver `EMAILS.md`, paso 2. No enviar el JSON por chat. Las reglas completas publicadas deben incluir `reminderEmails`. Después de cargar las variables, redeploy del proyecto.

## Paso 3: programación con reintentos

Para menos de 200 alumnos sigue siendo necesario procesar más de un lote cuando haya muchos avisos. Vercel Hobby solo tiene los dos disparadores diarios configurados: pueden ejecutarse dentro de la hora y no reintentan automáticamente. No alcanza para garantizar un lote de 200 alumnos.

Configurar un programador HTTPS que ejecute GET de `/api/cron/reminders` cada minuto entre las 09:00 y las 09:59 de lunes a viernes, hora Argentina, y `/api/cron/reservations` desde las 10:05 con reintentos. Enviar la cabecera `Authorization: Bearer <CRON_SECRET>` y no poner el secreto en la URL. Alternativamente, usar las expresiones de cron para Vercel Pro descritas en `EMAILS.md`, previa decisión sobre el plan. No se creó ni contrató un programador externo.

Comprobar en sus registros que los lotes terminaron. Los endpoints devuelven 503 si faltan credenciales o queda un lote pendiente; 500 ante un error de envío; 401 sin autorización. Los mensajes aceptados no vuelven a enviarse. Cada lote guarda el cursor de los alumnos procesados.

## Paso 4: comprobación sin correos

Una vez guardadas las siete variables, con EMAIL_JOBS_ENABLED=false, el nuevo despliegue permite comprobar las credenciales desde `/api/email-check`. Requiere la cabecera secreta; no enviar CRON_SECRET por chat ni por URL. Comprueba lectura/escritura/borrado de un documento temporal, sin consultar alumnos, y verifica autenticación SMTP sin enviar correos. SMTP verify no comprueba la entrega en bandeja ni la aceptación de un mensaje específico.

En PowerShell:

```powershell
$claveComedor = Read-Host "Pegá CRON_SECRET (entrada oculta)" -AsSecureString
$tokenComedor = [System.Net.NetworkCredential]::new("", $claveComedor).Password
try {
    Invoke-RestMethod -Uri "https://appomedoruner.vercel.app/api/email-check" -Headers @{Authorization="Bearer $tokenComedor"} | ConvertTo-Json
} finally {
    Remove-Variable claveComedor, tokenComedor -ErrorAction SilentlyContinue
}
```

El resultado debe tener ok=true, configuration=ok, firebase=ok, gmail=ok, enabled=false. Se puede compartir ese resultado: no contiene secretos. Si configuration es missing_or_invalid, revisar nombres/valores y desplegar de nuevo. firebase=permission_denied indica revisar el rol de la cuenta de servicio; gmail=authentication_failed indica revisar la contraseña de aplicación/cuenta. Las conexiones fallidas requieren revisar los registros y el acceso del servidor.

## Paso 5: prueba y activación

Las pruebas locales usan Gmail simulado, no verifican el acceso desde Vercel ni la llegada a la bandeja de entrada. Verificar primero con un proyecto y cuentas de prueba. No invocar el job de producción para hacer una prueba sin considerar que enviará a todos los alumnos elegibles cuando esté habilitado.

Verificar un Excel recibido por ambos administradores, un recordatorio, el enlace de baja y la exclusión de un alumno con reserva. Después activar `EMAIL_JOBS_ENABLED=true`, redeploy y comprobar el programador durante el piloto. El Excel es una foto del estado al generarse: cambios posteriores se consultan en el panel.

## Límites y fallos

Una cuenta Gmail personal tiene límites de envío. Menos de 200 perfiles más dos reportes diarios queda por debajo del límite publicado de 500 mensajes, pero Google puede restringir antes una cuenta nueva o actividad que considere inusual. No garantiza entrega ni llegada a la bandeja principal. Revisar la cuenta de Gmail y los registros durante el piloto.

SMTP no tiene la idempotencia de Resend. Antes de enviar, el registro cambia a `sending`; cuando Gmail confirma pasa a `sent`. Si se corta la conexión o falla la escritura tras la aceptación, queda `uncertain` o `sending`. **No se reenvía automáticamente en esos estados**, para evitar duplicados. El operador revisa Enviados de Gmail y el registro `emailDeliveries` antes de decidir qué hacer. No cambiar masivamente registros a `pending` ni borrar la colección. Un fallo de autenticación conocido (`EAUTH`) permite reintentar después de corregir la configuración, porque no se llegó a enviar.

El Message-ID estable sirve para rastrear, no garantiza que Gmail elimine duplicados. No hay garantía de envío exactamente una vez con SMTP. La política favorece evitar duplicados frente a reenviar un resultado incierto.

Si Google revoca la contraseña de aplicación al cambiar la contraseña de la cuenta, crear otra y reemplazarla en Vercel. Mantener la verificación en dos pasos y controlar quién tiene acceso a la cuenta del comedor.

Documentación: https://support.google.com/accounts/answer/185833 · https://support.google.com/mail/answer/22839 · https://nodemailer.com/guides/using-gmail
