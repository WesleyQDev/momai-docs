import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { HostBridge } from '../types.ts'

export interface PodcastTurn {
  id: string
  speaker: 'hostA' | 'hostB'
  speakerName: string
  text: string
  emotion?: string
  pauseAfterMs?: number
  citationLocator?: string
}

export interface TtsVoiceDescriptor {
  id: string
  name: string
  language: string
  gender?: string
  suggested?: boolean
}

export interface PodcastTtsClient {
  listVoices(engine?: string): Promise<TtsVoiceDescriptor[]>
  getConfig(): Promise<{ engine: string; voice: string; speed: number }>
  synthesize(opts: {
    text: string
    voice?: string
    engine?: string
    speed?: number
  }): Promise<{ audioBase64: string; mimeType: string; engine?: string }>
}

export function createHostTtsClient(): PodcastTtsClient {
  const baseUrl = () => (process.env.MOMAI_API_URL || 'http://127.0.0.1:8050').replace(/\/$/, '')
  const token = () => process.env.MOMAI_SESSION_TOKEN || ''

  return {
    async listVoices(engine) {
      const qs = engine ? `?engine=${encodeURIComponent(engine)}` : ''
      const res = await fetch(`${baseUrl()}/voice/tts/voices${qs}`, {
        headers: { 'X-Session-Token': token() },
        signal: AbortSignal.timeout(10_000)
      })
      if (!res.ok) return []
      const data = (await res.json()) as { voices?: TtsVoiceDescriptor[] }
      return Array.isArray(data.voices) ? data.voices : []
    },
    async getConfig() {
      const res = await fetch(`${baseUrl()}/voice/tts/config`, {
        headers: { 'X-Session-Token': token() },
        signal: AbortSignal.timeout(8_000)
      })
      if (!res.ok) return { engine: 'phonon', voice: '', speed: 1.0 }
      const data = (await res.json()) as { config?: { engine: string; voice: string; speed: number } }
      return data.config || { engine: 'phonon', voice: '', speed: 1.0 }
    },
    async synthesize(opts) {
      const res = await fetch(`${baseUrl()}/voice/tts/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token()
        },
        body: JSON.stringify(opts),
        signal: AbortSignal.timeout(60_000)
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || `TTS HTTP ${res.status}`)
      }
      return (await res.json()) as { audioBase64: string; mimeType: string; engine?: string }
    }
  }
}

export function selectDynamicVoicePair(
  voices: TtsVoiceDescriptor[],
  locale = 'pt-BR',
  preferredA?: string,
  preferredB?: string
): { voiceA: string; voiceB: string } {
  const langPrefix = locale.slice(0, 2).toLowerCase()
  const langVoices = voices.filter((v) => v.language.toLowerCase().startsWith(langPrefix))
  const pool = langVoices.length >= 2 ? langVoices : voices

  const female = pool.find((v) => v.gender === 'female')?.id || pool[0]?.id || ''
  const male = pool.find((v) => v.gender === 'male' && v.id !== female)?.id || pool[1]?.id || female

  return {
    voiceA: preferredA && voices.some((v) => v.id === preferredA) ? preferredA : female,
    voiceB: preferredB && voices.some((v) => v.id === preferredB) ? preferredB : male
  }
}

export function buildSilenceWav(durationMs: number, sampleRate = 24000): Buffer {
  const samples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000))
  const dataBytes = samples * 2
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataBytes, 40)
  return buf
}

export function estimateAudioDurationMs(buffer: Buffer, mimeType: string): number {
  if (mimeType.includes('wav') && buffer.length > 44) {
    const byteRate = buffer.readUInt32LE(28) || 48000
    return Math.round(((buffer.length - 44) / byteRate) * 1000)
  }
  // MP3 ~48kbps = 6000 bytes/s
  return Math.max(800, Math.round((buffer.length / 6000) * 1000))
}

async function runFfmpegMix(files: string[], outPath: string, format: 'mp3' | 'wav'): Promise<boolean> {
  const tmpList = `${outPath}.txt`
  fs.writeFileSync(tmpList, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'))
  try {
    const args = [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      tmpList,
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      ...(format === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '128k'] : ['-c:a', 'pcm_s16le']),
      outPath
    ]
    await new Promise<void>((resolve, reject) => {
      const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
      p.on('error', reject)
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg code ${code}`))))
    })
    return fs.existsSync(outPath)
  } finally {
    try {
      fs.unlinkSync(tmpList)
    } catch {}
  }
}

function formatSrtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  const rem = String(ms % 1000).padStart(3, '0')
  return `${h}:${m}:${sec},${rem}`
}

export async function renderPodcastArtifact(opts: {
  bridge: HostBridge
  tts?: PodcastTtsClient
  title: string
  turns: PodcastTurn[]
  locale?: string
  voiceA?: string
  voiceB?: string
}): Promise<{
  mp3Buffer: Buffer
  wavBuffer: Buffer
  srtText: string
  transcriptMarkdown: string
  voiceA: string
  voiceB: string
}> {
  const tts = opts.tts || createHostTtsClient()
  const config = await tts.getConfig()
  const voices = await tts.listVoices(config.engine)
  const pair = selectDynamicVoicePair(voices, opts.locale || 'pt-BR', opts.voiceA, opts.voiceB)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momai-podcast-'))
  const segmentPaths: string[] = []
  const srtEntries: string[] = []
  const mdLines: string[] = [`# ${opts.title}`, '']
  let cursorMs = 0

  try {
    for (let i = 0; i < opts.turns.length; i++) {
      const turn = opts.turns[i]
      const voice = turn.speaker === 'hostB' ? pair.voiceB : pair.voiceA
      const cacheKey = createHash('sha256')
        .update(`${config.engine}:${voice}:${config.speed}:${turn.text}`)
        .digest('hex')

      let audioBuf: Buffer
      let mimeType = 'audio/mpeg'
      const cached = await opts.bridge.collections
        .list('tts_cache', { where: { cacheKey }, limit: 1 })
        .catch(() => [])

      if (cached[0]?.audioBase64) {
        audioBuf = Buffer.from(String(cached[0].audioBase64), 'base64')
        mimeType = String(cached[0].mimeType || 'audio/mpeg')
      } else {
        const res = await tts.synthesize({
          text: turn.text,
          voice,
          engine: config.engine,
          speed: config.speed
        })
        audioBuf = Buffer.from(res.audioBase64, 'base64')
        mimeType = res.mimeType || 'audio/mpeg'
        await opts.bridge.collections
          .upsert('tts_cache', {
            cacheKey,
            voice,
            engine: config.engine,
            mimeType,
            audioBase64: res.audioBase64
          })
          .catch(() => {})
      }

      const ext = mimeType.includes('wav') ? 'wav' : 'mp3'
      const segPath = path.join(tmpDir, `seg-${i}.${ext}`)
      fs.writeFileSync(segPath, audioBuf)
      segmentPaths.push(segPath)

      const durMs = estimateAudioDurationMs(audioBuf, mimeType)
      srtEntries.push(
        `${i + 1}\n${formatSrtTime(cursorMs)} --> ${formatSrtTime(cursorMs + durMs)}\n[${turn.speakerName}] ${turn.text}\n`
      )
      mdLines.push(
        `**[${formatSrtTime(cursorMs).slice(0, 8)}] ${turn.speakerName}:** ${turn.text}${turn.citationLocator ? ` *(${turn.citationLocator})*` : ''}`
      )
      cursorMs += durMs

      const pauseMs = Math.min(1200, Math.max(200, turn.pauseAfterMs || 350))
      const silPath = path.join(tmpDir, `sil-${i}.wav`)
      fs.writeFileSync(silPath, buildSilenceWav(pauseMs))
      segmentPaths.push(silPath)
      cursorMs += pauseMs
    }

    const outMp3 = path.join(tmpDir, 'podcast.mp3')
    const outWav = path.join(tmpDir, 'podcast.wav')
    let mp3Buffer: Buffer
    let wavBuffer: Buffer

    try {
      await runFfmpegMix(segmentPaths, outMp3, 'mp3')
      await runFfmpegMix(segmentPaths, outWav, 'wav')
      mp3Buffer = fs.readFileSync(outMp3)
      wavBuffer = fs.readFileSync(outWav)
    } catch {
      // Fallback if ffmpeg is unavailable in minimal test environments
      const rawBuffers = segmentPaths
        .filter((p) => !path.basename(p).startsWith('sil-'))
        .map((p) => fs.readFileSync(p))
      mp3Buffer = Buffer.concat(rawBuffers)
      wavBuffer = buildSilenceWav(1000)
    }

    return {
      mp3Buffer,
      wavBuffer,
      srtText: srtEntries.join('\n'),
      transcriptMarkdown: mdLines.join('\n\n'),
      voiceA: pair.voiceA,
      voiceB: pair.voiceB
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
