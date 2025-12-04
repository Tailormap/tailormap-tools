#!/usr/bin/env node

import {getCliArgument, getTailormapProjectFile, runCommand, getPathFromProjectRoot, clearCache} from './helpers/shared.js';
import {generateVersionInfoFile} from './helpers/generate-version-info.js';
import {compressBundle} from './helpers/compress-build.js';
import fs from 'fs';
import path from 'path';

let appArgument = getCliArgument('--app');
if (appArgument === '') {
  appArgument = null;
}
const skipLocalize = getCliArgument('--skip-localize') !== null;
const language = getCliArgument('--language') || 'en';
const verbose = getCliArgument('--verbose') !== null;
const baseHref = getCliArgument('--base-href');
const renameToApp = getCliArgument('--rename-to-app') !== null;

async function moveFilesInDirectoryToParent(dir) {
  const parentDir = path.join(dir, '..');
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    fs.renameSync(path.join(dir, file), path.join(parentDir, file));
  });
  fs.rmdirSync(dir);
}

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

  const distPath = getPathFromProjectRoot('dist');

  if(app !== 'app' && renameToApp) {
    const appPath = path.join(distPath, app);
    const targetPath = path.join(distPath, 'app');

    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    fs.renameSync(appPath, targetPath);
    app = 'app';
  }

  // change in 6a29a4351b0d56b31e4ea98cabac24508dbfa435 leads to extra 'browser' directory in dist/app
  const appPath = path.join(distPath, app);
  const browserDir = path.join(appPath, 'browser');
  if (fs.existsSync(browserDir)) {
    moveFilesInDirectoryToParent(browserDir);
  }

  generateVersionInfoFile(app);
  compressBundle(app, language, verbose);

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

  // Single locale bundle built using '--skip-localize --locale=<locale>', move it one directory up and change the base-href
  const locale = dirs[0].name;
  const localizedAppPath = path.join(appPath, locale);
  moveFilesInDirectoryToParent(localizedAppPath);
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
