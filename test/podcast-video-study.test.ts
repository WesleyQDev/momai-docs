import { describe, it, expect, vi } from 'vitest'
import { selectDynamicVoicePair, renderPodcastArtifact, buildSilenceWav } from '../src/core/engines/podcast-engine.ts'
import { renderSceneSvg, renderVideoArtifact } from '../src/core/engines/video-engine.ts'
import {
  exportFlashcardsCsvAndAnki,
  renderMindMapOrTimelineSvg,
  renderXlsxWorkbook
} from '../src/core/engines/study-data-engines.ts'
import { templateRegistry } from '../src/core/templates/template-registry.ts'
import type { HostBridge } from '../src/core/types.ts'

const noopBridge: HostBridge = {
  storage: { get: async () => null, set: async () => {}, delete: async () => {}, listKeys: async () => [] },
  collections: {
    insert: async () => ({ id: 1 }),
    list: async () => [],
    count: async () => ({ count: 0 }),
    search: async () => [],
    remove: async () => ({ ok: true }),
    clear: async () => ({ removed: 0 }),
    upsert: async () => ({ id: 1, updated: false }),
    upsertMany: async () => ({ upserted: 0 })
  },
  sessionFiles: {
    write: async (p) => ({ ok: true, path: p }),
    read: async () => ({ bytes: new Uint8Array(), text: '' }),
    list: async () => [],
    remove: async () => ({ ok: true })
  },
  log() {},
  sendEvent() {},
  sendStructuredResponse() {}
}

describe('Podcast, Video SVG & Study/Data Engines', () => {
  it('selects dynamic voice pair from SDK list without hardcoded voice names', async () => {
    const voices = [
      { id: 'VozA', name: 'Voz A', language: 'pt-BR', gender: 'female' },
      { id: 'VozB', name: 'Voz B', language: 'pt-BR', gender: 'male' }
    ]
    const pair = selectDynamicVoicePair(voices, 'pt-BR')
    expect(pair.voiceA).toBe('VozA')
    expect(pair.voiceB).toBe('VozB')

    const synthMock = vi.fn(async () => ({
      audioBase64: Buffer.from('mock-audio-bytes').toString('base64'),
      mimeType: 'audio/mpeg'
    }))

    const pod = await renderPodcastArtifact({
      bridge: noopBridge,
      tts: {
        listVoices: async () => voices,
        getConfig: async () => ({ engine: 'phonon', voice: 'VozA', speed: 1.0 }),
        synthesize: synthMock
      },
      title: 'Episódio Piloto',
      turns: [
        { id: 't1', speaker: 'hostA', speakerName: 'Ana', text: 'Bem-vindos ao resumo.', citationLocator: 'p. 1' },
        { id: 't2', speaker: 'hostB', speakerName: 'Pedro', text: 'Os dados mostram economia de 28%.', citationLocator: 'p. 2' }
      ]
    })
    expect(synthMock).toHaveBeenCalledTimes(2)
    expect(pod.srtText).toContain('[Ana]')
    expect(pod.transcriptMarkdown).toContain('*(p. 2)*')
  })

  it('renders deterministic SVG scenes for 16:9 and 9:16 video without AI image generation', () => {
    const tokens = templateRegistry.getById('video-quadro-branco')!.designTokens
    const svg169 = renderSceneSvg({
      scene: { id: 's1', component: 'MetricCounterGridScene', heading: 'Resultados', narration: 'Economia de 28%', metrics: [{ label: 'Economia', value: '28%' }] },
      tokens,
      aspectRatio: '16:9',
      sceneIndex: 0,
      totalScenes: 3
    })
    const svg916 = renderSceneSvg({
      scene: { id: 's2', component: 'TimelineScene', heading: 'Fases', narration: 'Etapas', items: ['Etapa 1', 'Etapa 2'] },
      tokens,
      aspectRatio: '9:16',
      sceneIndex: 1,
      totalScenes: 3
    })
    expect(svg169).toContain('viewBox="0 0 1280 720"')
    expect(svg916).toContain('viewBox="0 0 1080 1920"')
  })

  it('renders MP4 video with audio and MP3 track from SVG scenes with illustrative images via PNG rasterization', async () => {
    const tokens = templateRegistry.getById('video-quadro-branco')!.designTokens
    const wavBase64 = buildSilenceWav(1600).toString('base64')
    // 1x1 transparent PNG data URL to verify embedded <image> rasterization inside SVG -> PNG -> MP4
    const samplePng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const res = await renderVideoArtifact({
      tts: {
        listVoices: async () => [],
        getConfig: async () => ({ engine: 'phonon', voice: 'VozA', speed: 1.0 }),
        synthesize: async () => ({ audioBase64: wavBase64, mimeType: 'audio/wav' })
      },
      title: 'Vídeo Teste',
      aspectRatio: '16:9',
      disableRemoteImages: true,
      attachments: [{ name: 'tema.png', base64: samplePng }],
      scenes: [
        {
          id: 's1',
          component: 'TitleHeroScene',
          heading: 'Introdução',
          narration: 'Bem-vindo ao vídeo explicativo.'
        },
        {
          id: 's2',
          component: 'AnimatedBulletListScene',
          heading: 'Pontos principais',
          narration: 'Primeiro ponto importante.',
          items: ['Item A', 'Item B']
        }
      ],
      tokens
    })

    expect(res.previewSvgs).toHaveLength(2)
    expect(res.previewSvgs[0]).toContain('<image href="data:image/png;base64,')
    expect(res.srtText).toContain('Bem-vindo ao vídeo explicativo.')
    expect(res.ffmpegAvailable).toBe(true)
    expect(res.mp4Buffer).not.toBeNull()
    expect(res.mp4Buffer!.subarray(4, 8).toString('ascii')).toBe('ftyp')
    expect(res.mp3Buffer).not.toBeNull()
    expect(res.mp3Buffer!.length).toBeGreaterThan(100)
  }, 20000)

  it('exports XLSX workbook, MindMap SVG and Anki/CSV flashcards', () => {
    const xlsx = renderXlsxWorkbook({
      sheets: [{ name: 'Métricas', headers: ['Unidade', 'Economia'], rows: [['Piloto', 420000]], summaryFormulaRow: true }]
    })
    expect(xlsx.subarray(0, 2).toString()).toBe('PK')

    const tokens = templateRegistry.getById('mindmap-radial')!.designTokens
    const mm = renderMindMapOrTimelineSvg({
      rootLabel: 'Eficiência',
      mode: 'mindmap',
      nodes: [{ id: 'n1', label: 'LED' }, { id: 'n2', label: 'Solar' }],
      tokens
    })
    expect(mm.svg).toContain('<svg')
    expect(mm.qaReport.passed).toBe(true)

    const fc = exportFlashcardsCsvAndAnki({
      deckTitle: 'Revisão',
      cards: [{ front: 'Qual a economia?', back: '28%', citationLocator: 'p. 1' }]
    })
    expect(fc.ankiTsvText).toContain('Qual a economia?\t28% (p. 1)')
  })
})
