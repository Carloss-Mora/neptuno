/// <reference path="../pb_data/types.d.ts" />
routerAdd('GET', '/api/debug-mail-env', (e) => {
  return e.json(200, {
    hasFetch: typeof fetch !== 'undefined',
    hasHttp: typeof $http !== 'undefined',
    hasMailerMessage: typeof MailerMessage !== 'undefined',
    hasAppNewMailClient: typeof $app !== 'undefined' && typeof $app.newMailClient === 'function',
    sender: $os.getenv('BUILDER_MAILER_SENDER_ADDRESS') || null,
    apiKeySet: !!$os.getenv('BUILDER_MAILER_API_KEY'),
  });
});
