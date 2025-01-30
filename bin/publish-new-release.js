#!/usr/bin/env node
'use strict';

const {checkCleanGitRepo, requestLibrary, getCliArgument, hasCliArgument, publishLibrary, requestVersion} = require("./helpers/shared");

checkCleanGitRepo();

(async function main() {
  const library = getCliArgument('--library');
  let version = getCliArgument('--version');
  const dryRun = hasCliArgument('--dry-run');

  if (version === null) {
    version = await requestVersion()
  }

  if (!version) {
    console.error('Supply version');
    process.exit(1);
  }

  if (library) {
    try {
      publishLibrary(library, version, dryRun);
    } catch (e) {
      console.log('Error occured', e);
    }
  } else {
    requestLibrary('Select the library for which to make a release', lib => publishLibrary(lib, version, dryRun));
  }
})();
