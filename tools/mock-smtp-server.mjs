#!/usr/bin/env node
// Servidor SMTP mínimo para pruebas locales (sin TLS). Guarda los mensajes recibidos.
//   node tools/mock-smtp-server.mjs [--port 2525]   ·   GET http://127.0.0.1:<port+1>/__outbox
import net from 'node:net';
import http from 'node:http';

const arg = process.argv.indexOf('--port');
const port = arg > -1 ? Number(process.argv[arg + 1]) : 2525;
const outbox = [];

net.createServer((socket) => {
  let buffer = '';
  let inData = false;
  let message = { from: '', to: [], data: '', authenticated: false };
  const send = (line) => socket.write(`${line}\r\n`);
  send('220 mock-smtp ready');
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let index;
    while ((index = buffer.indexOf('\r\n')) > -1) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (inData) {
        if (line === '.') {
          inData = false;
          outbox.push({ ...message, receivedAt: new Date().toISOString() });
          message = { from: '', to: [], data: '', authenticated: message.authenticated };
          send('250 queued');
        } else message.data += `${line}\n`;
        continue;
      }
      const command = line.toUpperCase();
      if (command.startsWith('EHLO') || command.startsWith('HELO')) { socket.write('250-mock-smtp\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n'); }
      else if (command.startsWith('AUTH PLAIN')) { message.authenticated = true; send('235 ok'); }
      else if (command.startsWith('AUTH LOGIN')) { message.authenticated = true; send('334 VXNlcm5hbWU6'); }
      else if (command.startsWith('MAIL FROM')) { message.from = line.slice(10); send('250 ok'); }
      else if (command.startsWith('RCPT TO')) { message.to.push(line.slice(8)); send('250 ok'); }
      else if (command === 'DATA') { inData = true; send('354 go'); }
      else if (command === 'QUIT') { send('221 bye'); socket.end(); }
      else if (message.authenticated && /^[A-Za-z0-9+/=]+$/.test(line)) { send(line.length < 30 ? '334 UGFzc3dvcmQ6' : '235 ok'); }
      else send('250 ok');
    }
  });
  socket.on('error', () => {});
}).listen(port, '127.0.0.1', () => console.log(`Mock SMTP en 127.0.0.1:${port}`));

http.createServer((request, response) => {
  if (request.url === '/__outbox') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(outbox)); }
  else { response.statusCode = 404; response.end(); }
}).listen(port + 1, '127.0.0.1');
