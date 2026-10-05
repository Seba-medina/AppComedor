# Copias y recuperación del comedor

## Descargar una copia

En el panel de administrador, pulsar **Descargar respaldo**. Guardar el JSON en una carpeta privada, fuera del repositorio. Contiene datos personales. Hacer una copia al finalizar cada jornada y antes de eliminar usuarios o modalidades. Conservar varias fechas para recuperar errores descubiertos después.

Incluye todos los documentos de `users`, `days`, `modalities`, `menus`, `reservations`, `attendance` y `userActivity`, de todas las semanas. Conserva IDs y fechas Firestore con nanosegundos. No incluye Firebase Authentication, reglas, índices ni bloqueos temporales de eliminación. El código, las reglas y los índices están en GitHub.

Es una copia manual: todavía no hay respaldos programados. Necesita conexión y lectura autorizada del servidor; ante un error no descarga un archivo parcial. Las colecciones se consultan por separado: conviene descargarla cuando no se estén haciendo cambios importantes. No es una instantánea transaccional de toda la base.

## Recuperar información

La herramienta es para Sebastián, desde su computadora; no utiliza una clave privada en la página. Requiere Node.js y credenciales autorizadas del proyecto para Firebase Admin. Preparar las credenciales siguiendo la documentación oficial: https://firebase.google.com/docs/admin/setup . No compartirlas, subirlas a GitHub ni incluirlas en el respaldo.

1. Clonar o descargar el repositorio. Desde su carpeta, ejecutar `npm install --prefix scripts`.
2. Configurar `GOOGLE_APPLICATION_CREDENTIALS` con la ruta local de las credenciales del proyecto. Usar primero un emulador o proyecto de prueba para practicar la recuperación.
3. Simular sin escribir: `node scripts/restore-backup.mjs RUTA_AL_RESPALDO.json`.
4. Para una persona: `node scripts/restore-backup.mjs RUTA_AL_RESPALDO.json --uid UID_DEL_ALUMNO`.
5. Revisar el resultado. Cuando corresponda recuperar, repetir el mismo comando agregando `--apply`.

Solo se crean documentos faltantes; nunca se sobrescriben datos que ya existen. Cada creación usa una transacción para proteger información recreada mientras corre la recuperación. `--uid` limita la recuperación al perfil, reservas, asistencias y última conexión de esa persona. La operación puede ser parcial si se corta la conexión; es seguro repetirla porque omite lo ya recuperado.

No ejecutar en producción para practicar. Si se borró la cuenta de acceso en Authentication, ese acceso debe resolverse por separado. Recuperar un documento faltante no deshace cambios posteriores en documentos existentes, bloqueos de días ni cancelaciones. Para corregir modificaciones existentes se necesita una recuperación puntual revisada por el responsable.

## Comprobación después de recuperar

Entrar con una cuenta de prueba afectada, comprobar su perfil e historial, y comparar los totales y el PDF del día con la copia. No restablecer días bloqueados para forzar reservas antiguas a quedar activas.

Los respaldos nuevos usan formato v2 e incluyen asistencias y actividad. Los archivos v1 anteriores siguen siendo recuperables, pero no contienen estos registros.

Formato v3: incluye auditLogs. La recuperación mantiene compatibilidad con v1 y v2. El respaldo nativo diario es una opción separada: ver ACTIVACION.md; no quedó activado automáticamente y requiere acceso al proyecto y plan Blaze.

Formato v4: agrega reservationPreferences (configuración habitual de días y porciones). La recuperación individual y la eliminación del usuario incluyen esta configuración.
