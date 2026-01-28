#!/usr/bin/env node

/**
 * link-modules.js - Angular Module Symlink Manager for tailormap-viewer
 *
 * This script manages symlinks from external Angular projects (e.g., tailormap-gbi)
 * into the tailormap-viewer monorepo.
 *
 * Usage:
 *   node link-modules.js link <source-path> [options]
 *   node link-modules.js unlink <module-name>
 *   node link-modules.js list
 *   node link-modules.js status
 *   node link-modules.js revert
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {consoleMarkup} = require("./helpers/shared.js");

// =============================================================================
// Configuration
// =============================================================================

const SCRIPT_DIR = process ? path.resolve(process.cwd()) : __dirname;
const PROJECTS_DIR = path.join(SCRIPT_DIR, 'projects');
const TSCONFIG_FILE = path.join(SCRIPT_DIR, 'tsconfig.json');
const ANGULAR_JSON = path.join(SCRIPT_DIR, 'angular.json');
const ENVIRONMENT_FILE = path.join(SCRIPT_DIR, 'projects/app/src/environments/environment.ts');
const BACKUP_DIR = path.join(SCRIPT_DIR, '.link-modules-backup');
const STATE_FILE = path.join(SCRIPT_DIR, '.linked-modules.json');

// =============================================================================
// Logging Functions
// =============================================================================

function logInfo(message) {
  console.log(`${consoleMarkup.blue('[INFO]')} ${message}`);
}

function logSuccess(message) {
  console.log(`${consoleMarkup.green('[SUCCESS]')} ${message}`);
}

function logWarning(message) {
  console.log(`${consoleMarkup.yellow('[WARNING]')} ${message}`);
}

function logError(message) {
  console.log(`${consoleMarkup.red('[ERROR]')} ${message}`);
}

// =============================================================================
// Utility Functions
// =============================================================================

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  ensureDir(BACKUP_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const basename = path.basename(filePath);
  const backupPath = path.join(BACKUP_DIR, `${basename}.${timestamp}.backup`);
  fs.copyFileSync(filePath, backupPath);
  logInfo(`Backed up ${basename}`);
}

function toAbsolutePath(inputPath) {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(SCRIPT_DIR, inputPath);
}

// =============================================================================
// State Management
// =============================================================================

function initStateFile() {
  if (!fs.existsSync(STATE_FILE)) {
    writeJson(STATE_FILE, { linkedModules: [] });
  }
}

function getState() {
  initStateFile();
  return readJson(STATE_FILE);
}

function saveState(state) {
  writeJson(STATE_FILE, state);
}

function addToState(moduleInfo) {
  const state = getState();
  state.linkedModules.push(moduleInfo);
  saveState(state);
}

function removeFromState(dirName) {
  const state = getState();
  state.linkedModules = state.linkedModules.filter((m) => m.name !== dirName);
  saveState(state);
}

function getModuleInfo(dirName) {
  const state = getState();
  return state.linkedModules.find((m) => m.name === dirName);
}

// =============================================================================
// tsconfig.json Management
// =============================================================================

function addTsconfigPath(scope, dirName, libName) {
  const pathAlias = `${scope}/${libName}`;
  const pathValue = `projects/${dirName}/src`;

  logInfo(`Adding path '${pathAlias}' to tsconfig.json...`);

  const tsconfig = readJson(TSCONFIG_FILE);
  if (!tsconfig.compilerOptions.paths) {
    tsconfig.compilerOptions.paths = {};
  }
  tsconfig.compilerOptions.paths[pathAlias] = [pathValue];
  writeJson(TSCONFIG_FILE, tsconfig);

  logSuccess(`Added tsconfig path: ${pathAlias} -> ${pathValue}`);
}

function removeTsconfigPath(scope, libName) {
  const pathAlias = `${scope}/${libName}`;

  logInfo(`Removing path '${pathAlias}' from tsconfig.json...`);

  const tsconfig = readJson(TSCONFIG_FILE);
  if (tsconfig.compilerOptions.paths) {
    delete tsconfig.compilerOptions.paths[pathAlias];
  }
  writeJson(TSCONFIG_FILE, tsconfig);

  logSuccess(`Removed tsconfig path: ${pathAlias}`);
}

// =============================================================================
// angular.json Management
// =============================================================================

function addAngularProject(moduleName, prefix = 'tm') {
  logInfo(`Adding project '${moduleName}' to angular.json...`);

  const angular = readJson(ANGULAR_JSON);
  angular.projects[moduleName] = {
    projectType: 'library',
    root: `projects/${moduleName}`,
    sourceRoot: `projects/${moduleName}/src`,
    prefix: prefix,
    architect: {
      build: {
        builder: '@angular/build:ng-packagr',
        options: {
          project: `projects/${moduleName}/ng-package.json`,
          tsConfig: `projects/${moduleName}/tsconfig.lib.json`,
        },
        configurations: {
          production: {
            tsConfig: `projects/${moduleName}/tsconfig.lib.prod.json`,
          },
          development: {
            tsConfig: `projects/${moduleName}/tsconfig.lib.json`,
          },
        },
        defaultConfiguration: 'production',
      },
      lint: {
        builder: '@angular-eslint/builder:lint',
        options: {
          lintFilePatterns: [
            `projects/${moduleName}/**/*.ts`,
            `projects/${moduleName}/**/*.html`,
          ],
        },
      },
    },
  };
  writeJson(ANGULAR_JSON, angular);

  logSuccess(`Added angular.json project: ${moduleName}`);
}

function removeAngularProject(moduleName) {
  logInfo(`Removing project '${moduleName}' from angular.json...`);

  const angular = readJson(ANGULAR_JSON);
  delete angular.projects[moduleName];
  writeJson(ANGULAR_JSON, angular);

  logSuccess(`Removed angular.json project: ${moduleName}`);
}

// =============================================================================
// Assets & Styles Management
// =============================================================================

function addAngularAsset(inputPath, outputPath) {
  logInfo(`Adding asset: ${inputPath} -> ${outputPath}`);

  const angular = readJson(ANGULAR_JSON);
  const assets = angular.projects.app.architect.build.options.assets;

  // Check if already exists
  const exists = assets.some(
    (a) => typeof a === 'object' && a.input === inputPath
  );
  if (exists) {
    logWarning(`Asset '${inputPath}' already exists, skipping`);
    return;
  }

  assets.push({ glob: '**/*', input: inputPath, output: outputPath });
  writeJson(ANGULAR_JSON, angular);
}

function addAngularStyle(stylePath) {
  logInfo(`Adding style: ${stylePath}`);

  const angular = readJson(ANGULAR_JSON);
  const styles = angular.projects.app.architect.build.options.styles;

  if (styles.includes(stylePath)) {
    logWarning(`Style '${stylePath}' already exists, skipping`);
    return;
  }

  styles.push(stylePath);
  writeJson(ANGULAR_JSON, angular);
}

function addAngularTranslation(locale, translationPath) {
  logInfo(`Adding translation (${locale}): ${translationPath}`);

  const angular = readJson(ANGULAR_JSON);
  const locales = angular.projects.app.i18n?.locales;

  if (!locales || !locales[locale]) {
    logWarning(`Locale '${locale}' not found in angular.json, skipping`);
    return;
  }

  const translations = locales[locale].translation;
  if (translations.includes(translationPath)) {
    logWarning(`Translation '${translationPath}' already exists, skipping`);
    return;
  }

  translations.push(translationPath);
  writeJson(ANGULAR_JSON, angular);
}

function removeAllModuleAssets(dirName) {
  const assetsBase = `projects/${dirName}/assets`;

  logInfo(`Removing all assets/styles/translations for ${dirName}...`);

  const angular = readJson(ANGULAR_JSON);

  // Remove assets
  angular.projects.app.architect.build.options.assets =
    angular.projects.app.architect.build.options.assets.filter(
      (a) => typeof a === 'string' || !a.input.startsWith(assetsBase)
    );

  // Remove styles
  angular.projects.app.architect.build.options.styles =
    angular.projects.app.architect.build.options.styles.filter(
      (s) => !s.startsWith(assetsBase)
    );

  // Remove translations
  const locales = angular.projects.app.i18n?.locales;
  if (locales) {
    for (const locale of Object.keys(locales)) {
      if (locales[locale].translation) {
        locales[locale].translation = locales[locale].translation.filter(
          (t) => !t.startsWith(assetsBase)
        );
      }
    }
  }

  writeJson(ANGULAR_JSON, angular);
  logSuccess(`Removed assets/styles/translations for ${dirName}`);
}

function detectAndAddAssets(sourcePath, dirName) {
  const assetsDir = path.join(sourcePath, 'assets');
  const assetsBase = `projects/${dirName}/assets`;

  if (!fs.existsSync(assetsDir)) {
    logInfo('No assets directory found in source module');
    return;
  }

  logInfo(`Detecting assets in ${assetsDir}...`);

  const addedAssets = [];
  const addedStyles = [];
  const addedTranslations = [];

  // Check for icons directory
  if (fs.existsSync(path.join(assetsDir, 'icons'))) {
    addAngularAsset(`${assetsBase}/icons`, 'icons');
    addedAssets.push('icons');
  }

  // Check for root directory
  if (fs.existsSync(path.join(assetsDir, 'root'))) {
    addAngularAsset(`${assetsBase}/root`, '.');
    addedAssets.push('root');
  }

  // Check for other asset directories
  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const name = entry.name;
      if (!['icons', 'root', 'locale'].includes(name)) {
        addAngularAsset(`${assetsBase}/${name}`, name);
        addedAssets.push(name);
      }
    }
  }

  // Check for CSS/SCSS files
  for (const entry of entries) {
    if (entry.isFile()) {
      const name = entry.name;
      if (name.endsWith('.css') || name.endsWith('.scss')) {
        addAngularStyle(`${assetsBase}/${name}`);
        addedStyles.push(name);
      }
    }
  }

  // Check for translation files
  const localeDir = path.join(assetsDir, 'locale');
  if (fs.existsSync(localeDir)) {
    const localeFiles = fs.readdirSync(localeDir);
    for (const file of localeFiles) {
      if (file.endsWith('.nl.xlf')) {
        addAngularTranslation('nl', `${assetsBase}/locale/${file}`);
        addedTranslations.push(file);
      } else if (file.endsWith('.de.xlf')) {
        addAngularTranslation('de', `${assetsBase}/locale/${file}`);
        addedTranslations.push(file);
      }
    }
  }

  // Report what was added
  if (addedAssets.length > 0) {
    logSuccess(`Added assets: ${addedAssets.join(', ')}`);
  }
  if (addedStyles.length > 0) {
    logSuccess(`Added styles: ${addedStyles.join(', ')}`);
  }
  if (addedTranslations.length > 0) {
    logSuccess(`Added translations: ${addedTranslations.join(', ')}`);
  }
}

// =============================================================================
// environment.ts Management
// =============================================================================

function addEnvironmentImport(scope, libName, moduleClass) {
  if (!moduleClass) {
    logInfo('No module class specified, skipping environment.ts update');
    return;
  }

  const importPath = `${scope}/${libName}`;
  logInfo(`Adding '${moduleClass}' to environment.ts...`);

  let content = fs.readFileSync(ENVIRONMENT_FILE, 'utf8');

  // Check if import already exists
  if (content.includes(`import { ${moduleClass} }`)) {
    logWarning(`Import for '${moduleClass}' already exists in environment.ts`);
    return;
  }

  // Add import statement after the last import
  const importStatement = `import { ${moduleClass} } from '${importPath}';`;
  const lastImportMatch = content.match(/^import .+;$/gm);
  if (lastImportMatch) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    content = content.replace(lastImport, `${lastImport}\n${importStatement}`);
  } else {
    content = importStatement + '\n' + content;
  }

  // Add module to imports array
  if (!content.includes(`${moduleClass},`) && !content.includes(`${moduleClass}]`)) {
    // Find the imports array closing bracket and add before it
    content = content.replace(
      /(\s*)(],?\s*)(};?\s*$)/m,
      (match, indent, bracket, end) => {
        // Find the imports: [ pattern and its closing ]
        const importsMatch = content.match(/imports:\s*\[\s*([\s\S]*?)\s*\]/);
        if (importsMatch) {
          const oldImports = importsMatch[0];
          const newImports = oldImports.replace(
            /(\s*)\],?/,
            `$1  ${moduleClass},\n$1],`
          );
          content = content.replace(oldImports, newImports);
        }
        return match;
      }
    );

    // Alternative: direct replacement of imports array
    const importsArrayMatch = content.match(/(imports:\s*\[)([\s\S]*?)(\s*\])/);
    if (importsArrayMatch && !content.includes(`${moduleClass},`)) {
      const [full, start, middle, end] = importsArrayMatch;
      const newMiddle = middle.trimEnd() + `\n    ${moduleClass},`;
      content = content.replace(full, start + newMiddle + end);
    }
  }

  fs.writeFileSync(ENVIRONMENT_FILE, content);
  logSuccess(`Added '${moduleClass}' to environment.ts`);
}

function removeEnvironmentImport(scope, libName, moduleClass) {
  if (!moduleClass) {
    logInfo('No module class specified, skipping environment.ts cleanup');
    return;
  }

  const importPath = `${scope}/${libName}`;
  logInfo(`Removing '${moduleClass}' from environment.ts...`);

  let content = fs.readFileSync(ENVIRONMENT_FILE, 'utf8');

  // Remove import statement
  const importRegex = new RegExp(
    `import\\s*\\{\\s*${moduleClass}\\s*\\}\\s*from\\s*'${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}';?\\n?`,
    'g'
  );
  content = content.replace(importRegex, '');

  // Remove from imports array
  const moduleRegex = new RegExp(`\\s*${moduleClass},?\\n?`, 'g');
  content = content.replace(moduleRegex, '\n');

  // Clean up any double newlines
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(ENVIRONMENT_FILE, content);
  logSuccess(`Removed '${moduleClass}' from environment.ts`);
}

// =============================================================================
// Symlink Management
// =============================================================================

function createSymlink(sourcePath, moduleName) {
  const targetPath = path.join(PROJECTS_DIR, moduleName);
  const absoluteSource = toAbsolutePath(sourcePath);

  if (!fs.existsSync(absoluteSource)) {
    logError(`Source directory does not exist: ${absoluteSource}`);
    process.exit(1);
  }

  if (fs.existsSync(targetPath)) {
    const stats = fs.lstatSync(targetPath);
    if (stats.isSymbolicLink()) {
      logWarning(`Symlink already exists at ${targetPath}, removing...`);
      fs.unlinkSync(targetPath);
    } else {
      logError(`A non-symlink file/directory already exists at ${targetPath}`);
      logError('Please remove it manually or choose a different module name');
      process.exit(1);
    }
  }

  logInfo(`Creating symlink: ${targetPath} -> ${absoluteSource}`);
  fs.symlinkSync(absoluteSource, targetPath, 'dir');
  logSuccess('Symlink created successfully');

  return absoluteSource;
}

function removeSymlink(moduleName) {
  const targetPath = path.join(PROJECTS_DIR, moduleName);

  if (fs.existsSync(targetPath)) {
    const stats = fs.lstatSync(targetPath);
    if (stats.isSymbolicLink()) {
      logInfo(`Removing symlink: ${targetPath}`);
      fs.unlinkSync(targetPath);
      logSuccess('Symlink removed');
    } else {
      logWarning(`${targetPath} exists but is not a symlink, skipping removal`);
    }
  } else {
    logWarning(`Symlink does not exist: ${targetPath}`);
  }
}

// =============================================================================
// Commands
// =============================================================================

function cmdLink(args) {
  const options = parseArgs(args, {
    scope: '@tailormap-viewer',
    name: '',
    lib: '',
    module: '',
    prefix: 'tm',
    assets: false,
  });

  const sourcePath = options._[0];
  if (!sourcePath) {
    logError('Source path is required');
    console.log(
      'Usage: node link-modules.js link <source-path> [--scope <scope>] [--name <name>] [--lib <lib>] [--module <class>] [--assets] [--prefix <prefix>]'
    );
    process.exit(1);
  }

  const absoluteSource = toAbsolutePath(sourcePath);
  const dirName = options.name || path.basename(absoluteSource);
  const libName = options.lib || dirName;
  const scope = options.scope;
  const moduleClass = options.module;
  const withAssets = options.assets;
  const prefix = options.prefix;

  logInfo('Linking module:');
  logInfo(`  Source: ${absoluteSource}`);
  logInfo(`  Directory: projects/${dirName}`);
  logInfo(`  Import path: ${scope}/${libName}`);
  if (moduleClass) {
    logInfo(`  Module class: ${moduleClass} (will be added to environment.ts)`);
  }
  if (withAssets) {
    logInfo('  Assets: will auto-detect and add assets/styles/translations');
  }
  logInfo(`  Prefix: ${prefix}`);
  console.log('');

  // Backup files
  backupFile(TSCONFIG_FILE);
  backupFile(ANGULAR_JSON);
  if (moduleClass) {
    backupFile(ENVIRONMENT_FILE);
  }

  // Perform linking
  const resolvedSource = createSymlink(absoluteSource, dirName);
  addTsconfigPath(scope, dirName, libName);
  addAngularProject(dirName, prefix);
  if (moduleClass) {
    addEnvironmentImport(scope, libName, moduleClass);
  }
  if (withAssets) {
    detectAndAddAssets(resolvedSource, dirName);
  }

  // Save state
  addToState({
    name: dirName,
    source: absoluteSource,
    scope: scope,
    lib: libName,
    module: moduleClass || '',
    assets: withAssets,
  });

  console.log('');
  logSuccess('Module linked successfully!');
  console.log('');
  console.log('To use this module in your code, import from:');
  console.log(`  import { ... } from '${scope}/${libName}';`);
  if (moduleClass) {
    console.log('');
    console.log(`The module '${moduleClass}' has been added to environment.ts imports.`);
  }
  if (withAssets) {
    console.log('');
    console.log('Assets, styles, and translations have been added to angular.json.');
  }
  console.log('');
  console.log('To unlink this module later, run:');
  console.log(`  node link-modules.js unlink ${dirName}`);
}

function cmdUnlink(args) {
  const dirName = args[0];
  if (!dirName) {
    logError('Module directory name is required');
    console.log('Usage: node link-modules.js unlink <directory-name>');
    process.exit(1);
  }

  const moduleInfo = getModuleInfo(dirName);
  let scope, libName, moduleClass, withAssets;

  if (!moduleInfo) {
    logWarning(`Module '${dirName}' not found in state file, attempting cleanup anyway...`);
    scope = '@tailormap-viewer';
    libName = dirName;
    moduleClass = '';
    withAssets = false;
  } else {
    scope = moduleInfo.scope;
    libName = moduleInfo.lib || moduleInfo.name;
    moduleClass = moduleInfo.module || '';
    withAssets = moduleInfo.assets || false;
  }

  logInfo(`Unlinking module: ${dirName}`);
  logInfo(`  Import path: ${scope}/${libName}`);
  if (moduleClass) {
    logInfo(`  Module class: ${moduleClass}`);
  }
  if (withAssets) {
    logInfo('  Assets: will be removed');
  }
  console.log('');

  // Backup files
  backupFile(TSCONFIG_FILE);
  backupFile(ANGULAR_JSON);
  if (moduleClass) {
    backupFile(ENVIRONMENT_FILE);
  }

  // Perform unlinking
  removeSymlink(dirName);
  removeTsconfigPath(scope, libName);
  removeAngularProject(dirName);
  if (moduleClass) {
    removeEnvironmentImport(scope, libName, moduleClass);
  }
  if (withAssets) {
    removeAllModuleAssets(dirName);
  }
  removeFromState(dirName);

  console.log('');
  logSuccess(`Module '${dirName}' unlinked successfully!`);
}

function cmdList() {
  const state = getState();

  console.log('');
  console.log('Linked Modules:');
  console.log('===============');

  if (state.linkedModules.length === 0) {
    console.log('  (none)');
  } else {
    console.log('');
    console.log(
      '  ' +
      'DIRECTORY'.padEnd(15) +
      'IMPORT PATH'.padEnd(25) +
      'MODULE CLASS'.padEnd(18) +
      'ASSETS'.padEnd(7) +
      'SOURCE'
    );
    console.log(
      '  ' +
      '---------'.padEnd(15) +
      '-----------'.padEnd(25) +
      '------------'.padEnd(18) +
      '------'.padEnd(7) +
      '------'
    );
    for (const m of state.linkedModules) {
      const importPath = `${m.scope}/${m.lib || m.name}`;
      const moduleClass = m.module || '-';
      const assets = m.assets ? '\u2713' : '-';
      console.log(
        '  ' +
        m.name.padEnd(15) +
        importPath.padEnd(25) +
        moduleClass.padEnd(18) +
        assets.padEnd(7) +
        m.source
      );
    }
  }
  console.log('');
}

function cmdStatus() {
  console.log('');
  console.log('Link Modules Status');
  console.log('===================');
  console.log('');

  // Check state file
  if (fs.existsSync(STATE_FILE)) {
    logInfo(`State file: ${STATE_FILE} (exists)`);
  } else {
    logWarning(`State file: ${STATE_FILE} (not found)`);
  }

  // Check backups
  if (fs.existsSync(BACKUP_DIR)) {
    const backupCount = fs.readdirSync(BACKUP_DIR).length;
    logInfo(`Backup directory: ${BACKUP_DIR} (${backupCount} backups)`);
  } else {
    logInfo(`Backup directory: ${BACKUP_DIR} (not created yet)`);
  }

  console.log('');

  // List linked modules and verify symlinks
  const state = getState();
  if (state.linkedModules.length === 0) {
    logInfo('No linked modules');
  } else {
    console.log('Linked modules:');
    for (const m of state.linkedModules) {
      const targetPath = path.join(PROJECTS_DIR, m.name);
      const importPath = `${m.scope}/${m.lib || m.name}`;

      if (fs.existsSync(targetPath)) {
        const stats = fs.lstatSync(targetPath);
        if (stats.isSymbolicLink()) {
          const linkTarget = fs.readlinkSync(targetPath);
          if (fs.existsSync(targetPath)) {
            console.log(`  ${consoleMarkup.green('\u2713')} ${m.name} -> ${linkTarget}`);
            console.log(`      Import: ${importPath}`);
            if (m.module) {
              console.log(`      Module: ${m.module} (in environment.ts)`);
            }
            if (m.assets) {
              console.log('      Assets: enabled');
            }
          } else {
            console.log(`  ${consoleMarkup.red('\u2717')} ${m.name} -> ${linkTarget} (broken link)`);
          }
        } else {
          console.log(`  ${consoleMarkup.red('\u2717')} ${m.name} (not a symlink)`);
        }
      } else {
        console.log(`  ${consoleMarkup.red('\u2717')} ${m.name} (symlink missing)`);
      }
    }
  }
  console.log('');
}

async function cmdRevert() {
  if (!fs.existsSync(BACKUP_DIR)) {
    logError('No backups found. Nothing to revert.');
    process.exit(1);
  }

  console.log('');
  console.log('Available backups:');
  console.log('');

  const backups = fs.readdirSync(BACKUP_DIR).sort().reverse();
  for (const backup of backups.slice(0, 20)) {
    const stats = fs.statSync(path.join(BACKUP_DIR, backup));
    console.log(`  ${backup}  (${stats.mtime.toISOString()})`);
  }

  console.log('');
  console.log('To restore a specific backup, copy it back to the original location.');
  console.log(`  cp ${BACKUP_DIR}/tsconfig.json.<timestamp>.backup ${TSCONFIG_FILE}`);
  console.log(`  cp ${BACKUP_DIR}/angular.json.<timestamp>.backup ${ANGULAR_JSON}`);
  console.log('');

  const answer = await askQuestion('Do you want to restore the most recent backups? [y/N] ');

  if (answer.toLowerCase() === 'y') {
    // Find latest backups
    const tsconfigBackups = backups.filter((b) => b.startsWith('tsconfig.json.'));
    const angularBackups = backups.filter((b) => b.startsWith('angular.json.'));
    const envBackups = backups.filter((b) => b.startsWith('environment.ts.'));

    if (tsconfigBackups.length > 0) {
      const latest = path.join(BACKUP_DIR, tsconfigBackups[0]);
      fs.copyFileSync(latest, TSCONFIG_FILE);
      logSuccess(`Restored tsconfig.json from ${latest}`);
    } else {
      logWarning('No tsconfig.json backup found');
    }

    if (angularBackups.length > 0) {
      const latest = path.join(BACKUP_DIR, angularBackups[0]);
      fs.copyFileSync(latest, ANGULAR_JSON);
      logSuccess(`Restored angular.json from ${latest}`);
    } else {
      logWarning('No angular.json backup found');
    }

    if (envBackups.length > 0) {
      const latest = path.join(BACKUP_DIR, envBackups[0]);
      fs.copyFileSync(latest, ENVIRONMENT_FILE);
      logSuccess(`Restored environment.ts from ${latest}`);
    } else {
      logWarning('No environment.ts backup found');
    }

    // Remove all symlinks
    logInfo('Removing all symlinks...');
    const state = getState();
    for (const m of state.linkedModules) {
      removeSymlink(m.name);
    }

    // Clear state
    saveState({ linkedModules: [] });

    console.log('');
    logSuccess('Revert complete!');
  } else {
    logInfo('Revert cancelled');
  }
}

function cmdHelp() {
  console.log(`
Angular Module Symlink Manager for tailormap-viewer

USAGE:
    node link-modules.js <command> [options]

COMMANDS:
    link <source-path>   Link an external module into the project
        --scope <scope>  Package scope (default: @tailormap-viewer)
        --name <name>    Directory name in projects/ (default: source dir name)
        --lib <lib>      Library name for imports (default: same as --name)
        --module <class> Angular module class to add to environment.ts (optional)
        --assets         Auto-detect and add assets/styles/translations to angular.json
        --prefix <prefix> Angular component prefix (default: tm)

    unlink <dir-name>    Unlink a previously linked module by directory name

    list                 List all linked modules

    status               Show detailed status of linked modules

    revert               Restore configuration files from backups

EXAMPLES:
    # Link a module from tailormap-gbi
    node link-modules.js link ../tailormap-gbi/projects/gbi-plugin

    # Link with custom scope and directory name
    node link-modules.js link ../tailormap-gbi/projects/gbi --scope @tailormap-gbi --name plugin

    # Link with different directory name but keep original library name for imports
    node link-modules.js link ../tailormap-gbi/projects/shared --scope @tailormap-gbi --name gbi-shared --lib shared

    # Link and add module to environment.ts
    node link-modules.js link ../tailormap-gbi/projects/maps --scope @tailormap-gbi --module GbiMapsModule

    # Link with assets (like ng-add schematic)
    node link-modules.js link ../tailormap-gbi/projects/maps --scope @tailormap-gbi --module GbiMapsModule --assets

    # Full example with all options
    node link-modules.js link ../tailormap-gbi/projects/shared \\
        --scope @tailormap-gbi \\
        --name gbi-shared \\
        --lib shared \\
        --module GbiSharedModule \\
        --assets

    # Unlink a module
    node link-modules.js unlink gbi-shared

ASSETS DETECTION (--assets flag):
    When --assets is specified, the script auto-detects:
    - assets/icons/     -> copied to dist/icons/
    - assets/root/      -> copied to dist/ root
    - assets/*.css      -> added to styles
    - assets/*.scss     -> added to styles
    - assets/locale/*.nl.xlf -> added to i18n translations (nl)
    - assets/locale/*.de.xlf -> added to i18n translations (de)

NOTES:
    - Backups are stored in .link-modules-backup/
    - State is tracked in .linked-modules.json
    - Use --lib when you need to avoid directory conflicts but keep original import paths
    - Use --module to automatically add the Angular module to environment.ts
    - Use --assets to replicate ng-add schematic behavior
`);
}

// =============================================================================
// Argument Parsing
// =============================================================================

function parseArgs(args, defaults) {
  const result = { _: [], ...defaults };
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'assets') {
        result.assets = true;
        i++;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result[key] = args[i + 1];
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else {
      result._.push(arg);
      i++;
    }
  }

  return result;
}

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const commandArgs = args.slice(1);

  switch (command) {
    case 'link':
      cmdLink(commandArgs);
      break;
    case 'unlink':
      cmdUnlink(commandArgs);
      break;
    case 'list':
      cmdList();
      break;
    case 'status':
      cmdStatus();
      break;
    case 'revert':
      await cmdRevert();
      break;
    case 'help':
    case '--help':
    case '-h':
      cmdHelp();
      break;
    default:
      logError(`Unknown command: ${command}`);
      console.log('');
      cmdHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  logError(err.message);
  process.exit(1);
});
