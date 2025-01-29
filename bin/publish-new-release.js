#!/usr/bin/env node
'use strict';

const {checkCleanGitRepo, requestLibrary, getCliArgument, hasCliArgument, publishLibrary} = require("./helpers/shared");

checkCleanGitRepo();

const library = getCliArgument('--library');
const version = getCliArgument('--version');
const dryRun = hasCliArgument('--dry-run');

if (library) {
  try {
    publishLibrary(library, version, dryRun);
  } catch (e) {
    console.log('Error occured', e);
  }
} else {
  requestLibrary('Select the library for which to make a release', lib => publishLibrary(lib, version, dryRun));
}
