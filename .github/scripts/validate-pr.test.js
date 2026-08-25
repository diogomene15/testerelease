'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, parseConventional, highestImpact } = require('./validate-pr.js');

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
