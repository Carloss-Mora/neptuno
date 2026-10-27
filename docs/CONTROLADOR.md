# Controlador de riego y funcionamiento sin internet

Neptuno no acciona hardware por sí solo: un controlador (por ejemplo un ESP32 con relés y sensores) envía lecturas
al servidor y abre o cierra las válvulas según la respuesta. Esta guía define ese protocolo y qué debe hacer el
controlador cuando se queda sin internet. El sketch `firmware/neptuno-controller/neptuno-controller.ino` lo
implementa como referencia (**no compilado ni probado en hardware**); las reglas están probadas en
`tools/controller-rules.js`, y `node tools/simulate-device.js --failure disconnect` las muestra en acción.

## Protocolo

`POST /api/neptuno/ingest` con la cabecera `X-Device-Key` y el cuerpo:

```json
{ "soil_humidity": 52, "temperature": 24, "water_level": 80,
  "sensor_readings": { "<id del sensor>": 41.5 },
  "flow_lpm": 11.8 }
```

`sensor_readings` y `flow_lpm` son opcionales (humedades distintas por sensor y caudal medido). El servidor
acepta una lectura cada `intervalo / 2` segundos como mínimo.

Respuesta:

```json
{ "irrigation": "ON",
  "zones": [ { "id": "…", "name": "Lote norte", "channel": 1, "state": "ON" } ],
  "hold_seconds": 60,
  "config": { "control_mode": "AUTO", "humidity_min": 65, "humidity_max": 80,
              "max_irrigation_minutes": 60, "min_rest_minutes": 0,
              "pulse_on_minutes": 10, "pulse_off_minutes": 20 } }
```

- `irrigation`: ON si alguna zona debe regar. Sin zonas, es la orden para la válvula única.
- `zones`: estado deseado de cada válvula; `channel` es la salida del controlador (1 a 8).
- `hold_seconds`: cuánto tiempo (3 intervalos, mínimo 60 s) se obedece la última orden sin contacto.
- `config`: solo trae umbrales en modo `AUTO`; permite seguir regando sin servidor.

## Reglas sin internet

1. **Contacto reciente** (hasta `hold_seconds`): obedece lo último que dijo el servidor.
2. **Sin contacto y modo `AUTO` con umbrales válidos**: sigue regando solo con las mismas reglas del servidor
   (empieza bajo la humedad mínima, corta al llegar a la máxima, respeta el máximo de riego, el descanso y los
   pulsos), zona por zona con sus propios sensores, durante **6 horas como máximo**.
3. **Cualquier otro caso** cierra todas las válvulas: modo manual o programado, sin umbrales, sensor dañado o
   desconectado, nivel de agua bajo (< 20 %) o pasadas las 6 horas autónomas.
4. Al arrancar, las válvulas quedan cerradas hasta tener lecturas válidas.

El servidor, por su parte, registra una parada de seguridad (`WATCHDOG`) cuando el dispositivo deja de reportar
(2 intervalos, mínimo 60 s) y avisa al usuario de que el dispositivo está sin conexión.

## Antes de conectar una bomba real

- Prueba primero con la bomba desconectada y comprueba cada relé con el monitor serie.
- Calibra cada sensor de humedad (valor en aire y en agua) y el nivel del tanque.
- Usa HTTPS con el certificado de tu servidor (`setCACert`) en lugar de `setInsecure()`.
- Añade un fusible o protección térmica a la bomba y una válvula de alivio; el software no sustituye la
  protección eléctrica ni hidráulica.
