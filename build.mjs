import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')

const uiConfig = {
  absWorkingDir: __dirname,
  entryPoints: [
    'src/page.tsx',
    'src/widget-studio.tsx'
  ],
  bundle: true,
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
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: 'dist/runtime.js',
  external: ['@resvg/resvg-wasm', 'docx', 'fflate', 'pdf-lib', 'pptxgenjs', 'unpdf', 'zod']
}

if (watch) {
  const [uiCtx, workerCtx] = await Promise.all([
    esbuild.context(uiConfig),
    esbuild.context(workerConfig)
  ])
  await Promise.all([uiCtx.watch(), workerCtx.watch()])
  console.log('[momai-docs] watching UI & worker...')
} else {
  await Promise.all([esbuild.build(uiConfig), esbuild.build(workerConfig)])
  console.log('[momai-docs] built dist/page.js, dist/widget-studio.js, dist/chat-project-bar.js, dist/runtime.js')
}
