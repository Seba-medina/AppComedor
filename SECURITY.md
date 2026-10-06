# Seguridad de AppComedor

Revisión del 30/09/2026. Este documento describe el código y las pruebas; no certifica que las reglas y controles estén activados en Firebase Console.

## Controles implementados

- Identidad de Google con correo verificado. Administradores autorizados en reglas: Sebastian y María Laura. Cambiar la interfaz o el perfil no otorga permisos.
- Perfiles y reservas privados para cada UID; administradores pueden consultar el conjunto. Denegación por defecto para otras colecciones.
- Identificador determinista de cada turno, generación del día y validación atómica de ambos turnos con getAfter: máximo 2 porciones al día, enteras y no negativas. Un turno sin porciones es un registro auxiliar, no una reserva activa.
- Corte con hora del servidor; días bloqueados no admiten reservas. El desbloqueo no recupera reservas antiguas. El alumno no puede revertir una baja administrativa.
- Campos inmutables de reservas protegidos en actualizaciones; longitudes y campos permitidos validados.
- Menú público por documento específico; listado masivo de menús restringido a administradores. Esto reduce enumeración, pero no limita la frecuencia de lecturas de un menú conocido.
- Textos de usuarios escapados antes de renderizar HTML. No se evalúa código suministrado por usuarios.
- Datos privados de la sesión anterior retirados del DOM al cambiar de cuenta o salir.
- Cabeceras Vercel: CSP, bloqueo de iframes externos, nosniff, política de referente, permisos de dispositivos deshabilitados y COOP compatible con ventana de Google. CSP permite estilos inline porque el tutorial posiciona elementos dinámicamente; no permite scripts inline ni eval.

## Acciones pendientes en Firebase

1. Publicar firestore.rules actualizado. GitHub/Vercel no despliegan estas reglas.
2. Registrar la aplicación web en App Check con reCAPTCHA Enterprise, clave de tipo puntuación y dominio appomedoruner.vercel.app. Compartir únicamente la clave pública del sitio para completar app-check-config.js; no compartir secretos ni claves de servicio.
3. Publicar el cliente con esa clave, probar inicio de sesión y reservas, observar solicitudes válidas en métricas y después activar enforcement en Firestore. No activarlo antes: clientes sin integración dejarían de funcionar. La clave vacía del repositorio significa que App Check aún NO está activo. No habilitar tokens debug en producción.
4. Revisar dominios de Auth autorizados y proveedores habilitados. Retirar dominios de desarrollo innecesarios. Activar verificación en dos pasos o passkeys en ambas cuentas administradoras y en cuentas con acceso a las consolas.
5. Configurar seguimiento de consumo y alertas. Una alerta presupuestaria no es un límite de gasto. Revisar opciones de respaldo, retención y recuperación según el plan y los datos manejados.

## Riesgos pendientes antes de apertura amplia

- Cualquier cuenta Google verificada puede registrarse. No se comprueba matrícula, legajo ni pertenencia a la facultad. La condición declarada (regular/becario/personal) no es una acreditación.
- El límite de 2 porciones es por cuenta (UID), no por persona física. Una persona con varias cuentas puede multiplicar reservas. Decidir aprobación administrativa contra padrón, acceso institucional o validación de legajo con unicidad en un backend confiable. No agregar restricciones de elegibilidad sin acordarlas con el comedor.
- App Check disminuye abuso pero no elimina bots ni sustituye autorización o controles de frecuencia. No hay rate limiting de negocio por cuenta/IP implementado. Para defensa fuerte ante repetición masiva, mover escrituras a un backend con límites, métricas y auditoría; evitar confiar en límites del JavaScript del navegador.
- Firestore es accesible directamente: un firewall de Vercel por sí solo no protege su API. Las solicitudes autorizadas y los rechazos pueden consumir recursos según el servicio. Monitorear ambos.
- Administradores se autorizan por correo verificado. Una cuenta administradora comprometida permite operaciones de administrador. Una evolución recomendada es usar UID/claims gestionados desde un backend y auditoría de acciones. Existe una bitácora inmutable para clientes en auditLogs. No equivale a un historial completo de todas las escrituras posibles ni impide cambios mediante Admin SDK.
- La imagen de menú vive en Firestore: cada consulta puede transferir cientos de KB. Para escala, migrar a almacenamiento/CDN con caché antes de aumentar límites de imagen.
- Los perfiles contienen preferencias alimentarias. Definir quién puede consultarlas, durante cuánto tiempo se conservan y cómo se atiende una solicitud de eliminación.

## Pruebas

Ejecutar solo contra demo-appcomedor/emulador, nunca contra datos de producción. Pruebas de reglas cubren acceso ajeno, listado privado, suplantación de admin por correo no verificado/proveedor incorrecto, roles inventados, duplicados, cantidades negativas/fraccionarias, límite agregado, cambios atómicos de turno, manipulación de fecha de creación, corte, bloqueo y reactivación de baja. Pruebas de interfaz comprueban limpieza al salir. El login Google real y la configuración activa de Firebase requieren comprobación en producción por el titular.

Fuentes: https://firebase.google.com/docs/app-check y https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider ; https://vercel.com/docs/project-configuration/vercel-json .

## Eliminación desde el panel

Solo administradores pueden borrar perfiles y reservas del comedor. Las cuentas con correo administrador y la cuenta propia del solicitante están excluidas. Durante el borrado, un bloqueo temporal de UID impide nuevas escrituras/lecturas del usuario; se retira al terminar. Las reservas se borran por UID en todas las semanas, en lotes de hasta 450, y el perfil al final. Los lotes de distintos usuarios no forman una transacción global: un error puede dejar una eliminación parcial; se informa cuántos usuarios completaron el proceso y se puede reintentar. No se elimina la identidad en Firebase Authentication. El usuario podrá crear un nuevo perfil después. Las modalidades pueden eliminarse por administrador; no borra sus reservas históricas.

## Revisión del 6 de octubre de 2026: superficie del despliegue

El build crea public/ desde una lista explícita de archivos de la interfaz. Vercel publica únicamente esa salida; los módulos de server/, reglas e índices Firebase, documentación, scripts, pruebas, paquetes y archivos ZIP quedan fuera del contenido estático. No se alteran las rutas API ni las reglas, los roles o la lógica de reservas. Las fuentes originales siguen en la raíz para mantener imports del servidor y pruebas existentes.

Archivos: vercel.json define buildCommand/outputDirectory; scripts/build-public.mjs copia solo la interfaz y valida imports locales; tests/public-output.test.mjs valida exclusión de internos, referencias HTML/CSS y conservación de las rutas API en el proyecto. .gitignore excluye public/ porque es salida generada.

La publicación de reglas de Firestore no equivale a exponer una credencial ni demuestra una vulnerabilidad explotable; el repositorio es público, por lo que retirar esas URL no oculta el código en GitHub. Las claves privadas y secretos se mantienen fuera del repositorio y del cliente.

### Migración a roles: pendiente, no activada

Asignar admin:true con Admin SDK a los UID correctos en un entorno privilegiado, conservar otros claims existentes y verificar los roles de ambos administradores antes de retirar la autorización actual. El permiso Cloud Datastore User usado por los correos no autoriza por sí solo a administrar Firebase Authentication. No ampliar los permisos del servicio de correo para resolver esta migración.

Actualizar reglas y cliente coordinadamente. Además de mostrar el panel, adaptar protección frente a borrado de administradores, filtros por rol, auditoría, backup/restauración y destinatarios de reportes. Una lista de correos de entrega puede permanecer en el servidor, pero no debe actuar como autorización. Revocar un claim no invalida instantáneamente tokens ya emitidos: contemplar renovación y revocación de sesión.

No publicar reglas que exijan admin:true antes de asignar los claims, para evitar bloquear a los administradores. No asignar roles desde el cliente, un perfil editable ni un endpoint público de bootstrap.

### App Check: pendiente, no activado

Registrar el proveedor, recibir la clave pública de reCAPTCHA Enterprise, publicar la integración y observar métricas antes de enforcement. No activar enforcement con una clave vacía. App Check no sustituye reglas ni demuestra que el usuario pertenezca a la facultad.

### Verificación pendiente en producción

Comprobar HTTP 404 para /firestore.rules, /firebase.json, /firestore.indexes.json y /.firebaserc; también /server/email-job.mjs, /scripts/restore-backup.mjs, /tests/rules.cjs y el ZIP antiguo. Comprobar index, módulos, logo, inicio de sesión, reservas, PDF, respaldo y cron autorizado sin enviar correos de prueba masivos.

Los tests de reglas del repositorio cubren usuarios autenticados; eso no reemplaza comprobar que las mismas reglas están publicadas en Firebase. Una revisión pasiva no garantiza ausencia de fallos ni resistencia a abuso con múltiples cuentas.
