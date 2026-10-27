# Neptuno

Neptuno monitorea cultivos y controla el riego con React/Vite y PocketBase.

## Desarrollo local

1. Instala Node.js 18 o superior y las dependencias con `npm install`.
2. Copia `.env.example` a `.env` y completa la configuración que uses localmente.
3. Inicia la aplicación con `npm run dev`. La interfaz web queda en `http://localhost:3000` y PocketBase en `http://127.0.0.1:8090`.
4. Crea una cuenta, registra un cultivo y configura el caudal medido en L/min para mostrar consumo estimado.
5. En **Cultivos → Administrar dispositivos**, registra un dispositivo y guarda la clave que se muestra una sola vez.

Las colecciones y campos nuevos se crean mediante migraciones en `apps/pocketbase/pb_migrations`. No edites migraciones ya aplicadas.

## Simular un sensor

Usa el valor de la clave mostrado al crear el dispositivo. Para evitar dejarla en el historial del terminal, puedes pasarla en `DEVICE_KEY`:

```powershell
$env:DEVICE_KEY = "PEGA_AQUI_LA_CLAVE"
node tools/simulate-device.js --url http://127.0.0.1:8090 --interval 15
```

El simulador envía humedad, temperatura y nivel de agua cada intervalo. La humedad baja mientras el riego está apagado y sube cuando el servidor responde `ON`. Las lecturas simuladas se marcan como **Demo** en la aplicación.

Fallos disponibles:

```powershell
node tools/simulate-device.js --url http://127.0.0.1:8090 --interval 15 --failure low-water
node tools/simulate-device.js --url http://127.0.0.1:8090 --interval 15 --failure disconnect
```

Detén el simulador con `Ctrl+C`. El modo `disconnect` deja de enviar lecturas para probar el estado sin conexión; `low-water` transmite un nivel inferior al 20%.

El vigilante del servidor registra el riego como apagado si un dispositivo deja de reportar mientras estaba activo. El firmware también debe cerrar la válvula localmente si pierde comunicación con el servidor: un comando de apagado no puede llegar a un equipo que está desconectado.

## Control automático

El modo `AUTO` requiere umbrales mínimos/máximos de humedad y límites configurados de duración y descanso. Los valores agronómicos no vienen precargados y deben validarse con AGROSAVIA (2022) antes de usarse. El nivel de agua inferior al 20% bloquea el riego.

El consumo se presenta como **estimado**: caudal configurado en L/min multiplicado por los minutos reales registrados. No se infiere consumo de agua cuando falta un caudal medido.

## Configurar el correo (verificación de cuenta y alertas)

El código de verificación y las alertas se envían por correo. Si el correo no está configurado o el proveedor rechaza el envío, la app lo dice en pantalla en lugar de aparentar que se envió. Copia `.env.example` a `.env` en la raíz y elige **una** opción; reinicia PocketBase después (`npm run dev`).

**Opción A – SMTP (la más rápida; entrega a cualquier correo, p. ej. Gmail, Hotmail, Outlook, institucionales):**

1. En la cuenta que enviará los códigos activa la verificación en dos pasos y crea una *contraseña de aplicación* (Gmail: myaccount.google.com/apppasswords).
2. Completa en `.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USERNAME=tucuenta@gmail.com`, `SMTP_PASSWORD=<contraseña de aplicación>`, `SMTP_SENDER_ADDRESS=tucuenta@gmail.com`.
3. Gmail limita los envíos diarios (cientos por día): suficiente para pruebas y piloto.

**Opción B – Resend con dominio propio (recomendada al publicar):** verifica un dominio en resend.com/domains (registros SPF y DKIM) y define `BUILDER_MAILER_API_KEY` y `BUILDER_MAILER_SENDER_ADDRESS=no-reply@tudominio.com`. Con `onboarding@resend.dev` Resend solo entrega al correo de tu cuenta de Resend.

Notas: PocketBase limita `request-otp` a 10 solicitudes por hora por IP; la web deja 60 s entre solicitudes. El estado real de cada envío se consulta en `/api/neptuno/auth/otp-status?otpId=…`. Para probar sin enviar correos reales: `node tools/mock-smtp-server.mjs --port 2525` (con `SMTP_HOST=127.0.0.1 SMTP_PORT=2525`) o `node tools/mock-mail-server.mjs --port 9999` (con `BUILDER_MAILER_API_URL=http://127.0.0.1:9999`).

## Sensores, reportes y ajustes

- **Sensores** (`/sensors`): cada cultivo tiene un plano en cuadrícula (hasta 6×6, 2×2 por defecto) donde se colocan hasta 12 sensores (humedad del suelo, temperatura, nivel de agua). Cada uno muestra su última lectura y su estado: *Normal*, *Alerta* (fuera de los umbrales del cultivo), *Sin señal* (pasaron 3 intervalos del dispositivo, mínimo 60 s, sin datos) o *Sin lecturas*. El dispositivo sigue enviando `soil_humidity`, `temperature` y `water_level` a `/api/neptuno/ingest`: esa lectura actualiza todos los sensores del mismo tipo. Para valores distintos por sensor, el dispositivo puede añadir `"sensor_readings": {"<id del sensor>": 41.5}`. Las lecturas del Laboratorio y las `demo` no tocan los sensores.
- **Reportes** (`/reports`): periodo de 7, 30 o 90 días, o un rango de fechas (máx. 400 días). Muestra consumo de agua (caudal × minutos reales de riego, por lo que requiere el caudal del cultivo), riegos, tiempo de riego, humedad/agua y resumen de lecturas, y permite descargar un **PDF** (resumen con gráfica) y un **Excel** (hojas Resumen, Consumo diario con totales por fórmula, Riegos, Lecturas por hora y Sensores). Las lecturas se agrupan por hora en el servidor (`/api/neptuno/reports/readings`).
- **Ajustes** (`/settings`): nombre, zona horaria, unidades (litros/galones, °C/°F; los datos siempre se guardan en litros y °C), valores por defecto de los cultivos nuevos, notificaciones, cuánto tiempo conservar las lecturas detalladas (7–90 días; luego se resumen por hora), descarga de tus datos en JSON y eliminación de la cuenta.
- Prueba del backend de sensores y reportes: `node tools/e2e-sensors.mjs` (con `PB_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`).

## Laboratorio de simulación

En **Laboratorio** (`/simulator`) cada cultivo puede tener un cultivo virtual para probar el riego sin sensores ni agua. La simulación pasa por el mismo motor de decisiones que un dispositivo físico (`irrigation-core.js`), corre en el servidor (sigue aunque cierres sesión; en marcha avanza un paso por minuto real) y permite avanzar paso a paso, cambiar humedad, agua y temperatura a mano y provocar fallos: sensor desconectado, lectura inválida y riego sin efecto.

Está aislada del hardware: usa un dispositivo marcado `is_simulated` que no acepta lecturas externas, sus lecturas y registros se marcan como Demo, y no envía correos. Los valores de la física del suelo (`simulation-model.js`) son ilustrativos: sirven para probar el software, no son parámetros agronómicos ni de un sensor real.

## Qué es real y qué es simulado

- Las lecturas se marcan como **Demo** cuando vienen del simulador; solo un dispositivo físico conectado al endpoint produce datos de hardware real.
- El consumo de agua no es una medición directa: es **estimado** como caudal configurado (L/min) multiplicado por la duración real de cada sesión.
- Los umbrales de humedad, agua y temperatura son configurables por cultivo. No se precargan valores agronómicos supuestos.
- Las alertas de correo se encolan y se procesan en segundo plano. Se puede activar cada tipo desde **Ajustes**; para cada tipo y cultivo se limita el envío a un correo cada 30 minutos.
- Las lecturas crudas se conservan durante 30 días; después se agrupan por hora y se guardan como promedios históricos para las estadísticas.

## Comprobaciones

```powershell
npm run test:run --prefix apps/web
npm run lint --prefix apps/web
npm run build --prefix apps/web
```

### Prueba integral contra PocketBase

Con PocketBase 0.36.1 iniciado y sus migraciones aplicadas, configura las variables de entorno sin escribir credenciales en el comando ni en el repositorio:

```powershell
$env:PB_URL = "http://127.0.0.1:8090"
$env:PB_ADMIN_EMAIL = "superusuario-local@example.test"
$env:PB_ADMIN_PASSWORD = "CONTRASENA_LOCAL"
node tools/e2e-smoke.mjs
```

El smoke test crea dos usuarios descartables, comprueba ingesta, AUTO, anulación manual, reglas de acceso y el ciclo ON → OFF → ON con el simulador; elimina los usuarios de prueba al terminar. Para incluir la espera del vigilante:

```powershell
node tools/e2e-smoke.mjs --slow
```

Si defines además `MOCK_MAIL_URL=http://127.0.0.1:9999` (con `node tools/mock-mail-server.mjs --port 9999` y PocketBase arrancado con `BUILDER_MAILER_API_URL` apuntando ahí) se prueba también el flujo completo del código de verificación.

También comprueba que todas las colecciones tengan `created`/`updated` y que un cultivo sin umbrales no genere alertas ni correos.

### Prueba de pantallas en navegador

Con PocketBase y la web (`npm run dev`) en marcha:

```powershell
$env:PB_URL = "http://127.0.0.1:8090"
$env:PB_ADMIN_EMAIL = "superusuario-local@example.test"
$env:PB_ADMIN_PASSWORD = "CONTRASENA_LOCAL"
npx playwright test
```

Crea un usuario descartable, recorre las pantallas principales y falla ante cualquier respuesta HTTP >= 400 o `console.error`. Atajos: `npm test`, `npm run test:e2e`, `npm run test:ui`.

Ejecuta estos checks solo contra una instancia local de pruebas; no uses una base con datos de producción.

## Registro e inicio de sesión con Google

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto → *APIs y servicios* → *Pantalla de consentimiento de OAuth* (tipo Externo, con tu correo) → *Credenciales* → *Crear credenciales* → *ID de cliente de OAuth* (aplicación web).
2. En *URI de redireccionamiento autorizados* añade `http://127.0.0.1:8090/api/oauth2-redirect` y `http://localhost:8090/api/oauth2-redirect`. En producción añade `https://TU-API/api/oauth2-redirect`. Google no acepta IP de red local (como 192.168.x.x), así que en desarrollo entra siempre por `localhost`.
3. Copia el *ID de cliente* y el *Secreto* a `.env` como `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` y reinicia PocketBase. Si en el arranque ves «[google] Inicio de sesión con Google activado desde el entorno», el botón aparece en Registro e Inicio de sesión.
4. Mientras la app esté en modo *Pruebas*, solo entran los correos que añadas como usuarios de prueba; para abrirla a todos, pulsa *Publicar aplicación* en la pantalla de consentimiento.
5. Quien se registra con Google queda con el correo verificado y no necesita código. Si ya existía una cuenta con ese correo, se enlaza a ella.
