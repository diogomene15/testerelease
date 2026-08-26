'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validate, parseConventional, highestImpact, releaseImpact,
} = require('./validate-pr.js');

const base = {
  prTitle: 'feat(api): adiciona endpoint de listagem',
  prBody: '',
  commits: [{ sha: 'abc1234', message: 'feat(api): adiciona endpoint de listagem' }],
  labels: ['changes: feature'],
  headRef: 'feature/listagem',
};

test('PR bem formado passa', () => {
  const r = validate(base);
  assert.equal(r.ok, true, r.errors.join('\n'));
  assert.equal(r.actualImpact, 'minor');
});

test('PR sem label de mudança falha', () => {
  const r = validate({ ...base, labels: [] });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /Nenhuma label de mudança/);
});

test('PR com duas labels de mudança falha', () => {
  const r = validate({ ...base, labels: ['changes: feature', 'changes: fix'] });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /labels de mudança/);
});

test('título fora do Conventional Commits falha', () => {
  const r = validate({ ...base, prTitle: 'adiciona endpoint' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /não é um Conventional Commit/);
});

test('commit fora do padrão falha', () => {
  const r = validate({
    ...base,
    commits: [{ sha: 'abc1234', message: 'wip: mexendo nas coisas' }],
  });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /fora do padrão Conventional Commits/);
});

test('label que subestima o impacto falha', () => {
  const r = validate({
    ...base,
    labels: ['changes: fix'],
    commits: [{ sha: 'abc1234', message: 'feat(api): novo endpoint' }],
    prTitle: 'feat(api): novo endpoint',
  });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /subestimar/);
});

test('label que superestima o impacto apenas avisa', () => {
  const r = validate({
    ...base,
    labels: ['changes: breaking'],
    commits: [{ sha: 'abc1234', message: 'fix(api): corrige typo' }],
    prTitle: 'fix(api): corrige typo',
  });
  assert.equal(r.ok, true, r.errors.join('\n'));
  assert.equal(r.warnings.length, 1);
});

test('breaking via "!" é detectado', () => {
  const p = parseConventional('feat(api)!: remove campo legado');
  assert.equal(p.breaking, true);
  assert.equal(p.impact, 'major');
});

test('breaking via rodapé BREAKING CHANGE é detectado', () => {
  const p = parseConventional('feat(api): troca contrato', 'BREAKING CHANGE: campo x removido');
  assert.equal(p.breaking, true);
  assert.equal(p.impact, 'major');
});

test('branch fora da convenção falha', () => {
  const r = validate({ ...base, headRef: 'minha-branch' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /não segue a convenção/);
});

test('highestImpact escolhe o maior nível', () => {
  assert.equal(
    highestImpact([{ impact: 'patch' }, { impact: 'major' }, { impact: 'none' }]),
    'major'
  );
});

test('escopo com barra e ponto é aceito', () => {
  const p = parseConventional('fix(src/app.js): corrige leitura');
  assert.equal(p.valid, true);
  assert.equal(p.scope, 'src/app.js');
});

// -------------------------------------------- back-merge de hotfix em develop

const hotfixBase = {
  prTitle: 'chore(hotfix): retroporta correção do login para develop',
  prBody: '',
  commits: [{ sha: 'def5678', message: 'fix(login): trata sessão expirada' }],
  labels: ['changes: chore'],
  headRef: 'hotfix/login-500',
  baseRef: 'develop',
};

test('back-merge de hotfix com título neutro passa', () => {
  const r = validate(hotfixBase);
  assert.equal(r.ok, true, r.errors.join('\n'));
  assert.equal(r.hotfixBackmerge, true);
  assert.equal(r.actualImpact, 'none');
});

test('back-merge de hotfix com título versionável falha', () => {
  const r = validate({ ...hotfixBase, prTitle: 'fix(login): trata sessão expirada' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /não pode gerar versão/);
});

test('back-merge de hotfix com label não neutra falha', () => {
  const r = validate({ ...hotfixBase, labels: ['changes: fix'] });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /precisa da label `changes: chore`/);
});

test('os commits fix: de dentro do hotfix não contaminam o impacto', () => {
  // Sem a exceção, a regra de coerência acusaria a label `changes: chore` de
  // subestimar o `fix:` do commit.
  const r = validate({
    ...hotfixBase,
    commits: [
      { sha: 'def5678', message: 'fix(login): trata sessão expirada' },
      { sha: 'def5679', message: 'test(login): cobre sessão expirada' },
    ],
  });
  assert.equal(r.ok, true, r.errors.join('\n'));
  assert.equal(r.actualImpact, 'none');
});

test('back-merge de hotfix ainda exige Conventional Commits nos commits', () => {
  const r = validate({
    ...hotfixBase,
    commits: [{ sha: 'def5678', message: 'corrige login' }],
  });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /fora do padrão Conventional Commits/);
});

test('PR normal para develop não é tratado como back-merge de hotfix', () => {
  const r = validate(base);
  assert.equal(r.hotfixBackmerge, false);
});

// ---------------------------------------------- impacto para projetar versão

const parse = (...messages) => messages.map((m) => parseConventional(m, ''));

test('impacto de release acompanha o semântico quando ele existe', () => {
  assert.equal(releaseImpact(parse('feat: a', 'ci: b')), 'minor');
  assert.equal(releaseImpact(parse('fix: a', 'chore: b')), 'patch');
  assert.equal(releaseImpact(parse('feat!: a')), 'major');
});

test('commits publicáveis sem impacto semântico ainda geram PATCH', () => {
  // O release-please publica qualquer commit com seção visível no changelog.
  assert.equal(highestImpact(parse('ci: a', 'docs: b')), 'none');
  assert.equal(releaseImpact(parse('ci: a', 'docs: b')), 'patch');
  assert.equal(releaseImpact(parse('refactor: a')), 'patch');
  assert.equal(releaseImpact(parse('build: a')), 'patch');
});

test('tipos ocultos no changelog não geram release', () => {
  assert.equal(releaseImpact(parse('chore: a', 'test: b', 'style: c')), 'none');
  assert.equal(releaseImpact([]), 'none');
});
