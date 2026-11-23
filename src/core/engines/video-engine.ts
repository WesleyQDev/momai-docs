import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { DesignTokens, VisualQAReport } from '../types.ts'
import { runVisualQA } from '../qa/visual-qa.ts'
import {
  createHostTtsClient,
  estimateAudioDurationMs,
  type PodcastTtsClient
} from './podcast-engine.ts'

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
  items?: string[]
  metrics?: Array<{ label: string; value: string }>
  quote?: { text: string; author?: string }
  imageDataUrl?: string
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatSrtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  const rem = String(ms % 1000).padStart(3, '0')
  return `${h}:${m}:${sec},${rem}`
}

export function renderSceneSvg(opts: {
  scene: VideoScene
  tokens: DesignTokens
  aspectRatio: '16:9' | '9:16'
  sceneIndex: number
  totalScenes: number
}): string {
  const w = opts.aspectRatio === '9:16' ? 1080 : 1280
  const h = opts.aspectRatio === '9:16' ? 1920 : 720
  const { scene, tokens } = opts
  const items = (scene.items || []).slice(0, 6)
  const metrics = (scene.metrics || []).slice(0, 4)

  let body = ''
  if (scene.component === 'TitleHeroScene') {
    body = `
      <rect x="0" y="0" width="24" height="${h}" fill="${tokens.accent}"/>
      <text x="90" y="${Math.round(h * 0.42)}" font-size="54" font-weight="700" fill="${tokens.primary}">${escapeXml(scene.heading.slice(0, 50))}</text>
      <text x="90" y="${Math.round(h * 0.52)}" font-size="26" fill="${tokens.textMuted}">${escapeXml(scene.narration.slice(0, 85))}</text>
    `
  } else if (scene.component === 'MetricCounterGridScene' && metrics.length > 0) {
    const cardW = Math.round((w - 180) / Math.min(metrics.length, 2))
    body = metrics
      .map((m, idx) => {
        const col = idx % 2
        const row = Math.floor(idx / 2)
        const x = 80 + col * (cardW + 20)
        const y = 170 + row * 190
        return `<rect x="${x}" y="${y}" width="${cardW}" height="160" rx="16" fill="${tokens.surfaceAlt}" stroke="${tokens.border}" stroke-width="2"/><text x="${x + 28}" y="${y + 72}" font-size="42" font-weight="700" fill="${tokens.accent}">${escapeXml(m.value)}</text><text x="${x + 28}" y="${y + 118}" font-size="22" fill="${tokens.textPrimary}">${escapeXml(m.label.slice(0, 32))}</text>`
      })
      .join('')
  } else if (scene.component === 'QuoteCalloutScene' && scene.quote) {
    body = `
      <rect x="80" y="180" width="${w - 160}" height="280" rx="20" fill="${tokens.surfaceAlt}" stroke="${tokens.accent}" stroke-width="3"/>
      <text x="120" y="275" font-size="30" font-style="italic" fill="${tokens.textPrimary}">"${escapeXml(scene.quote.text.slice(0, 95))}"</text>
      <text x="120" y="385" font-size="22" font-weight="600" fill="${tokens.primary}">— ${escapeXml(scene.quote.author || 'Fonte do Projeto')}</text>
    `
  } else if (scene.component === 'SourceImageSpotlightScene' && scene.imageDataUrl) {
    body = `
      <image href="${scene.imageDataUrl}" x="100" y="150" width="${w - 200}" height="${h - 280}" preserveAspectRatio="xMidYMid meet"/>
    `
  } else if (scene.component === 'TimelineScene' || scene.component === 'ProcessFlowScene') {
    body = items
      .slice(0, 4)
      .map((it, idx) => {
        const y = 175 + idx * 115
        return `<circle cx="115" cy="${y}" r="18" fill="${tokens.accent}"/><text x="115" y="${y + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="#FFFFFF">${idx + 1}</text><rect x="160" y="${y - 34}" width="${w - 240}" height="74" rx="12" fill="${tokens.surfaceAlt}" stroke="${tokens.border}"/><text x="188" y="${y + 10}" font-size="24" fill="${tokens.textPrimary}">${escapeXml(it.slice(0, 68))}</text>`
      })
      .join('')
  } else {
    body = items
      .map((it, idx) => {
        const y = 185 + idx * 80
        return `<rect x="80" y="${y - 32}" width="12" height="36" rx="4" fill="${tokens.accent}"/><text x="112" y="${y - 6}" font-size="26" fill="${tokens.textPrimary}">${escapeXml(it.slice(0, 72))}</text>`
      })
      .join('')
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${tokens.surface}"/>
    <rect x="0" y="0" width="${w}" height="110" fill="${tokens.surfaceAlt}"/>
    <text x="80" y="72" font-size="34" font-weight="700" fill="${tokens.primary}">${escapeXml(scene.heading.slice(0, 56))}</text>
    ${body}
    <text x="${w - 60}" y="${h - 32}" text-anchor="end" font-size="18" fill="${tokens.textMuted}">${opts.sceneIndex + 1} / ${opts.totalScenes}</text>
  </svg>`
}

export async function renderVideoArtifact(opts: {
  tts?: PodcastTtsClient
  title: string
  aspectRatio: '16:9' | '9:16'
  scenes: VideoScene[]
  tokens: DesignTokens
  voice?: string
}): Promise<{
  mp4Buffer: Buffer | null
  srtText: string
  previewSvgs: string[]
  qaReport: VisualQAReport
  ffmpegAvailable: boolean
}> {
  const tts = opts.tts || createHostTtsClient()
  const config = await tts.getConfig()
  const voice = opts.voice || config.voice

  const previewSvgs = opts.scenes.map((scene, idx) =>
    renderSceneSvg({
      scene,
      tokens: opts.tokens,
      aspectRatio: opts.aspectRatio,
      sceneIndex: idx,
      totalScenes: opts.scenes.length
    })
  )

  const { report } = runVisualQA({
    tokens: opts.tokens,
    pages: opts.scenes.map((s, idx) => ({
      index: idx,
      label: `Cena ${idx + 1}`,
      fillRatio: 0.65,
      overflowChars: Math.max(0, s.heading.length - 64)
    }))
  })

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momai-video-'))
  const srtLines: string[] = []
  let cursorMs = 0
  let ffmpegAvailable = false
  let mp4Buffer: Buffer | null = null

  try {
    const clipPaths: string[] = []
    for (let i = 0; i < opts.scenes.length; i++) {
      const scene = opts.scenes[i]
      const synth = await tts.synthesize({
        text: scene.narration || scene.heading,
        voice,
        engine: config.engine,
        speed: config.speed
      })
      const audioBuf = Buffer.from(synth.audioBase64, 'base64')
      const durMs = estimateAudioDurationMs(audioBuf, synth.mimeType || 'audio/mpeg')
      srtLines.push(
        `${i + 1}\n${formatSrtTime(cursorMs)} --> ${formatSrtTime(cursorMs + durMs)}\n${scene.narration}\n`
      )
      cursorMs += durMs

      const svgPath = path.join(tmpDir, `scene-${i}.svg`)
      const audPath = path.join(tmpDir, `scene-${i}.${synth.mimeType.includes('wav') ? 'wav' : 'mp3'}`)
      const clipPath = path.join(tmpDir, `clip-${i}.mp4`)
      fs.writeFileSync(svgPath, previewSvgs[i])
      fs.writeFileSync(audPath, audioBuf)
      clipPaths.push(clipPath)

      try {
        const durSec = Math.max(1.5, durMs / 1000).toFixed(2)
        await new Promise<void>((resolve, reject) => {
          const p = spawn(
            'ffmpeg',
            ['-y', '-loop', '1', '-t', durSec, '-i', svgPath, '-i', audPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clipPath],
            { stdio: ['ignore', 'pipe', 'pipe'] }
          )
          p.on('error', reject)
          p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
        })
      } catch {
        // Fallback when ffmpeg lacks librsvg/svg demuxer: record availability
      }
    }

    const readyClips = clipPaths.filter((p) => fs.existsSync(p))
    if (readyClips.length === opts.scenes.length && readyClips.length > 0) {
      const listPath = path.join(tmpDir, 'concat.txt')
      const finalMp4 = path.join(tmpDir, 'final.mp4')
      fs.writeFileSync(listPath, readyClips.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
      await new Promise<void>((resolve, reject) => {
        const p = spawn('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', finalMp4], {
          stdio: ['ignore', 'pipe', 'pipe']
        })
        p.on('error', reject)
        p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg concat ${code}`))))
      })
      if (fs.existsSync(finalMp4)) {
        mp4Buffer = fs.readFileSync(finalMp4)
        ffmpegAvailable = true
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  return {
    mp4Buffer,
    srtText: srtLines.join('\n'),
    previewSvgs,
    qaReport: report,
    ffmpegAvailable
  }
}
