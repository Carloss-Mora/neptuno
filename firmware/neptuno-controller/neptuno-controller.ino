// Neptuno · controlador de riego (ESP32) — SKETCH DE REFERENCIA
//
// IMPORTANTE: este sketch implementa el protocolo y las reglas sin internet de docs/CONTROLADOR.md,
// pero NO se ha compilado ni probado en hardware. Revisa los pines, calibra los sensores y pruébalo
// con la bomba desconectada antes de usarlo. Las mismas reglas están probadas en tools/controller-rules.js.
//
// Librerías: WiFi, HTTPClient (incluidas en el núcleo ESP32) y ArduinoJson 7.
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ---- Configuración de tu instalación ----------------------------------------------------------------------
const char* WIFI_SSID = "TU_WIFI";
const char* WIFI_PASSWORD = "TU_CLAVE";
const char* INGEST_URL = "https://TU_SERVIDOR/api/neptuno/ingest";
const char* DEVICE_KEY = "CLAVE_DEL_DISPOSITIVO";   // la que muestra Neptuno al registrar el dispositivo
const unsigned long INTERVAL_MS = 15000;             // igual al intervalo configurado del dispositivo

const int ZONES = 2;                                  // número de válvulas (1 a 8)
const int RELAY_PINS[ZONES] = {26, 27};               // salida de cada válvula (canal 1, 2, ...)
const int SOIL_PINS[ZONES] = {34, 35};                // sensor de humedad de suelo de cada zona (ADC)
const int WATER_LEVEL_PIN = 32;                       // nivel del tanque (ADC)
const bool RELAY_ACTIVE_LOW = true;                   // muchos módulos de relé activan con LOW

// Calibración: lectura ADC con el sensor en el aire (seco) y sumergido en agua (100 %).
const int SOIL_ADC_DRY = 3200, SOIL_ADC_WET = 1400;
const int WATER_ADC_EMPTY = 500, WATER_ADC_FULL = 3000;

const unsigned long AUTONOMOUS_MAX_MS = 6UL * 60UL * 60UL * 1000UL;  // máximo operando sin servidor
const float WATER_MIN_PERCENT = 20.0;                                // igual que el servidor
// -----------------------------------------------------------------------------------------------------------

struct Zone {
  bool on = false;
  bool serverOn = false;
  unsigned long onSince = 0, lastStop = 0, cycleOnMs = 0;
  bool hasStopped = false, inPulseCycle = false;
  float humidity = 0;
};
struct Config {
  bool valid = false;
  bool automatic = false;
  float humidityMin = 0, humidityMax = 0;
  unsigned long maxIrrigationMs = 0, minRestMs = 0, pulseOnMs = 0, pulseOffMs = 0;
} config;

Zone zones[ZONES];
unsigned long lastContact = 0, holdMs = 60000, lastSend = 0;
float waterLevel = 0;
bool sensorsOk = true;

float readPercent(int pin, int rawLow, int rawHigh) {
  int raw = analogRead(pin);
  if (raw <= 0 || raw >= 4095) return NAN;            // cable suelto o corto: lectura no válida
  float percent = 100.0 * (raw - rawLow) / (float)(rawHigh - rawLow);
  return constrain(percent, 0.0, 100.0);
}

void setValve(int index, bool on) {
  Zone& zone = zones[index];
  if (on == zone.on) return;
  digitalWrite(RELAY_PINS[index], (on != RELAY_ACTIVE_LOW) ? HIGH : LOW);
  unsigned long now = millis();
  if (on) zone.onSince = now;
  else { zone.lastStop = now; zone.hasStopped = true; }
  zone.on = on;
}

void closeAll() { for (int i = 0; i < ZONES; i++) setValve(i, false); }

void readSensors() {
  sensorsOk = true;
  for (int i = 0; i < ZONES; i++) {
    float h = readPercent(SOIL_PINS[i], SOIL_ADC_DRY, SOIL_ADC_WET);
    if (isnan(h)) sensorsOk = false; else zones[i].humidity = h;
  }
  float w = readPercent(WATER_LEVEL_PIN, WATER_ADC_EMPTY, WATER_ADC_FULL);
  if (isnan(w)) sensorsOk = false; else waterLevel = w;
}

// Misma política que apps/pocketbase/pb_hooks/irrigation-policy.js, para una zona.
// Devuelve el estado deseado; actualiza el ciclo de pulsos.
bool decideZone(int index, unsigned long now) {
  Zone& zone = zones[index];
  if (waterLevel < WATER_MIN_PERCENT) { zone.inPulseCycle = false; zone.cycleOnMs = 0; return false; }

  if (zone.on) {
    unsigned long running = now - zone.onSince;
    if (zone.cycleOnMs + running >= config.maxIrrigationMs) { zone.inPulseCycle = false; zone.cycleOnMs = 0; return false; }
    if (zone.humidity >= config.humidityMax) { zone.inPulseCycle = false; zone.cycleOnMs = 0; return false; }
    if (config.pulseOnMs > 0 && config.pulseOffMs > 0 && running >= config.pulseOnMs) {
      zone.cycleOnMs += running;
      zone.inPulseCycle = true;
      return false;                                   // pausa entre pulsos
    }
    return true;
  }

  if (config.pulseOnMs > 0 && config.pulseOffMs > 0 && zone.inPulseCycle) {
    if (zone.cycleOnMs >= config.maxIrrigationMs || zone.humidity >= config.humidityMax) {
      zone.inPulseCycle = false; zone.cycleOnMs = 0; return false;
    }
    if (zone.hasStopped && now - zone.lastStop < config.pulseOffMs) return false;
    return true;                                      // otro pulso
  }

  if (zone.hasStopped && now - zone.lastStop < config.minRestMs) return false;
  if (zone.humidity < config.humidityMin) { zone.cycleOnMs = 0; return true; }
  return false;
}

// Reglas sin internet (ver docs/CONTROLADOR.md).
void runOfflineRules(unsigned long now) {
  unsigned long offline = now - lastContact;
  if (offline <= holdMs) {                            // contacto reciente: obedecer lo último del servidor
    for (int i = 0; i < ZONES; i++) setValve(i, zones[i].serverOn);
    return;
  }
  bool autonomous = config.valid && config.automatic && sensorsOk && offline <= holdMs + AUTONOMOUS_MAX_MS;
  if (!autonomous) { closeAll(); return; }            // ante la duda, cerrado
  for (int i = 0; i < ZONES; i++) setValve(i, decideZone(i, now));
}

bool sendReading() {
  if (WiFi.status() != WL_CONNECTED) return false;
  JsonDocument body;
  float soilAverage = 0;
  for (int i = 0; i < ZONES; i++) soilAverage += zones[i].humidity;
  body["soil_humidity"] = soilAverage / ZONES;
  body["temperature"] = 22.0;                         // TODO: lee tu sensor de temperatura (DHT22, DS18B20...)
  body["water_level"] = waterLevel;
  // Para humedades distintas por sensor añade "sensor_readings": {"<id del sensor>": valor}.
  String payload;
  serializeJson(body, payload);

  WiFiClientSecure client;
  client.setInsecure();                               // TODO: en producción usa setCACert() con el certificado de tu servidor
  HTTPClient http;
  http.setTimeout(8000);
  if (!http.begin(client, INGEST_URL)) return false;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int status = http.POST(payload);
  if (status != 200) { http.end(); return false; }

  JsonDocument reply;
  DeserializationError error = deserializeJson(reply, http.getString());
  http.end();
  if (error) return false;

  lastContact = millis();
  if (reply["hold_seconds"].is<int>()) holdMs = (unsigned long)reply["hold_seconds"].as<int>() * 1000UL;
  JsonObject cfg = reply["config"];
  config.valid = !cfg.isNull();
  config.automatic = config.valid && String(cfg["control_mode"] | "") == "AUTO";
  config.humidityMin = cfg["humidity_min"] | 0.0;
  config.humidityMax = cfg["humidity_max"] | 0.0;
  config.maxIrrigationMs = (unsigned long)((cfg["max_irrigation_minutes"] | 0) * 60000UL);
  config.minRestMs = (unsigned long)((cfg["min_rest_minutes"] | 0) * 60000UL);
  config.pulseOnMs = (unsigned long)((cfg["pulse_on_minutes"] | 0) * 60000UL);
  config.pulseOffMs = (unsigned long)((cfg["pulse_off_minutes"] | 0) * 60000UL);
  if (config.humidityMax <= config.humidityMin || config.maxIrrigationMs == 0) config.valid = false;

  JsonArray zoneStates = reply["zones"];
  if (!zoneStates.isNull() && zoneStates.size() > 0) {
    for (JsonObject item : zoneStates) {               // un estado por canal de válvula (1..ZONES)
      int channel = item["channel"] | 0;
      if (channel >= 1 && channel <= ZONES) zones[channel - 1].serverOn = String(item["state"] | "OFF") == "ON";
    }
  } else {                                             // cultivo sin zonas: una orden para todas las válvulas
    bool on = String(reply["irrigation"] | "OFF") == "ON";
    for (int i = 0; i < ZONES; i++) zones[i].serverOn = on;
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < ZONES; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], RELAY_ACTIVE_LOW ? HIGH : LOW);  // válvulas cerradas al arrancar
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastContact = millis();
}

void loop() {
  unsigned long now = millis();
  if (WiFi.status() != WL_CONNECTED && now % 10000 < 50) WiFi.reconnect();

  readSensors();
  if (now - lastSend >= INTERVAL_MS) {
    lastSend = now;
    bool contact = sendReading();
    Serial.println(contact ? "Servidor: lectura enviada" : "Servidor: sin respuesta");
  }
  if (!sensorsOk) closeAll();                          // sensor dañado: cerrar siempre
  else runOfflineRules(now);
  delay(200);
}
