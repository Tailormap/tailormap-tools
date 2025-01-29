const path = require('path');
const fs = require('fs');
const {getPathFromProjectRoot, getTailormapProjectFile} = require("./shared");

function getPackageVersion() {
  const corePackageLocation = getTailormapProjectFile().coreProjectLocation;
  try {
    return require(getPathFromProjectRoot(`${corePackageLocation}/package.json`)).version;
  } catch (error) {
    return undefined;
  }
}

function getAddedPackagesWithVersion() {
  try {
    const packages = require(getPathFromProjectRoot('added-packages.json'));
    return packages.map(packageName => {
      return {name: packageName, version: getPackageVersion(packageName)};
    });
  } catch (error) {
    return [];
  }
}

function generateVersionInfoFile(app) {
  try {
    const file = getPathFromProjectRoot(`dist/${app}/version.json`);
    const appVersion = getPackageVersion();
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

exports.generateVersionInfoFile = generateVersionInfoFile;
