#!/usr/bin/env node
'use strict';

const {getCliArgument, getTailormapProjectFile, runCommand, getPathFromProjectRoot, clearCache} = require("./helpers/shared");
const {generateVersionInfoFile} = require("./helpers/generate-version-info");
const {compressBundle} = require("./helpers/compress-build");
const fs = require('fs');
const path = require('path');

let appArgument = getCliArgument('--app');
if (appArgument === '') {
  appArgument = null;
}
const skipLocalize = getCliArgument('--skip-localize') !== null;
const language = getCliArgument('--language') || 'en';
const verbose = getCliArgument('--verbose') !== null;
const baseHref = getCliArgument('--base-href');
const renameToApp = getCliArgument('--rename-to-app') !== null;

async function buildApplication(app) {
  await clearCache();
  const buildArgs = ['build', app];
  if (!skipLocalize) {
    buildArgs.push('--localize');
  }
  if (baseHref) {
    buildArgs.push('--base-href=' + baseHref);
  }
  await runCommand('ng', buildArgs, getPathFromProjectRoot());
  generateVersionInfoFile(app);
  compressBundle(app, language, verbose);

  if(app !== 'app' && renameToApp) {
    const distPath = getPathFromProjectRoot('dist');
    const appPath = path.join(distPath, app);
    const targetPath = path.join(distPath, 'app');

    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    fs.renameSync(appPath, targetPath);
    app = 'app';
  }

  await moveBundleWhenNotSourceLocale(app);
}

async function moveBundleWhenNotSourceLocale(app) {
  const distPath = getPathFromProjectRoot('dist');
  const appPath = path.join(distPath, app);

  // When index.html exists, the app is built with the source locale without localization
  if(fs.existsSync(path.join(appPath, 'index.html'))) {
    return;
  }

  // Look at the locale directories
  const dirs = fs.readdirSync(appPath, { withFileTypes: true }).filter(dirent => dirent.isDirectory());
  if (dirs.length > 1) {
    // Multiple locale bundles, nothing to do
    return;
  }

  // Single locale bundle, move it one directory up and change the base-href
  const locale = dirs[0].name;
  const localizedAppPath = path.join(appPath, locale);
  await runCommand('bash', ['-c', `mv ${localizedAppPath}/* ${appPath}`]);
  await runCommand('rmdir', [localizedAppPath]);
  const indexHtmlPath = path.join(appPath, 'index.html');
  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  indexHtml = indexHtml.replace(new RegExp(`<base href="(/.+)?/${locale}/"`), '<base href="$1/"');
  fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
}

let app = appArgument;
if (!app) {
  const configFileApps = getTailormapProjectFile().apps;
  app = configFileApps?.length > 0 ? configFileApps[0] : 'app';
}
buildApplication(app);
