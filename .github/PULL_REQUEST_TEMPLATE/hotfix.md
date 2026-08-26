## O que quebrou em produção

<!-- O sintoma, não a causa. Uma ou duas frases. -->

## A correção

<!-- O que foi mudado e por que é a menor mudança possível que resolve. -->

## Destino deste PR

<!-- Marque um. As regras de versão são diferentes em cada um. -->

- [ ] **`main`** — título `fix(escopo): …`, merge commit → publica `vX.Y.Z-hf`
- [ ] **`release`** — título `fix(escopo): …`, merge commit → publica `vX.Y.(Z+1)-rc.1`
- [ ] **`develop`** — título `chore(hotfix): …`, squash → **nenhuma versão**

## Checklist

- [ ] A branch tem o prefixo `hotfix/` — é ele que dispara toda a detecção.
- [ ] A branch saiu de `main`, não de `develop`.
- [ ] O PR para `main` foi mergeado **antes** deste (se este não for o de `main`).
- [ ] Os três PRs (`main`, `release`, `develop`) estão abertos ou já mergeados.
- [ ] O PR para `develop` usa título neutro e a label `changes: chore` — um `fix:`
      squashado ali geraria um terceiro bump para a mesma correção.

Regras completas em [`docs/HOTFIX.md`](../../docs/HOTFIX.md).
