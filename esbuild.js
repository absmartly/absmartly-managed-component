const esbuild = require('esbuild')
const fs = require('fs')

// First, build the ABSmartly SDK bundle for Zaraz (served from public/_zaraz/absmartly-sdk.js)
esbuild.buildSync({
  entryPoints: ['src/zaraz/static/absmartly-sdk-bundle.js'],
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'public/_zaraz/absmartly-sdk.js',
})

// Build the main managed component
esbuild.buildSync({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  platform: 'node',
  format: 'esm',
  target: ['esnext'],
  tsconfig: 'tsconfig.build.json',
  outfile: 'dist/index.js',
})
