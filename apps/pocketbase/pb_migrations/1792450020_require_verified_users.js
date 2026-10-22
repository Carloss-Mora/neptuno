/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  let appUrl = $os.getenv('PUBLIC_APP_URL') || '';
  const isProduction = $os.getenv('NODE_ENV') === 'production';

  if (!appUrl && !isProduction) appUrl = 'http://localhost:3000';
  appUrl = appUrl.replace(/\/+$/, '');

  const hostMatch = appUrl.match(/^https:\/\/([^/:?#]+)/i);
  const publicHost = hostMatch ? hostMatch[1].toLowerCase() : '';
  const validUrl = isProduction
    ? /^https:\/\/[^\s"'<>]+$/i.test(appUrl) && !publicHost.endsWith('.example')
    : /^https?:\/\/[^\s"'<>]+$/i.test(appUrl);
  if (!validUrl) {
    throw new Error('Set a valid public app URL in PUBLIC_APP_URL or PocketBase settings before configuring email verification.');
  }

  users.authRule = 'verified = true';
  users.verificationTemplate = {
    subject: 'Verifica tu correo de Neptuno',
    body: [
      '<p>Hola,</p>',
      '<p>Confirma tu dirección de correo para activar tu cuenta de Neptuno:</p>',
      `<p><a href="${appUrl}/verify-email?token={{.Token}}">Verificar mi correo</a></p>`,
      '<p>Si no creaste esta cuenta, puedes ignorar este mensaje.</p>',
    ].join(''),
  };
  return app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId('users');
  users.authRule = null;
  users.verificationTemplate = {
    subject: 'Verify your email',
    body: '<p>Click on the button below to verify your email address.</p><p><a class="btn" href="{{.ActionURL}}">Verify</a></p>',
  };
  return app.save(users);
});
