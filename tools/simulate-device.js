#!/usr/bin/env node

const readArguments = (args) => {
  const options = {
    url: process.env.POCKETBASE_URL || 'http://127.0.0.1:8090',
    key: process.env.DEVICE_KEY || '',
    interval: 15,
    failure: '',
    humidity: 70,
    temperature: 22,
    waterLevel: 80,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === '--url' && value) {
      options.url = value;
      index += 1;
    } else if (argument === '--key' && value) {
      options.key = value;
      index += 1;
    } else if (argument === '--interval' && value) {
      options.interval = Number(value);
      index += 1;
    } else if (argument === '--failure' && value) {
      options.failure = value;
      index += 1;
    } else if (argument === '--humidity' && value) {
      options.humidity = Number(value);
      index += 1;
    } else if (argument === '--temperature' && value) {
      options.temperature = Number(value);
      index += 1;
    } else if (argument === '--water-level' && value) {
      options.waterLevel = Number(value);
      index += 1;
    } else if (argument === '--help') {
      options.help = true;
    } else {
      throw new Error(`Argumento desconocido o sin valor: ${argument}`);
    }
  }

  return options;
};

const printHelp = () => {
  console.log(`Simulador de dispositivo Neptuno

Uso:
  node tools/simulate-device.js --url http://127.0.0.1:8090 --key <CLAVE>

Opciones:
  --interval <segundos>          Intervalo entre lecturas (por defecto: 15)
  --humidity <0-100>             Humedad inicial (por defecto: 70)
  --temperature <-10..60>        Temperatura inicial (por defecto: 22)
  --water-level <0-100>           Nivel de agua (por defecto: 80)
  --failure disconnect|low-water Simula desconexión o nivel bajo
  DEVICE_KEY=<CLAVE>             Alternativa a --key
`);
};

const main = async () => {
  const options = readArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.key) throw new Error('Falta la clave; usa --key o la variable DEVICE_KEY.');
  if (!Number.isInteger(options.interval) || options.interval < 1 || options.interval > 3600) {
    throw new Error('El intervalo debe ser un entero entre 1 y 3600 segundos.');
  }
  if (options.failure && !['disconnect', 'low-water'].includes(options.failure)) {
    throw new Error('El modo de fallo debe ser disconnect o low-water.');
  }
  if (!Number.isFinite(options.humidity) || options.humidity < 0 || options.humidity > 100) {
    throw new Error('La humedad inicial debe estar entre 0 y 100.');
  }
  if (!Number.isFinite(options.temperature) || options.temperature < -10 || options.temperature > 60) {
    throw new Error('La temperatura debe estar entre -10 y 60.');
  }
  if (!Number.isFinite(options.waterLevel) || options.waterLevel < 0 || options.waterLevel > 100) {
    throw new Error('El nivel de agua debe estar entre 0 y 100.');
  }
  if (typeof fetch !== 'function') {
    throw new Error('Este simulador requiere Node.js 18 o superior (fetch integrado).');
  }

  const endpoint = new URL('/api/neptuno/ingest', options.url).toString();
  let humidity = options.humidity;
  let waterLevel = options.failure === 'low-water' ? Math.min(options.waterLevel, 10) : options.waterLevel;
  let desiredState = 'OFF';
  console.log(`Enviando lecturas demo a ${endpoint} cada ${options.interval} s. Ctrl+C para detener.`);
  if (options.failure) console.log(`Fallo simulado: ${options.failure}`);

  const sendReading = async () => {
    if (options.failure === 'disconnect') {
      console.log(`[${new Date().toLocaleTimeString()}] Corte de conexión simulado; no se envió lectura.`);
      return;
    }

    humidity = Math.min(100, Math.max(0, humidity + (desiredState === 'ON' ? 2 : -1)));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': options.key,
      },
      body: JSON.stringify({
        soil_humidity: humidity,
        temperature: options.temperature,
        water_level: waterLevel,
        demo: true,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[${new Date().toLocaleTimeString()}] HTTP ${response.status}: ${body.message || 'No se aceptó la lectura.'}`);
      return;
    }

    desiredState = body.irrigation === 'ON' ? 'ON' : 'OFF';
    console.log(`[${new Date().toLocaleTimeString()}] Humedad ${humidity.toFixed(1)}% · agua ${waterLevel}% · riego ${desiredState}`);
  };

  await sendReading();
  const timer = setInterval(() => {
    sendReading().catch((error) => console.error('No se pudo enviar la lectura:', error.message));
  }, options.interval * 1000);

  process.once('SIGINT', () => {
    clearInterval(timer);
    console.log('\nSimulador detenido.');
    process.exitCode = 0;
  });
};

main().catch((error) => {
  console.error(error.message);
  printHelp();
  process.exitCode = 1;
});
