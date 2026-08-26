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

// A assinatura posicional não escalava para novas opções; passa a receber um
// objeto de opções.
const NOME_PADRAO = 'mundo';

function saudar(name = NOME_PADRAO, { idioma = IDIOMA_PADRAO, maiusculas = false } = {}) {
  // O default de parâmetro só cobre `undefined`: `saudar(null)` produzia
  // "Olá, null!" e um nome em branco produzia "Olá, !".
  const nome = typeof name === 'string' && name.trim() ? name.trim() : NOME_PADRAO;
  // Um idioma desconhecido não deve derrubar a aplicação: cai no padrão.
  const saudacao = SAUDACOES[idioma] ?? SAUDACOES[IDIOMA_PADRAO];
  const texto = saudacao(nome);
  // toUpperCase() sem locale erra em alguns idiomas; toLocaleUpperCase respeita.
  return maiusculas ? texto.toLocaleUpperCase(idioma) : texto;
}

module.exports = { saudar, VERSION };

if (require.main === module) {
  console.log(`${saudar()} (v${VERSION})`);
}
