// PocketBase devuelve 0 para un campo numérico vacío. Un valor "configurado" es
// un número finito mayor que cero. Usar con require() dentro de cada handler:
//   const { isSet } = require(`${__hooks}/optional-number.js`);
module.exports = {
  isSet(value) {
    return value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) > 0;
  },
};
