> **Resuelto:** la causa raíz era que seis colecciones creadas por migración no tenían los campos `created`/`updated`. La migración `1792644600_add_created_updated_fields.js` los añade y `tools/e2e-smoke.mjs` lo vigila. Este documento se conserva solo como histórico.

# Diagnóstico de persistencia y carga de cultivos en Neptuno

## Resumen ejecutivo

La causa confirmada del error HTTP 400 observado anteriormente fue una consulta de PocketBase que pedía `sort=created` para la colección `crops`. El esquema activo de esa colección no contiene los campos de sistema `created` ni `updated`; por tanto, PocketBase no puede procesar ese orden y responde:

```text
HTTP 400
Something went wrong while processing your request.
```

La implementación actual de `CropContext.refreshCrops` ya ordena por `name`, campo que sí existe. Se verificó directamente contra la instancia local: `sort=created` devuelve 400 y `sort=name` devuelve 200. El cambio está cubierto por una prueba que espera `sort: 'name'`.

Si el error aparece todavía, la explicación más probable es que la pestaña/aplicación esté ejecutando un bundle anterior o que el frontend esté conectado a otra instancia de PocketBase con una configuración/esquema diferentes. No se debe concluir que esa es la causa sin comprobar la petición en Network. Los cultivos están persistidos en la base local inspeccionada, asociados al mismo usuario.

## 1. Conexión del frontend con PocketBase

El cliente compartido se crea en [`apps/web/src/lib/pocketbaseClient.js`](./apps/web/src/lib/pocketbaseClient.js):

- Primero utiliza `VITE_POCKETBASE_URL`, si está configurada.
- Si no lo está durante desarrollo, compone la URL con el protocolo y hostname del navegador y el puerto `8090`; en un proceso sin navegador usa `http://127.0.0.1:8090`.
- En producción requiere que `VITE_POCKETBASE_URL` exista.
- Las llamadas de la aplicación usan esta única instancia de PocketBase.

No se han reproducido aquí valores de `.env`. Al diagnosticar otro entorno, confirma el **origen** de la solicitud en la pestaña Network y que corresponde a la instancia cuyo panel contiene los dos cultivos. Las variables `VITE_*` se incorporan al bundle al iniciar/construir Vite; cambiar el archivo de entorno requiere reiniciar el proceso correspondiente y regenerar el bundle de producción.

En la instancia local de esta revisión, PocketBase respondió a `/api/health`. Esto acredita solo esa instancia local, no un servidor remoto ni un bundle desplegado.

## 2. Registro, autenticación y carga al recargar

La autenticación está implementada en [`apps/web/src/contexts/AuthContext.jsx`](./apps/web/src/contexts/AuthContext.jsx):

- El registro valida datos básicos, crea la cuenta en `users`, solicita un OTP y requiere verificación de correo.
- El inicio de sesión llama `users.authWithPassword`; la cuenta no verificada no se acepta como sesión.
- La verificación OTP también establece el usuario autenticado.
- Al iniciar el proveedor se restaura el usuario desde el `authStore` de PocketBase cuando el token almacenado sigue siendo válido.
- El cierre de sesión limpia `authStore` y `currentUser`.

El proveedor compartido en [`apps/web/src/contexts/CropContext.jsx`](./apps/web/src/contexts/CropContext.jsx) obtiene los registros con `refreshCrops()`. Al volver a cargar la aplicación, vuelve a consultar PocketBase; el almacenamiento local solo guarda el **ID del cultivo seleccionado**, no los registros de cultivos.

`CropProvider` está por encima de las rutas, junto a `AuthProvider`, en [`apps/web/src/App.jsx`](./apps/web/src/App.jsx). Tanto [`apps/web/src/pages/CropsPage.jsx`](./apps/web/src/pages/CropsPage.jsx) como el selector de [`apps/web/src/components/Header.jsx`](./apps/web/src/components/Header.jsx) usan el mismo contexto. Resumen también consume ese contexto en [`apps/web/src/pages/SummaryPage.jsx`](./apps/web/src/pages/SummaryPage.jsx).

## 3. Colecciones y permisos implicados

La pantalla Cultivos necesita principalmente:

- `users`: autenticación y relación del propietario.
- `crops`: listar, ver, crear, actualizar y eliminar cultivos del usuario.

Resumen comparte la lista `crops` y además carga datos asociados:

- `sensor_readings`
- `sensor_readings_hourly`
- `irrigation_logs`
- `devices`

Los esquemas se definen mediante migraciones en `apps/pocketbase/pb_migrations`. La migración [`1792450040_add_multi_crop_support.js`](./apps/pocketbase/pb_migrations/1792450040_add_multi_crop_support.js) crea `crops`, el campo de relación `userId`, el nombre, los parámetros y reglas de acceso restringidas al usuario autenticado. Migraciones posteriores añaden parámetros de riego y refuerzan reglas; por ejemplo, [`1792644100_lock_measurement_ownership.js`](./apps/pocketbase/pb_migrations/1792644100_lock_measurement_ownership.js).

En la base local examinada:

- Existe `crops` con `userId`, `name`, parámetros de humedad y control.
- `listRule` y `viewRule` de `crops` limitan la lectura a `userId = @request.auth.id`.
- Las lecturas, registros horarios, historial y dispositivos tienen reglas que limitan por `userId` y la relación con el cultivo.
- Hay dos filas en la tabla local `crops`, ambas asociadas a un usuario.

No hace falta relajar permisos ni crear colecciones para corregir el 400 de ordenamiento.

## 4. Causas posibles de una carga vacía o fallida

### Confirmada: orden sobre un campo inexistente (HTTP 400)

La consulta anterior usaba `sort: 'created'` en `crops`. El esquema real de esa colección no contiene `created`; el API local reproduce consistentemente 400 con ese parámetro y 200 con `sort=name`. El código actual ya solicita `sort: 'name'`.

### Posible si el 400 continúa: bundle anterior o instancia distinta

Si Network sigue mostrando `sort=created`, el navegador está ejecutando código anterior (bundle/cache/servidor distinto) o se está mirando otra ejecución del frontend. Si Network muestra `sort=name` pero continúa el 400, revisa el host de la petición: el frontend podría estar apuntando a otra instancia/esquema. Compara la solicitud real y la respuesta con el panel de PocketBase de esa misma instancia.

### Posible: usuario/sesión no corresponde al propietario

Las reglas no dejan listar cultivos de otro usuario. Una solicitud sin token válido o con otro usuario no debe mostrar los registros del propietario; en PocketBase, una regla de listado puede producir una lista vacía en vez de un error HTTP. Que el panel administrativo muestre filas no demuestra que la sesión de la aplicación tenga permiso para verlas.

### Posible: sesión aún en restauración

`AuthProvider` restaura `currentUser` en un efecto. Antes de establecerlo, `CropContext` limpia su estado y no consulta cultivos. La interfaz debe distinguir carga de lista vacía; si la lista queda vacía después del estado de carga, verifica la identidad de la sesión y el resultado autenticado del API.

### Errores secundarios en Resumen

Resumen consulta además cuatro colecciones distintas. Un error en una de ellas puede generar el aviso del resumen aunque `crops` esté correctamente disponible. Los mensajes de desarrollo y logs de [`SummaryPage.jsx`](./apps/web/src/pages/SummaryPage.jsx) deben identificar la colección y el error. En el esquema local consultado existen sus campos de orden (`created`, `hour_start` o `name`) y reglas de propietario.

## 5. Archivos y funciones concretas a revisar

| Archivo | Función o elemento | Relevancia |
|---|---|---|
| [`apps/web/src/lib/pocketbaseClient.js`](./apps/web/src/lib/pocketbaseClient.js) | Construcción del cliente y resolución de URL | Determina a qué servidor se envía la solicitud. No divulgar el contenido del entorno al compartir diagnósticos. |
| [`apps/web/src/contexts/AuthContext.jsx`](./apps/web/src/contexts/AuthContext.jsx) | `login`, `signup`, OTP, restauración inicial y `logout` | Determina identidad/validez de la sesión con la que se evalúan las reglas. |
| [`apps/web/src/contexts/CropContext.jsx`](./apps/web/src/contexts/CropContext.jsx) | `refreshCrops`, `createCrop`, `updateCrop`, `deleteCrop` | Fuente compartida de cultivos; el orden actual debe seguir siendo por un campo presente, `name`. |
| [`apps/web/src/pages/CropsPage.jsx`](./apps/web/src/pages/CropsPage.jsx) | `handleSubmit` y lista | Presenta errores de guardado/carga y los cultivos del contexto. |
| [`apps/web/src/components/Header.jsx`](./apps/web/src/components/Header.jsx) | Selector superior | Distingue carga/error de lista vacía y muestra la selección del contexto. |
| [`apps/web/src/pages/SummaryPage.jsx`](./apps/web/src/pages/SummaryPage.jsx) | `refresh` | Usa los cultivos del contexto; las consultas secundarias pueden fallar independientemente. |
| [`apps/pocketbase/pb_migrations/1792450040_add_multi_crop_support.js`](./apps/pocketbase/pb_migrations/1792450040_add_multi_crop_support.js) | Esquema y reglas iniciales de `crops` | Fuente de referencia del esquema y aislamiento por propietario. |
| [`apps/pocketbase/pb_migrations/1792644100_lock_measurement_ownership.js`](./apps/pocketbase/pb_migrations/1792644100_lock_measurement_ownership.js) | Endurecimiento de actualizaciones | Evita modificar campos de propietario desde el cliente. |
| [`apps/web/src/__tests__/crop-context.test.jsx`](./apps/web/src/__tests__/crop-context.test.jsx) | Pruebas de consulta, recarga y vistas | Debe proteger el orden válido y la consistencia de Cultivos/Resumen/selector. |

## 6. Plan de corrección priorizado y verificación

1. **Confirmar la solicitud exacta en Network** al reproducir el problema con la sesión del usuario afectado:
   - URL/host de PocketBase.
   - Ruta `.../api/collections/crops/records`.
   - Parámetros `sort`, `filter` y paginación.
   - Código HTTP y JSON de respuesta.
   - No copiar encabezados `Authorization`, cookies ni credenciales.
2. **Si la solicitud conserva `sort=created`**, reiniciar Vite si no recogió el cambio y hacer recarga forzada; en despliegues, reconstruir y publicar el bundle con la configuración correcta. Confirmar que el parámetro pasa a `sort=name`.
3. **Si falla con `sort=name`**, confirmar que el host pertenece a la instancia cuyo panel contiene los cultivos y que el usuario autenticado en la aplicación es su propietario. Comprobar el resultado de la solicitud autenticada en PocketBase; no cambiar reglas para ocultar el problema.
4. **Si `crops` responde correctamente pero Resumen falla**, identificar en consola el nombre de la colección secundaria que rechazó la consulta y revisar esa petición/esquema por separado.
5. **Verificar el ciclo completo**: iniciar sesión con el propietario, cargar Cultivos, comprobar ambos registros, recargar, confirmar que la petición devuelve esos mismos registros y comprobar selector y Resumen.
6. **Mantener pruebas automatizadas** para que la consulta de cultivos use un campo de orden existente y para que los registros se mantengan visibles tras remontar la aplicación.

No se realizaron cambios a la aplicación, no se ejecutaron migraciones y no se modificó ni eliminó información. Este archivo es el único resultado solicitado.
