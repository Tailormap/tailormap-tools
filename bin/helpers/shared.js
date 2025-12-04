import {spawn, execSync} from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import {existsSync, readFileSync} from 'fs';

const getPathFromProjectRoot = (fileDirPath) => {
  if (!fileDirPath) {
    return path.resolve(process.cwd());
  }
  if (Array.isArray(fileDirPath)) {
    return path.resolve(process.cwd(), ...fileDirPath);
  }
  return path.resolve(process.cwd(), fileDirPath);
};

const tmProjectFilePath = getPathFromProjectRoot('tm-project.json');

if (!existsSync(tmProjectFilePath)) {
  console.error('A tm-project.json file is required for Tailormap tools to work. Please provide this, see README for more info. Also the scripts need to run from the root of the project.');
  process.exit();
}

const tmProjectJson = readFileSync(tmProjectFilePath);
const tmProjectContents = JSON.parse(tmProjectJson.toString())
const scopedLibraries = tmProjectContents.libraries;
const availableLibraries = scopedLibraries.map(scopedProject => scopedProject[1]);

const getTailormapProjectFile = () => {
  return tmProjectContents;
}

const getScopeForLibrary = (project) => {
  return scopedLibraries.find(scopedProject => {
    return scopedProject[1] === project;
  })[0];
};

const getCliArgument = (varName) => {
  const cliArgIdx = process.argv.findIndex(a => a.indexOf(varName) !== -1);
  return cliArgIdx !== -1 ? process.argv[cliArgIdx].substring(varName.length + 1).toLowerCase() : null;
}

const hasCliArgument = (varName) => {
  return process.argv.findIndex(a => a.indexOf(varName) !== -1) !== -1;
};

const checkCleanGitRepo = () => {
  const gitStatus = execSync('git status --short').toString();
  const gitDirty = gitStatus !== '';
  if (gitDirty) {
    console.error('Git repository is dirty, please commit first before making a new release');
    process.exit();
  }
};

const requestLibrary = async (message, callback) => {
  const inquirer = await import('inquirer');
  inquirer.default.prompt([{
    type: 'list',
    name: 'library',
    message: message,
    choices: availableLibraries,
  }])
    .then(answers => {
      const library = answers.library;
      if (!library) {
        console.error('Please select a library');
        process.exit();
      }
      callback(library);
    });
};

const getProbableVersion = async () => {
  const project = availableLibraries[0];
  if (!project) {
    return '';
  }
  await runCommand('npm', ['version', 'patch', '--no-git-tag-version'], getPathFromProjectRoot(`projects/${project}`), 'ignore');
  const version = await getCurrentVersion(project);
  await runCommand('git', ['checkout', '--', `projects/${project}/package.json`], getPathFromProjectRoot());
  return version;
}

const requestVersion = async () => {
  const inquirer = await import('inquirer');
  const answers = await inquirer.default.prompt([{
    type: 'input',
    name: 'version',
    message: 'What version do you want to release (e.g. 10.0.0-rc2)',
    default: await getProbableVersion(),
    validate: function (value) {
      const versionRegex = new RegExp('^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$');
      if (!versionRegex.test(value)) {
        return 'Please provide a valid version (for example 10.0.0 or 10.0.0-rc2)';
      }
      return true;
    }
  }]);
  return answers.version;
};

const runCommand = (command, args, cwd, stdio = 'inherit') => {
  return new Promise((resolve, reject) => {
    const workingDir = cwd || path.resolve(path.dirname('../'));
    const cmd = spawn(command, args, {
      stdio: stdio,
      env: process.env,
      cwd: workingDir,
    });
    cmd.on('error', err => {
      console.error(err);
      reject();
    });
    cmd.on('close', (code) => {
      if (code !== 0) {
        reject('Exit code is not success');
      } else {
        resolve();
      }
    });
  });
};

const getPackageJsonPath = (project) => {
  return getPathFromProjectRoot(`projects/${project}/package.json`);
}

const getPackageJson = async (project) => {
  const packageJson = await fs.readFile(getPackageJsonPath(project));
  return JSON.parse(packageJson.toString());
};

const getMainPackageJson = async () => {
  const packageJson = await fs.readFile(getPathFromProjectRoot('package.json'));
  return JSON.parse(packageJson.toString());
}

const getCurrentVersion = async (project) => {
  return (await getPackageJson(project)).version;
};

const updatePeerDependencies = async (project) => {
  console.log('Updating peer dependencies of other projects');
  const currentVersion = await getCurrentVersion(project);
  for (const availableProject of availableLibraries) {
    const packageJson = await getPackageJson(availableProject);
    let madeChanges = false;
    const keys = Object.keys(packageJson.peerDependencies);
    for (const key of keys) {
      const scope = getScopeForLibrary(project);
      if (key === scope + '/' + project) {
        console.log('Updating peer dependency for ' + availableProject + ': ' + key + ' from ' + packageJson.peerDependencies[key] + ' to ' + currentVersion);
        packageJson.peerDependencies[key] = `^${currentVersion}`;
        madeChanges = true;
      }
    }
    if (madeChanges) {
      await fs.writeFile(getPackageJsonPath(availableProject), JSON.stringify(packageJson, null, 2));
    }
  }
}

const updateProjectPeerDependencies = async (project) => {
  console.log('Updating peer dependencies of ' + project);
  const mainPackageJson = await getMainPackageJson();
  const mainDependencies = mainPackageJson.dependencies || {};
  const packageJson = await getPackageJson(project);
  let madeChanges = false;
  const keys = Object.keys(packageJson.peerDependencies);
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(mainDependencies, key) && packageJson.peerDependencies[key] !== mainDependencies[key]) {
      console.log('Updating peer dependency for ' + key + ' from ' + packageJson.peerDependencies[key] + ' to ' + mainDependencies[key]);
      packageJson.peerDependencies[key] = mainDependencies[key];
      madeChanges = true;
    }
  }
  if (madeChanges) {
    await fs.writeFile(getPackageJsonPath(project), JSON.stringify(packageJson, null, 2));
  }
}

const publishLibrary = async (project, version, dryRun) => {
  const packageJson = await getPackageJson(project);
  const registryFromPackageJson = packageJson.publishConfig?.registry;
  if (!registryFromPackageJson) {
    console.error(`Error: Did not find a publishConfig with registry URL in ${getPackageJsonPath(project)}`);
    process.exit(0);
  }
  console.log(`Publishing release for ${project}. Supplied version: ${version}. Dry-run: ${dryRun ? 'true' : 'false'}`);
  const npmVersion = version.startsWith('v') ? version.substring(1) : version;
  const versionCommand = version ? ['version', npmVersion] : ['version', 'patch'];
  await updateProjectPeerDependencies(project);
  await runCommand('npm', versionCommand, getPathFromProjectRoot(`projects/${project}`));
  await runCommand('ng', ['build', project]);
  if (packageJson.scripts?.build) {
    console.log('Found build command for ' + project);
    await runCommand('npm', ['run', 'build'], getPathFromProjectRoot(`projects/${project}`));
    console.log('Ran build command for ' + project);
  } else if (existsSync(getPathFromProjectRoot(`projects/${project}/tsconfig.schematics.json`))) {
    console.log('Building schematics for ' + project);
    await runCommand('tsc', ['-p', 'tsconfig.schematics.json'], getPathFromProjectRoot(`projects/${project}`));
    console.log('Done building schematics for ' + project);
  }
  // note that the push url is not the same as the (anonymous) download url
  if (dryRun) {
    console.log('Would publish ' + project + ` to ${registryFromPackageJson}, but running in dry-run mode`);
  } else {
    const scope = getScopeForLibrary(project);
    const tag = npmVersion.indexOf('-rc') !== -1 ? 'next' : 'latest';
    await runCommand('npm', ['publish', `--scope=${scope}`, `--registry=${registryFromPackageJson}`, `--tag=${tag}`], getPathFromProjectRoot(`dist/${project}`));
  }
  await updatePeerDependencies(project);
  if (dryRun) {
    console.log('Would add all changed files to Git, but running in dry-run mode');
  } else {
    await runCommand('git', ['add', '-A']);
  }
  const currentVersion = await getCurrentVersion(project);
  const message = `Released version ${currentVersion} of ${project} project`;
  if (dryRun) {
    console.log('Would commit: ' + message + ', but running in dry-run mode');
  } else {
    await runCommand('git', ['commit', '-m', `Released version ${currentVersion} of ${project} project`])
  }
  console.log(message);
}

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const clearCache = async () => {
  await runCommand('rm', ['-rf', 'dist'], getPathFromProjectRoot());
  await runCommand('rm', ['-rf', '.angular'], getPathFromProjectRoot());
  await runCommand('rm', ['-rf', '.nx'], getPathFromProjectRoot());
}

export {
  requestLibrary,
  requestVersion,
  checkCleanGitRepo,
  runCommand,
  availableLibraries,
  getCliArgument,
  hasCliArgument,
  publishLibrary,
  sleep,
  clearCache,
  getPathFromProjectRoot,
  getTailormapProjectFile
};
