'use strict';

/**
 * Cálculo de versões do fluxo.
 *
 * Duas funções distintas moram aqui:
 *
 *  - **projeção** (`bumpStable`, `nextRc`): replica as regras que o
 *    release-please aplica nos workflows de push, para responder "que versão sai
 *    se eu mergear este PR?" ANTES do merge — momento em que o release-please
 *    ainda não enxerga esses commits na branch alvo. Aqui a fonte da verdade
 *    continua sendo o release-please; isto é só a projeção.
 *
 *  - **decisão** (`nextHotfix`, `nextRcForHotfix`): as versões de hotfix não são
 *    deriváveis de nenhuma estratégia do release-please, então são calculadas
 *    aqui e impostas a ele via `--release-as`. Nesses casos isto *é* a fonte da
 *    verdade. Ver `hotfix.js` e `docs/HOTFIX.md`.
 */

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Rótulo de prerelease do track de staging (`release`). */
const RC_PRERELEASE = 'rc';

/** Rótulo de prerelease dos hotfixes publicados em produção (`main`). */
const HOTFIX_PRERELEASE = 'hf';

function parseVersion(version) {
  const match = String(version ?? '').trim().match(SEMVER_RE);
  if (!match) throw new Error(`Versão semver inválida: ${JSON.stringify(version)}`);
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ?? null,
  };
}

function formatVersion({ major, minor, patch, prerelease }) {
  const core = `${major}.${minor}.${patch}`;
  return prerelease ? `${core}-${prerelease}` : core;
}

/**
 * Quebra o identificador de prerelease em rótulo e contador.
 *
 *   `rc.3` -> { label: 'rc', counter: 3 }
 *   `hf`   -> { label: 'hf', counter: null }
 */
function parsePrerelease(prerelease) {
  if (!prerelease) return null;
  const parts = String(prerelease).split('.');
  const last = parts[parts.length - 1];
  return {
    label: parts[0],
    counter: parts.length > 1 && /^\d+$/.test(last) ? Number(last) : null,
  };
}

/** Núcleo `X.Y.Z` da versão, descartando qualquer sufixo de prerelease. */
function stableCore(version) {
  const { major, minor, patch } = parseVersion(version);
  return `${major}.${minor}.${patch}`;
}

/** A versão é um hotfix de produção (`X.Y.Z-hf`, `X.Y.Z-hf.N`)? */
function isHotfixVersion(version) {
  const { prerelease } = parseVersion(version);
  return parsePrerelease(prerelease)?.label === HOTFIX_PRERELEASE;
}

/**
 * O núcleo `X.Y.Z` desta versão já foi publicado como estável?
 *
 * Distingue os dois sufixos do fluxo, que apontam para lados opostos da mesma
 * versão: `1.2.0-rc.3` é **pré**-lançamento (o núcleo 1.2.0 ainda não saiu),
 * enquanto `1.2.0-hf` é **pós**-lançamento (corrige o 1.2.0 que já está em
 * produção). Do primeiro se gradua para 1.2.0; do segundo só se avança.
 */
function coreAlreadyReleased(prerelease) {
  if (prerelease === null) return true;
  return parsePrerelease(prerelease).label === HOTFIX_PRERELEASE;
}

/**
 * Bump semver padrão. Com `bumpMinorPreMajor: false` (o default das configs
 * deste repo), um breaking change em 0.x promove para 1.0.0.
 */
function bumpStable(currentVersion, impact, { bumpMinorPreMajor = false } = {}) {
  const { major, minor, patch, prerelease } = parseVersion(currentVersion);
  const core = `${major}.${minor}.${patch}`;
  const released = coreAlreadyReleased(prerelease);

  if (impact === 'none') {
    // Uma versão de prerelease "gradua" para o próprio núcleo quando não há
    // nada além dela: 1.2.0-rc.3 -> 1.2.0. Um `-hf` não gradua: seu núcleo já
    // saiu, então sem commits não há próxima versão nenhuma.
    return released ? formatVersion({ major, minor, patch, prerelease }) : core;
  }

  const preMajor = major === 0;

  switch (impact) {
    case 'major':
      return preMajor && bumpMinorPreMajor
        ? `0.${minor + 1}.0`
        : `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return released ? `${major}.${minor}.${patch + 1}` : core;
    default:
      return core;
  }
}

/**
 * Próxima versão de release candidate.
 *
 * `currentRc` é a última versão publicada no track RC (pode já ser um rc ou uma
 * versão estável). O alvo estável é recalculado a partir de `lastStable`; se o
 * RC atual já aponta para esse mesmo alvo, apenas o contador `rc.N` avança.
 */
function nextRc(lastStable, currentRc, impact, options = {}) {
  let target = bumpStable(lastStable, impact, options);

  if (currentRc) {
    // Cada hotfix retroportado eleva o núcleo do track RC sem mexer no núcleo da
    // estável (que fica em `-hf`). Depois de dois deles, um `fix:` normal
    // calcularia um alvo *abaixo* do que a RC já publicou — o alvo nunca pode
    // regredir para trás do track.
    const rcCore = stableCore(currentRc);
    if (compareVersions(rcCore, target) > 0) target = rcCore;

    const { prerelease } = parseVersion(currentRc);
    if (prerelease && rcCore === target) {
      const counter = parsePrerelease(prerelease).counter ?? 0;
      return `${target}-${RC_PRERELEASE}.${counter + 1}`;
    }
  }

  return `${target}-${RC_PRERELEASE}.1`;
}

/**
 * Versão de um hotfix publicado em `main`.
 *
 * O núcleo `X.Y.Z` é **preservado**: a correção é publicada sobre a estável que
 * já está em produção, sinalizada pelo sufixo `-hf`. Hotfixes seguintes sobre a
 * mesma estável apenas avançam o contador.
 *
 *   1.0.2      -> 1.0.2-hf
 *   1.0.2-hf   -> 1.0.2-hf.2
 *   1.0.2-hf.2 -> 1.0.2-hf.3
 */
function nextHotfix(currentStable) {
  const { major, minor, patch, prerelease } = parseVersion(currentStable);
  const core = `${major}.${minor}.${patch}`;
  const pre = parsePrerelease(prerelease);

  if (!pre || pre.label !== HOTFIX_PRERELEASE) {
    return `${core}-${HOTFIX_PRERELEASE}`;
  }

  // `-hf` (sem contador) é o primeiro; o próximo é `-hf.2`, e não `-hf.1`, que
  // seria menor que ele na precedência semver.
  return `${core}-${HOTFIX_PRERELEASE}.${(pre.counter ?? 1) + 1}`;
}

/**
 * Versão do track RC depois que um hotfix é retroportado para `release`.
 *
 * Aqui o núcleo **avança** um PATCH: a RC atual aponta para uma estável que o
 * hotfix já corrigiu em produção, então a próxima estável tem de ser maior. O
 * contador de RC reinicia porque o ciclo passou a mirar outro núcleo.
 *
 *   1.0.1-rc.3 -> 1.0.2-rc.1
 *   1.0.2-rc.1 -> 1.0.3-rc.1
 */
function nextRcForHotfix(currentRc) {
  const { major, minor, patch } = parseVersion(currentRc);
  return `${major}.${minor}.${patch + 1}-${RC_PRERELEASE}.1`;
}

/** Compara duas versões semver (ignora metadados de build). */
function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  for (const key of ['major', 'minor', 'patch']) {
    if (va[key] !== vb[key]) return va[key] < vb[key] ? -1 : 1;
  }

  if (va.prerelease === vb.prerelease) return 0;
  if (va.prerelease === null) return 1;   // estável > prerelease
  if (vb.prerelease === null) return -1;
  return va.prerelease < vb.prerelease ? -1 : 1;
}

module.exports = {
  parseVersion,
  formatVersion,
  parsePrerelease,
  stableCore,
  isHotfixVersion,
  bumpStable,
  nextRc,
  nextHotfix,
  nextRcForHotfix,
  compareVersions,
  RC_PRERELEASE,
  HOTFIX_PRERELEASE,
};
