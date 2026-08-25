'use strict';

/**
 * Projeção de versão para o preview do PR `develop -> release`.
 *
 * Replica as regras que o release-please aplica nos workflows de push, para
 * conseguir responder "que versão sai se eu mergear este PR?" ANTES do merge —
 * momento em que o release-please ainda não enxerga esses commits na branch
 * alvo. A fonte da verdade continua sendo o release-please; isto é a projeção.
 */

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

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

/** Núcleo `X.Y.Z` da versão, descartando qualquer sufixo de prerelease. */
function stableCore(version) {
  const { major, minor, patch } = parseVersion(version);
  return `${major}.${minor}.${patch}`;
}

/**
 * Bump semver padrão. Com `bumpMinorPreMajor: false` (o default das configs
 * deste repo), um breaking change em 0.x promove para 1.0.0.
 */
function bumpStable(currentVersion, impact, { bumpMinorPreMajor = false } = {}) {
  const { major, minor, patch, prerelease } = parseVersion(currentVersion);

  // Uma versão prerelease "gradua" para o próprio núcleo quando não há nada
  // além dela: 1.2.0-rc.3 -> 1.2.0.
  if (prerelease && impact === 'none') return `${major}.${minor}.${patch}`;

  const preMajor = major === 0;

  switch (impact) {
    case 'major':
      return preMajor && bumpMinorPreMajor
        ? `0.${minor + 1}.0`
        : `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return prerelease
        ? `${major}.${minor}.${patch}`
        : `${major}.${minor}.${patch + 1}`;
    case 'none':
    default:
      return `${major}.${minor}.${patch}`;
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
  const target = bumpStable(lastStable, impact, options);

  if (currentRc) {
    const { prerelease } = parseVersion(currentRc);
    if (prerelease && stableCore(currentRc) === target) {
      const counter = Number(prerelease.match(/(\d+)\s*$/)?.[1] ?? 0);
      return `${target}-rc.${counter + 1}`;
    }
  }

  return `${target}-rc.1`;
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
  stableCore,
  bumpStable,
  nextRc,
  compareVersions,
};
