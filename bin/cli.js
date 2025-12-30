#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const command = process.argv[2];
const packageDir = path.resolve(__dirname, '..');

if (command === 'bundle') {
  console.log('Building @absmartly/managed-component bundle...');
  execSync('node esbuild.js', { cwd: packageDir, stdio: 'inherit' });
} else {
  console.log('Usage: absmartly-mc <command>');
  console.log('Commands:');
  console.log('  bundle  Build the SDK bundles');
  process.exit(1);
}
