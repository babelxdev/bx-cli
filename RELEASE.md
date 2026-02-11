# 🚀 Processo de Release - Automático

Este documento explica como publicar novas versões do BabelX CLI automaticamente usando GitHub Actions.

## 📋 Requisitos

Antes de começar, você precisa configurar:

### 1. Token do npm (NPM_TOKEN)

1. Acesse https://www.npmjs.com/settings/tokens
2. Clique em "Generate New Token" → "Classic Token"
3. Selecione as permissões: **Publish**
4. Copie o token gerado
5. No GitHub, vá em Settings → Secrets and variables → Actions
6. Adicione um novo secret: `NPM_TOKEN` com o valor do token copiado

### 2. Permissões do GitHub Actions

No repositório GitHub:
1. Settings → Actions → General
2. Em "Workflow permissions", selecione: **Read and write permissions**
3. Marque: **Allow GitHub Actions to create and approve pull requests**

## 🔄 Fluxo de CI/CD (Automático)

O workflow `.github/workflows/ci-cd.yml` funciona assim:

### Em todo push/PR:
- ✅ Roda o linter (`bun run lint:check`)
- ✅ Faz o build (`bun run build`)
- ✅ Testa os comandos básicos da CLI

### Em push para `main` (com versão nova):
- 🔍 Compara versão do `package.json` com última versão no npm
- 🚀 Se versão mudou: publica automaticamente no npm
- 🏷️ Cria tag no git (ex: `v0.1.1`)
- 📝 Cria uma Release no GitHub com notas automáticas

## 🛠️ Como Fazer Release (Simples)

**Agora é automático!** Basta atualizar a versão no `package.json` e fazer push:

```bash
# 1. Edite o package.json e aumente a versão
# Ex: "version": "0.1.0" → "0.1.1"

# 2. Commite suas mudanças
git add .
git commit -m "feat: nova funcionalidade incrível"

# 3. Push para main (isso dispara o release automaticamente!)
git push origin main

# ✨ Pronto! GitHub Actions vai:
#    - Detectar que a versão mudou (0.1.0 → 0.1.1)
#    - Publicar no npm automaticamente
#    - Criar tag v0.1.1
#    - Criar Release no GitHub
```

### Opção alternativa: Script helper (opcional)

Se preferir, ainda pode usar o script para automatizar o bump de versão:

```bash
# Atualiza versão + commit + push (tudo de uma vez)
./scripts/release.sh patch   # 0.1.0 → 0.1.1
./scripts/release.sh minor   # 0.1.0 → 0.2.0
./scripts/release.sh major   # 0.1.0 → 1.0.0
```

## 📊 Acompanhar o Release

Após criar a tag, acompanhe em:
- **GitHub Actions**: https://github.com/babelxdev/bx-cli/actions
- **Releases**: https://github.com/babelxdev/bx-cli/releases
- **npm**: https://www.npmjs.com/package/@babelx/cli

## 🧪 Testar antes de publicar

Se quiser testar o fluxo completo sem publicar:

```bash
# 1. Criar uma tag de teste (não começa com v)
git tag test-release
git push origin test-release

# 2. Isso vai rodar os testes mas NÃO vai publicar no npm

# 3. Depois apague a tag
git tag -d test-release
git push --delete origin test-release
```

## 🔧 Solução de Problemas

### Erro: "npm ERR! 401 Unauthorized"
- Verifique se o secret `NPM_TOKEN` está configurado no GitHub
- Verifique se o token no npmjs.com ainda é válido

### Erro: "npm ERR! 403 Forbidden"
- Verifique se você é owner do package `@babelx/cli` no npm
- Ou se tem permissões de publish

### Erro no lint ou build
- Corrija os erros localmente primeiro
- Commit e push antes de criar a tag

## 📦 Instalação da CLI publicada

Após o release ser publicado com sucesso:

```bash
# Instalar versão específica
npm install -g @babelx/cli@0.1.1

# Ou instalar última versão
npm install -g @babelx/cli

# Verificar instalação
bx --version
bx init --help
```

## 📝 Convenção de Commits (Recomendado)

Para gerar changelogs automáticos:

- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Documentação
- `chore:` - Tarefas de manutenção
- `refactor:` - Refatoração de código

## 🔄 Versionamento Semântico

Seguimos [SemVer](https://semver.org/):

- **MAJOR** (X.0.0): Mudanças incompatíveis (breaking changes)
- **MINOR** (0.X.0): Novas funcionalidades compatíveis
- **PATCH** (0.0.X): Correções de bugs

---

## 💡 Dica

Configure o GitHub para notificar no Slack/Discord quando:
- Um release for publicado
- O workflow falhar

Settings → Webhooks → Add webhook
