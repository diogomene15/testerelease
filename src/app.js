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

function greet(name = 'mundo', idioma = 'pt') {
  const saudacao = SAUDACOES[idioma];
  if (!saudacao) throw new Error(`Idioma não suportado: ${idioma}`);
  return saudacao(name);
}

module.exports = { greet, VERSION };

if (require.main === module) {
  console.log(`${greet()} (v${VERSION})`);
}
