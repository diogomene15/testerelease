'use strict';

/**
 * Validação de PRs `feature/* -> develop`.
 *
 * Regras aplicadas (todas obrigatórias):
 *  1. O PR precisa de exatamente UMA label de mudança (`changes: *`).
 *  2. O título do PR precisa ser um Conventional Commit — como o merge é
 *     squash, o título vira a mensagem de commit final em `develop` e é o que
 *     o release-please vai ler para calcular a versão.
 *  3. Todos os commits do PR precisam ser Conventional Commits.
 *  4. A label declarada precisa ser coerente com o impacto real dos commits.
 *  5. A branch de origem precisa seguir a convenção de nomes do fluxo.
 *
 * O back-merge de um `hotfix/*` em `develop` inverte a regra 4: em vez de exigir
 * que a label acompanhe os commits, exige que título e label sejam **neutros** —
 * a correção já foi versionada em `main` e em `release`, e o commit squashado
 * geraria um terceiro bump. Ver `docs/HOTFIX.md`.
 */

const { isHotfixBranch } = require('./hotfix.js');

const COMMIT_TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor',
  'perf', 'test', 'build', 'ci', 'chore', 'revert',
];

const CONVENTIONAL_RE = new RegExp(
  `^(${COMMIT_TYPES.join('|')})(\\([^)\\r\\n]+\\))?(!)?: (.+)$`
);

const BRANCH_PREFIXES = [
  'feature', 'feat', 'fix', 'hotfix', 'bugfix', 'docs',
  'refactor', 'perf', 'test', 'chore', 'ci', 'build',
];

const BRANCH_RE = new RegExp(`^(${BRANCH_PREFIXES.join('|')})/[a-z0-9._-]+`, 'i');

/** label -> nível de impacto semântico declarado */
const CHANGE_LABELS = {
  'changes: breaking': 'major',
  'changes: feature': 'minor',
  'changes: fix': 'patch',
  'changes: chore': 'none',
};

/** tipo de commit -> nível de impacto semântico real */
const TYPE_IMPACT = {
  feat: 'minor',
  fix: 'patch',
  perf: 'patch',
  revert: 'patch',
  docs: 'none',
  style: 'none',
  refactor: 'none',
  test: 'none',
  build: 'none',
  ci: 'none',
  chore: 'none',
};

const IMPACT_RANK = { none: 0, patch: 1, minor: 2, major: 3 };

/** Faz o parse de uma mensagem de commit / título de PR. */
function parseConventional(message, body) {
  const subject = String(message || '').split('\n')[0].trim();
  const match = subject.match(CONVENTIONAL_RE);
  if (!match) return { valid: false, subject };

  const [, type, scope, bang, description] = match;
  const fullBody = [String(message || '').split('\n').slice(1).join('\n'), body || ''].join('\n');
  const breaking = Boolean(bang) || /^BREAKING[ -]CHANGE:/m.test(fullBody);

  return {
    valid: true,
    subject,
    type,
    scope: scope ? scope.slice(1, -1) : null,
    breaking,
    description,
    impact: breaking ? 'major' : (TYPE_IMPACT[type] ?? 'none'),
  };
}

/** Maior impacto semântico entre todos os commits analisados. */
function highestImpact(parsedCommits) {
  return parsedCommits.reduce(
    (acc, c) => (IMPACT_RANK[c.impact] > IMPACT_RANK[acc] ? c.impact : acc),
    'none'
  );
}

function validate({ prTitle, prBody, commits = [], labels = [], headRef = '', baseRef = 'develop' }) {
  const errors = [];
  const warnings = [];

  // O back-merge de um hotfix em `develop` chega aqui pelo mesmo guard, mas
  // troca a regra de coerência por uma exigência de neutralidade.
  const hotfixBackmerge = baseRef === 'develop' && isHotfixBranch(headRef);

  // ---------------------------------------------------------------- 1. label
  const changeLabels = labels.filter((l) => Object.hasOwn(CHANGE_LABELS, l));

  if (changeLabels.length === 0) {
    errors.push(
      'Nenhuma label de mudança encontrada. O PR precisa de exatamente uma destas: ' +
      Object.keys(CHANGE_LABELS).map((l) => `\`${l}\``).join(', ') + '.'
    );
  } else if (changeLabels.length > 1) {
    errors.push(
      `O PR tem ${changeLabels.length} labels de mudança (${changeLabels.join(', ')}). ` +
      'Use exatamente uma — ela declara o impacto semântico da entrega.'
    );
  }

  const declaredImpact = changeLabels.length === 1 ? CHANGE_LABELS[changeLabels[0]] : null;

  // ---------------------------------------------------------------- 2. título
  const parsedTitle = parseConventional(prTitle, prBody);
  if (!parsedTitle.valid) {
    errors.push(
      `O título do PR não é um Conventional Commit: \`${parsedTitle.subject}\`.\n` +
      `   Formato esperado: \`tipo(escopo opcional): descrição\` — tipos válidos: ${COMMIT_TYPES.join(', ')}.\n` +
      '   Isso é obrigatório porque o merge é **squash**: o título vira a mensagem de commit em `develop`.'
    );
  }

  // --------------------------------------------------------------- 3. commits
  const parsedCommits = [];
  const invalidCommits = [];

  for (const commit of commits) {
    const parsed = parseConventional(commit.message, '');
    parsed.sha = commit.sha;
    if (parsed.valid) parsedCommits.push(parsed);
    else invalidCommits.push({ sha: commit.sha, subject: parsed.subject });
  }

  if (invalidCommits.length > 0) {
    errors.push(
      `${invalidCommits.length} commit(s) fora do padrão Conventional Commits:\n` +
      invalidCommits
        .map((c) => `   - \`${String(c.sha).slice(0, 7)}\` ${c.subject}`)
        .join('\n')
    );
  }

  // ------------------------------------------------- 4. coerência label/commits
  // No squash só o título sobrevive; num back-merge de hotfix os `fix:` de
  // dentro do PR são descartados de propósito, então o impacto que vale é o do
  // título — e ele tem de ser nenhum.
  const actualImpact = hotfixBackmerge
    ? (parsedTitle.valid ? parsedTitle.impact : 'none')
    : highestImpact(parsedTitle.valid ? [...parsedCommits, parsedTitle] : parsedCommits);

  if (hotfixBackmerge) {
    // A versão do hotfix já foi publicada em `main` (`-hf`) e o ciclo já foi
    // reposicionado em `release` (PATCH). Um `fix:` squashado aqui viraria um
    // terceiro bump quando `develop` voltasse para `release`.
    if (parsedTitle.valid && parsedTitle.impact !== 'none') {
      errors.push(
        `O título \`${parsedTitle.subject}\` declara impacto **${parsedTitle.impact}**, mas o ` +
        'back-merge de um hotfix em `develop` não pode gerar versão — a correção já foi ' +
        'versionada em `main` e em `release`.\n' +
        '   Use um tipo neutro, por exemplo: `chore(hotfix): retroporta <correção> para develop`.'
      );
    }

    if (declaredImpact && declaredImpact !== 'none') {
      errors.push(
        `A label \`${changeLabels[0]}\` declara impacto **${declaredImpact}**. Um back-merge de ` +
        'hotfix precisa da label `changes: chore` — ele não muda a versão de `develop`.'
      );
    }
  } else if (declaredImpact && parsedCommits.length > 0 && invalidCommits.length === 0) {
    if (IMPACT_RANK[declaredImpact] < IMPACT_RANK[actualImpact]) {
      errors.push(
        `A label \`${changeLabels[0]}\` declara impacto **${declaredImpact}**, mas os commits ` +
        `do PR produzem impacto **${actualImpact}**. Ajuste a label para não subestimar a versão.`
      );
    } else if (IMPACT_RANK[declaredImpact] > IMPACT_RANK[actualImpact]) {
      warnings.push(
        `A label \`${changeLabels[0]}\` declara impacto **${declaredImpact}**, acima do impacto ` +
        `**${actualImpact}** detectado nos commits. Isso força um bump maior — confirme se é intencional.`
      );
    }
  }

  // ----------------------------------------------------------- 5. nome da branch
  if (headRef && !BRANCH_RE.test(headRef)) {
    errors.push(
      `A branch de origem \`${headRef}\` não segue a convenção do fluxo. ` +
      `Use \`<prefixo>/<descrição>\` com um destes prefixos: ${BRANCH_PREFIXES.join(', ')}.`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    declaredImpact,
    actualImpact,
    hotfixBackmerge,
    changeLabel: changeLabels[0] ?? null,
    parsedTitle,
    commitCount: commits.length,
    validCommitCount: parsedCommits.length,
  };
}

module.exports = {
  validate,
  parseConventional,
  highestImpact,
  COMMIT_TYPES,
  CHANGE_LABELS,
  BRANCH_PREFIXES,
  IMPACT_RANK,
};
