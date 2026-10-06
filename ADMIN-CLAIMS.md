# Migración de administradores a Custom Claims

Estado: preparada, no activada. Los roles de producción y el cliente actual no se modifican al publicar estos archivos. La prueba de correos del 6 de octubre conserva su comportamiento.

## Componentes

- scripts/manage-admin-claims.mjs: check consulta; grant identifica exclusivamente las dos cuentas administradoras existentes, exige Google verificado y cuenta habilitada, conserva otros claims, asigna admin:true y verifica el resultado.
- scripts/admin-claims-core.mjs: lógica comprobable con Auth/Firestore simulados.
- scripts/admin-claims-client.mjs: credenciales locales mediante Application Default Credentials y proyecto fijo appcomedor-6b4f7; rechaza una clave de otro proyecto.
- adminRoles/{uid}: registro privado mantenido con Admin SDK. Protege cuentas de borrado y permite comprobar revocación aun con un token antiguo. Los clientes no pueden crear, modificar ni borrar roles.
- security/claims/: candidato de cliente, reglas y módulos de correo del servidor. No se publica porque no pertenece a la lista del build público.
- scripts/apply-admin-claims.mjs: exige verificar ambos roles; compara hashes de las fuentes originales, guarda copia local y prepara los reemplazos. No asigna roles ni despliega.
- server/mail-recipients.mjs: destinatarios de correo exclusivamente del servidor; son direcciones de entrega, no autorización.
- tests/admin-claims.test.mjs: identidad, conservación de claims, filtros por UID y comprobaciones del candidato.
- tests/rules-claims.cjs y tests/ui-claims.cjs: pruebas de emulador/interfaz ejecutadas el 6 de octubre, incluidos los cambios de No voy y bienvenida; la activación y verificación con cuentas reales siguen pendientes.

## Orden para activar sin bloquear administradores

1. Actualizar una copia local del repositorio e instalar dependencias: npm ci.
2. Usar credenciales de administración dedicadas, con Firebase Authentication Admin y Cloud Datastore User en el proyecto. No ampliar los permisos de la cuenta del servicio de correo. Alternativa: credenciales personales ADC de una identidad autorizada.
3. Mantener la clave privada solo en la PC. Definir GOOGLE_APPLICATION_CREDENTIALS con su ruta local. No cargarla en GitHub, Vercel, el navegador o el chat.
4. Ejecutar node scripts/manage-admin-claims.mjs check. Una salida incompleta significa NO activar.
5. Ejecutar node scripts/manage-admin-claims.mjs grant y repetir check. Ambas filas deben mostrar claim:true y protected:true. Si hay error parcial, repetir grant y verificar; las dos operaciones Auth no son una transacción global.
6. Cerrar sesión y volver a ingresar con ambos administradores para renovar tokens.
7. Ejecutar las pruebas de candidato: node --test tests/admin-claims.test.mjs; node tests/ui-claims.cjs con las dependencias de tests; pruebas rules-claims.cjs dentro del emulador demo-appcomedor. Las pruebas del candidato pasaron en el entorno de trabajo el 6 de octubre; requieren repetición si cambian estas fuentes antes de activar.
8. Ejecutar node scripts/apply-admin-claims.mjs. Si alguna fuente cambió, se detiene antes de copiar para no perder nuevas funciones.
9. Publicar las nuevas reglas de Firestore primero, con ambos roles ya verificados. GitHub/Vercel no publica reglas Firebase. Conservar la copia anterior para recuperación. No publicar directamente el archivo candidato antes de completar pasos 4–7.
10. Commit/push de los reemplazos de cliente/servidor. Comprobar acceso de ambos administradores, reservas de una cuenta común, PDF, respaldo y borrado protegido. Eliminar las credenciales administrativas temporales una vez finalizada la migración.

## Límites y recuperación

El menú público, límite de porciones, corte de las 10 y generación por bloqueo no se cambian. Las reglas de negocio posteriores a shortText son idénticas al original. Las reservas y perfiles no se reescriben.

El registro adminRoles no pertenece al respaldo de datos editables de la app: no restaurar roles desde archivos aportados por usuarios. Mantener la administración de roles separada.

Para retirar permisos, primero inhabilitar adminRoles/{uid} desde el entorno privilegiado y después retirar el claim admin preservando otros claims. Los tokens ya emitidos pueden durar hasta su expiración; el registro permite denegar inmediatamente el acceso administrativo en las reglas nuevas. Una cuenta administradora comprometida sigue siendo un riesgo: activar 2FA/passkeys.

Si hay problemas antes del cliente nuevo, conservar/restaurar las reglas anteriores temporalmente y verificar identidades. No recuperar acceso añadiendo un endpoint de asignación de roles accesible al navegador.

## App Check, siguiente etapa

La clave pública todavía está vacía. Registrar la app web del proyecto en App Check con reCAPTCHA Enterprise, dominio appomedoruner.vercel.app y clave de tipo puntuación. Compartir solamente la site key pública para integrar. Publicar, revisar métricas y probar usuarios/admin antes de enforcement de Firestore. Nunca compartir JSON de servicio, clave privada ni tokens debug; no usar debug en producción.
