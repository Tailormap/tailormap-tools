import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import {consoleMarkup, getPathFromProjectRoot} from './shared.js';

const EXTENSIONS = ['.js', '.css', '.svg', '.map'];
const COMPRESS_SIZE_THRESHOLD = 1024;

function compressBundle(app, language, verbose) {

  console.log('Compressing bundle...');
  const start = Date.now();

  // recursive option requires Node v20
  const files = fs.readdirSync(getPathFromProjectRoot(`dist/${app}`), {recursive: true, withFileTypes: true})
    .filter(entry => entry.isFile())
    .filter(entry => EXTENSIONS.includes(path.extname(entry.name)))
    .map(entry => ({
      filename: path.join(entry.parentPath, '/', entry.name),
      displayName: path.join(entry.parentPath, '/', entry.name).split('/dist/')[1],
    }));

  const displayNamePad = files.reduce((previous, current) => Math.max(previous, current.displayName.length), 0) - 2;

  let bundleTotal = 0;
  let compressedTotal = 0;
  files.forEach(entry => {
    const {size} = fs.statSync(entry.filename);
    if (size > COMPRESS_SIZE_THRESHOLD) {
      verbose && process.stdout.write(`Compressing ${entry.displayName.padEnd(displayNamePad, ' ')} size ${(size + "").padStart(7, ' ')}, ratio: `);

      const contents = fs.readFileSync(entry.filename);

      const gzipped = zlib.gzipSync(contents, {level: 9});
      fs.writeFileSync(entry.filename + ".gz", gzipped);

      const ratio = (gzipped.length / size).toFixed(2);
      verbose && process.stdout.write(` ${consoleMarkup.bold(ratio)}\n`);

      if (entry.displayName.startsWith(`${app}/${language}/`) && path.extname(entry.filename) !== '.map') {
        bundleTotal += size;
        compressedTotal += gzipped.length;
      }
    }
  });

  console.log(`Total single bundle compression ratio: ${consoleMarkup.boldGreen((compressedTotal / bundleTotal).toFixed(2))}, saved ${consoleMarkup.bold(((bundleTotal - compressedTotal) / 1024).toFixed(0))} KiB`);
  console.log(`Compressed bundle in ${(Date.now() - start).toFixed(0)}ms`);
}

export {compressBundle};
