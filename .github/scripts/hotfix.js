'use strict';

/**
 * Detecção e política de versão dos hotfixes.
 *
 * Um hotfix corrige `main` sem passar pelo ciclo `develop -> release -> main`, e
 * a mesma branch `hotfix/*` abre um PR para cada uma das três branches
 * permanentes. Cada destino tem uma regra de versão própria:
 *
 * | Destino   | Versão                            | Exemplo                  |
 * | --------- | --------------------------------- | ------------------------ |
 * | `main`    | núcleo preservado + sufixo `-hf`  | 1.0.2   -> 1.0.2-hf      |
 * | `release` | PATCH do núcleo, contador de RC 1 | 1.0.1-rc.3 -> 1.0.2-rc.1 |
 * | `develop` | nenhuma                           | —                        |
 *
 * Nenhuma dessas regras é derivável das estratégias de versionamento do
 * release-please (a `prerelease` bumparia 1.0.1-rc.3 para 1.0.1-rc.4), por isso
 * a versão é calculada aqui e imposta a ele com `--release-as`.
 */

const { nextHotfix, nextRcForHotfix, bumpStable, isHotfixVersion } = require('./compute-version.js');

/** Prefixo obrigatório da branch — é ele que dispara todo o fluxo de hotfix. */
const HOTFIX_BRANCH_RE = /^hotfix\/[a-z0-9._-]+/i;

function isHotfixBranch(ref) {
  return HOTFIX_BRANCH_RE.test(String(ref ?? ''));
}

/**
 * Encontra, entre os PRs que a API associa a um commit, o PR de hotfix que
 * produziu aquele merge.
 *
 * O casamento por `merge_commit_sha` é o critério forte: garante que o commit
 * que disparou o workflow é o merge *daquele* PR, e não um commit qualquer que
 * por acaso também pertence a ele.
 */
function findHotfixPullRequest(pulls = [], sha = null) {
  const all = pulls ?? [];
  const hotfixes = all.filter((pr) => isHotfixBranch(pr?.head?.ref));
  if (hotfixes.length === 0) return null;

  if (sha) {
    const owner = all.find((pr) => pr.merge_commit_sha === sha);
    // Se algum PR reivindica este merge, a resposta é ele — hotfix ou não. Um
    // merge `develop -> release` traz junto os commits do PR de hotfix, e sem
    // esta checagem eles fariam o push parecer um segundo hotfix.
    if (owner) return isHotfixBranch(owner.head?.ref) ? owner : null;
  }

  // Fallback para os casos em que o SHA do push não é o `merge_commit_sha`
  // registrado em nenhum PR (merge feito por fora da UI, por exemplo).
  const merged = hotfixes.filter((pr) => pr.merged_at);
  return merged.length === 1 ? merged[0] : null;
}

/**
 * Versão a impor via `--release-as` para um hotfix, dado o canal do workflow.
 * Retorna `null` quando o canal não publica versão de hotfix.
 */
function hotfixReleaseAs(channel, currentVersion) {
  switch (channel) {
    case 'stable':
      return nextHotfix(currentVersion);
    case 'rc':
      return nextRcForHotfix(currentVersion);
    default:
      return null;
  }
}

/**
 * Versão a impor quando um ciclo **normal** publica em cima de um `-hf`.
 *
 * Todos os `VersionUpdater` do release-please carregam o identificador de
 * prerelease para a versão seguinte:
 *
 * ```js
 * // release-please/build/src/versioning-strategy.js
 * bump(version) {
 *   return new Version(version.major, version.minor, version.patch + 1,
 *                      version.preRelease, version.build);
 * }
 * ```
 *
 * Com o manifesto estável em `1.0.0-hf`, a promoção seguinte sairia como
 * `1.0.1-hf` — e o sufixo nunca mais sairia do track. Como `-hf` marca
 * *pós*-lançamento (o núcleo já foi publicado), a versão correta é a limpa, e
 * ela também precisa ser imposta com `--release-as`.
 *
 * Retorna `null` quando não há o que sanear: outro canal, ou versão atual sem
 * `-hf`.
 */
function postHotfixReleaseAs(channel, currentVersion, impact) {
  if (channel !== 'stable') return null;
  if (!isHotfixVersion(currentVersion)) return null;

  // Impacto `none` não quer dizer "sem release": o release-please publica
  // qualquer commit que caia numa seção visível do changelog — `ci:` e `docs:`
  // caem —, e nesses casos o bump dele é PATCH. O piso replica isso. Se não
  // houver nada publicável, ele não abre Release PR e a versão imposta é
  // inócua: `--release-as` não cria release, só escolhe o número de uma.
  return bumpStable(currentVersion, impact && impact !== 'none' ? impact : 'patch');
}

module.exports = {
  HOTFIX_BRANCH_RE,
  isHotfixBranch,
  findHotfixPullRequest,
  hotfixReleaseAs,
  postHotfixReleaseAs,
};
