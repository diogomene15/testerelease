# Fluxo de hotfix

Um hotfix é uma correção que entra em produção **sem esperar o ciclo**
`develop → release → main`. Ele sai de `main`, volta para `main` e depois é
retroportado para as outras duas branches permanentes.

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
   main ────────────┴──▶ hotfix/xyz ──①──▶ main               │  1.0.2 → 1.0.2-hf
 (produção)                    │                              │
                               ├──②──▶ release  (staging)     │  1.0.1-rc.3 → 1.0.2-rc.1
                               │                              │
                               └──③──▶ develop (integração)   │  nenhuma versão
                                                              │
                                          ciclo normal segue ─┘
```

A ordem importa: **① produção primeiro** (é a urgência que justifica o hotfix),
depois os dois back-merges. Sem ② e ③ a correção volta a sumir no próximo
`develop → release → main`.

## Regras de versão

| # | PR | Merge | Versão | Exemplo |
| --- | --- | --- | --- | --- |
| ① | `hotfix/*` → `main` | merge commit | núcleo **preservado** + sufixo `-hf` | `1.0.2` → `1.0.2-hf` → `1.0.2-hf.2` → `1.0.2-hf.3` |
| ② | `hotfix/*` → `release` | merge commit | **PATCH** no núcleo, contador de RC em 1 | `1.0.1-rc.3` → `1.0.2-rc.1` → `1.0.3-rc.1` |
| ③ | `hotfix/*` → `develop` | squash | **nenhuma** | — |

As duas primeiras são simétricas e é isso que fecha o fluxo: em `main` o núcleo
não pode mudar (a correção é publicada *sobre* a estável que já está rodando),
e em `release` ele **tem** que mudar (a RC mirava uma estável que acabou de ser
corrigida em produção — a próxima estável precisa ser maior).

### ① `hotfix/*` → `main`

O primeiro hotfix sobre uma estável sai sem contador (`1.0.2-hf`); o segundo já
sai como `1.0.2-hf.2`. Não existe `-hf.1`: ele seria **menor** que `1.0.2-hf` na
precedência semver, e a sequência publicada tem de ser crescente.

A release no GitHub é criada como **estável**, não como pre-release — o
release-please só marca pre-release quando a config declara `prerelease: true`,
e a config do track estável (`release-please-config.json`) não declara.

### ② `hotfix/*` → `release`

O núcleo avança um PATCH e o contador de RC reinicia, porque o ciclo passou a
mirar outro núcleo. Cada hotfix retroportado avança de novo: `1.0.2-rc.1`,
`1.0.3-rc.1`, `1.0.4-rc.1`.

Depois disso o ciclo normal volta a fechar sozinho: com `main` em `1.0.2-hf` e
`release` em `1.0.3-rc.1`, um `fix:` qualquer no ciclo produz `1.0.3-rc.2` — o
mesmo alvo, contador avançando, como sempre.

### ③ `hotfix/*` → `develop`

`develop` não tem workflow de release, então nada acontece automaticamente. O
cuidado aqui é outro: **o merge em `develop` é squash**, e um commit squashado
não guarda ancestralidade com os commits originais do hotfix. Quando `develop`
voltasse para `release`, o release-please veria aquele `fix:` como novidade e
geraria um **terceiro** bump para a mesma correção.

Por isso o guard exige que o back-merge seja neutro:

| Exigência | Valor |
| --- | --- |
| Título do PR | tipo sem impacto de versão — `chore(hotfix): retroporta … para develop` |
| Label | `changes: chore` |
| Commits internos | continuam validados como Conventional Commits, mas **não** entram no cálculo de impacto |

Sem essa exceção, a regra normal de coerência acusaria a label `changes: chore`
de subestimar o `fix:` que está dentro do PR.

## Passo a passo

```bash
# ① corrigir e publicar em produção
git switch main && git pull
git switch -c hotfix/login-500
# ... correção ...
git commit -m "fix(login): trata sessão expirada sem derrubar o app"
git push -u origin hotfix/login-500

gh pr create --base main --head hotfix/login-500 \
  --title "fix(login): trata sessão expirada sem derrubar o app" \
  --label hotfix
# merge commit → workflow `Release Estável` publica v1.0.2-hf

# ② retroportar para staging
gh pr create --base release --head hotfix/login-500 \
  --title "fix(login): trata sessão expirada sem derrubar o app" \
  --label hotfix
# merge commit → workflow `Release Candidate` publica v1.0.3-rc.1

# ③ retroportar para integração (neutro)
gh pr create --base develop --head hotfix/login-500 \
  --title "chore(hotfix): retroporta correção do login para develop" \
  --label "changes: chore" --label hotfix
# squash → nenhuma versão
```

A branch `hotfix/*` só é apagada depois dos três merges — ela é a origem comum
dos três PRs.

## Como o release-please é levado a produzir essas versões

Nenhuma das duas regras sai de uma estratégia de versionamento do
release-please. A estratégia `prerelease`, que o track de RC usa, faria:

```
1.0.1-rc.3  +  fix:   →  1.0.1-rc.4     ← o que o release-please quer fazer
1.0.1-rc.3  +  hotfix →  1.0.2-rc.1     ← o que este fluxo precisa
```

E em `main` a estratégia `default` bumparia o núcleo (`1.0.2` → `1.0.3`), que é
exatamente o que um hotfix **não** pode fazer.

A saída é calcular a versão neste repositório e impô-la ao release-please com
`--release-as`, que sobrepõe a estratégia. O caminho é:

1. `.github/workflows/release-please-run.yml` pergunta à API quais PRs estão
   associados ao commit que disparou o workflow;
2. `.github/scripts/hotfix.js` decide se aquele push foi produzido pelo merge de
   um `hotfix/*` — casando o SHA do push com o `merge_commit_sha` do PR;
3. `.github/scripts/compute-version.js` calcula a versão do canal (`nextHotfix`
   para `main`, `nextRcForHotfix` para `release`);
4. o `release-pr` roda com `--release-as <versão>`.

O mesmo caminho é usado uma vez mais depois: o **primeiro ciclo normal publicado
em cima de um `-hf`** também tem a versão imposta, agora por
`postHotfixReleaseAs` — só para retirar o sufixo (armadilha 5). Fora desses dois
casos nada disso é acionado, e o release-please segue calculando a versão pelos
commits semânticos, como antes.

> `--release-as` funciona em modo manifest (com `--config-file`/`--manifest-file`)
> e vale para todos os pacotes do manifesto. Não é preciso passar `--path`.

## Consequência semver do sufixo `-hf`

`1.0.2-hf` é, em semver estrito, **menor** que `1.0.2` — todo identificador de
prerelease tem precedência menor que a versão limpa. A regra deste fluxo usa o
sufixo como marca de *pós*-lançamento, o que inverte essa leitura. Na prática:

| Situação | Efeito |
| --- | --- |
| Release "Latest" no GitHub | correto — o GitHub usa data de criação, não precedência semver |
| Ordenação por semver (`sort -V`, `gh release list`) | `v1.0.2-hf` aparece **antes** de `v1.0.2` |
| Range de dependência (`^1.0.0`, `~1.0.2`) | um consumidor npm/cargo **não** receberia `1.0.2-hf`: ranges excluem prereleases |
| release-please | indiferente — no modo manifest a versão atual vem do manifesto, não de comparação de tags |

Nada disso quebra este repositório, que não é publicado como pacote. Se um dia
for, a alternativa que preserva a precedência é usar metadado de build
(`1.0.2+hf.2`) ou simplesmente bumpar o PATCH em produção também.

## Recuperando o ciclo depois de um hotfix

Terminados os três merges, o estado fica assim:

| Branch | Versão |
| --- | --- |
| `main` | `1.0.2-hf` |
| `release` | `1.0.3-rc.1` |
| `develop` | — |

Na promoção seguinte `release → main` a versão sai limpa — `1.0.3` se houver
`fix:` no ciclo, `1.1.0` se houver `feat:` —, mas isso também precisa ser
imposto: os updaters do release-please carregam o sufixo adiante (armadilha 5).
Se **nada** entrou no ciclo além do próprio hotfix, não há commit novo para
contar e nenhuma release é publicada — `main` fica em `1.0.2-hf` até o próximo
ciclo real.

### Os dois núcleos divergem, e isso é esperado

A regra de `main` preserva o núcleo; a de `release` avança um PATCH por hotfix.
Depois de três hotfixes seguidos os tracks ficam assim:

| | `main` | `release` |
| --- | --- | --- |
| depois do 1º hotfix | `1.0.0-hf` | `1.0.1-rc.1` |
| depois do 2º | `1.0.0-hf.2` | `1.0.2-rc.1` |
| depois do 3º | `1.0.0-hf.3` | `1.0.3-rc.1` |

A RC promete `1.0.3`, mas a promoção parte de `1.0.0-hf.3` e, com só `fix:` no
ciclo, publica `1.0.1`. Nada colide (as tags dos dois tracks são distintas), mas
os números não batem — é a consequência direta de produção não avançar o núcleo.
O guard de `main` comenta um aviso quando isso acontece.

Se o alinhamento importar mais que a preservação do núcleo, a saída é bumpar o
PATCH em produção também (`1.0.2` → `1.0.3`, sem sufixo) e usar o `-hf` só como
metadado. Um `feat:` no ciclo já reconcilia os dois lados sozinho, porque o
`MINOR` sobrepõe qualquer diferença de PATCH acumulada.

## Armadilhas específicas do hotfix

### 1. Retroportar para `release` antes de publicar em `main`

A versão do retroporte é calculada a partir da RC atual, não da estável, então
inverter a ordem não produz um número errado — mas produz uma RC apontando para
uma estável que ainda não existe, e a janela entre os dois merges é exatamente o
tempo em que produção continua quebrada. Publique em `main` primeiro.

### 2. Squash no PR para `release` ou `main`

Os rulesets destas duas branches só permitem merge commit, justamente para
preservar os commits semânticos e a ancestralidade. Se o squash fosse permitido,
o retroporte para `release` perderia a ligação com o hotfix e o release-please
recontaria os mesmos `fix:` no próximo `develop → release`.

### 3. Título versionável no back-merge para `develop`

É o erro que o guard de `develop` bloqueia. Repetir o título `fix(login): …` no
PR para `develop` parece natural — e gera um bump extra duas transições adiante,
quando já não é óbvio de onde veio.

### 4. O sufixo `-hf` gruda no track estável

Todos os `VersionUpdater` do release-please copiam o identificador de prerelease
para a versão seguinte:

```js
// release-please/build/src/versioning-strategy.js
bump(version) {
  return new Version(version.major, version.minor, version.patch + 1,
                     version.preRelease, version.build);
}
```

Com o manifesto estável em `1.0.0-hf`, a promoção seguinte sairia `1.0.1-hf`, a
outra `1.0.2-hf`, e o track **nunca mais** publicaria uma versão limpa. Não é o
mesmo caso do `-rc`: lá o prerelease é intencional e a estratégia `prerelease`
sabe manejá-lo; aqui ele é uma marca de pós-lançamento que só vale para aquela
publicação.

Por isso `postHotfixReleaseAs` recalcula a versão (`bumpStable`, que trata `-hf`
como pós-lançamento) e a impõe com `--release-as` no primeiro ciclo normal
depois de um hotfix. O impacto é recontado a partir de `git log v<atual>..HEAD`
com o mesmo parser do guard; o release-please continua montando o changelog
sozinho.

O piso desse cálculo é PATCH, mesmo quando nenhum commit tem impacto de versão.
Os dois lados não classificam "publicável" da mesma forma: para o guard só
`feat`, `fix`, `perf` e breaking movem a versão, enquanto o release-please
publica **qualquer** commit que caia numa seção visível do changelog — `ci:` e
`docs:` caem, e bumpa o PATCH. Sem o piso, um ciclo só de `ci:` voltaria a sair
como `1.0.1-hf`. Impor uma versão nunca cria uma release: se o changelog sair
vazio, o release-please não abre Release PR nenhum.

### 5. Branch sem o prefixo `hotfix/`

Toda a detecção depende dele. Uma branch `fix/login-500` abrindo PR para `main`
é barrada pelo guard (só `release` e `hotfix/*` podem); mas se o guard for
ignorado por bypass, o push em `main` seria versionado pelo caminho normal e o
núcleo mudaria.
