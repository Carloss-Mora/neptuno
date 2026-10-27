// Genera un código QR para abrir Neptuno desde un celular conectado a la misma red WiFi que este computador.
// Uso:  npm run qr            (usa la primera dirección de red local que encuentre)
//       npm run qr -- 192.168.1.20   (o indica la dirección a mano)
import os from 'node:os';
import QRCode from 'qrcode';

const given = process.argv[2];
const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((net) => net && net.family === 'IPv4' && !net.internal)
  .map((net) => net.address);
const ip = given || addresses.find((a) => a.startsWith('192.168.') || a.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(a)) || addresses[0];
if (!ip) {
  console.error('No encontré una red local. Conecta el computador al WiFi o al punto de acceso del celular e inténtalo de nuevo.');
  process.exit(1);
}
const url = `http://${ip}:3000`;
await QRCode.toFile('neptuno-qr-local.png', url, { width: 640, margin: 2 });
console.log(`Dirección para los celulares: ${url}`);
console.log('Guardé el código QR en neptuno-qr-local.png (ábrelo y muéstralo en pantalla).');
console.log(addresses.length > 1 ? `Otras direcciones de este equipo: ${addresses.join(', ')}` : '');
