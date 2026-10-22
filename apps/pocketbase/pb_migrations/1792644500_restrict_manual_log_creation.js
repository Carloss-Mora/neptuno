/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const logs = app.findCollectionByNameOrId('irrigation_logs');
  logs.createRule = null;
  app.save(logs);
}, (app) => {
  const logs = app.findCollectionByNameOrId('irrigation_logs');
  logs.createRule = 'userId = @request.auth.id';
  app.save(logs);
});
