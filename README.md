# AppComedor — Firebase

Aplicación HTML/CSS/JavaScript publicada desde la rama main en Vercel.
Firebase Auth (Google) y Firestore guardan perfiles, reservas, días, modalidades y menú.
No se importan las reservas ficticias ni el almacenamiento local de la demo.

## Activación en Firebase Console

1. Proyecto: appcomedor-6b4f7.
2. Authentication: habilitar Google y autorizar appomedoruner.vercel.app.
3. Firestore → Reglas: reemplazar el contenido por el archivo firestore.rules y publicar.
4. Abrir la web e iniciar sesión con sebastianezequielmedina@gmail.com.
5. Guardar el perfil, abrir Panel del comedor, elegir el lunes y habilitar la semana.
6. Cargar la imagen del menú y bloquear fechas sin servicio.
7. Probar una cuenta de alumno: solo debe consultar su perfil y reservas.

Mientras no se publiquen las reglas, el login puede funcionar pero la base rechazará lecturas y escrituras. El código no despliega las reglas automáticamente.

## Roles y seguridad

El administrador inicial se reconoce por email verificado y proveedor Google, tanto en la interfaz como en reglas. Cambiar el perfil no cambia permisos. Para agregar un administrador institucional hay que actualizar ADMIN_EMAIL en domain.mjs y admin() en firestore.rules; conviene migrar luego a roles por UID o custom claims.

Los alumnos consultan sus reservas mediante una consulta por uid. La base rechaza lecturas de terceros, roles inventados en perfiles, reservas duplicadas, porciones fuera de 1–4, modalidades inexistentes/desactivadas, días bloqueados y reservas desde las 10:00 de Argentina. La validación usa request.time del servidor.

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
