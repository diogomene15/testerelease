# Changelog

## [1.0.1-rc.1](https://github.com/diogomene15/testerelease/compare/v1.0.0-rc.2...v1.0.1-rc.1) (2026-08-26)


### 🐛 Correções

* **saudacao:** trata nome nulo ou em branco sem quebrar a mensagem ([d38d67b](https://github.com/diogomene15/testerelease/commit/d38d67bb0b94167ced82754b472a02fab3462d74))
* **saudacao:** trata nome nulo ou em branco sem quebrar a mensagem ([#31](https://github.com/diogomene15/testerelease/issues/31)) ([9fa111e](https://github.com/diogomene15/testerelease/commit/9fa111e159cbd8e354055ed904b1570cc104f5e3))

## [1.0.0-rc.2](https://github.com/diogomene15/testerelease/compare/v1.0.0-rc.1...v1.0.0-rc.2) (2026-08-26)


### 🤖 CI/CD

* **hotfix:** adiciona fluxo de hotfix com versões -hf e retroporte ([#23](https://github.com/diogomene15/testerelease/issues/23)) ([0d88780](https://github.com/diogomene15/testerelease/commit/0d88780669aabd6d30d287e6eb3ec2fdfb7840ba))
* **hotfix:** usa PATCH como piso ao retirar o sufixo -hf ([#25](https://github.com/diogomene15/testerelease/issues/25)) ([7d4634e](https://github.com/diogomene15/testerelease/commit/7d4634eda72faaca2ada37314936ed2c6e26ca81))
* **preview:** lê o manifesto estável da branch default ([#22](https://github.com/diogomene15/testerelease/issues/22)) ([c960bc8](https://github.com/diogomene15/testerelease/commit/c960bc8a030ca54159993e4a64949486eccec044))

## [1.0.0-rc.1](https://github.com/diogomene15/testerelease/compare/v1.0.0-rc...v1.0.0-rc.1) (2026-08-25)


### 🐛 Correções

* **saudacao:** usa toLocaleUpperCase para respeitar o idioma ([#17](https://github.com/diogomene15/testerelease/issues/17)) ([847f075](https://github.com/diogomene15/testerelease/commit/847f075d2e667343cbaa44fdfc2127cf08ed2cb7))

## [1.0.0-rc](https://github.com/diogomene15/testerelease/compare/v0.1.0-rc...v1.0.0-rc) (2026-08-25)


### ⚠ BREAKING CHANGES

* **saudacao:** `greet(name, idioma)` foi removido em favor de `saudar(name, { idioma, maiusculas })`.

### ✨ Funcionalidades

* **saudacao:** troca greet por saudar com objeto de opções ([#14](https://github.com/diogomene15/testerelease/issues/14)) ([b7e0206](https://github.com/diogomene15/testerelease/commit/b7e0206f706119141919316c838ab5b9cc308fc1))


### 🤖 CI/CD

* **preview:** usa a versão calculada pelo release-please no comentário ([#13](https://github.com/diogomene15/testerelease/issues/13)) ([a35cf7e](https://github.com/diogomene15/testerelease/commit/a35cf7e3f66319ba893e89cfd65150877891bf75))

## [0.1.0-rc](https://github.com/diogomene15/testerelease/compare/v0.0.0...v0.1.0-rc) (2026-08-25)


### ✨ Funcionalidades

* **saudacao:** adiciona suporte a pt, en e es ([#3](https://github.com/diogomene15/testerelease/issues/3)) ([b25a8f3](https://github.com/diogomene15/testerelease/commit/b25a8f3415444438c317bde7230bcd436551070b))


### 🐛 Correções

* **release-please:** corrige config que impedia a criação das releases ([c0982da](https://github.com/diogomene15/testerelease/commit/c0982da5e54e7d469f35b4bbff5fca89ec5122f9))
* **saudacao:** usa idioma padrão em vez de lançar erro ([#4](https://github.com/diogomene15/testerelease/issues/4)) ([0743be5](https://github.com/diogomene15/testerelease/commit/0743be52d52c7bb6ed8b0957405a59728680d53d))


### 🤖 CI/CD

* ignora Release PRs do release-please nos guards de origem ([1c6faaa](https://github.com/diogomene15/testerelease/commit/1c6faaa12af243e330c74137e33708caf9cdf444))
* **preview:** aguarda o GitHub calcular o merge commit do PR ([#8](https://github.com/diogomene15/testerelease/issues/8)) ([e5debe5](https://github.com/diogomene15/testerelease/commit/e5debe50428de612bf3b423d31b08c6a77266ee6))
* **preview:** concede contents:write para publicar a branch efêmera ([#9](https://github.com/diogomene15/testerelease/issues/9)) ([0463097](https://github.com/diogomene15/testerelease/commit/04630979d98eff584c46490b3a6361c7ca225ebc))
