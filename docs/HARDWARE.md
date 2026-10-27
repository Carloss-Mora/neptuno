# Controlador de Neptuno: qué comprar y cómo conectarlo

> El programa de referencia (`firmware/neptuno-controller/neptuno-controller.ino`) **no se ha probado en hardware**. Las reglas que implementa sí están probadas en software (`tools/controller-rules.js`). Pruébalo primero **con la bomba y las válvulas desconectadas** y calibra los sensores.

## Recomendación: ESP32 DevKit (WROOM-32, 30 pines)

Es la placa más usada para este tipo de proyecto: trae WiFi, cuesta poco, se programa con el IDE de Arduino y tiene entradas analógicas para los sensores. Alternativa: ESP8266 (más barata, pero una sola entrada analógica y menos pines).

## Lista de materiales (1 línea de riego, 2 zonas)

Los precios son **aproximados en pesos colombianos** (referencia de tiendas como Mercado Libre, Didácticas Electrónicas o Electrónica Panamericana; verifícalos antes de comprar, cambian bastante):

| # | Pieza | Para qué | Cant. | Precio aprox. |
|---|-------|----------|-------|---------------|
| 1 | ESP32 DevKit 30 pines | Cerebro: WiFi y reglas de riego | 1 | $30.000 – $45.000 |
| 2 | Módulo de 2 relés 5 V (con optoacoplador) | Abre y cierra las válvulas | 1 | $10.000 – $18.000 |
| 3 | Electroválvula 12 V DC, ½" normalmente cerrada | Deja pasar el agua | 2 | $35.000 – $70.000 c/u |
| 4 | Fuente 12 V 2 A | Alimenta las válvulas | 1 | $20.000 – $35.000 |
| 5 | Convertidor reductor 12 V → 5 V (LM2596) o fuente USB 5 V | Alimenta el ESP32 y el módulo de relés | 1 | $6.000 – $12.000 |
| 6 | Sensor de humedad de suelo **capacitivo** v1.2 | Mide la humedad (uno por zona) | 2 | $10.000 – $18.000 c/u |
| 7 | Sensor de temperatura DS18B20 sumergible | Temperatura del cultivo | 1 | $10.000 – $18.000 |
| 8 | Sensor de nivel del tanque: flotador, o ultrasónico JSN-SR04T | Nivel de agua | 1 | $10.000 – $50.000 |
| 9 | Sensor de caudal YF-S201 (opcional) | Detecta fugas u obstrucciones | 1 | $25.000 – $40.000 |
| 10 | Resistencia 4.7 kΩ, diodos 1N4007, protoboard o placa, cables, caja plástica IP65, prensaestopas | Conexión y protección | – | $30.000 – $60.000 |

**Total aproximado: entre $250.000 y $450.000** según las opciones. Para una prueba de mesa (sin válvulas reales) basta con las piezas 1, 2, 6 y 7: unos **$70.000 – $100.000**.

Elige sensores **capacitivos** (no los de dos puntas metálicas "resistivos"): los resistivos se corroen en semanas dentro del suelo.

## Conexiones (según el programa de referencia)

```
Fuente 12 V ──┬──────────────► relé 1 (COM) ──► válvula 1 ──► vuelve al negativo de la fuente
              └──────────────► relé 2 (COM) ──► válvula 2 ──► vuelve al negativo
12 V ──► LM2596 (ajustado a 5 V) ──► ESP32 pin VIN y módulo de relés VCC
Todos los negativos (GND) unidos: fuente, ESP32, relés y sensores.

ESP32 GPIO 26 ──► IN1 del módulo de relés (zona 1)
ESP32 GPIO 27 ──► IN2 del módulo de relés (zona 2)
ESP32 GPIO 34 ◄── sensor de humedad zona 1 (salida AOUT), alimentado con 3.3 V
ESP32 GPIO 35 ◄── sensor de humedad zona 2 (AOUT), alimentado con 3.3 V
ESP32 GPIO 32 ◄── nivel del tanque (salida analógica)
ESP32 GPIO 4  ◄── DS18B20 (cable de datos) + resistencia 4.7 kΩ entre datos y 3.3 V
ESP32 GPIO 25 ◄── YF-S201 (cable de señal; alimentado con 5 V) — opcional
```

Reglas importantes:

- Pon un **diodo 1N4007** en antiparalelo sobre cada válvula (la raya hacia el positivo): protege el relé del pico al apagarla.
- Los pines 34 y 35 solo son de entrada: perfectos para los sensores analógicos.
- Usa los sensores analógicos con **3.3 V**, nunca 5 V, en las entradas del ESP32.
- Caja plástica cerrada (IP65), empalmes con conectores sellados y la electrónica **lejos del agua**. Nunca mezcles los 12 V de las válvulas con la corriente de la casa sin un instalador.
- Si la válvula es de 110/220 V, usa un relé con aislamiento adecuado y que lo instale una persona calificada.

## Pasos para ponerlo a funcionar

1. En Neptuno: **Cultivos** → crea el cultivo y sus zonas (cada zona usa un canal de válvula, 1 y 2). En **Sensores** registra los sensores de suelo de cada zona y anota su ID.
2. En **Sensores → Dispositivos** registra un dispositivo nuevo y copia la **clave** que muestra una sola vez.
3. En el IDE de Arduino instala el soporte para ESP32 y las librerías *ArduinoJson 7*, *OneWire* y *DallasTemperature*.
4. Abre `neptuno-controller.ino` y completa la configuración del inicio: WiFi, `INGEST_URL` (la dirección de tu servidor `/api/neptuno/ingest`), `DEVICE_KEY` y los IDs de sensores de suelo.
5. **Calibra los sensores de suelo**: anota la lectura ADC con el sensor al aire (seco) y dentro de un vaso de agua (100 %) y escribe esos valores en `SOIL_ADC_DRY` / `SOIL_ADC_WET`. Haz lo mismo con el nivel del tanque.
6. Sube el programa con las válvulas **desconectadas** y mira el Monitor Serie. En el Panel Principal de Neptuno deben aparecer las lecturas.
7. Con el cultivo en modo manual, enciende el riego desde Neptuno y comprueba que el relé hace «clic». Luego conecta las válvulas.
8. Prueba que, al apagar el router, el controlador cierra las válvulas o sigue con las reglas sin internet (ver `docs/CONTROLADOR.md`).

## Para la hidráulica (aparte de la electrónica)

Tanque o fuente de agua, bomba (si no hay presión suficiente), filtro de malla o de disco antes de la línea (los goteros se tapan), manguera de goteo con emisores cada 20–30 cm, reguladores de presión si hace falta y un manómetro para verificar.
