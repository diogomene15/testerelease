'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  bumpStable, nextRc, stableCore, compareVersions, parseVersion,
  nextHotfix, nextRcForHotfix, isHotfixVersion,
} = require('./compute-version.js');

test('bump minor', () => assert.equal(bumpStable('1.2.3', 'minor'), '1.3.0'));
test('bump patch', () => assert.equal(bumpStable('1.2.3', 'patch'), '1.2.4'));
test('bump major', () => assert.equal(bumpStable('1.2.3', 'major'), '2.0.0'));
test('bump none mantém a versão', () => assert.equal(bumpStable('1.2.3', 'none'), '1.2.3'));

test('breaking em 0.x promove para 1.0.0 por padrão', () => {
  assert.equal(bumpStable('0.4.1', 'major'), '1.0.0');
});

test('breaking em 0.x fica em 0.y com bumpMinorPreMajor', () => {
  assert.equal(bumpStable('0.4.1', 'major', { bumpMinorPreMajor: true }), '0.5.0');
});

test('primeiro rc de um alvo novo começa em rc.1', () => {
  assert.equal(nextRc('1.2.0', '1.2.0', 'minor'), '1.3.0-rc.1');
});

test('rc do mesmo alvo apenas incrementa o contador', () => {
  assert.equal(nextRc('1.2.0', '1.3.0-rc.1', 'minor'), '1.3.0-rc.2');
  assert.equal(nextRc('1.2.0', '1.3.0-rc.7', 'minor'), '1.3.0-rc.8');
});

test('impacto maior no meio do ciclo reinicia o contador no novo alvo', () => {
  assert.equal(nextRc('1.2.0', '1.3.0-rc.4', 'major'), '2.0.0-rc.1');
});

test('stableCore descarta o sufixo de prerelease', () => {
  assert.equal(stableCore('2.0.0-rc.3'), '2.0.0');
  assert.equal(stableCore('v1.4.2'), '1.4.2');
});

test('versão estável é maior que seu prerelease', () => {
  assert.equal(compareVersions('1.3.0', '1.3.0-rc.9'), 1);
  assert.equal(compareVersions('1.3.0-rc.1', '1.3.0-rc.2'), -1);
  assert.equal(compareVersions('1.3.0', '1.3.0'), 0);
});

test('prefixo v é aceito', () => {
  assert.equal(parseVersion('v1.2.3').major, 1);
});

test('versão inválida lança erro', () => {
  assert.throws(() => parseVersion('abc'), /semver inválida/);
});

// ------------------------------------------------------------------ hotfix

test('primeiro hotfix preserva o núcleo e ganha o sufixo -hf', () => {
  assert.equal(nextHotfix('1.0.2'), '1.0.2-hf');
  assert.equal(nextHotfix('v2.4.0'), '2.4.0-hf');
});

test('hotfixes seguintes avançam o contador a partir de 2', () => {
  assert.equal(nextHotfix('1.0.2-hf'), '1.0.2-hf.2');
  assert.equal(nextHotfix('1.0.2-hf.2'), '1.0.2-hf.3');
  assert.equal(nextHotfix('1.0.2-hf.9'), '1.0.2-hf.10');
});

test('a sequência de hotfixes é crescente em semver', () => {
  assert.equal(compareVersions('1.0.2-hf', '1.0.2-hf.2'), -1);
  assert.equal(compareVersions('1.0.2-hf.2', '1.0.2-hf.3'), -1);
});

test('hotfix retroportado para release avança o PATCH e reinicia o contador', () => {
  assert.equal(nextRcForHotfix('1.0.1-rc.3'), '1.0.2-rc.1');
  assert.equal(nextRcForHotfix('1.0.2-rc.1'), '1.0.3-rc.1');
  assert.equal(nextRcForHotfix('1.0.3-rc.1'), '1.0.4-rc.1');
});

test('hotfix sobre um track de RC ainda sem prerelease também avança o PATCH', () => {
  assert.equal(nextRcForHotfix('1.0.1'), '1.0.2-rc.1');
});

test('isHotfixVersion distingue os dois sufixos do fluxo', () => {
  assert.equal(isHotfixVersion('1.0.2-hf'), true);
  assert.equal(isHotfixVersion('1.0.2-hf.4'), true);
  assert.equal(isHotfixVersion('1.0.2-rc.4'), false);
  assert.equal(isHotfixVersion('1.0.2'), false);
});

test('-hf é pós-lançamento: a próxima estável avança sobre o núcleo', () => {
  assert.equal(bumpStable('1.0.2-hf', 'patch'), '1.0.3');
  assert.equal(bumpStable('1.0.2-hf.3', 'patch'), '1.0.3');
  assert.equal(bumpStable('1.0.2-hf', 'minor'), '1.1.0');
  assert.equal(bumpStable('1.0.2-hf', 'major'), '2.0.0');
});

test('-rc é pré-lançamento: um fix apenas gradua para o núcleo', () => {
  assert.equal(bumpStable('1.2.0-rc.3', 'patch'), '1.2.0');
  assert.equal(bumpStable('1.2.0-rc.3', 'none'), '1.2.0');
});

test('sem commits, um -hf não gera versão nova', () => {
  assert.equal(bumpStable('1.0.2-hf', 'none'), '1.0.2-hf');
});

test('depois do hotfix o ciclo normal de RC volta a fechar', () => {
  // main em 1.0.0-hf, release já reposicionada em 1.0.1-rc.1 pelo back-merge:
  // um novo fix no ciclo apenas avança o contador do mesmo alvo.
  assert.equal(nextRc('1.0.0-hf', '1.0.1-rc.1', 'patch'), '1.0.1-rc.2');
  // e uma feature no mesmo ciclo reposiciona o alvo.
  assert.equal(nextRc('1.0.0-hf', '1.0.1-rc.1', 'minor'), '1.1.0-rc.1');
});

test('a RC não regride depois de vários hotfixes retroportados', () => {
  // main preso em 1.0.0-hf.3 (o núcleo nunca muda), release já em 1.0.2 pelos
  // dois retroportes: um fix normal continua de 1.0.2, não volta para 1.0.1.
  assert.equal(nextRc('1.0.0-hf.3', '1.0.2-rc.1', 'patch'), '1.0.2-rc.2');
  assert.equal(nextRc('1.0.0-hf.3', '1.0.2-rc.2', 'patch'), '1.0.2-rc.3');
});

test('um impacto maior ainda reposiciona o alvo acima do núcleo da RC', () => {
  assert.equal(nextRc('1.0.0-hf.3', '1.0.2-rc.2', 'minor'), '1.1.0-rc.1');
  assert.equal(nextRc('1.0.0-hf.3', '1.0.2-rc.2', 'major'), '2.0.0-rc.1');
});
