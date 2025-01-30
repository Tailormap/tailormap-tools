#!/usr/bin/env node
'use strict';

const {getCliArgument, getTailormapProjectFile, runCommand, getPathFromProjectRoot, clearCache} = require("./helpers/shared");
const {generateVersionInfoFile} = require("./helpers/generate-version-info");
const {compressBundle} = require("./helpers/compress-build");
const fs = require('fs');
const path = require('path');

const appArgument = getCliArgument('--app');
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
  }
}

buildApplication(appArgument || getTailormapProjectFile().apps[0])
