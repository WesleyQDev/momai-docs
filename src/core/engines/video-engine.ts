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
  normalizeTtsNarration,
  selectDynamicVoicePair,
  type PodcastTtsClient
} from './podcast-engine.ts'
import { fetchWikimediaImageDataUrl } from '../media/wikimedia-image.ts'
import { normalizeLocale, type DocsLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

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
    .replace(/\s*[\[(](?:Fonte|Source|Fuente|Quelle)[\s\]:][^\]\)]*[\])]/gi, '')
    .replace(/\s*[\[(](?:Nota complementar|Supplementary note|Nota complementaria|Note complémentaire|Ergänzender Hinweis|Nota supplementare)[\])]/gi, '')
    .replace(/\s*[\[(](?:Não encontrado nas fontes fornecidas|Not found in the provided sources|No encontrado en las fuentes proporcionadas|Introuvable dans les sources fournies|In den bereitgestellten Quellen nicht gefunden|Non trovato nelle fonti fornite)[\])]/gi, '')
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
  let truncated = false
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxCharsPerLine) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word.slice(0, maxCharsPerLine)
      if (lines.length >= maxLines) {
        truncated = true
        break
      }
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current)
  } else if (current && lines.length >= maxLines) {
    truncated = true
  }
  if (truncated && lines.length > 0) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] =
      last.length + 3 <= maxCharsPerLine ? `${last}...` : `${last.slice(0, Math.max(1, maxCharsPerLine - 3))}...`
  }
  return lines.slice(0, maxLines)
}

function extractSearchKeywords(raw: string): string {
  const stop = new Set([
    'para', 'como', 'com', 'sem', 'entre', 'sobre', 'mais', 'menos', 'uma', 'uns', 'umas',
    'dos', 'das', 'nos', 'nas', 'pelos', 'pelas', 'que', 'por', 'the', 'and', 'for', 'with'
  ])
  return String(raw || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stop.has(w.toLowerCase()))
    .slice(0, 2)
    .join(' ')
}

function normalizeFfmpegColor(hex: string | undefined, fallback = '#FFFFFF'): string {
  const clean = String(hex || '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean : fallback
}

function fitSvgTextLines(
  text: string,
  baseMaxChars: number,
  maxLines: number
): { lines: string[]; scale: number } {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { lines: [], scale: 1 }

  for (const scale of [1, 0.86, 0.74, 0.64]) {
    const chars = Math.max(12, Math.round(baseMaxChars / scale))
    const lines: string[] = []
    let current = ''
    let overflow = false
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (next.length <= chars) {
        current = next
      } else {
        if (current) lines.push(current)
        current = word
        if (lines.length >= maxLines) {
          overflow = true
          break
        }
      }
    }
    if (!overflow && current) {
      if (lines.length < maxLines) {
        lines.push(current)
        return { lines, scale }
      }
    }
  }

  const fallbackChars = Math.max(12, Math.round(baseMaxChars / 0.64))
  return { lines: wrapSvgText(text, fallbackChars, maxLines + 1), scale: 0.64 }
}

function firstCompleteSentence(text: string, maxChars: number): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const match = clean.match(/^(.{12,}?[.!?])(?:\s|$)/)
  if (match && match[1].length <= maxChars) return match[1]
  return clean
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
  revealCount?: number
  locale?: DocsLocale
}): string {
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const isVertical = opts.aspectRatio === '9:16'
  const w = isVertical ? 1080 : 1280
  const h = isVertical ? 1920 : 720
  const { scene, tokens } = opts
  const preset: LayoutPreset = opts.layoutPreset || 'executive'
  const revealLimit = opts.revealCount ?? Number.POSITIVE_INFINITY
  const showEl = (idx: number) => idx < revealLimit
  const cleanHeading = stripSourceTag(scene.heading)
  const items = (scene.items || []).slice(0, 6).map(stripSourceTag).filter(Boolean)
  const metrics = (scene.metrics || []).slice(0, 4)
  const hasImage = Boolean(scene.imageDataUrl && /^data:image\//i.test(scene.imageDataUrl))
  const clipId = `scene-img-clip-${opts.sceneIndex}`

  const imgBox = isVertical
    ? { x: 80, y: Math.round(h * 0.54), w: w - 160, h: Math.round(h * 0.36) }
    : { x: Math.round(w * 0.58), y: 148, w: Math.round(w * 0.36), h: h - 220 }

  const renderImageFrame = (box: { x: number; y: number; w: number; h: number }, revealIdx = 99) =>
    hasImage && showEl(revealIdx)
      ? `<defs><clipPath id="${clipId}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="14"/></clipPath></defs>` +
        `<image href="${escapeXml(scene.imageDataUrl!)}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"/>`
      : ''

  const textColWidth = hasImage && !isVertical ? Math.round(w * 0.5) : w - 160
  const isCover =
    scene.component === 'TitleHeroScene' ||
    (opts.sceneIndex === 0 && items.length === 0 && metrics.length === 0 && !scene.quote)

  let body = ''
  if (isCover) {
    const coverLeft = 96
    const baseTitleChars = hasImage && !isVertical ? 22 : isVertical ? 22 : 32
    const fittedTitle = fitSvgTextLines(cleanHeading || tr('Apresentação'), baseTitleChars, 3)
    const titleLines = fittedTitle.lines
    const subtitleSource = items[0] || firstCompleteSentence(stripSourceTag(scene.narration), 160)
    const titleFontSize = Math.round((isVertical ? 52 : 48) * fittedTitle.scale)
    const titleLineH = Math.round(titleFontSize * 1.28)
    const titleStartY = isVertical ? Math.round(h * 0.24) : Math.round(h * 0.35)
    const badgeY = titleStartY - 72
    const fittedSub = fitSvgTextLines(subtitleSource, hasImage && !isVertical ? 38 : isVertical ? 36 : 58, 3)
    const subLines = fittedSub.lines
    const subFontSize = Math.round(23 * Math.max(0.85, fittedSub.scale))

    const titleSvg = titleLines
      .map(
        (line, i) =>
          `<text x="${coverLeft}" y="${titleStartY + i * titleLineH}" font-size="${titleFontSize}" font-weight="800" fill="${tokens.primary}">${escapeXml(line)}</text>`
      )
      .join('')
    const subStartY = titleStartY + titleLines.length * titleLineH + 22
    const subSvg = showEl(0)
      ? subLines
          .map(
            (line, i) =>
              `<text x="${coverLeft}" y="${subStartY + i * Math.round(subFontSize * 1.45)}" font-size="${subFontSize}" font-weight="400" fill="${tokens.textMuted}">${escapeXml(line)}</text>`
          )
          .join('')
      : ''

    body = `
      <circle cx="${w - 80}" cy="110" r="220" fill="${tokens.accent}" opacity="0.06"/>
      <circle cx="${w - 190}" cy="${h - 40}" r="140" fill="${tokens.primary}" opacity="0.05"/>
      <rect x="${coverLeft}" y="${badgeY}" width="164" height="32" rx="16" fill="${tokens.accent}" opacity="0.14"/>
      <text x="${coverLeft + 82}" y="${badgeY + 21}" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="1.2" fill="${tokens.accent}">${escapeXml(tr('APRESENTAÇÃO'))}</text>
      ${titleSvg}
      <rect x="${coverLeft}" y="${titleStartY + titleLines.length * titleLineH - 12}" width="84" height="5" rx="2.5" fill="${tokens.accent}"/>
      ${subSvg}
      ${renderImageFrame(imgBox, 1)}
    `
  } else if (scene.component === 'SourceImageSpotlightScene' && hasImage) {
    body = showEl(0)
      ? `
      <defs><clipPath id="${clipId}"><rect x="80" y="140" width="${w - 160}" height="${h - 215}" rx="16"/></clipPath></defs>
      <image href="${escapeXml(scene.imageDataUrl!)}" x="80" y="140" width="${w - 160}" height="${h - 215}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"/>
    `
      : ''
  } else if (scene.component === 'MetricCounterGridScene' && metrics.length > 0) {
    const gridW = hasImage && !isVertical ? textColWidth : w - 160
    const cols = hasImage && !isVertical ? 1 : Math.min(metrics.length, 2)
    const cardW = Math.round((gridW - (cols - 1) * 32) / cols)
    const visibleMetrics = metrics.slice(0, hasImage && !isVertical ? 3 : 4)
    body =
      visibleMetrics
        .map((m, idx) => {
          if (!showEl(idx)) return ''
          const col = idx % cols
          const row = Math.floor(idx / cols)
          const x = 80 + col * (cardW + 32)
          const y = 165 + row * 175
          const labelLines = wrapSvgText(m.label, Math.max(18, Math.floor((cardW - 16) / 12)), 2)
          return `
            <rect x="${x}" y="${y}" width="56" height="5" rx="2.5" fill="${tokens.accent}"/>
            <text x="${x}" y="${y + 56}" font-size="44" font-weight="800" fill="${tokens.accent}">${escapeXml(m.value)}</text>
            ${labelLines.map((l, li) => `<text x="${x}" y="${y + 92 + li * 26}" font-size="21" fill="${tokens.textPrimary}">${escapeXml(l)}</text>`).join('')}
          `
        })
        .join('') + renderImageFrame(imgBox, visibleMetrics.length)
  } else if (scene.component === 'QuoteCalloutScene' && scene.quote) {
    const qW = hasImage && !isVertical ? textColWidth : w - 160
    const qLines = wrapSvgText(`"${scene.quote.text}"`, hasImage && !isVertical ? 34 : 56, 4)
    body =
      (showEl(0)
        ? `
      <rect x="80" y="185" width="8" height="260" rx="4" fill="${tokens.accent}"/>
      ${qLines.map((l, i) => `<text x="116" y="${235 + i * 42}" font-size="28" font-style="italic" fill="${tokens.textPrimary}">${escapeXml(l)}</text>`).join('')}
      <text x="116" y="435" font-size="21" font-weight="700" fill="${tokens.primary}">- ${escapeXml(scene.quote.author || tr('Referência'))}</text>
    `
        : '') + renderImageFrame(imgBox, 1)
  } else if (scene.component === 'BarChartScene' && metrics.length > 0) {
    const chartW = hasImage && !isVertical ? textColWidth : w - 160
    const visibleMetrics = metrics.slice(0, 4)
    const numericVals = visibleMetrics.map((m) => {
      const n = Number.parseFloat(String(m.value).replace(/[^\d.,-]/g, '').replace(',', '.'))
      return Number.isFinite(n) && n > 0 ? n : 50
    })
    const maxVal = Math.max(1, ...numericVals)
    const barMaxW = Math.max(120, chartW - 180)
    body =
      visibleMetrics
        .map((m, idx) => {
          if (!showEl(idx)) return ''
          const y = 175 + idx * 108
          const ratio = Math.max(0.12, Math.min(1, numericVals[idx] / maxVal))
          const barW = Math.round(barMaxW * ratio)
          return `
            <text x="80" y="${y + 24}" font-size="21" font-weight="600" fill="${tokens.textPrimary}">${escapeXml(m.label.slice(0, 44))}</text>
            <rect x="80" y="${y + 40}" width="${barMaxW}" height="14" rx="7" fill="${tokens.border}" opacity="0.4"/>
            <rect x="80" y="${y + 40}" width="${barW}" height="14" rx="7" fill="${tokens.accent}"/>
            <text x="${80 + barMaxW + 24}" y="${y + 53}" font-size="22" font-weight="800" fill="${tokens.primary}">${escapeXml(m.value)}</text>
          `
        })
        .join('') + renderImageFrame(imgBox, visibleMetrics.length)
  } else if (scene.component === 'ConceptMapScene' && items.length >= 2 && !isVertical && !hasImage) {
    const centerX = Math.round(w / 2)
    const centerY = 395
    const branches = items.slice(0, 4)
    const coords = [
      { x: 90, y: 170, lineX: 390, lineY: 225 },
      { x: w - 410, y: 170, lineX: w - 410, lineY: 225 },
      { x: 90, y: 495, lineX: 390, lineY: 545 },
      { x: w - 410, y: 495, lineX: w - 410, lineY: 545 }
    ]
    const linesSvg = branches
      .map((_, idx) => {
        if (!showEl(idx)) return ''
        const c = coords[idx]
        return `<line x1="${centerX}" y1="${centerY}" x2="${c.lineX}" y2="${c.lineY}" stroke="${tokens.accent}" stroke-width="2.5" opacity="0.5"/>`
      })
      .join('')
    const nodesSvg = branches
      .map((it, idx) => {
        if (!showEl(idx)) return ''
        const c = coords[idx]
        const lines = wrapSvgText(it, 26, 2)
        const ty = lines.length > 1 ? c.y + 42 : c.y + 56
        return `
          <rect x="${c.x}" y="${c.y}" width="8" height="84" rx="4" fill="${tokens.accent}"/>
          ${lines.map((l, li) => `<text x="${c.x + 24}" y="${ty + li * 25}" font-size="20" fill="${tokens.textPrimary}">${escapeXml(l)}</text>`).join('')}
        `
      })
      .join('')
    const rootLines = wrapSvgText(cleanHeading, 18, 2)
    const rootY = rootLines.length > 1 ? centerY - 6 : centerY + 6
    body = `
      ${linesSvg}
      ${nodesSvg}
      <circle cx="${centerX}" cy="${centerY}" r="94" fill="${tokens.primary}"/>
      ${rootLines.map((l, li) => `<text x="${centerX}" y="${rootY + li * 24}" text-anchor="middle" font-size="19" font-weight="700" fill="#FFFFFF">${escapeXml(l)}</text>`).join('')}
    `
  } else if (scene.component === 'ComparisonSplitScene' && items.length >= 2) {
    const mid = Math.ceil(items.length / 2)
    const leftItems = items.slice(0, mid)
    const rightItems = items.slice(mid)
    const colW = Math.round((w - 200) / 2)
    const sparse = Math.max(leftItems.length, rightItems.length) <= 1
    const fontSize = sparse ? 26 : 22
    const lineH = sparse ? 36 : 29
    const maxChars = sparse ? 32 : 36
    const maxLines = sparse ? 5 : 3
    const colY = sparse ? 210 : 162
    const colH = sparse ? 340 : Math.min(460, Math.max(280, Math.max(leftItems.length, rightItems.length) * 112 + 40))
    const renderCol = (colItems: string[], x: number, accentBar: string, offsetIdx: number) => {
      const rows = colItems
        .slice(0, 4)
        .map((it, idx) => {
          if (!showEl(offsetIdx + idx)) return ''
          const lines = wrapSvgText(it, maxChars, maxLines)
          const ry = colY + 62 + idx * (sparse ? 130 : 98)
          return `<circle cx="${x + 34}" cy="${ry - 6}" r="7" fill="${accentBar}"/>${lines.map((l, li) => `<text x="${x + 56}" y="${ry + li * lineH}" font-size="${fontSize}" fill="${tokens.textPrimary}">${escapeXml(l)}</text>`).join('')}`
        })
        .join('')
      return `<rect x="${x}" y="${colY}" width="${colW}" height="${colH}" rx="20" fill="${tokens.surfaceAlt}" opacity="0.72"/><rect x="${x}" y="${colY}" width="110" height="5" rx="2.5" fill="${accentBar}"/>${rows}`
    }
    body =
      renderCol(leftItems, 80, tokens.primary, 0) +
      renderCol(rightItems, 80 + colW + 40, tokens.accent, Math.min(2, leftItems.length))
  } else if (scene.component === 'TimelineScene' || scene.component === 'ProcessFlowScene') {
    const maxChars = hasImage && !isVertical ? 40 : 64
    const listItems = (items.length > 0 ? items : wrapSvgText(stripSourceTag(scene.narration), maxChars, 3)).slice(0, 4)
    const sparse = listItems.length <= 2
    const stepY = sparse ? 150 : 114
    const startY = sparse ? 235 : 185
    const lineEndY = startY + Math.max(0, listItems.length - 1) * stepY
    body =
      (!hasImage ? `<circle cx="${w - 90}" cy="${h - 90}" r="160" fill="${tokens.accent}" opacity="0.05"/>` : '') +
      `<line x1="104" y1="${startY}" x2="104" y2="${lineEndY}" stroke="${tokens.border}" stroke-width="3"/>` +
      listItems
        .map((it, idx) => {
          if (!showEl(idx)) return ''
          const y = startY + idx * stepY
          const lines = wrapSvgText(it, maxChars, sparse ? 3 : 2)
          const textY = lines.length > 1 ? y - 8 : y + 7
          return `
            <circle cx="104" cy="${y}" r="22" fill="${tokens.accent}"/>
            <text x="104" y="${y + 7}" text-anchor="middle" font-size="18" font-weight="700" fill="#FFFFFF">${idx + 1}</text>
            ${lines.map((l, li) => `<text x="150" y="${textY + li * 30}" font-size="${sparse ? 25 : 22}" fill="${tokens.textPrimary}">${escapeXml(l)}</text>`).join('')}
          `
        })
        .join('') +
      renderImageFrame(imgBox, listItems.length)
  } else {
    const maxChars = hasImage && !isVertical ? 42 : 68
    const listItems = items.length > 0 ? items : wrapSvgText(stripSourceTag(scene.narration), maxChars, 4)
    const visible = listItems.slice(0, 4)
    const sparse = visible.length <= 2
    const stepY = sparse ? 148 : visible.length === 3 ? 118 : 96
    const startY = sparse ? 235 : 185
    const fontSize = sparse ? 26 : 23
    body =
      (!hasImage ? `<circle cx="${w - 90}" cy="${h - 90}" r="160" fill="${tokens.accent}" opacity="0.05"/><circle cx="${w - 220}" cy="${h - 40}" r="90" fill="${tokens.primary}" opacity="0.04"/>` : '') +
      visible
        .map((it, idx) => {
          if (!showEl(idx)) return ''
          const y = startY + idx * stepY
          const lines = wrapSvgText(it, maxChars, sparse ? 3 : 2)
          return `
            <circle cx="92" cy="${y - 7}" r="6.5" fill="${tokens.accent}"/>
            ${lines.map((l, li) => `<text x="118" y="${y + li * (fontSize + 7)}" font-size="${fontSize}" fill="${tokens.textPrimary}">${escapeXml(l)}</text>`).join('')}
          `
        })
        .join('') + renderImageFrame(imgBox, visible.length)
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
      ? `<circle cx="${w - 110}" cy="160" r="140" fill="${tokens.accent}" opacity="0.08"/><rect x="32" y="132" width="24" height="3" fill="${tokens.accent}"/><rect x="${w - 56}" y="${h - 48}" width="24" height="3" fill="${tokens.primary}"/>`
      : preset === 'playful' || preset === 'whiteboard'
        ? `<circle cx="${w - 90}" cy="${h - 90}" r="110" fill="${tokens.accent}" opacity="0.12"/><circle cx="70" cy="${h - 70}" r="60" fill="${tokens.primary}" opacity="0.08"/><rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="28" fill="none" stroke="${tokens.border}" stroke-width="2"/>`
        : preset === 'modern'
          ? `<rect x="${w - 280}" y="0" width="280" height="${h}" fill="${tokens.surfaceAlt}" opacity="0.45"/><circle cx="${w - 140}" cy="180" r="95" fill="${tokens.accent}" opacity="0.12"/>`
          : preset === 'editorial'
            ? `<line x1="80" y1="114" x2="${w - 80}" y2="114" stroke="${tokens.accent}" stroke-width="2"/>`
            : `<rect x="0" y="108" width="${w}" height="4" fill="${tokens.accent}" opacity="0.75"/>`

  const fittedHeader = fitSvgTextLines(cleanHeading, isVertical ? 36 : 54, 2)
  const headerFontSize = Math.round(31 * Math.max(0.76, fittedHeader.scale))
  const headerStartY = fittedHeader.lines.length > 1 ? 46 : 68
  const progressW = Math.round((w * Math.max(1, opts.sceneIndex + 1)) / Math.max(1, opts.totalScenes))
  const headerChrome = isCover
    ? ''
    : `
    <rect x="0" y="0" width="${w}" height="110" fill="${tokens.surfaceAlt}"/>
    ${themeBackdrop}
    ${fittedHeader.lines
      .map(
        (line, li) =>
          `<text x="80" y="${headerStartY + li * Math.round(headerFontSize * 1.22)}" font-size="${headerFontSize}" font-weight="700" fill="${tokens.primary}">${escapeXml(line)}</text>`
      )
      .join('')}
  `

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Segoe UI, Arial, DejaVu Sans, Liberation Sans, sans-serif">
    <rect width="${w}" height="${h}" fill="${tokens.surface}"/>
    ${headerChrome}
    ${body}
    <rect x="0" y="${h - 6}" width="${w}" height="6" fill="${tokens.border}" opacity="0.45"/>
    <rect x="0" y="${h - 6}" width="${progressW}" height="6" fill="${tokens.accent}"/>
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

export async function renderPngToJpg(pngBuffer: Buffer): Promise<Buffer | null> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momai-jpg-'))
  const inPath = path.join(tmpDir, 'in.png')
  const outPath = path.join(tmpDir, 'out.jpg')
  try {
    fs.writeFileSync(inPath, pngBuffer)
    await runFfmpeg(resolveFfmpegBin(), ['-y', '-i', inPath, '-q:v', '2', outPath])
    return fs.existsSync(outPath) ? fs.readFileSync(outPath) : null
  } catch {
    return null
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
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
  speakerCount?: 1 | 2
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
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const tts = opts.tts || createHostTtsClient()
  const config = await tts.getConfig().catch(() => ({ engine: 'phonon', voice: '', speed: 1.0 }))
  const isDialogue =
    opts.speakerCount === 2 ||
    Boolean(opts.voiceB) ||
    opts.scenes.some((s) => s.speaker === 'hostB')
  let voice = opts.voice || config.voice
  let voiceB = opts.voiceB || ''
  if (isDialogue) {
    const availableVoices = await tts.listVoices().catch(() => [])
    const pair = selectDynamicVoicePair(availableVoices, opts.locale || 'pt-BR', opts.voice, opts.voiceB)
    voice = pair.voiceA || voice
    voiceB = pair.voiceB || voice
  }
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
        const primaryQuery = scene.imageQuery || extractSearchKeywords(`${scene.heading} ${opts.title}`)
        let dataUrl = primaryQuery ? await fetchWikimediaImageDataUrl(primaryQuery, usedRemoteUrls) : null
        if (!dataUrl && scene.heading) {
          const kw = extractSearchKeywords(scene.heading)
          if (kw && kw !== primaryQuery) dataUrl = await fetchWikimediaImageDataUrl(kw, usedRemoteUrls)
        }
        if (!dataUrl && idx === 0 && opts.title) {
          const kw = extractSearchKeywords(opts.title)
          if (kw && kw !== primaryQuery) dataUrl = await fetchWikimediaImageDataUrl(kw, usedRemoteUrls)
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
      layoutPreset: opts.layoutPreset,
      locale
    })
  )

  const { report } = runVisualQA({
    tokens: opts.tokens,
    pages: scenes.map((s, idx) => ({
      index: idx,
      label: tr('Cena {number}', { number: idx + 1 }),
      fillRatio: 0.65,
      overflowChars: Math.max(0, s.heading.length - 64)
    })),
    locale
  })

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momai-video-'))
  const ffmpegBin = resolveFfmpegBin()
  const srtLines: string[] = []
  let cursorMs = 0
  let ffmpegAvailable = false
  let mp4Buffer: Buffer | null = null
  let mp3Buffer: Buffer | null = null

  const hasExplicitDialogue = scenes.some((s) => s.speaker === 'hostB')

  try {
    const clipPaths: string[] = []
    const audioPaths: string[] = []
    const rawAudioBuffers: Buffer[] = []

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const narrationText = (scene.narration || scene.heading || tr('Cena')).trim()
      let audioBuf: Buffer
      let mimeType = 'audio/mpeg'

      try {
        const effectiveSpeaker = isDialogue
          ? hasExplicitDialogue
            ? scene.speaker || (i % 2 === 1 ? 'hostB' : 'hostA')
            : i % 2 === 1
              ? 'hostB'
              : 'hostA'
          : 'hostA'
        const sceneVoice = effectiveSpeaker === 'hostB' && voiceB ? voiceB : voice
        const spokenNarration = normalizeTtsNarration(narrationText) || narrationText
        const synth = await tts.synthesize({
          text: spokenNarration,
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

      const durSec = Math.max(1.5, durMs / 1000)
      const bgHex = normalizeFfmpegColor(opts.tokens.surface, '#FFFFFF')
      const audPath = path.join(tmpDir, `scene-${i}.${mimeType.includes('wav') ? 'wav' : 'mp3'}`)
      const clipPath = path.join(tmpDir, `clip-${i}.mp4`)
      fs.writeFileSync(audPath, audioBuf)
      audioPaths.push(audPath)
      rawAudioBuffers.push(audioBuf)
      clipPaths.push(clipPath)

      const elemCount = Math.max(
        1,
        Math.min(
          4,
          (scene.metrics?.length || 0) +
            (scene.items?.length || 0) +
            (scene.imageDataUrl ? 1 : 0) +
            (scene.component === 'TitleHeroScene' ? 1 : 0)
        )
      )
      const totalSteps = Math.min(4, elemCount)
      const stepCounts: number[] =
        durSec >= 2.8 && elemCount >= 2
          ? Array.from({ length: totalSteps }, (_, idx) =>
              idx === totalSteps - 1 ? Number.POSITIVE_INFINITY : idx
            )
          : [Number.POSITIVE_INFINITY]

      const stepPngPaths: string[] = []
      for (let s = 0; s < stepCounts.length; s++) {
        const stepSvg =
          s === stepCounts.length - 1
            ? previewSvgs[i]
            : renderSceneSvg({
                scene,
                tokens: opts.tokens,
                aspectRatio: opts.aspectRatio,
                sceneIndex: i,
                totalScenes: scenes.length,
                includeSubtitles: opts.includeSubtitles,
                subtitleStyle: opts.subtitleStyle,
                layoutPreset: opts.layoutPreset,
                revealCount: stepCounts[s],
                locale
              })
        const spPath = path.join(tmpDir, `scene-${i}-step-${s}.png`)
        fs.writeFileSync(spPath, await renderSvgToPng(stepSvg))
        stepPngPaths.push(spPath)
      }

      const fadeOutStart = Math.max(0.4, Number((durSec - 0.35).toFixed(2)))
      try {
        if (stepPngPaths.length > 1) {
          const stepDur = Math.min(0.85, (durSec * 0.45) / (stepPngPaths.length - 1))
          const fadeDur = Math.min(0.32, stepDur * 0.6)
          const inputArgs: string[] = []
          for (let s = 0; s < stepPngPaths.length; s++) {
            const len = s === stepPngPaths.length - 1 ? durSec : stepDur + fadeDur
            inputArgs.push('-loop', '1', '-t', len.toFixed(2), '-i', stepPngPaths[s])
          }
          const audIdx = stepPngPaths.length
          inputArgs.push('-i', audPath)

          const chains: string[] = []
          let prevLabel = '0:v'
          for (let s = 1; s < stepPngPaths.length; s++) {
            const offset = Number((s * stepDur).toFixed(2))
            const outLabel = s === stepPngPaths.length - 1 ? 'vmerged' : `vx${s}`
            chains.push(
              `[${prevLabel}][${s}:v]xfade=transition=fade:duration=${fadeDur.toFixed(2)}:offset=${offset}[${outLabel}]`
            )
            prevLabel = outLabel
          }
          chains.push(
            `[${prevLabel}]fade=t=in:st=0:d=0.35:color=${bgHex},fade=t=out:st=${fadeOutStart}:d=0.35:color=${bgHex},format=yuv420p[vout]`
          )

          await runFfmpeg(ffmpegBin, [
            '-y',
            ...inputArgs,
            '-filter_complex',
            chains.join(';'),
            '-map',
            '[vout]',
            '-map',
            `${audIdx}:a`,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-r',
            '24',
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
        } else {
          await runFfmpeg(ffmpegBin, [
            '-y',
            '-loop',
            '1',
            '-framerate',
            '24',
            '-i',
            stepPngPaths[0],
            '-i',
            audPath,
            '-vf',
            `fade=t=in:st=0:d=0.35:color=${bgHex},fade=t=out:st=${fadeOutStart}:d=0.35:color=${bgHex}`,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-r',
            '24',
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
        }
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
