# Tailormap Tools - Copilot Instructions

## Project Overview

This repository contains development scripts and tools for Tailormap development. It provides CLI utilities to help with common tasks like building applications, publishing libraries, extracting i18n translations, and managing Angular libraries.

## Repository Structure

- `/bin/` - Executable CLI scripts (main entry points)
  - `build-application.js` - Builds Angular applications with localization support
  - `publish-new-release.js` - Publishes a single library release
  - `publish-all.js` - Publishes all configured libraries
  - `extract-i18n.js` - Extracts i18n translations from Angular libraries
  - `add-ng-libraries.js` - Adds Angular libraries (used in Docker builds)
- `/bin/helpers/` - Shared utility functions
  - `shared.js` - Common utilities for git, CLI args, and project management
  - `generate-version-info.js` - Generates version info files
  - `compress-build.js` - Compresses build bundles
- `/projects/` - Test projects directory
- `tm-project.json` - Required configuration file for the tools (see below)
- `package.json` - Node.js package configuration with CLI bin commands
- `eslint.config.mjs` - ESLint configuration

## Key Configuration Files

### tm-project.json

This file is **required** at the root of any project using these tools. It defines:

```json
{
  "coreProjectLocation": "path/to/core",
  "libraries": [
    ["@scope", "library-name"]
  ],
  "apps": ["app-name"]
}
```

Example for Tailormap Viewer:
```json
{
  "coreProjectLocation": "projects/core",
  "libraries": [
    ["@tailormap-viewer", "api"],
    ["@tailormap-viewer", "shared"]
  ]
}
```

Example for extensions:
```json
{
  "coreProjectLocation": "node_modules/@tailormap-viewer/core",
  "libraries": [
    ["@tailormap-b3p", "hello-world"]
  ]
}
```

## Build, Test, and Lint

### Installing Dependencies
```bash
npm install
```

### Linting
```bash
npm run lint
```

There are no automated tests in this repository. Manual testing is done by running the CLI tools.

## Code Conventions

### Language and Style
- **Language**: Node.js (JavaScript)
- **Module System**: CommonJS (`require`/`module.exports`)
- **Target Environment**: Node.js environment (CLI tools)
- **License**: MIT License

### ESLint Configuration
- Uses `@eslint/js` recommended config
- CommonJS source type for all JS files
- Node.js globals enabled
- Custom rules:
  - `no-unused-vars`: Error, with specific exceptions for caught errors and args with `_` prefix
  - Args ignored with pattern `^_`
  - Caught errors not checked

### Code Style Guidelines
1. Use `'use strict';` at the top of executable scripts
2. Include shebang `#!/usr/bin/env node` for CLI entry points
3. Use async/await for asynchronous operations
4. Use `const` for immutable bindings, avoid `var`
5. Prefer destructuring imports from modules: `const {func1, func2} = require('./module')`
6. Scripts should check for clean git repo before making changes (via `checkCleanGitRepo()`)
7. CLI arguments are parsed using `getCliArgument()` and `hasCliArgument()` helpers
8. Use `console.error()` for errors and `console.log()` for informational output
9. Exit with `process.exit(1)` on errors, `process.exit(0)` or implicit for success

### Common Patterns
- CLI scripts use helper functions from `/bin/helpers/shared.js`
- Git operations use `execSync` from child_process
- Interactive prompts use the `inquirer` package
- Colored console output uses the `chalk` package
- Path resolution always uses `path.resolve()` or `getPathFromProjectRoot()`
- File operations use both sync (`fs`) and async (`fs/promises`) based on context

### Error Handling
- Use try-catch blocks for operations that may fail
- Log meaningful error messages before exiting
- Preserve error context when logging: `console.log('Error occurred', e)`

## Working with This Repository

### Adding New CLI Tools
1. Create a new script in `/bin/` with proper shebang and strict mode
2. Add the script to `package.json` `bin` section with `tm-` prefix
3. Import required helpers from `/bin/helpers/shared.js`
4. Implement CLI argument parsing using `getCliArgument()` and `hasCliArgument()`
5. Follow existing patterns for user interaction and output

### Modifying Helpers
- Shared utilities go in `/bin/helpers/shared.js`
- Specialized helpers get their own files in `/bin/helpers/`
- All helpers use CommonJS exports: `module.exports = { func1, func2 }`

### Dependencies
- **Production**: `chalk` (terminal colors), `inquirer` (interactive prompts)
- **Development**: `eslint`, `@eslint/js`, `globals`
- Add new dependencies sparingly; prefer Node.js built-ins when possible

## Publishing

This package is published to a private Nexus registry at `https://repo.b3p.nl/nexus/repository/npm-public` under the `@tailormap-viewer` scope.

To publish: `npm run publish-lib` (increments patch version and publishes)

## Important Notes

- All CLI tools expect to be run from the project root
- The `tm-project.json` file must exist in the working directory
- Git repository must be clean for certain operations (publish, release)
- Scripts use synchronous child_process operations for git commands
- Angular-specific operations assume `ng` CLI is available in the project
