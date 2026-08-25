'use strict';

// Aplicação de exemplo, usada só para gerar mudanças reais nos testes do fluxo.

const VERSION = require('fs')
  .readFileSync(require('path').join(__dirname, '..', 'version.txt'), 'utf8')
  .trim();

const SAUDACOES = {
  pt: (name) => `Olá, ${name}!`,
  en: (name) => `Hello, ${name}!`,
  es: (name) => `¡Hola, ${name}!`,
};

const IDIOMA_PADRAO = 'pt';

function greet(name = 'mundo', idioma = IDIOMA_PADRAO) {
  // Um idioma desconhecido não deve derrubar a aplicação: cai no padrão.
  const saudacao = SAUDACOES[idioma] ?? SAUDACOES[IDIOMA_PADRAO];
  return saudacao(name);
}

module.exports = { greet, VERSION };

if (require.main === module) {
  console.log(`${greet()} (v${VERSION})`);
}
