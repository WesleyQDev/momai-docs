import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))

const uiConfig = {
  absWorkingDir: __dirname,
  entryPoints: ['page.tsx'],
  bundle: true,
  minify: true,
  treeShaking: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outdir: 'dist',
  loader: {
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.png': 'dataurl',
    '.webp': 'dataurl'
  },
  external: ['momai:sdk', 'react', 'react-dom', 'react/jsx-runtime', '@heroicons/react']
}

const workerConfig = {
  absWorkingDir: __dirname,
  entryPoints: ['runtime.ts'],
  bundle: true,
  minify: true,
  treeShaking: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: 'dist/runtime.js',
  external: ['docx', 'pdf-lib', 'zod']
}

await Promise.all([esbuild.build(uiConfig), esbuild.build(workerConfig)])
console.log('[momai-docs-demo] built dist/page.js and dist/runtime.js')
