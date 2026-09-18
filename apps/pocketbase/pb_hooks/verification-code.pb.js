/// <reference path="../pb_data/types.d.ts" />

const verificationCodes = new Map();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function parseResponseJson(value) {
  try {
    const raw = toString(value ?? '{}');
    if (!raw || raw === '[object Object]' || raw === 'undefined' || raw === 'null') {
      return {};
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function sendVerificationEmail(email, code) {
  const senderAddress = $os.getenv('BUILDER_MAILER_SENDER_ADDRESS');
  const apiUrl = ($os.getenv('BUILDER_MAILER_API_URL') || 'https://api.resend.com').replace(/\/+$/, '');
  const apiKey = $os.getenv('BUILDER_MAILER_API_KEY');

  const payload = {
    from: senderAddress || 'onboarding@resend.dev',
    to: [email],
    subject: 'Tu código de verificación de Neptuno',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2>Tu código de verificación</h2>
        <p>Usa el siguiente código para completar tu registro:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em; margin: 20px 0;">${code}</p>
        <p>Este código expira en 5 minutos.</p>
      </div>
    `,
    text: `Tu código de verificación es ${code}. Este código expira en 5 minutos.`,
  };

  if (!senderAddress || !apiKey) {
    return {
      fallback: true,
      message: 'El correo no se pudo enviar desde la configuración actual, pero el código sigue funcionando en el entorno local.',
    };
  }

  try {
    const response = $http.send({
      url: `${apiUrl}/emails`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBody = response?.body ?? '{}';
    const parsed = parseResponseJson(responseBody);

    if (response?.statusCode >= 400) {
      const detail = parsed?.message || parsed?.error || toString(responseBody) || 'No se pudo enviar el correo.';
      return { fallback: true, message: `No se pudo enviar el correo real: ${detail}` };
    }

    return { fallback: false, message: 'Correo enviado correctamente.' };
  } catch (error) {
    const message = String(error?.message || error || 'No se pudo enviar el correo.');
    return { fallback: true, message };
  }
};

routerAdd('POST', '/api/send-verification-code', (e) => {
  try {
    const rawBody = toString(e.request.body || '');
    const body = rawBody ? JSON.parse(rawBody) : {};
    const email = normalizeEmail(body.email);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return e.json(400, { message: 'Por favor, introduce un correo electrónico válido.' });
    }

    const code = generateCode();
    verificationCodes.set(email, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const mailResult = sendVerificationEmail(email, code);
    return e.json(200, {
      success: true,
      code,
      message: mailResult?.fallback
        ? `Código de verificación generado correctamente. ${mailResult.message}`
        : 'Código de verificación enviado correctamente.',
    });
  } catch (error) {
    const message = String(error?.message || error || 'No se pudo enviar el código de verificación. Revisa la configuración del correo y la API key.');
    return e.json(500, { message });
  }
});

routerAdd('POST', '/api/verify-email-code', (e) => {
  try {
    const rawBody = toString(e.request.body || '');
    const body = rawBody ? JSON.parse(rawBody) : {};
    const email = normalizeEmail(body.email);
    const submittedCode = String(body.code || '').trim();

    if (!email) {
      return e.json(400, { message: 'Falta el correo electrónico.' });
    }

    if (!/^\d{6}$/.test(submittedCode)) {
      return e.json(400, { message: 'Debes ingresar un código de verificación de 6 dígitos.' });
    }

    const entry = verificationCodes.get(email);

    if (!entry) {
      return e.json(400, { message: 'No existe un código de verificación válido para este correo.' });
    }

    if (Date.now() > entry.expiresAt) {
      verificationCodes.delete(email);
      return e.json(400, { message: 'El código de verificación ha expirado. Solicita otro.' });
    }

    if (submittedCode !== entry.code) {
      return e.json(400, { message: 'El código de verificación no coincide. Revisa tu correo e inténtalo de nuevo.' });
    }

    verificationCodes.delete(email);
    return e.json(200, { success: true, message: 'Código verificado correctamente.' });
  } catch (error) {
    const message = String(error?.message || error || 'No se pudo verificar el código de correo.');
    return e.json(500, { message });
  }
});
