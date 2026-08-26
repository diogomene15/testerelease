# testerelease

Repositório de teste do [release-please](https://github.com/googleapis/release-please)
sobre um fluxo Gitflow em que a branch `release` é uma **staging permanente**.

```
feature/*  ──squash──▶  develop  ──merge──▶  release  ──merge──▶  main
                                              (staging)          (produção)
                                                 │                   │
                                            vX.Y.Z-rc.N           vX.Y.Z
                                            (pre-release)        (estável)
```

## Regras do fluxo

| Transição | Merge | O que acontece |
| --- | --- | --- |
| `feature/*` → `develop` | **squash** | Bloqueado sem label `changes: *` e sem Conventional Commits |
| `develop` → `release` | **merge commit** | release-please calcula e comenta a versão; no merge publica `vX.Y.Z-rc.N` |
| `release` → `main` | **merge commit** | Publica `vX.Y.Z` estável, `CHANGELOG.md` e release notes |

Detalhes em [`docs/BRANCHING.md`](docs/BRANCHING.md).

## Hotfix

Correção urgente que sai de `main` e volta para as três branches permanentes,
com uma regra de versão por destino:

| Transição | Merge | Versão |
| --- | --- | --- |
| `hotfix/*` → `main` | **merge commit** | núcleo preservado + `-hf`: `1.0.2` → `1.0.2-hf` → `1.0.2-hf.2` |
| `hotfix/*` → `release` | **merge commit** | PATCH no núcleo: `1.0.1-rc.3` → `1.0.2-rc.1` |
| `hotfix/*` → `develop` | **squash** | nenhuma — o título precisa ser `chore(hotfix): …` |

Essas versões não saem de nenhuma estratégia do release-please: são calculadas
em `.github/scripts/` e impostas a ele com `--release-as`.

Detalhes em [`docs/HOTFIX.md`](docs/HOTFIX.md).

## Labels de mudança

Todo PR para `develop` precisa de **exatamente uma**:

| Label | Impacto |
| --- | --- |
| `changes: breaking` | `MAJOR` |
| `changes: feature` | `MINOR` |
| `changes: fix` | `PATCH` |
| `changes: chore` | nenhum |

## Workflows

| Arquivo | Gatilho | Função |
| --- | --- | --- |
| `pr-develop-guard.yml` | PR → `develop` | Valida label, título e commits; exige back-merge de hotfix neutro |
| `pr-release-preview.yml` | PR → `release` | release-please em dry-run: prevê a RC (ou a versão imposta pelo hotfix) |
| `pr-main-guard.yml` | PR → `main` | Valida origem (`release` ou `hotfix/*`) e prevê a versão |
| `release-candidate.yml` | push em `release` | Publica `vX.Y.Z-rc.N` (pre-release) |
| `release-stable.yml` | push em `main` | Publica `vX.Y.Z` (estável) ou `vX.Y.Z-hf` |
| `release-please-run.yml` | `workflow_call` | Ciclo release-please compartilhado + detecção de hotfix |

## Scripts

| Arquivo | Função |
| --- | --- |
| `validate-pr.js` | Regras dos PRs para `develop`; impacto semântico e impacto de release |
| `compute-version.js` | Projeção das versões do ciclo e cálculo das de hotfix |
| `hotfix.js` | Detecta o PR de hotfix que originou um push e escolhe a versão do canal |

## Testes locais

```bash
node --test .github/scripts/*.test.js
```
