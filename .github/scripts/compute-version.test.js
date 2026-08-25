'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bumpStable, nextRc, stableCore, compareVersions, parseVersion } = require('./compute-version.js');

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
