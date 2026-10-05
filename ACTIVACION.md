# Activación final · Comedor

## Estado de este cambio

La página incorpora semanas administrativas independientes, buscador, resumen mensual con descarga CSV para Excel, registro de acciones administrativas, privacidad y datos de asistencia. Los alumnos siguen viendo la semana actual. No se efectuaron reservas, cancelaciones ni eliminaciones de producción durante las pruebas.

La función Mi semana habitual también está incluida: configurar turnos y porciones de cada día una vez; luego Usar mi semana y Guardar reserva semanal. No crea reservas sin el segundo clic.

Hay tres pasos externos pendientes. GitHub/Vercel no publica las reglas de Firebase ni activa App Check o el respaldo nativo.

## 1. Reglas

Copiar `firestore.rules` completo en Firebase → Firestore Database → Reglas → Publicar. Incluye `auditLogs` y el nuevo campo `schedule` de `reservationPreferences`. Las configuraciones anteriores se leen y convierten sin perder sus días y porciones; para guardar la configuración por día hay que publicar estas reglas. Los cambios administrativos se guardan junto con su registro en una misma escritura atómica; con reglas anteriores, Firebase rechazará ambas cosas. También se puede ejecutar `firebase deploy --only firestore:rules --project appcomedor-6b4f7` desde una cuenta autorizada.

## 2. Respaldo automático diario

Se usará el respaldo nativo de Firestore: copia consistente de la base y sus índices, incluso con la página cerrada. Frecuencia diaria, conservación propuesta de 14 días. Requiere plan Blaze y genera cargos de almacenamiento/restauración: revisar el plan y presupuesto en la consola antes de habilitarlo. No se activó ni modificó la facturación desde este trabajo.

Método visual: Google Cloud → Firestore → Databases → `(default)` → Scheduled backups / Disaster recovery → Daily → retención 14 días → Save. Comprobar después que exista al menos una copia finalizada.

Método CLI, desde una computadora autorizada con Node.js:

```sh
npm install -g firebase-tools
firebase login
node scripts/configure-backups.mjs
# Si no existe una programación diaria y el proyecto tiene el plan requerido:
node scripts/configure-backups.mjs --apply
```

El script consulta primero y no borra ni modifica programaciones existentes. Si ya hay una diaria, usarla o revisar su retención en la consola, sin volver a crearla. La hora la administra Firestore; no se promete una hora exacta.

Recuperación: el respaldo nativo se restaura a una base nueva desde la consola; verificar datos antes de migrar a producción. No se abre con el restaurador JSON de esta app. El botón Descargar respaldo sigue generando JSON para recuperar documentos faltantes con `scripts/restore-backup.mjs`.

Documentación: https://firebase.google.com/docs/firestore/backups

## 3. App Check

La integración cliente ya existe, pero la clave pública en `app-check-config.js` sigue vacía. No se activó la exigencia de validación.

1. Crear/seleccionar una clave web de reCAPTCHA Enterprise para `appomedoruner.vercel.app` en el proyecto `appcomedor-6b4f7`. Revisar las condiciones del servicio en la consola.
2. En Firebase → App Check → Apps, registrar la aplicación web con esa misma clave.
3. Colocar la clave pública (no una clave privada) en `RECAPTCHA_ENTERPRISE_SITE_KEY` dentro de `app-check-config.js` y publicar GitHub/Vercel.
4. Entrar con un alumno y un administrador, verificar login, reservas, asistencia, resumen y respaldo. Comprobar solicitudes válidas en las métricas de App Check.
5. Solo después, activar enforcement para Firestore. Si se exige antes de publicar la clave y verificar tokens, se bloquearán usuarios legítimos.

Documentación: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider

## Prueba piloto

- Preparar próxima semana y confirmar que el alumno sigue viendo la actual.
- Reservar con una cuenta de prueba, editar y cancelar antes de las 10:00.
- Marcar asistencia en ambos turnos y comprobar que suma un solo día.
- Consultar una semana anterior y descargar su PDF.
- Generar resumen mensual y revisar CSV contra reservas/asistencias reales.
- Ver el historial administrativo y descargar un respaldo JSON.
- Verificar la primera copia automática antes de dar por terminado el punto de respaldos.

## Alcance del historial

El historial registra acciones realizadas desde este panel, con el correo del administrador y hora del servidor. Las escrituras administrativas normales y su registro son atómicas. Se conserva el registro de cada usuario eliminado; los lotes de limpieza previos pueden haberse completado parcialmente si hubo un error. No reconstruye el pasado ni registra acciones hechas directamente con Firebase Console o Admin SDK. Las reglas impiden que el cliente altere o borre un registro, pero esto no constituye una auditoría externa de toda la infraestructura.
