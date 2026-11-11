#!/usr/bin/env node

import {
  checkCleanGitRepo,
  clearCache,
  publishLibrary,
  requestVersion,
  runCommand,
  availableLibraries,
  getCliArgument,
  hasCliArgument,
  getPathFromProjectRoot
} from './helpers/shared.js';

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
      await publishLibrary(lib, version, dryRun, true);
      // await sleep(5000);
    }
    if (!dryRun) {
      const tagVersion = version.startsWith('v') ? version : `v${version}`;
      await runCommand('git', ['add', '-A']);
      await runCommand('git', ['commit', '-m', `Released version ${version} of Tailormap`])
      if (tagVersion.indexOf('-rc') !== -1) {
        console.log('Release candidate, not tagging in Git');
      } else {
        console.log('Tagging release in Git with tag: ' + tagVersion);
        await runCommand('git', ['tag', tagVersion], getPathFromProjectRoot());
      }
    }
  } catch (e) {
    console.log('Error occurred: ', e);
    process.exit(1);
  }
})();


