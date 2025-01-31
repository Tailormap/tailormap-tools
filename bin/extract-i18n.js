#!/usr/bin/env node
'use strict';

const {runCommand, getCliArgument, clearCache, getPathFromProjectRoot} = require("./helpers/shared");
const path = require("path");
const fs = require("fs/promises");
const {readdirSync} = require("fs");

const singleLibrary = getCliArgument('--library');
const getDirectories = source => {
  return readdirSync(source, {withFileTypes: true})
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
};
const availableLibraries = getDirectories(getPathFromProjectRoot('projects'));
const angularJsonPath = path.resolve(getPathFromProjectRoot('angular.json'));
const angularJsonBackupPath = getPathFromProjectRoot('angular.json.orig');

const addTemporaryConfiguration = async (library) => {
  const configuration = {
    "outputPath": `projects/${library}/assets/locale`,
    "includeIdsWithPrefix": [library],
    "sourceFile": `messages.${library}.en.xlf`,
    "targetFiles": [
      `messages.${library}.nl.xlf`,
      `messages.${library}.de.xlf`,
    ]
  };
  try {
    const angularJsonContents = JSON.parse((await fs.readFile(angularJsonPath)).toString());
    angularJsonContents['projects']['app']['architect']['extract-i18n']['configurations'][library] = configuration;
    await fs.writeFile(angularJsonPath, JSON.stringify(angularJsonContents));
  } catch (e) {
    console.error('Could not write i18n configuration to angular.json');
  }
}

const backupConfiguration = async () => {
  try {
    await fs.copyFile(angularJsonPath, angularJsonBackupPath);
  } catch (e) {
    console.error('Could not make backup of angular.json');
  }
};

const cleanupTemporaryConfiguration = async () => {
  try {
    await fs.rm(angularJsonPath);
    await fs.copyFile(angularJsonBackupPath, angularJsonPath);
    await fs.rm(angularJsonBackupPath);
  } catch (e) {
    console.error('Could revert changes to angular.json, please check manually');
  }
}

(async function main() {
  try {
    await clearCache();
    const libs = singleLibrary && availableLibraries.includes(singleLibrary)
      ? [singleLibrary]
      : availableLibraries;
    await backupConfiguration();
    for (const lib of libs) {
      await addTemporaryConfiguration(lib);
      await runCommand('ng', ['extract-i18n', `--configuration=${lib}`], getPathFromProjectRoot());
    }
    await cleanupTemporaryConfiguration();
  } catch (e) {
    console.log('Error occurred: ', e);
  }
})();


