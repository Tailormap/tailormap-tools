#!/usr/bin/env node
'use strict';

const {getCliArgument, getTailormapProjectFile, runCommand, getPathFromProjectRoot, clearCache} = require("./helpers/shared");
const {generateVersionInfoFile} = require("./helpers/generate-version-info");
const {compressBundle} = require("./helpers/compress-build");

const app = getCliArgument('--app');
const skipLocalize = getCliArgument('--skip-localize') !== null;
const language = getCliArgument('--language') || 'en';
const verbose = getCliArgument('--verbose') !== null;
const baseHref = getCliArgument('--base-href');

async function buildApplication(application) {
  if (!application) {
    console.log('Please provide application to build with --app');
    process.exit(1);
  }
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
}

buildApplication(app || getTailormapProjectFile().apps[0])
