# AppComedor — revisión de casos reales (29/09/2026)

Versión revisada: `AppComedor-demo.zip` en la carpeta AppComedor. Se inspeccionaron `index.html` y `app.js`; `node --check app.js` pasó. Se intentó automatizar el recorrido visual, pero este entorno no tiene un navegador ejecutable instalado; por eso los resultados siguientes describen lo comprobado en el código, no una prueba extremo a extremo aprobada.

| Caso | Resultado en la demo | Para la aplicación real |
| --- | --- | --- |
| Elegir un día o varios, con turno, porciones y restricciones independientes | La demo admite un turno por día | Permitir mediodía, noche o ambos; exigir al menos uno por día y guardar por usuario, fecha y turno |
| Reservar un día bloqueado | La casilla desaparece; se elimina de la selección al bloquear | Validar el bloqueo en el servidor en cada escritura |
| Bloquear un día con reservas previas | **Falla:** las reservas permanecen en el listado y en los totales | Cancelar todas las reservas activas de la fecha para ambos turnos, registrar causa y actor; excluirlas de totales |
| Desbloquear luego de cancelar | La demo conserva las reservas anteriores | No restaurar las canceladas; permitir una reserva nueva solo dentro del plazo |
| Reservar después de las 10:00 del día | **No implementado**: el límite es solo texto | Comprobar hora de Argentina en servidor, incluyendo exactamente las 10:00 |
| Inicio de sesión, perfil, celiaquía preseleccionada y modalidad temporal por fecha | **No implementado** | Probar alta con Google, edición de perfil y copia de preferencias en cada reserva |
| Alumno intenta entrar al panel o ver datos ajenos | **No implementado**: el botón del panel está disponible para todos | Rechazar acceso y lecturas según rol en backend y reglas de datos |
| Recargar la página | Se pierden todos los cambios | Persistencia en Firestore y recuperación tras nueva sesión |
| Subir menú semanal | La foto está incluida como archivo fijo | Carga admin, semana correcta, imagen válida y lectura para alumnos |

## Criterios de aceptación antes de usar reservas reales

1. Bloquear una fecha con reservas cancela todas las activas y actualiza listados y totales sin pérdida del historial. No se acepta una nueva reserva durante el bloqueo.
2. Una reserva del día se acepta antes de las 10:00 y se rechaza desde las 10:00, usando `America/Argentina/Buenos_Aires`, independientemente del reloj del dispositivo.
3. El alumno solo lee y modifica su propio perfil y reservas; el administrador accede al conjunto y administra menú, bloqueos y modalidades.
4. Guardar un turno no borra el otro turno ni reservas de otros días; repetir el guardado edita ese turno sin duplicarlo. Bloquear una fecha cancela ambos turnos.
5. La celiaquía del perfil aparece preseleccionada; un cambio para un día no altera otros días ni reservas previas. La modalidad especial se asigna a fechas elegidas.

**Estado:** la demo es apta para revisar diseño e interacciones básicas. Todavía no es apta para validar operaciones reales ni seguridad. Repetir estos casos con cuentas alumno y admin sobre un entorno de prueba conectado antes de publicar.

## Revisión posterior: demo v2

Se actualizaron ambos turnos, perfil, modalidades por fecha, bloqueo con cancelación e historial, carga local de menú y persistencia local. Pasaron las pruebas de lógica con DOM simulado: mínimo un turno, ambos horarios, guardado sin duplicados, cancelación de ambos turnos, no restauración al desbloquear, límite 09:59:59/10:00:00, persistencia y rechazo de días bloqueados. No se ejecutó un navegador real. Google Auth, permisos y servidor siguen pendientes.
