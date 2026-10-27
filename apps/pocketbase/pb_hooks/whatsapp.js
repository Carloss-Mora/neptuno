// Alertas por WhatsApp. Dos proveedores, elegidos con la variable WHATSAPP_PROVIDER:
//   cloud     (por defecto si hay WHATSAPP_TOKEN): API oficial de WhatsApp Business (Meta). Necesita una plantilla aprobada.
//   callmebot : servicio gratuito para uso personal; cada persona activa su número y recibe una clave (apikey).
// Módulo CommonJS que se carga con require() desde los hooks de PocketBase.

const API_DEFAULT = 'https://graph.facebook.com/v21.0';
const CALLMEBOT_DEFAULT = 'https://api.callmebot.com';

const env = (name) => String($os.getenv(name) || '');

module.exports = {
  // "+57 300 123 4567", "3001234567" o "573001234567" → "573001234567". '' si no parece un celular válido.
  normalizePhone(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('3')) digits = `57${digits}`;
    if (digits.length < 11 || digits.length > 15) return '';
    return digits;
  },

  validateSettings(record) {
    const raw = String(record.get('whatsapp_phone') || '').trim();
    const enabled = record.get('whatsapp_enabled') === true;
    if (raw === '' && !enabled) {
      record.set('whatsapp_phone', '');
      return;
    }
    const phone = this.normalizePhone(raw);
    if (!phone) throw new BadRequestError('Escribe un celular válido con indicativo, por ejemplo +57 300 123 4567.');
    record.set('whatsapp_phone', `+${phone}`);
    if (enabled && this.needsApiKey() && !String(record.get('whatsapp_apikey') || '').trim()) {
      throw new BadRequestError('Para activar WhatsApp escribe también tu clave de CallMeBot.');
    }
  },

  provider() {
    const chosen = env('WHATSAPP_PROVIDER').toLowerCase();
    if (chosen === 'callmebot' || chosen === 'cloud') return chosen;
    return env('WHATSAPP_TOKEN') ? 'cloud' : '';
  },

  configured() {
    const provider = this.provider();
    if (provider === 'cloud') return Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'));
    return provider === 'callmebot';
  },

  needsApiKey() {
    return this.provider() === 'callmebot';
  },

  // Los parámetros de plantilla de Meta no admiten saltos de línea, tabulaciones ni muchos espacios seguidos.
  clean(text) {
    return String(text || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 900);
  },

  // setting: registro de user_settings con whatsapp_phone y (para callmebot) whatsapp_apikey.
  send(setting, text) {
    const to = this.normalizePhone(setting.get('whatsapp_phone'));
    if (!to) throw new Error('El número de WhatsApp no es válido.');
    const body = this.clean(text);
    const provider = this.provider();
    let response;

    if (provider === 'cloud') {
      const base = env('WHATSAPP_API_BASE') || API_DEFAULT;
      response = $http.send({
        url: `${base}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
        method: 'POST',
        headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: env('WHATSAPP_TEMPLATE') || 'neptuno_alerta',
            language: { code: env('WHATSAPP_LANG') || 'es' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: body }] }],
          },
        }),
        timeout: 15,
      });
    } else if (provider === 'callmebot') {
      const apikey = String(setting.get('whatsapp_apikey') || '');
      if (!apikey) throw new Error('Falta la clave (apikey) de CallMeBot.');
      const base = env('WHATSAPP_API_BASE') || CALLMEBOT_DEFAULT;
      response = $http.send({
        url: `${base}/whatsapp.php?phone=${encodeURIComponent(`+${to}`)}&text=${encodeURIComponent(body)}&apikey=${encodeURIComponent(apikey)}`,
        method: 'GET',
        timeout: 15,
      });
    } else {
      throw new Error('WhatsApp no está configurado en el servidor.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`WhatsApp respondió ${response.statusCode}: ${String(response.raw || '').slice(0, 300)}`);
    }
    return true;
  },
};
