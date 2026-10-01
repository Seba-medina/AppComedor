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
- Administradores se autorizan por correo verificado. Una cuenta administradora comprometida permite operaciones de administrador. Una evolución recomendada es usar UID/claims gestionados desde un backend y auditoría de acciones. Actualmente no existe bitácora inmutable de operaciones.
- La imagen de menú vive en Firestore: cada consulta puede transferir cientos de KB. Para escala, migrar a almacenamiento/CDN con caché antes de aumentar límites de imagen.
- Los perfiles contienen preferencias alimentarias. Definir quién puede consultarlas, durante cuánto tiempo se conservan y cómo se atiende una solicitud de eliminación.

## Pruebas

Ejecutar solo contra demo-appcomedor/emulador, nunca contra datos de producción. Pruebas de reglas cubren acceso ajeno, listado privado, suplantación de admin por correo no verificado/proveedor incorrecto, roles inventados, duplicados, cantidades negativas/fraccionarias, límite agregado, cambios atómicos de turno, manipulación de fecha de creación, corte, bloqueo y reactivación de baja. Pruebas de interfaz comprueban limpieza al salir. El login Google real y la configuración activa de Firebase requieren comprobación en producción por el titular.

Fuentes: https://firebase.google.com/docs/app-check y https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider ; https://vercel.com/docs/project-configuration/vercel-json .

## Eliminación desde el panel

Solo administradores pueden borrar perfiles y reservas del comedor. Las cuentas con correo administrador y la cuenta propia del solicitante están excluidas. Durante el borrado, un bloqueo temporal de UID impide nuevas escrituras/lecturas del usuario; se retira al terminar. Las reservas se borran por UID en todas las semanas, en lotes de hasta 450, y el perfil al final. Los lotes de distintos usuarios no forman una transacción global: un error puede dejar una eliminación parcial; se informa cuántos usuarios completaron el proceso y se puede reintentar. No se elimina la identidad en Firebase Authentication. El usuario podrá crear un nuevo perfil después. Las modalidades pueden eliminarse por administrador; no borra sus reservas históricas.
