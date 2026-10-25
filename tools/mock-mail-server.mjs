#!/usr/bin/env node
// Servidor de correo simulado con la forma de la API de Resend (POST /emails).
// Sirve para probar el flujo de verificación sin enviar correos reales.
//
//   node tools/mock-mail-server.mjs [--port 9999]
//
// Control (solo para pruebas locales):
//   POST /__mode    {"mode":"ok"|"401"|"403"}   respuesta que dará POST /emails
//   GET  /__outbox                               correos recibidos
//   POST /__reset                                vacía la bandeja y vuelve a "ok"

import http from 'node:http';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const MODES = new Set(['ok', '401', '403']);

export const createMockMailServer = () => {
  let mode = 'ok';
  let outbox = [];

  const send = (response, status, payload) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(payload));
  };

  const server = http.createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }

      if (request.method === 'POST' && request.url === '/__mode') {
        if (!MODES.has(body.mode)) return send(response, 400, { message: 'Modo no válido.' });
        mode = body.mode;
        return send(response, 200, { mode });
      }
      if (request.method === 'POST' && request.url === '/__reset') {
        outbox = [];
        mode = 'ok';
        return send(response, 200, { mode });
      }
      if (request.method === 'GET' && request.url === '/__outbox') {
        return send(response, 200, { items: outbox });
      }

      if (request.method === 'POST' && request.url === '/emails') {
        outbox.push({
          mode,
          authorization: request.headers.authorization || '',
          from: body.from,
          to: body.to,
          subject: body.subject,
          html: body.html,
          text: body.text,
          receivedAt: new Date().toISOString(),
        });
        if (mode === '401') {
          return send(response, 401, { statusCode: 401, name: 'restricted_api_key', message: 'API key is invalid' });
        }
        if (mode === '403') {
          return send(response, 403, {
            statusCode: 403,
            name: 'validation_error',
            message: 'You can only send testing emails to your own email address. To send emails to other recipients, please verify a domain at resend.com/domains.',
          });
        }
        return send(response, 200, { id: `mock-${Date.now()}` });
      }

      return send(response, 404, { message: 'No encontrado.' });
    });
  });

  return server;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const portIndex = process.argv.indexOf('--port');
  const port = Number(portIndex > -1 ? process.argv[portIndex + 1] : process.env.MOCK_MAIL_PORT || 9999);
  createMockMailServer().listen(port, '127.0.0.1', () => {
    console.log(`Servidor de correo simulado en http://127.0.0.1:${port}`);
  });
}
