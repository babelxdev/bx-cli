#!/bin/bash
# Script de release automático para BabelX CLI
# Uso: ./scripts/release.sh [patch|minor|major]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está na pasta correta
if [ ! -f "package.json" ]; then
    echo -e "${RED}Erro: Execute este script da raiz do projeto bx-cli${NC}"
    exit 1
fi

# Tipo de versão (padrão: patch)
VERSION_TYPE=${1:-patch}

echo -e "${YELLOW}🚀 Iniciando release do BabelX CLI${NC}"
echo "Tipo de versão: $VERSION_TYPE"

# Verificar branch atual
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo -e "${RED}Erro: Você deve estar na branch main ou master${NC}"
    echo "Branch atual: $CURRENT_BRANCH"
    exit 1
fi

# Verificar se há mudanças não commitadas
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Erro: Há mudanças não commitadas${NC}"
    echo "Por favor, commit ou stash suas mudanças antes de fazer release."
    git status
    exit 1
fi

# Pull das últimas mudanças
echo -e "${YELLOW}📥 Atualizando código...${NC}"
git pull origin $CURRENT_BRANCH

# Ler versão atual
CURRENT_VERSION=$(cat package.json | grep '"version"' | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
echo "Versão atual: $CURRENT_VERSION"

# Calcular nova versão
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case $VERSION_TYPE in
    major)
        NEW_MAJOR=$((MAJOR + 1))
        NEW_VERSION="$NEW_MAJOR.0.0"
        ;;
    minor)
        NEW_MINOR=$((MINOR + 1))
        NEW_VERSION="$MAJOR.$NEW_MINOR.0"
        ;;
    patch)
        NEW_PATCH=$((PATCH + 1))
        NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
        ;;
    *)
        echo -e "${RED}Erro: Tipo de versão inválido. Use: patch, minor ou major${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}Nova versão: $NEW_VERSION${NC}"

# Perguntar confirmação
read -p "Deseja continuar com o release v$NEW_VERSION? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Release cancelado.${NC}"
    exit 0
fi

# Atualizar versão no package.json
echo -e "${YELLOW}📝 Atualizando package.json...${NC}"
bunx json -I -f package.json -e "this.version='$NEW_VERSION'"

# Commit da versão
echo -e "${YELLOW}📦 Criando commit...${NC}"
git add package.json
git commit -m "chore(release): v$NEW_VERSION"

# Criar tag
echo -e "${YELLOW}🏷️  Criando tag v$NEW_VERSION...${NC}"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

Changes:
- See CHANGELOG.md or GitHub Releases for details"

# Push para o GitHub
echo -e "${YELLOW}📤 Enviando para o GitHub...${NC}"
git push origin $CURRENT_BRANCH
git push origin "v$NEW_VERSION"

echo -e "${GREEN}✅ Release v$NEW_VERSION iniciado!${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "1. O GitHub Actions vai rodar os testes"
echo "2. Se passar, vai publicar automaticamente no npm"
echo "3. Acompanhe em: https://github.com/babelxdev/bx-cli/actions"
echo ""
echo -e "${YELLOW}Instalar a nova versão:${NC}"
echo "  npm install -g @babelx/cli@$NEW_VERSION"
