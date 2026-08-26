'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isHotfixBranch, findHotfixPullRequest, hotfixReleaseAs, postHotfixReleaseAs,
} = require('./hotfix.js');

const pr = (number, ref, { merged = true, sha = null } = {}) => ({
  number,
  head: { ref },
  merged_at: merged ? '2026-08-25T12:00:00Z' : null,
  merge_commit_sha: sha,
});

test('reconhece a branch de hotfix pelo prefixo', () => {
  assert.equal(isHotfixBranch('hotfix/login-500'), true);
  assert.equal(isHotfixBranch('HOTFIX/Login-500'), true);
  assert.equal(isHotfixBranch('feature/login'), false);
  assert.equal(isHotfixBranch('hotfix'), false);      // sem descrição
  assert.equal(isHotfixBranch('hotfixes/login'), false);
  assert.equal(isHotfixBranch(undefined), false);
});

test('encontra o PR de hotfix pelo merge commit', () => {
  const found = findHotfixPullRequest(
    [pr(30, 'develop', { sha: 'aaa' }), pr(31, 'hotfix/login-500', { sha: 'bbb' })],
    'bbb'
  );
  assert.equal(found.number, 31);
});

test('ignora o PR de hotfix quando o merge do push é de outro PR', () => {
  // O merge `develop -> release` carrega commits que também pertencem ao PR de
  // hotfix; só o `merge_commit_sha` distingue quem produziu este push.
  const found = findHotfixPullRequest(
    [pr(40, 'develop', { sha: 'ccc' }), pr(31, 'hotfix/login-500', { sha: 'bbb' })],
    'ccc'
  );
  assert.equal(found, null);
});

test('sem PR de hotfix na lista, não detecta nada', () => {
  assert.equal(findHotfixPullRequest([pr(40, 'develop', { sha: 'ccc' })], 'ccc'), null);
  assert.equal(findHotfixPullRequest([], 'ccc'), null);
  assert.equal(findHotfixPullRequest(undefined, 'ccc'), null);
});

test('cai no fallback quando o SHA do push não é o merge_commit_sha registrado', () => {
  const found = findHotfixPullRequest([pr(31, 'hotfix/login-500', { sha: 'bbb' })], 'zzz');
  assert.equal(found.number, 31);
});

test('o fallback não escolhe entre dois PRs de hotfix ambíguos', () => {
  const found = findHotfixPullRequest(
    [pr(31, 'hotfix/a', { sha: 'bbb' }), pr(32, 'hotfix/b', { sha: 'ccc' })],
    'zzz'
  );
  assert.equal(found, null);
});

test('o fallback ignora PRs de hotfix ainda abertos', () => {
  const found = findHotfixPullRequest([pr(31, 'hotfix/a', { merged: false })], 'zzz');
  assert.equal(found, null);
});

test('a versão imposta depende do canal', () => {
  assert.equal(hotfixReleaseAs('stable', '1.0.2'), '1.0.2-hf');
  assert.equal(hotfixReleaseAs('stable', '1.0.2-hf'), '1.0.2-hf.2');
  assert.equal(hotfixReleaseAs('rc', '1.0.1-rc.3'), '1.0.2-rc.1');
});

test('canais sem política de hotfix não impõem versão', () => {
  assert.equal(hotfixReleaseAs('develop', '1.0.2'), null);
  assert.equal(hotfixReleaseAs('', '1.0.2'), null);
});

// ------------------------------------------- ciclo normal em cima de um `-hf`

test('o ciclo seguinte a um hotfix publica a versão sem o sufixo', () => {
  // Sem isto o release-please carregaria o `-hf` adiante: 1.0.0-hf -> 1.0.1-hf.
  assert.equal(postHotfixReleaseAs('stable', '1.0.0-hf', 'patch'), '1.0.1');
  assert.equal(postHotfixReleaseAs('stable', '1.0.0-hf.3', 'minor'), '1.1.0');
  assert.equal(postHotfixReleaseAs('stable', '1.0.0-hf.3', 'major'), '2.0.0');
});

test('impacto nenhum ainda impõe o PATCH limpo', () => {
  // O release-please publica um ciclo só de `ci:`/`docs:` (são seções visíveis)
  // e bumpa o PATCH. Sem o piso, esse ciclo sairia como `1.0.1-hf`.
  assert.equal(postHotfixReleaseAs('stable', '1.0.0-hf', 'none'), '1.0.1');
  assert.equal(postHotfixReleaseAs('stable', '1.0.0-hf', undefined), '1.0.1');
});

test('uma estável comum segue calculada pelo release-please', () => {
  assert.equal(postHotfixReleaseAs('stable', '1.0.0', 'patch'), null);
  assert.equal(postHotfixReleaseAs('stable', '1.0.0-rc.2', 'patch'), null);
});

test('o track de RC não passa por esse saneamento', () => {
  // Lá o prerelease é `rc` e a estratégia `prerelease` do release-please já
  // trata o contador corretamente.
  assert.equal(postHotfixReleaseAs('rc', '1.0.1-rc.1', 'patch'), null);
});
