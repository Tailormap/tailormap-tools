import path from 'path';
import fs from 'fs';
import {getPathFromProjectRoot, getTailormapProjectFile} from './shared.js';

function getPackageVersion(packageName) {
  try {
    console.log('Getting project version for:', packageName);
    const packageJsonPath = getPathFromProjectRoot(`${packageName}/package.json`);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch (error) {
    return undefined;
  }
}

function getAddedPackagesWithVersion() {
  try {
    const addedPackagesPath = getPathFromProjectRoot('added-packages.json');
    const packages = JSON.parse(fs.readFileSync(addedPackagesPath, 'utf-8'));
    return packages.map(packageName => {
      return {name: packageName, version: getPackageVersion(`node_modules/${packageName}`)};
    });
  } catch (error) {
    return [];
  }
}

function generateVersionInfoFile(app) {
  try {
    const file = getPathFromProjectRoot(`dist/${app}/version.json`);
    const appVersion = getPackageVersion(getTailormapProjectFile().coreProjectLocation || 'node_modules/@tailormap-viewer/core');
    const versionInfo = {
      version: appVersion,
      buildDate: Date(),
      addedPackages: getAddedPackagesWithVersion()
    };
    const version = JSON.stringify(versionInfo, null, 2);
    fs.writeFileSync(file, version, {encoding: 'utf-8'});
    console.log(`Wrote version info ${appVersion} to ${path.relative(getPathFromProjectRoot(), file)}`);
  } catch (e) {
    console.log('Error writing version and git info', e);
  }
}

export {generateVersionInfoFile};
