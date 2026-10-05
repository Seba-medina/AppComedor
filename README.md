# AppComedor — Firebase

Aplicación HTML/CSS/JavaScript publicada desde la rama main en Vercel.
Firebase Auth (Google) y Firestore guardan perfiles, reservas, días, modalidades y menú.
No se importan las reservas ficticias ni el almacenamiento local de la demo.

## Activación en Firebase Console

1. Proyecto: appcomedor-6b4f7.
2. Authentication: habilitar Google y autorizar appomedoruner.vercel.app.
3. Firestore → Reglas: reemplazar el contenido por el archivo firestore.rules y publicar.
4. Abrir la web e iniciar sesión con sebastianezequielmedina@gmail.com.
5. Guardar el perfil, abrir Panel del comedor, habilitar la semana actual.
6. Cargar la imagen del menú y bloquear fechas sin servicio.
7. Probar una cuenta de alumno: solo debe consultar su perfil y reservas.

Mientras no se publiquen las reglas, el login puede funcionar pero la base rechazará lecturas y escrituras. El código no despliega las reglas automáticamente.

## Roles y seguridad

El administrador inicial se reconoce por email verificado y proveedor Google, tanto en la interfaz como en reglas. Cambiar el perfil no cambia permisos. Para agregar un administrador institucional hay que actualizar ADMIN_EMAILS en domain.mjs y admin() en firestore.rules; conviene migrar luego a roles por UID o custom claims.

Los alumnos consultan sus reservas mediante una consulta por uid. La base rechaza lecturas de terceros, roles inventados en perfiles, reservas duplicadas, más de 2 porciones por día entre ambos turnos, modalidades inexistentes/desactivadas, días bloqueados y reservas desde las 10:00 de Argentina. La validación usa request.time del servidor.

## Bloqueo y cancelaciones

days/{YYYY-MM-DD} contiene una generación que aumenta al bloquear. Cada reserva guarda esa generación, y su clave incluye uid, fecha, turno y generación. Una reserva es activa solo si su generación coincide con el día, no está bloqueado y no fue dada de baja.

El cambio del día invalida todas las reservas de ambos turnos en una sola transacción. El desbloqueo conserva la generación: las reservas antiguas siguen canceladas. Reservar nuevamente crea documentos distintos y preserva el historial. No hay un estado de cancelación escrito masivamente en cada documento: el estado operativo se calcula con el día. Cualquier exportación o informe futuro debe usar la misma regla.

Las bajas solicitadas por WhatsApp se aplican desde el panel por reserva. Una reserva dada de baja no puede reactivarse desde el alumno.

## Menú sin Firebase Storage

Para esta primera versión, una imagen semanal de hasta 500 KB se guarda en el documento menus/{lunes}, como data URL. Este límite mantiene el documento por debajo de 1 MiB y permite empezar sin Storage ni configuración de Cloudinary. Para imágenes grandes o más volumen se debe migrar a almacenamiento de archivos y conservar solo la URL en Firestore.

firestore.indexes.json excluye image de los índices. Si se utiliza Firebase CLI, firebase deploy --only firestore despliega reglas e índices con una cuenta autorizada. En Console también se puede crear una excepción de indexación para menus.image.

## Pruebas

    node --test tests/domain.test.mjs

Para las pruebas de reglas, instalar las dependencias de tests/package.json (npm install --prefix tests) y ejecutar con Java 21 o superior y Firebase CLI disponible:

    firebase emulators:exec --only firestore --project demo-appcomedor "node tests/rules.cjs"

No apuntar estas pruebas al proyecto real. Se probaron autenticación, restricciones de acceso, perfiles, ambos turnos, duplicados, hora del servidor, bloqueo/desbloqueo, conservación del historial, modalidades, permisos del menú y una reserva semanal de diez turnos en una operación. La UI se comprobó con JSDOM y un SDK simulado (tests/ui.cjs): roles, preferencias, ambos turnos, guardado y actualización de cancelaciones. Falta la prueba completa en producción con cuentas reales, después de publicar las reglas.

Referencias oficiales:
- https://firebase.google.com/docs/web/alt-setup
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/security/test-rules-emulator

## Revisión de seguridad

Ver SECURITY.md para cambios, pruebas, límites conocidos y activación pendiente de App Check.

Los usuarios pueden cancelar cada turno desde Mis reservas antes de las 10:00 (Argentina). Se conserva el historial y se descuentan las porciones. Una cancelación no puede revertirse desde la cuenta del alumno. Publicar las reglas de Firestore actualizadas para habilitar esta operación.

## Respaldo de datos

El panel administrador permite descargar un respaldo JSON de todos los perfiles, días, modalidades, menús y reservas de todas las semanas. Lecturas directas del servidor; no se genera una copia parcial ante errores. Ver `BACKUPS.md` para guardar las copias y recuperar documentos faltantes con simulación previa. La recuperación requiere credenciales del responsable en su computadora; nunca en la página.

## Asistencias y última conexión

El administrador marca Asistió este día en el listado diario. Una persona suma un solo día aunque vaya a ambos turnos; desmarcar corrige el registro. Solo se admiten fechas de hoy o anteriores. Usuarios registrados muestra el total histórico de días marcados y la última apertura de la app con sesión iniciada (hora Argentina). No es un indicador de conexión en tiempo real ni reconstruye accesos o asistencias anteriores a su activación. Requiere publicar las reglas actualizadas de `attendance` y `userActivity`. Los respaldos v2 incluyen ambos registros y eliminar un usuario también los elimina.

## Gestión completa

El administrador navega entre semanas sin alterar la semana del alumno; prepara días, menú y modalidades de la semana elegida, consulta reservas y PDF anteriores. Usuarios permite buscar por nombre/correo y filtrar condición/rol. El resumen mensual cuenta reservas vigentes, porciones solicitadas y asistencias diarias explícitas, exportable como CSV para Excel. El historial registra cambios del panel con escrituras atómicas y conserva las últimas 100 acciones en pantalla. Consultar ACTIVACION.md para reglas, respaldo diario nativo (requiere Blaze) y App Check pendientes de configuración externa. El aviso público está en privacidad.html.

## Mi semana habitual

Cada alumno guarda una configuración independiente para cada día de lunes a viernes: porciones al mediodía y a la noche (máximo 2 en total por día). El campo schedule guarda solo los días elegidos; las preferencias anteriores con turnos iguales se convierten al leerlas. Usar mi semana prepara los días disponibles, sin confirmar automáticamente; Guardar reserva semanal confirma. Se omiten días bloqueados, no habilitados, vencidos y turnos cancelados, con aviso explícito. Las reservas existentes conservan sus restricciones/modalidad; las nuevas toman preferencias del perfil. La selección fuera de la plantilla se conserva. Las preferencias están en reservationPreferences y se incluyen en respaldo v4, compatible con v1-v3 al recuperar.

## Recordatorios y Excel por correo

El perfil permite desactivar recordatorios. Las rutas protegidas de servidor generan Excel para administradores y recordatorios para alumnos sin reserva. Están desactivadas hasta configurar credenciales, publicar reglas y habilitar el servicio. Ver `EMAILS.md` para activación, programación con reintentos y límites. No se enviaron correos reales desde las pruebas.
