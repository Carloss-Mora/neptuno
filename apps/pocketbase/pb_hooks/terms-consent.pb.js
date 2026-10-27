/// <reference path="../pb_data/types.d.ts" />

// Nadie crea una cuenta sin aceptar los términos y la política de privacidad (registro con correo o con Google).
// El administrador (superusuario) puede crear cuentas desde el panel sin este requisito.
// (Los handlers son aislados: los textos van dentro de cada uno.)
onRecordCreateRequest((e) => {
  const path = String(e.request && e.request.url ? e.request.url.path : '');
  if (e.hasSuperuserAuth() || path.indexOf('auth-with-oauth2') !== -1) {
    return e.next();
  }
  const body = e.requestInfo().body || {};
  const accepted = body.termsAccepted === true || body.termsAccepted === 'true';
  if (!accepted) {
    throw new BadRequestError('Para crear tu cuenta debes aceptar los términos y condiciones y la política de privacidad.');
  }
  e.record.set('terms_accepted_at', new DateTime());
  e.next();
}, 'users');

onRecordAuthWithOAuth2Request((e) => {
  console.log(`[oauth] ${e.providerName}: ${e.isNewRecord ? 'cuenta nueva' : 'cuenta existente'}`);
  if (e.isNewRecord) {
    const data = e.createData || {};
    if (data.termsAccepted !== true && data.termsAccepted !== 'true') {
      throw new BadRequestError('Esta cuenta de Google aún no está registrada. Créala desde «Registrarme» aceptando los términos y la política de privacidad.');
    }
    // En una cuenta nueva el registro puede no existir todavía: la fecha viaja en createData.
    try {
      if (e.record) e.record.set('terms_accepted_at', new DateTime());
      else data.terms_accepted_at = new Date().toISOString();
    } catch (error) {
      console.error('[oauth] No se pudo guardar la fecha de aceptación de términos:', error);
    }
  }
  try {
    e.next();
  } catch (error) {
    console.error('[oauth] Falló el inicio de sesión con Google:', error);
    throw error;
  }
}, 'users');
