# BabelX CLI

Official CLI for BabelX - AI-powered translation and i18n management.

## Features

- 🌍 **3 i18n structures supported**: directory, file, suffix
- 🤖 **AI-powered translation** using BabelX API
- 💾 **Smart caching** - never re-translate the same string twice
- 🔄 **Sync mode** - only translate new/changed strings
- 🔍 **Auto-detection** - detects your i18n structure automatically

## Installation

```bash
npm install -g @babelx/cli
# or
bun install -g @babelx/cli
```

## Quick Start

```bash
# 1. Initialize project
bx init

# 2. Login with your API key
bx login your-api-key-here

# 3. Translate all files
bx translate

# 4. Sync (only new/changed strings)
bx sync
```

## Supported i18n Structures

### 1. Directory per language (recommended)
```
locales/
  en/
    common.json
    auth.json
  pt-BR/
    common.json  ← Generated
    auth.json    ← Generated
  es/
    common.json  ← Generated
    auth.json    ← Generated
```

### 2. File per language
```
i18n/
  en.json        ← Source
  pt-BR.json     ← Generated
  es.json        ← Generated
```

### 3. Suffix in filename
```
messages.en.json    ← Source
messages.pt-BR.json ← Generated
messages.es.json    ← Generated
```

## Commands

### `bx init`
Initialize BabelX in your project.

```bash
bx init                    # Auto-detect structure
bx init --structure directory --source en --targets "pt-BR,es"
bx init --path ./translations --structure file
```

Options:
- `--structure <type>` - i18n structure: `directory`, `file`, `suffix`
- `--source <lang>` - Source language code
- `--targets <langs>` - Comma-separated target languages
- `--path <path>` - Path to i18n files (default: ./locales)

### `bx login`
Authenticate with BabelX API.

```bash
bx login <api-key>
```

The API key is saved to `.babelx.json` in the current directory.

### `bx translate`
Translate all i18n files.

```bash
bx translate                    # Translate to all target languages
bx translate --target es        # Translate to specific language
bx translate --dry-run          # Preview without making changes
bx translate --force            # Re-translate everything (ignore cache)
```

Options:
- `--source <lang>` - Override source language
- `--target <lang>` - Override target language(s)
- `--structure <type>` - Override structure detection
- `--dry-run` - Show what would be translated
- `--force` - Ignore cache and re-translate

### `bx sync`
Sync translations - only translate new/changed strings.

```bash
bx sync                         # Sync all target languages
bx sync --target pt-BR          # Sync specific language
bx sync --check                 # Check status without translating
```

Options:
- `--target <lang>` - Sync specific language only
- `--check` - Check translation status (dry run)
- `--force` - Force re-translation

### `bx languages`
List available translation languages.

```bash
bx languages
bx languages --search portuguese
```

### `bx cache`
Manage translation cache.

```bash
bx cache stats                  # Show cache statistics
bx cache clear                  # Clear all cached translations
```

### `bx projects`
Manage BabelX projects (requires projects service).

```bash
bx projects list
bx projects create my-app --source en --target pt-BR,es
bx projects delete <project-id>
```

## Configuration

Create `.babelx.json` in your project root:

```json
{
  "sourceLanguage": "en",
  "targetLanguages": ["pt-BR", "es", "fr"],
  "i18nPath": "./locales",
  "structure": "directory",
  "i18nFormat": "json"
}
```

Or use environment variables:
- `BABELX_API_KEY` - Your API key
- `BABELX_API_URL` - API URL (default: https://api.babelx.dev)
- `BABELX_SOURCE_LANGUAGE` - Source language
- `BABELX_TARGET_LANGUAGES` - Comma-separated target languages
- `BABELX_I18N_PATH` - Path to i18n files

## Example Workflow

```bash
# 1. Setup
mkdir my-project && cd my-project
bx init --structure directory --source en --targets "pt-BR,es"

# 2. Create your source translations
mkdir -p locales/en
echo '{"hello": "Hello World"}' > locales/en/common.json

# 3. Authenticate
bx login sk_live_xxx

# 4. Translate everything
bx translate

# 5. Add new string to source
echo '{"hello": "Hello World", "welcome": "Welcome!"}' > locales/en/common.json

# 6. Sync (only translates the new "welcome" string)
bx sync

# 7. Check cache
bx cache stats
```

## Requirements

- Node.js 18+ or Bun 1.0+
- BabelX API key

## License

Apache 2.0 © BabelX
