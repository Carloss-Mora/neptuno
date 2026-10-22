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

El smoke test crea dos usuarios descartables, comprueba ingesta, AUTO, anulación manual, reglas de acceso, y elimina los usuarios de prueba al terminar. Para incluir la espera del vigilante:

```powershell
node tools/e2e-smoke.mjs --slow
```

Ejecuta estos checks solo contra una instancia local de pruebas; no uses una base con datos de producción.
