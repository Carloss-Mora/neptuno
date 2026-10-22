/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.otp = {
    enabled: true,
    duration: 300,
    length: 6,
    emailTemplate: {
      subject: 'Tu código de verificación de Neptuno',
      body: [
        '<p>Hola,</p>',
        '<p>Introduce este código en Neptuno para verificar tu correo e iniciar sesión:</p>',
        '<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">{OTP}</p>',
        '<p>El código caduca en 5 minutos. Si no solicitaste este código, puedes ignorar este mensaje.</p>',
      ].join(''),
    },
  };

  return app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId('users');
  users.otp = {
    enabled: false,
    duration: 0,
    length: 8,
    emailTemplate: {
      subject: 'Your one-time password',
      body: '<p>Your one-time password is <strong>{OTP}</strong>.</p>',
    },
  };

  return app.save(users);
});
