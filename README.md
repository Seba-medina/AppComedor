# AppComedor — demo actualizada

Abrí index.html con styles.css, app.js y menu-semanal.jpg en la misma carpeta.

## Funciones de esta versión

- Reserva de uno o varios días con mediodía, noche o ambos. Se exige al menos un turno por cada día elegido.
- Porciones y restricciones independientes por turno.
- Perfil editable con condición habitual y preferencias alimentarias preseleccionadas al elegir nuevos turnos.
- Modalidades temporales habilitadas para fechas elegidas desde el panel.
- Bloqueo con aviso: cancela las reservas de ambos turnos, excluye sus porciones de los totales y conserva historial. Desbloquear no restaura reservas.
- Corte local a las 10:00 de Argentina y carga de imagen semanal.
- Persistencia en el almacenamiento del mismo navegador; los datos no se comparten entre usuarios ni dispositivos.

La semana del 5 al 9 de octubre de 2026 y las personas son ficticias. La foto original es de referencia.

## Publicar en Vercel

Con Node.js instalado, abrí una terminal en esta carpeta y ejecutá:

    npx vercel login
    npx vercel

Seguí las preguntas para crear un proyecto llamado appcomedor en tu cuenta. Para este HTML elegí Other si pregunta el framework y dejá vacíos los comandos de compilación. Revisá el enlace de vista previa y, para publicar en producción, ejecutá:

    npx vercel --prod

Alternativa con GitHub: subí los archivos de esta carpeta a un repositorio e importalo desde Add New → Project en Vercel; framework Other, sin build command y salida en la raíz. Las siguientes actualizaciones del repositorio generarán despliegues.

Documentación oficial: https://vercel.com/docs/cli/deploy y https://vercel.com/docs/builds/configure-a-build

## Alcance pendiente

Esto sigue siendo una demo. El botón Probar panel admin está disponible para mostrar ambos roles y no protege datos. No hay login real con Google ni backend. Firebase Auth, Firestore y validación de hora, permisos y bloqueos en servidor son necesarios antes de admitir reservas reales. La carga de imágenes es local, sin Cloudinary.

El perfil afecta nuevas selecciones y las reservas reenviadas; no modifica automáticamente reservas anteriores. Las bajas de reservas confirmadas continúan por WhatsApp.

## Verificación

Sintaxis de JavaScript comprobada. Pruebas automatizadas de lógica mediante un DOM simulado: mínimo un turno, ambos horarios, ausencia de duplicados, bloqueo/cancelación, historial, desbloqueo, corte horario y persistencia. No equivalen a una prueba visual en un navegador ni a pruebas de servidor.
