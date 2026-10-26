/// <reference path="../pb_data/types.d.ts" />

// Aplica la configuración SMTP desde variables de entorno al arrancar, para no depender
// de configurar a mano el panel de PocketBase (y que sea reproducible en cualquier equipo).
//   SMTP_HOST, SMTP_PORT (587 por defecto), SMTP_USERNAME, SMTP_PASSWORD,
//   SMTP_SENDER_ADDRESS, SMTP_SENDER_NAME (Neptuno por defecto), SMTP_TLS (true solo para el puerto 465).
// Si SMTP_HOST no está definido no toca nada.
onBootstrap((e) => {
  e.next();
  const host = $os.getenv('SMTP_HOST');
  if (!host) return;
  try {
    const settings = $app.settings();
    settings.smtp.enabled = true;
    settings.smtp.host = host;
    settings.smtp.port = Number($os.getenv('SMTP_PORT') || 587);
    settings.smtp.username = $os.getenv('SMTP_USERNAME') || '';
    settings.smtp.password = $os.getenv('SMTP_PASSWORD') || '';
    settings.smtp.tls = String($os.getenv('SMTP_TLS')).toLowerCase() === 'true';
    const sender = $os.getenv('SMTP_SENDER_ADDRESS') || $os.getenv('SMTP_USERNAME');
    if (sender) settings.meta.senderAddress = sender;
    settings.meta.senderName = $os.getenv('SMTP_SENDER_NAME') || 'Neptuno';
    $app.save(settings);
    console.log(`[correo] SMTP configurado desde el entorno: ${host}:${settings.smtp.port}`);
  } catch (error) {
    console.error('[correo] No se pudo aplicar la configuración SMTP del entorno:', error);
  }
});
