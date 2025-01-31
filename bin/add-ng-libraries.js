#!/usr/bin/env node
'use strict';

// Script to be called from Dockerfile to add one or more Angular libraries as specified by a build-time argument.
// The Angular libraries can contain an extra Tailormap component such as https://github.com/B3Partners/tailormap-hello-world
// This script basically runs `ng add` for each

const { execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');

// Append text to .npmrc, to allow mapping prefixes to a specific registry
const appendNpmRc = process.env['APPEND_NPMRC'];
if (appendNpmRc) {
  writeFileSync('.npmrc', readFileSync('.npmrc') + '\n' + appendNpmRc);
}

const addNgLibraries = process.env['ADD_NG_LIBRARIES'];
const addedPackages = [];
if (addNgLibraries) {
  addNgLibraries.split(' ').forEach(library => {
    console.log('Adding Angular library: ' + library);
    try {
      const output = execSync('npx ng add --skip-confirmation ' + library);
      console.log(output.toString());
      const idx = library.lastIndexOf('@');
      const packageName = idx > 0 ? library.substring(0, idx) : library;
      addedPackages.push(packageName);
    } catch(error) {
      // Stderr from execSync() is already piped to stderr, so error is output already
      console.error('Error installing library');
      process.exit(1);
    }
  });
}
writeFileSync('./added-packages.json', JSON.stringify(addedPackages, null, 4));

