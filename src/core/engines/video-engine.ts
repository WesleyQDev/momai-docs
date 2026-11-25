import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import type { DesignTokens, LayoutPreset, VisualQAReport } from '../types.ts'
import { runVisualQA } from '../qa/visual-qa.ts'
import {
  buildSilenceWav,
  createHostTtsClient,
  estimateAudioDurationMs,
  type PodcastTtsClient
} from './podcast-engine.ts'
import { fetchWikimediaImageDataUrl } from '../media/wikimedia-image.ts'

export type VideoSceneComponent =
  | 'TitleHeroScene'
  | 'AnimatedBulletListScene'
  | 'ComparisonSplitScene'
  | 'MetricCounterGridScene'
  | 'BarChartScene'
  | 'ProcessFlowScene'
  | 'TimelineScene'
  | 'ConceptMapScene'
  | 'QuoteCalloutScene'
  | 'SourceImageSpotlightScene'
  | 'TableHighlightScene'
  | 'SummaryTakeawaysScene'

export interface VideoScene {
  id: string
  component: VideoSceneComponent
  heading: string
  narration: string
  speaker?: 'hostA' | 'hostB'
  items?: string[]
  metrics?: Array<{ label: string; value: string }>
  quote?: { text: string; author?: string }
  imageQuery?: string
  imageDataUrl?: string
}

function stripSourceTag(str: string): string {
  return String(str || '')
    .replace(/\s*\[Fonte[^\]]*\]/gi, '')
    .replace(/\s*\(Fonte[^)]*\)/gi, '')
    .replace(/\s*\[Nota complementar\]/gi, '')
    .replace(/\s*\(Nota complementar\)/gi, '')
    .replace(/\s*\[Não encontrado nas fontes fornecidas\]/gi, '')
    .trim()
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapSvgText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxCharsPerLine) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word.slice(0, maxCharsPerLine)
      if (lines.length >= maxLines) break
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines.slice(0, maxLines)
}

function formatSrtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  const rem = String(ms % 1000).padStart(3, '0')
  return `${h}:${m}:${sec},${rem}`
}

export interface VideoSubtitleStyle {
  enabled?: boolean
  color?: string
  backgroundColor?: string
}

export function renderSceneSvg(opts: {
  scene: VideoScene
  tokens: DesignTokens
  aspectRatio: '16:9' | '9:16'
  sceneIndex: number
  totalScenes: number
  includeSubtitles?: boolean
  subtitleStyle?: VideoSubtitleStyle
  layoutPreset?: LayoutPreset
}): string {
  const isVertical = opts.aspectRatio === '9:16'
  const w = isVertical ? 1080 : 1280
  const h = isVertical ? 1920 : 720
  const { scene, tokens } = opts
  const preset: LayoutPreset = opts.layoutPreset || 'executive'
  const cleanHeading = stripSourceTag(scene.heading)
  const items = (scene.items || []).slice(0, 6).map(stripSourceTag).filter(Boolean)
  const metrics = (scene.metrics || []).slice(0, 4)
  const hasImage = Boolean(scene.imageDataUrl && /^data:image\//i.test(scene.imageDataUrl))
  const clipId = `scene-img-clip-${opts.sceneIndex}`

  const imgBox = isVertical
    ? { x: 80, y: Math.round(h * 0.54), w: w - 160, h: Math.round(h * 0.36) }
    : { x: Math.round(w * 0.59), y: 150, w: Math.round(w * 0.35), h: h - 220 }

  const renderImageFrame = (box: { x: number; y: number; w: number; h: number }) =>
    hasImage
      ? `<defs><clipPath id="${clipId}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="18"/></clipPath></defs>` +
      `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="18" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="2"/>` +
      `<image href="${escapeXml(scene.imageDataUrl!)}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
      : ''

  const textColWidth = hasImage && !isVertical ? Math.round(w * 0.52) : w - 160

  let body = ''
  if (scene.component === 'TitleHeroScene') {
    const titleLines = wrapSvgText(scene.heading, hasImage && !isVertical ? 22 : 34, 2)
    const narrLines = wrapSvgText(scene.narration, hasImage && !isVertical ? 40 : 62, 4)
    const titleStartY = isVertical ? Math.round(h * 0.22) : Math.round(h * 0.34)
    const titleSvg = titleLines
      .map(
        (line, i) =>
          `<text x="90" y="${titleStartY + i * 62}" font-size="48" font-weight="700" fill="${tokens.primary}">${escapeXml(line)}</text>`
      )
      .join('')
    const narrStartY = titleStartY + titleLines.length * 62 + 24
    const narrSvg = narrLines
      .map(
        (line, i) =>
          `<text x="90" y="${narrStartY + i * 34}" font-size="24" fill="${tokens.textMuted}">${escapeXml(line)}</text>`
      )
      .join('')
    body = `
      <rect x="0" y="0" width="24" height="${h}" fill="${tokens.accent}"/>
      ${titleSvg}
      ${narrSvg}
      ${renderImageFrame(imgBox)}
    `
  } else if (scene.component === 'SourceImageSpotlightScene' && hasImage) {
    body = `
      <defs><clipPath id="${clipId}"><rect x="90" y="145" width="${w - 180}" height="${h - 235}" rx="18"/></clipPath></defs>
      <rect x="90" y="145" width="${w - 180}" height="${h - 235}" rx="18" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="2"/>
      <image href="${escapeXml(scene.imageDataUrl!)}" x="90" y="145" width="${w - 180}" height="${h - 235}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
    `
  } else if (scene.component === 'MetricCounterGridScene' && metrics.length > 0) {
    const gridW = hasImage && !isVertical ? textColWidth : w - 160
    const cols = hasImage && !isVertical ? 1 : Math.min(metrics.length, 2)
    const cardW = Math.round((gridW - (cols - 1) * 20) / cols)
    body =
      metrics
        .slice(0, hasImage && !isVertical ? 3 : 4)
        .map((m, idx) => {
          const col = idx % cols
          const row = Math.floor(idx / cols)
          const x = 80 + col * (cardW + 20)
          const y = 160 + row * 165
          return `<rect x="${x}" y="${y}" width="${cardW}" height="145" rx="16" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="2"/><text x="${x + 28}" y="${y + 66}" font-size="40" font-weight="700" fill="${tokens.accent}">${escapeXml(m.value)}</text><text x="${x + 28}" y="${y + 110}" font-size="22" fill="${tokens.textPrimary}">${escapeXml(m.label.slice(0, 32))}</text>`
        })
        .join('') + renderImageFrame(imgBox)
  } else if (scene.component === 'QuoteCalloutScene' && scene.quote) {
    const qW = hasImage && !isVertical ? textColWidth : w - 160
    const qLines = wrapSvgText(`"${scene.quote.text}"`, hasImage && !isVertical ? 34 : 58, 4)
    body =
      `
      <rect x="80" y="170" width="${qW}" height="320" rx="20" fill="${tokens.surfaceAlt}" stroke="${tokens.accent}" stroke-width="3"/>
      ${qLines.map((l, i) => `<text x="112" y="${235 + i * 38}" font-size="26" font-style="italic" fill="${tokens.textPrimary}">${escapeXml(l)}</text>`).join('')}
      <text x="112" y="445" font-size="22" font-weight="600" fill="${tokens.primary}">- ${escapeXml(scene.quote.author || 'Fonte do Projeto')}</text>
    ` + renderImageFrame(imgBox)
  } else if (scene.component === 'TimelineScene' || scene.component === 'ProcessFlowScene') {
    const cardW = hasImage && !isVertical ? textColWidth - 70 : w - 240
    const maxChars = hasImage && !isVertical ? 36 : 64
    const listItems = items.length > 0 ? items : wrapSvgText(scene.narration, maxChars, 3)
    body =
      listItems
        .slice(0, 4)
        .map((it, idx) => {
          const y = 175 + idx * 115
          return `<circle cx="115" cy="${y}" r="18" fill="${tokens.accent}"/><text x="115" y="${y + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="#FFFFFF">${idx + 1}</text><rect x="160" y="${y - 34}" width="${cardW}" height="74" rx="12" fill="${tokens.surfaceAlt}" stroke="${tokens.border}"/><text x="184" y="${y + 10}" font-size="22" fill="${tokens.textPrimary}">${escapeXml(it.slice(0, maxChars))}</text>`
        })
        .join('') + renderImageFrame(imgBox)
  } else {
    const maxChars = hasImage && !isVertical ? 40 : 72
    const listItems = items.length > 0 ? items : wrapSvgText(scene.narration, maxChars, 4)
    body =
      listItems
        .map((it, idx) => {
          const y = 185 + idx * 78
          return `<rect x="80" y="${y - 28}" width="10" height="32" rx="4" fill="${tokens.accent}"/><text x="108" y="${y - 4}" font-size="24" fill="${tokens.textPrimary}">${escapeXml(it.slice(0, maxChars))}</text>`
        })
        .join('') + renderImageFrame(imgBox)
  }

  const subText = (scene.narration || scene.heading || '').trim()
  const showSubtitles =
    (opts.includeSubtitles === true || opts.subtitleStyle?.enabled === true) &&
    opts.subtitleStyle?.enabled !== false &&
    Boolean(subText)
  let subtitleOverlay = ''
  if (showSubtitles) {
    const maxSubChars = isVertical ? 42 : 76
    const subLines = wrapSvgText(subText, maxSubChars, 2)
    if (subLines.length > 0) {
      const fontSize = isVertical ? 26 : 21
      const lineHeight = isVertical ? 34 : 28
      const padY = 10
      const boxH = subLines.length * lineHeight + padY * 2
      const boxW = Math.min(w - 180, Math.max(360, Math.max(...subLines.map((l) => l.length)) * (fontSize * 0.56) + 56))
      const boxX = Math.round((w - boxW) / 2)
      const boxY = h - boxH - (isVertical ? 84 : 42)
      const textStartY = boxY + padY + fontSize - 2
      const subBg = opts.subtitleStyle?.backgroundColor
      const subColor = opts.subtitleStyle?.color || tokens.textPrimary
      const bgRect =
        subBg && subBg !== 'none' && subBg !== 'transparent'
          ? `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="12" fill="${escapeXml(subBg)}"/>`
          : ''
      subtitleOverlay =
        bgRect +
        subLines
          .map(
            (line, idx) =>
              `<text x="${Math.round(w / 2)}" y="${textStartY + idx * lineHeight}" text-anchor="middle" font-size="${fontSize}" font-weight="600" fill="${escapeXml(subColor)}" stroke="${escapeXml(tokens.surface)}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${escapeXml(line)}</text>`
          )
          .join('')
    }
  }

  const themeBackdrop =
    preset === 'tech_dark'
      ? `<circle cx="${w - 110}" cy="160" r="140" fill="${tokens.accent}" opacity="0.08"/><rect x="0" y="0" width="${w}" height="6" fill="${tokens.accent}"/><rect x="32" y="132" width="24" height="3" fill="${tokens.accent}"/><rect x="${w - 56}" y="${h - 48}" width="24" height="3" fill="${tokens.primary}"/>`
      : preset === 'playful' || preset === 'whiteboard'
        ? `<circle cx="${w - 90}" cy="${h - 90}" r="110" fill="${tokens.accent}" opacity="0.12"/><circle cx="70" cy="${h - 70}" r="60" fill="${tokens.primary}" opacity="0.08"/><rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="28" fill="none" stroke="${tokens.border}" stroke-width="2"/>`
        : preset === 'modern'
          ? `<rect x="${w - 280}" y="0" width="280" height="${h}" fill="${tokens.surfaceAlt}" opacity="0.45"/><circle cx="${w - 140}" cy="180" r="95" fill="${tokens.accent}" opacity="0.12"/>`
          : preset === 'editorial'
            ? `<rect x="0" y="0" width="12" height="${h}" fill="${tokens.primary}"/><line x1="80" y1="114" x2="${w - 80}" y2="114" stroke="${tokens.accent}" stroke-width="2"/>`
            : `<rect x="0" y="108" width="${w}" height="4" fill="${tokens.accent}" opacity="0.75"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Segoe UI, Arial, DejaVu Sans, Liberation Sans, sans-serif">
    <rect width="${w}" height="${h}" fill="${tokens.surface}"/>
    <rect x="0" y="0" width="${w}" height="110" fill="${tokens.surfaceAlt}"/>
    ${themeBackdrop}
    <text x="80" y="72" font-size="34" font-weight="700" fill="${tokens.primary}">${escapeXml(cleanHeading.slice(0, 56))}</text>
    ${body}
    ${subtitleOverlay}
  </svg>`
}

let wasmInitPromise: Promise<void> | null = null
let cachedFontBuffers: Uint8Array[] | null = null

function getSystemFontBuffers(): Uint8Array[] {
  if (cachedFontBuffers) return cachedFontBuffers
  const candidates = [
    'C:\\Windows\\Fonts\\segoeui.ttf',
    'C:\\Windows\\Fonts\\segoeuib.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
    'C:\\Windows\\Fonts\\arialbd.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/Library/Fonts/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
  ]
  cachedFontBuffers = candidates
    .filter((p) => {
      try {
        return fs.existsSync(p)
      } catch {
        return false
      }
    })
    .map((p) => fs.readFileSync(p))
  return cachedFontBuffers
}

function resolveResvgWasmPath(): string {
  const candidates: string[] = []

  // 1. NODE_PATH (set by extension-host-manager to include <skillPath>/node_modules)
  if (process.env.NODE_PATH) {
    for (const entry of process.env.NODE_PATH.split(path.delimiter)) {
      if (entry) candidates.push(path.join(entry, '@resvg', 'resvg-wasm', 'index_bg.wasm'))
    }
  }

  // 2. Relative to __dirname (dist/runtime.js or src/core/engines/video-engine.ts)
  if (typeof __dirname === 'string') {
    candidates.push(
      path.join(__dirname, 'index_bg.wasm'),
      path.join(__dirname, '..', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
      path.join(__dirname, '..', '..', '..', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm')
    )
  }

  // 3. Extension path passed via argv (fork(hostPath, [skillId, skillPath]))
  for (const arg of process.argv) {
    if (arg && (arg.includes('momai-docs') || arg.includes('extensions'))) {
      candidates.push(
        path.join(arg, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
        path.join(arg, 'dist', 'index_bg.wasm')
      )
    }
  }

  // 4. Dev workspace fallback when worker runs with cwd in apps/momai
  if (process.env.MOMAI_EXTENSIONS_DEV_DIR) {
    candidates.push(
      path.join(process.env.MOMAI_EXTENSIONS_DEV_DIR, 'momai-docs', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm')
    )
  }
  candidates.push(
    path.join(process.cwd(), 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm'),
    path.resolve(process.cwd(), '..', '..', '..', '00 - Momai Extensions', 'momai-docs', 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm')
  )

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch { }
  }

  const req =
    typeof require === 'function'
      ? require
      : createRequire(path.join(process.cwd(), 'package.json'))
  const searchPaths = [
    ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean) : []),
    typeof __dirname === 'string' ? __dirname : '',
    typeof __dirname === 'string' ? path.resolve(__dirname, '..') : '',
    process.cwd()
  ].filter(Boolean)
  return req.resolve('@resvg/resvg-wasm/index_bg.wasm', { paths: searchPaths })
}

async function ensureResvgWasm(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      const wasmPath = resolveResvgWasmPath()
      await initWasm(fs.readFileSync(wasmPath))
    })()
  }
  return wasmInitPromise
}

export async function renderSvgToPng(svg: string): Promise<Buffer> {
  await ensureResvgWasm()
  const fontBuffers = getSystemFontBuffers()
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers,
      defaultFontFamily: 'Segoe UI',
      loadSystemFonts: false
    }
  })
  return Buffer.from(resvg.render().asPng())
}

function resolveFfmpegBin(): string {
  const candidates = [
    process.env.FFMPEG_PATH,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe') : '',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe'
  ].filter(Boolean) as string[]
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch { }
  }
  return 'ffmpeg'
}

function runFfmpeg(ffmpegBin: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    p.stderr?.on('data', (chunk) => {
      if (stderr.length < 4096) stderr += String(chunk)
    })
    p.on('error', reject)
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(-300)}`))
    )
  })
}

export async function renderVideoArtifact(opts: {
  tts?: PodcastTtsClient
  title: string
  aspectRatio: '16:9' | '9:16'
  scenes: VideoScene[]
  tokens: DesignTokens
  locale?: string
  voice?: string
  voiceB?: string
  includeSubtitles?: boolean
  subtitleStyle?: VideoSubtitleStyle
  attachments?: Array<{ name: string; base64: string; caption?: string }>
  disableRemoteImages?: boolean
  layoutPreset?: LayoutPreset
}): Promise<{
  mp4Buffer: Buffer | null
  mp3Buffer: Buffer | null
  srtText: string
  previewSvgs: string[]
  qaReport: VisualQAReport
  ffmpegAvailable: boolean
}> {
  const tts = opts.tts || createHostTtsClient()
  const config = await tts.getConfig().catch(() => ({ engine: 'phonon', voice: '', speed: 1.0 }))
  const voice = opts.voice || config.voice
  const baseScenes: VideoScene[] =
    opts.scenes.length > 0
      ? opts.scenes
      : [{ id: 's1', component: 'TitleHeroScene', heading: opts.title, narration: opts.title }]

  const attachmentImages = (opts.attachments || [])
    .map((a) => String(a?.base64 || ''))
    .filter((b) => /^data:image\/(png|jpe?g|webp);base64,/i.test(b))
  let attachmentCursor = 0
  const usedRemoteUrls = new Set<string>()

  const scenes: VideoScene[] = await Promise.all(
    baseScenes.map(async (scene, idx) => {
      if (scene.imageDataUrl && /^data:image\//i.test(scene.imageDataUrl)) {
        return scene
      }
      if (attachmentCursor < attachmentImages.length) {
        return { ...scene, imageDataUrl: attachmentImages[attachmentCursor++] }
      }
      if (!opts.disableRemoteImages) {
        const primaryQuery = scene.imageQuery || `${opts.title} ${scene.heading}`
        let dataUrl = await fetchWikimediaImageDataUrl(primaryQuery, usedRemoteUrls)
        if (!dataUrl && idx === 0 && opts.title) {
          dataUrl = await fetchWikimediaImageDataUrl(opts.title, usedRemoteUrls)
        } else if (!dataUrl && scene.heading) {
          dataUrl = await fetchWikimediaImageDataUrl(scene.heading, usedRemoteUrls)
        }
        if (dataUrl) return { ...scene, imageDataUrl: dataUrl }
      }
      return scene
    })
  )

  const previewSvgs = scenes.map((scene, idx) =>
    renderSceneSvg({
      scene,
      tokens: opts.tokens,
      aspectRatio: opts.aspectRatio,
      sceneIndex: idx,
      totalScenes: scenes.length,
      includeSubtitles: opts.includeSubtitles,
      subtitleStyle: opts.subtitleStyle,
      layoutPreset: opts.layoutPreset
    })
  )

  const { report } = runVisualQA({
    tokens: opts.tokens,
    pages: scenes.map((s, idx) => ({
      index: idx,
      label: `Cena ${idx + 1}`,
      fillRatio: 0.65,
      overflowChars: Math.max(0, s.heading.length - 64)
    }))
  })

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momai-video-'))
  const ffmpegBin = resolveFfmpegBin()
  const srtLines: string[] = []
  let cursorMs = 0
  let ffmpegAvailable = false
  let mp4Buffer: Buffer | null = null
  let mp3Buffer: Buffer | null = null

  try {
    const clipPaths: string[] = []
    const audioPaths: string[] = []
    const rawAudioBuffers: Buffer[] = []

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const narrationText = (scene.narration || scene.heading || 'Cena').trim()
      let audioBuf: Buffer
      let mimeType = 'audio/mpeg'

      try {
        const sceneVoice = scene.speaker === 'hostB' && opts.voiceB ? opts.voiceB : voice
        const synth = await tts.synthesize({
          text: narrationText,
          voice: sceneVoice,
          engine: config.engine,
          speed: config.speed
        })
        if (!synth?.audioBase64) throw new Error('Empty TTS audio')
        audioBuf = Buffer.from(synth.audioBase64, 'base64')
        mimeType = synth.mimeType || 'audio/mpeg'
      } catch {
        const words = narrationText.split(/\s+/).filter(Boolean).length
        const fallbackMs = Math.max(2500, words * 360)
        audioBuf = buildSilenceWav(fallbackMs)
        mimeType = 'audio/wav'
      }

      const durMs = Math.max(1500, estimateAudioDurationMs(audioBuf, mimeType))
      srtLines.push(
        `${i + 1}\n${formatSrtTime(cursorMs)} --> ${formatSrtTime(cursorMs + durMs)}\n${narrationText}\n`
      )
      cursorMs += durMs

      const pngPath = path.join(tmpDir, `scene-${i}.png`)
      const audPath = path.join(tmpDir, `scene-${i}.${mimeType.includes('wav') ? 'wav' : 'mp3'}`)
      const clipPath = path.join(tmpDir, `clip-${i}.mp4`)

      const pngBuffer = await renderSvgToPng(previewSvgs[i])
      fs.writeFileSync(pngPath, pngBuffer)
      fs.writeFileSync(audPath, audioBuf)
      audioPaths.push(audPath)
      rawAudioBuffers.push(audioBuf)
      clipPaths.push(clipPath)

      try {
        await runFfmpeg(ffmpegBin, [
          '-y',
          '-loop',
          '1',
          '-framerate',
          '2',
          '-i',
          pngPath,
          '-i',
          audPath,
          '-c:v',
          'libx264',
          '-tune',
          'stillimage',
          '-r',
          '30',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-ar',
          '44100',
          '-ac',
          '2',
          '-shortest',
          clipPath
        ])
      } catch {
        // Record availability below if ffmpeg is missing or fails
      }
    }

    const readyClips = clipPaths.filter((p) => fs.existsSync(p))
    if (readyClips.length === scenes.length && readyClips.length > 0) {
      const listPath = path.join(tmpDir, 'concat.txt')
      const finalMp4 = path.join(tmpDir, 'final.mp4')
      fs.writeFileSync(listPath, readyClips.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
      await runFfmpeg(ffmpegBin, [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        finalMp4
      ])
      if (fs.existsSync(finalMp4)) {
        mp4Buffer = fs.readFileSync(finalMp4)
        ffmpegAvailable = true
      }
    }

    if (audioPaths.length > 0) {
      const audioListPath = path.join(tmpDir, 'audio-concat.txt')
      const finalMp3 = path.join(tmpDir, 'final.mp3')
      fs.writeFileSync(audioListPath, audioPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
      try {
        await runFfmpeg(ffmpegBin, [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          audioListPath,
          '-c:a',
          'libmp3lame',
          '-b:a',
          '128k',
          finalMp3
        ])
        if (fs.existsSync(finalMp3)) {
          mp3Buffer = fs.readFileSync(finalMp3)
        }
      } catch {
        mp3Buffer = Buffer.concat(rawAudioBuffers)
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  return {
    mp4Buffer,
    mp3Buffer,
    srtText: srtLines.join('\n'),
    previewSvgs,
    qaReport: report,
    ffmpegAvailable
  }
}
