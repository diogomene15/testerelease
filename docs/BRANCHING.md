# Modelo de ramificação

Gitflow com uma diferença importante: **`release` é uma branch permanente de
staging**. Ela não é criada e descartada a cada ciclo — ela existe sempre, recebe
`develop` continuamente e é de onde saem as release candidates.

```
feature/*  ──squash──▶  develop  ──merge──▶  release  ──merge──▶  main
                                              (staging)          (produção)
                                                 │                   │
                                            vX.Y.Z-rc.N           vX.Y.Z
                                            (pre-release)        (estável)
```

## As três transições

### 1. `feature/*` → `develop`

**Merge obrigatório: squash.** O título do PR vira a mensagem do commit
squashado, e é ele que o release-please vai ler depois. Por isso o guard valida
o título, não só os commits.

Exigências (workflow `Guard · feature → develop`):

| Regra | Por quê |
| --- | --- |
| Exatamente uma label `changes: *` | Declara o impacto semântico da entrega |
| Título em Conventional Commits | Vira a mensagem de commit no squash |
| Todos os commits em Conventional Commits | Rastreabilidade dentro do PR |
| Label coerente com os commits | Impede subestimar o bump de versão |
| Branch com prefixo conhecido | `feature/`, `fix/`, `hotfix/`, `chore/`, ... |

A label **não pode declarar impacto menor** que o dos commits (`changes: fix` com
um `feat:` dentro é erro). Declarar impacto **maior** é permitido, com aviso —
serve para forçar um bump maior conscientemente.

### 2. `develop` → `release`

**Merge obrigatório: merge commit.** Squash aqui destruiria os commits
semânticos individuais, e o release-please não teria como calcular a versão.

Ao abrir o PR, o workflow `Preview · develop → release` roda o release-please em
`--dry-run` e comenta no PR a versão que sairá do merge, o changelog previsto e
o impacto agregado dos commits.

Ao mergear, o workflow `Release Candidate · release`:

1. roda `release-please release-pr` com a config de RC;
2. mergeia automaticamente o Release PR gerado;
3. roda `release-please github-release`, criando a tag `vX.Y.Z-rc.N` e uma
   release marcada como **pre-release** no GitHub.

### 3. `release` → `main`

**Merge obrigatório: merge commit.** Só `release` pode abrir PR para `main`.

Ao mergear, o workflow `Release Estável · main` roda o mesmo ciclo, mas com a
config estável: tag `vX.Y.Z`, `CHANGELOG.md` atualizado e release no GitHub com
release notes — sem a marca de pre-release.

## Por que dois tracks de versão separados

O ponto delicado de rodar release-please em duas branches é o **estado
compartilhado**: se os dois tracks escrevessem nos mesmos arquivos, todo merge
`release → main` geraria conflito no manifesto e no changelog.

A configuração evita isso mantendo os arquivos de cada track disjuntos:

| | Track RC (`release`) | Track estável (`main`) |
| --- | --- | --- |
| Config | `release-please-config-rc.json` | `release-please-config.json` |
| Manifesto | `.release-please-manifest-rc.json` | `.release-please-manifest.json` |
| Changelog | `CHANGELOG-RC.md` | `CHANGELOG.md` |
| Arquivo de versão | — (`release-type: go`) | `version.txt` (`release-type: simple`) |
| Tags | `vX.Y.Z-rc.N` | `vX.Y.Z` |
| Release no GitHub | pre-release | estável |

Nenhum arquivo é escrito pelos dois lados, então `release → main` nunca conflita.
Os tracks convergem naturalmente porque ambos calculam a versão a partir dos
**mesmos commits semânticos** — o RC apenas chega primeiro.

O `release-type: go` no track de RC é intencional: essa estratégia do
release-please não mantém arquivo de versão no repositório (Go versiona por
tag), que é exatamente o que se quer para não disputar o `version.txt` com o
track estável.

## Convenções de commit

Tipos aceitos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `revert`.

| Commit | Impacto |
| --- | --- |
| `feat: ...` | `MINOR` |
| `fix: ...`, `perf: ...`, `revert: ...` | `PATCH` |
| `feat!: ...` ou rodapé `BREAKING CHANGE:` | `MAJOR` |
| demais tipos | nenhum |
