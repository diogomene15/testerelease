'use strict';

// Aplicação de exemplo, usada só para gerar mudanças reais nos testes do fluxo.

const VERSION = require('fs')
  .readFileSync(require('path').join(__dirname, '..', 'version.txt'), 'utf8')
  .trim();

function greet(name = 'mundo') {
  return `Olá, ${name}!`;
}

module.exports = { greet, VERSION };

if (require.main === module) {
  console.log(`${greet()} (v${VERSION})`);
}
