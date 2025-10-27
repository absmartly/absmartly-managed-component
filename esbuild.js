const esbuild = require('esbuild')
const fs = require('fs')

// First, build the ABSmartly SDK bundle for Zaraz (bundled strategy)
esbuild.buildSync({
  entryPoints: ['src/zaraz/static/absmartly-sdk-bundle.js'],
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'dist/absmartly-sdk.js',
})

// Read the generated SDK bundle
const sdkBundle = fs.readFileSync('dist/absmartly-sdk.js', 'utf-8')

// Build the main managed component with SDK bundle embedded
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

// Post-process: replace the placeholder with the actual SDK bundle
const outputFile = 'dist/index.js'
let output = fs.readFileSync(outputFile, 'utf-8')
output = output.replace(
  '"SDK_BUNDLE_PLACEHOLDER"',
  JSON.stringify(sdkBundle)
)
fs.writeFileSync(outputFile, output, 'utf-8')
