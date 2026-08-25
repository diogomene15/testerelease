## O que muda

<!-- Descreva a mudança em uma ou duas frases. -->

## Checklist

- [ ] O **título deste PR** é um Conventional Commit (`tipo(escopo): descrição`) — ele vira a mensagem de commit no squash.
- [ ] Todos os commits seguem Conventional Commits.
- [ ] Apliquei **exatamente uma** label `changes: *` compatível com o impacto real da mudança.

## Label de mudança

| Label | Impacto na versão |
| --- | --- |
| `changes: breaking` | `MAJOR` — quebra compatibilidade |
| `changes: feature` | `MINOR` — nova funcionalidade |
| `changes: fix` | `PATCH` — correção |
| `changes: chore` | nenhum bump |
