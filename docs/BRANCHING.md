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

main ──▶ hotfix/*  ──merge──▶  main       vX.Y.Z-hf      (núcleo preservado)
                   ──merge──▶  release   vX.Y.(Z+1)-rc.1  (PATCH no núcleo)
                   ─cherry-pick─▶ hotfix/*--develop ──squash──▶ develop
                                                     nenhuma versão
```

## As três transições do ciclo

O hotfix é a quarta transição e tem regras próprias — ver
[`HOTFIX.md`](HOTFIX.md).

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

Além de `release`, `hotfix/*` também pode abrir PR para `main` — é o caminho que
pula a homologação de propósito. Ver abaixo.

## A quarta transição: `hotfix/*`

Documentada por inteiro em [`HOTFIX.md`](HOTFIX.md). O resumo:

| PR | Merge | Versão |
| --- | --- | --- |
| `hotfix/*` → `main` | merge commit | núcleo preservado + `-hf` (`1.0.2` → `1.0.2-hf` → `1.0.2-hf.2`) |
| `hotfix/*` → `release` | merge commit | PATCH no núcleo (`1.0.1-rc.3` → `1.0.2-rc.1`) |
| `hotfix/*--develop` → `develop` | squash | nenhuma — título tem de ser neutro (`chore(hotfix): …`) |

Nenhuma dessas versões sai de uma estratégia do release-please: elas são
calculadas em `.github/scripts/` e impostas com `--release-as`.

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
| Tags | `vX.Y.Z-rc.N` | `vX.Y.Z`, `vX.Y.Z-hf[.N]` |
| Release no GitHub | pre-release | estável (o `-hf` também) |

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

Oito comportamentos do release-please que quebram este fluxo silenciosamente —
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

### 5. Um Release PR mergeado sem tag trava todos os próximos

Se um Release PR é mergeado mas o `github-release` não chega a criar a tag, o PR
fica com a label `autorelease: pending` para sempre. A partir daí o release-please
recusa qualquer novo release na branch:

```
Found pull request #2: 'chore: release release'
⚠ There are untagged, merged release PRs outstanding - aborting
```

E o pior: o workflow **termina verde**, porque para o release-please isso é um
aviso, não um erro. Nada é publicado e nada falha.

É a consequência natural da armadilha 2 — o `github-release` recusar o PR deixa
exatamente esse estado. Para destravar, remova a label `autorelease: pending` do
PR mergeado que ficou sem tag.

### 6. Um run cancelado bloqueia o merge indefinidamente

`concurrency.cancel-in-progress: true` é o padrão recomendado para economizar
minutos de CI, mas num **status check obrigatório** ele cria um impasse: o run
cancelado fica no rollup do PR como check não-bem-sucedido, e o merge segue
`BLOCKED` mesmo depois de um run posterior passar.

```
checks: [ {name: "...", conclusion: CANCELLED},
          {name: "...", conclusion: SUCCESS} ]
mergeStateStatus: BLOCKED
```

Dois eventos próximos bastam para provocar — abrir o PR e aplicar a label, por
exemplo. Por isso o guard de `develop` roda com `cancel-in-progress: false`. Se
um PR já ficou travado assim, `gh run rerun <id>` no run cancelado o libera.

### 7. Os updaters carregam o prerelease para a versão seguinte

`MajorVersionUpdate`, `MinorVersionUpdate` e `PatchVersionUpdate` repassam
`version.preRelease` intacto ao bumpar. No track de RC isso é inofensivo (a
estratégia `prerelease` reescreve o identificador), mas no track estável, depois
de um `-hf`, toda versão seguinte sairia `1.0.1-hf`, `1.0.2-hf`… O fluxo impõe a
versão limpa com `--release-as` no primeiro ciclo normal depois de um hotfix —
ver [`HOTFIX.md`](HOTFIX.md#4-o-sufixo--hf-gruda-no-track-estável).

### 8. "Publicável" não é o mesmo que "move a versão"

O release-please publica uma release para **qualquer** commit que caia numa
seção visível do changelog, e nesses casos bumpa o PATCH. Como as configs deste
repositório deixam `docs`, `build`, `ci` e `refactor` visíveis, um ciclo só de
`ci:` publica versão — mesmo que nenhuma regra semântica peça bump.

São dois conceitos distintos, e o código os separa:

| | Pergunta | Onde |
| --- | --- | --- |
| `TYPE_IMPACT` / `highestImpact` | quanto esta entrega move a versão? | política de labels em `develop` |
| `RELEASABLE_TYPES` / `releaseImpact` | o release-please vai publicar? | projeção de versão nos guards |

Confundir os dois faz o guard prometer uma versão e o release-please publicar
outra: a promoção do PR #27 foi projetada como `v1.0.0` e publicada como
`v1.0.1`. Só `test`, `style` e `chore` (as seções `hidden`) não publicam nada —
é por isso que o back-merge de hotfix em `develop` exige título `chore`.

## Interação com as configurações do repositório

`delete_branch_on_merge` **precisa ficar desligado**. Com ele ativo, o merge de
`develop → release` apaga a branch `develop` — a regra `deletion` do ruleset não
impede, porque quem faz o merge normalmente tem bypass. As branches de feature
são apagadas explicitamente com `gh pr merge --delete-branch`.
