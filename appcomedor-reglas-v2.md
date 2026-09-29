# AppComedor — decisiones y diseño funcional (29/09/2026)

Complementa `comedor-uner-contexto.md` y sustituye sus puntos incompatibles. La demo HTML existente usa datos ficticios y todavía no implementa estas reglas.

## Acceso y perfiles

- El usuario inicia sesión con Google mediante Firebase Auth; no se exige que la dirección sea `@gmail.com` si pertenece a una cuenta Google. En su primer acceso completa nombre, apellido y condición habitual (alumno regular, becario o personal).
- El perfil guarda las preferencias alimentarias habituales, por ejemplo celiaquía. Al crear reservas aparecen preseleccionadas y se pueden ajustar para cada día. El usuario puede editar su perfil y esas preferencias; las reservas ya confirmadas conservan una copia de sus datos tal como se registraron.
- El rol de administrador se asigna fuera del formulario público, por un responsable del sistema. Un usuario no puede darse permisos de administrador editando su perfil. El administrador consulta los datos de usuarios y reservas y gestiona menú, bloqueos y modalidades.
- La vista común solo permite iniciar sesión, ver el menú, editar el perfil propio y crear o consultar sus propias reservas. No muestra ni permite consultar las de terceros.

## Reservas

- Se puede confirmar un solo día o varios días de una semana en la misma operación. En cada fecha se marca **mediodía, noche o ambos**; al elegir el día hay que marcar al menos un turno. Cada turno tiene sus propias porciones y restricciones alimentarias. Una operación semanal guarda una reserva independiente por usuario, fecha y turno; volver a enviar ese turno lo modifica dentro del plazo, sin duplicarlo ni borrar el otro turno.
- Los días bloqueados no admiten nuevas reservas ni modificaciones. El límite para crear o modificar una reserva es a las **10:00, hora de Argentina, del día de asistencia**. El servidor debe comprobar hora y bloqueo al guardar, además del control visual de la web. Las bajas continúan por WhatsApp en esta primera versión.
- La condición especial es una modalidad temporal, seleccionada para las fechas concretas que correspondan (por ejemplo, dos días de un curso). No sustituye de forma permanente la condición habitual del perfil. El administrador crea y habilita las modalidades disponibles; el alumno selecciona una modalidad aplicable en cada día, cuando corresponda. La reserva guarda la condición habitual y la modalidad temporal usadas ese día.
- Las preferencias como celiaquía no deben confundirse con la condición administrativa de alumno/becario/personal ni con una modalidad temporal. El usuario puede mantenerlas en su perfil y sobrescribirlas por fecha.

## Panel del comedor

- El administrador sube una imagen del menú por semana, bloquea o desbloquea fechas y gestiona modalidades temporales. Puede consultar todas las reservas y usuarios, filtrando por fecha y turno, con totales de reservas y porciones.
- Al bloquear un día, todas las reservas activas de esa fecha se cancelan automáticamente y dejan de aparecer en los totales operativos, para ambos turnos. La interfaz muestra antes cuántas reservas se cancelarán. La operación de bloqueo y cancelación debe ser coherente: evitar que entre una reserva nueva mientras se procesa. Las reservas canceladas se conservan con estado `cancelada_por_bloqueo`, fecha y administrador responsable para consulta histórica. Desbloquear el día no las restaura: cada usuario debe volver a reservar si aún está dentro del plazo. El alumno ve el estado cancelado al consultar sus reservas.

## Modelo de datos propuesto

| Colección/documento | Campos principales |
| --- | --- |
| `usuarios/{uid}` | nombre, apellido, email, condiciónHabitual, preferenciasAlimentarias, creadoEn, actualizadoEn |
| `modalidades/{id}` | nombre, activa, fechasHabilitadas o rango opcional, creadoPor |
| `menus/{lunes-AAAA-MM-DD}` | imagenUrl, semanaInicio, actualizadoPor, actualizadoEn |
| `diasBloqueados/{AAAA-MM-DD}` | motivo, bloqueadoPor, bloqueadoEn |
| `reservas/{uid_YYYY-MM-DD_turno}` | uid, fecha, turno (`mediodia` o `noche`), porciones, restricciones, condiciónHabitual, modalidadId opcional, estado (`activa` o `cancelada_por_bloqueo`), canceladaEn, canceladaPor, creadoEn, actualizadoEn |

Los identificadores deterministas de reservas evitan duplicados por usuario, fecha y turno; permiten dos reservas del mismo usuario en un día. Guardar fechas como `YYYY-MM-DD` y definir el corte horario en `America/Argentina/Buenos_Aires`.

## Implementación pendiente

1. Configurar proyecto Firebase y proveedor Google; definir quién recibe el primer rol de administrador.
2. Implementar reglas de Firestore y una operación de servidor para validar autenticación, rol, hora límite, bloqueo y modalidad antes de cada escritura; no confiar en controles del navegador.
3. Conectar perfil, reservas y panel a datos reales; incorporar la carga segura de la imagen semanal y probar permisos de alumno/admin.

La elección de proveedor de imágenes y sus costos/planes debe comprobarse al configurarlo; no asumir que las condiciones del borrador anterior siguen vigentes.

## Estado de la demo actualizada

Hosting elegido: Vercel. La demo incluye ambos turnos por día, perfil editable con preferencias, modalidades temporales por fecha, carga local de menú, corte local de las 10:00 y cancelación al bloquear con historial. Persiste en el mismo navegador. Firebase Auth, permisos reales, Firestore y validaciones en servidor siguen pendientes.
