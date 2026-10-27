/// <reference path="../pb_data/types.d.ts" />

// Activa "Continuar con Google" desde variables de entorno al arrancar:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Si no están definidas, el botón de Google simplemente no aparece (y si estaba activado
// a mano en el panel de PocketBase, no se toca). Con ellas, sirve para registrarse y para entrar.
onBootstrap((e) => {
  e.next();
  const clientId = ($os.getenv('GOOGLE_CLIENT_ID') || '').trim();
  const clientSecret = ($os.getenv('GOOGLE_CLIENT_SECRET') || '').trim();
  if (!clientId || !clientSecret) return;
  try {
    const users = $app.findCollectionByNameOrId('users');
    users.oauth2.enabled = true;
    users.oauth2.providers = [{ name: 'google', clientId, clientSecret }];
    $app.save(users);
    console.log('[google] Inicio de sesión con Google activado desde el entorno');
  } catch (error) {
    console.error('[google] No se pudo activar Google desde el entorno:', error);
  }
});
