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

## Armadilhas do release-please neste arranjo

Quatro comportamentos do release-please que quebram este fluxo silenciosamente —
todos encontrados rodando o fluxo de ponta a ponta, não lendo a documentação.

### 1. `pull-request-title-pattern` exige `${scope}` e `${component}`

Um padrão que não contenha **os dois** placeholders é descartado inteiro, sem
erro: o release-please loga `pullRequestTitlePattern miss the part of '${scope}'`
e cai no título genérico `chore: release <branch>`.

```jsonc
// descartado silenciosamente
"pull-request-title-pattern": "chore(release): release candidate v${version}"

// aceito
"pull-request-title-pattern": "chore${scope}: release candidate${component} v${version}"
```

### 2. `package-name` impede o `github-release` de reconhecer o próprio PR

Com `package-name` definido, o release-please espera esse componente no título
do Release PR. Num repositório de pacote único o título não o carrega, e o
`github-release` recusa o PR que ele mesmo abriu:

```
⚠ PR component: undefined does not match configured component: testerelease
[]
```

O `release-pr` funciona, o PR é mergeado, o changelog é atualizado — e **nenhuma
tag ou release é criada**. O workflow termina verde. A correção é omitir
`package-name` em repositórios de pacote único.

### 3. A primeira release ignora o modo prerelease

Sem uma release anterior, o release-please usa a `initial-version` (`1.0.0` por
padrão) diretamente, sem passar pelo versioning strategy. Com `prerelease: true`
configurado, a primeira release candidate sai como `1.0.0` — **sem o sufixo
`-rc`**.

Por isso existe a tag `v0.0.0` no commit inicial: ela dá aos dois tracks um
ponto de partida, e todo cálculo seguinte passa pelo strategy normalmente.

### 4. `refs/pull/N/merge` não é legível pelo release-please

Para prever a versão antes do merge seria natural apontar o dry-run para o merge
simulado do PR. O release-please até lê os arquivos de config desse ref (via
Contents API), mas a busca de commits é uma query GraphQL por branch:

```
⚠ Could not find commits for branch refs/pull/5/merge - it likely does not exist.
```

O workflow de preview contorna isso publicando o merge simulado como uma branch
efêmera (`release-please-preview/pr-N`), rodando o dry-run contra ela e
removendo-a no fim (`if: always()`).
