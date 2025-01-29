#!/usr/bin/env node
'use strict';

const {
  checkCleanGitRepo,
  clearCache,
  publishLibrary,
  requestVersion,
  runCommand,
  availableLibraries,
  getCliArgument,
  hasCliArgument,
  getPathFromProjectRoot
} = require("./helpers/shared");

checkCleanGitRepo();

(async function main() {
  let version = getCliArgument('--version');
  const dryRun = hasCliArgument('--dry-run');

  if (version === null) {
    version = await requestVersion()
  }

  if (!version) {
    console.error('Supply version');
    process.exit(1);
  }

  try {
    await clearCache();
    for (const lib of availableLibraries) {
      await publishLibrary(lib, version, dryRun);
      // await sleep(5000);
    }
    if (!dryRun) {
      const tagVersion = version.startsWith('v') ? version : `v${version}`;
      await runCommand('git', ['tag', tagVersion], getPathFromProjectRoot());
    }
  } catch (e) {
    console.log('Error occurred: ', e);
    process.exit(1);
  }
})();


