/// <reference path="../pb_data/types.d.ts" />

// Detrás de un proxy (Caddy) PocketBase vería a todo el mundo con la misma dirección y los límites de peticiones
// se compartirían entre todas las personas. Con NEPTUNO_TRUST_PROXY=true se usa la dirección real (X-Forwarded-For).
// Con NEPTUNO_RELAXED_LIMITS=true los límites suben para una sala llena de gente registrándose a la vez.
onBootstrap((e) => {
  e.next();
  try {
    const settings = $app.settings();
    let changed = false;
    if (String($os.getenv('NEPTUNO_TRUST_PROXY')).toLowerCase() === 'true') {
      settings.trustedProxy = { headers: ['X-Forwarded-For'], useLeftmostIP: true };
      changed = true;
    }
    if (String($os.getenv('NEPTUNO_RELAXED_LIMITS')).toLowerCase() === 'true') {
      const limits = { '/api': 1500, '*:auth': 120, 'POST /api/collections/users/request-otp': 120 };
      const rules = settings.rateLimits.rules.map((rule) => ({
        label: rule.label,
        audience: rule.audience,
        duration: rule.duration,
        maxRequests: limits[rule.label] || rule.maxRequests,
      }));
      settings.rateLimits = { enabled: settings.rateLimits.enabled, rules };
      changed = true;
    }
    if (changed) {
      $app.save(settings);
      console.log('[red] Proxy de confianza y límites ajustados desde el entorno');
    }
  } catch (error) {
    console.error('[red] No se pudo aplicar la configuración de proxy y límites:', error);
  }
});
