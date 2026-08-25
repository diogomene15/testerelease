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
| `pr-develop-guard.yml` | PR → `develop` | Valida label, título e commits |
| `pr-release-preview.yml` | PR → `release` | release-please em dry-run: prevê a RC |
| `pr-main-guard.yml` | PR → `main` | Valida origem e prevê a versão estável |
| `release-candidate.yml` | push em `release` | Publica `vX.Y.Z-rc.N` (pre-release) |
| `release-stable.yml` | push em `main` | Publica `vX.Y.Z` (estável) |
| `release-please-run.yml` | `workflow_call` | Ciclo release-please compartilhado |

## Testes locais

```bash
node --test .github/scripts/validate-pr.test.js
node --test .github/scripts/compute-version.test.js
```
