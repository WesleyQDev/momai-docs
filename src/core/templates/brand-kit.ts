import { randomUUID } from 'node:crypto'
import { strFromU8, unzipSync } from 'fflate'
import { extractText as extractPdfText } from 'unpdf'
import type { BrandKit, HostBridge } from '../types.ts'
import { analyzeLetterheadFile, type LetterheadAnalysis } from '../engines/letterhead-engine.ts'
import { DOCS_LOCALES, normalizeLocale, type DocsLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

export function createDefaultBrandKit(projectId: string, institutionName = '', locale?: DocsLocale): BrandKit {
  return {
    id: `brand-${randomUUID().slice(0, 8)}`,
    projectId,
    name: translateCore(normalizeLocale(locale), 'Kit de Marca Padrão'),
    institutionName,
    department: '',
    footerText: '',
    signatureName: '',
    signatureRole: '',
    primaryColor: '',
    secondaryColor: '',
    accentColor: '',
    headingFont: '',
    bodyFont: '',
    updatedAt: Date.now()
  }
}

export async function getBrandKitForProject(
  bridge: HostBridge,
  projectId: string,
  locale?: DocsLocale
): Promise<BrandKit | null> {
  const rows = (await bridge.collections.list('brand_kits', {
    where: { projectId },
    limit: 1
  })) as BrandKit[]
  const kit = rows[0] || null
  if (!kit) return null
  const resolvedLocale = normalizeLocale(locale)
  const isDefaultName = DOCS_LOCALES.some((item) => translateCore(item, 'Kit de Marca Padrão') === kit.name)
  return isDefaultName ? { ...kit, name: translateCore(resolvedLocale, 'Kit de Marca Padrão') } : kit
}

export async function saveBrandKit(bridge: HostBridge, kit: BrandKit): Promise<BrandKit> {
  const updated: BrandKit = {
    ...kit,
    id: kit.id || `brand-${randomUUID().slice(0, 8)}`,
    updatedAt: Date.now()
  }
  await bridge.collections.upsert('brand_kits', updated as unknown as Record<string, unknown>)
  return updated
}

export interface ExtractedBrandResult {
  brandKit: BrandKit
  analysis: LetterheadAnalysis | null
}

function decodeBasicXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function extractParagraphLinesFromWordXml(xml: string): string[] {
  const lines: string[] = []
  for (const para of xml.split(/<\/w:p>/i)) {
    const text = (para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
      .map((tag) => decodeBasicXmlEntities(tag.replace(/<[^>]+>/g, '')))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) lines.push(text)
  }
  return lines
}

function normalizeHexColor(raw: string): string {
  const clean = raw.trim().replace(/^#/, '').toUpperCase()
  if (!/^[0-9A-F]{6}$/.test(clean)) return ''
  if (clean === '000000' || clean === 'FFFFFF') return ''
  return `#${clean}`
}

function extractDocxLogoDataUrl(files: Record<string, Uint8Array>): string {
  const headerRelKeys = Object.keys(files)
    .filter((k) => /^word\/_rels\/header\d*\.xml\.rels$/i.test(k))
    .sort()

  const candidatePaths: string[] = []
  for (const relKey of headerRelKeys) {
    const relXml = strFromU8(files[relKey])
    for (const m of relXml.matchAll(/Target=["']([^"']+)["']/gi)) {
      const target = m[1].replace(/^\/+/, '')
      const full = target.startsWith('word/') ? target : `word/${target.replace(/^\.\.\//, '')}`
      if (/\.(png|jpe?g|webp)$/i.test(full)) {
        candidatePaths.push(full)
      }
    }
  }

  for (const key of Object.keys(files).sort()) {
    if (/^word\/media\/.+\.(png|jpe?g|webp)$/i.test(key) && !candidatePaths.includes(key)) {
      candidatePaths.push(key)
    }
  }

  for (const mediaPath of candidatePaths) {
    const bytes = files[mediaPath]
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > 750 * 1024) continue
    const ext = (mediaPath.split('.').pop() || 'png').toLowerCase()
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
  }

  return ''
}

function extractDocxVisualTokens(files: Record<string, Uint8Array>): {
  primaryColor: string
  accentColor: string
  headingFont: string
  bodyFont: string
} {
  let primaryColor = ''
  let accentColor = ''
  let headingFont = ''
  let bodyFont = ''

  const themeXml = files['word/theme/theme1.xml'] ? strFromU8(files['word/theme/theme1.xml']) : ''
  if (themeXml) {
    const dk2 = /<a:dk2>[\s\S]*?<a:srgbClr\s+val=["']([0-9A-Fa-f]{6})["']/i.exec(themeXml)
    const accent1 = /<a:accent1>[\s\S]*?<a:srgbClr\s+val=["']([0-9A-Fa-f]{6})["']/i.exec(themeXml)
    if (dk2) primaryColor = normalizeHexColor(dk2[1])
    if (accent1) accentColor = normalizeHexColor(accent1[1])

    const majorFont = /<a:majorFont>[\s\S]*?<a:latin\s+typeface=["']([^"']+)["']/i.exec(themeXml)
    const minorFont = /<a:minorFont>[\s\S]*?<a:latin\s+typeface=["']([^"']+)["']/i.exec(themeXml)
    if (majorFont?.[1]) headingFont = majorFont[1].trim()
    if (minorFont?.[1]) bodyFont = minorFont[1].trim()
  }

  if (!primaryColor || !accentColor) {
    const fallbackSources = [files['word/header1.xml'], files['word/styles.xml'], files['word/document.xml']]
    for (const raw of fallbackSources) {
      if (!raw) continue
      const xml = strFromU8(raw)
      for (const m of xml.matchAll(/w:color\s+w:val=["']([0-9A-Fa-f]{6})["']/gi)) {
        const hex = normalizeHexColor(m[1])
        if (!hex) continue
        if (!primaryColor) {
          primaryColor = hex
        } else if (!accentColor && hex !== primaryColor) {
          accentColor = hex
          break
        }
      }
      if (primaryColor && accentColor) break
    }
  }

  return {
    primaryColor,
    accentColor: accentColor || primaryColor,
    headingFont,
    bodyFont
  }
}

/**
 * Extracts institution name, header/footer text, logo, palette and letterhead
 * metadata from an uploaded DOCX or PDF document to populate a BrandKit.
 */
export async function extractBrandKitFromDocument(opts: {
  projectId: string
  fileName: string
  buffer: Buffer
  existing?: BrandKit | null
  locale?: DocsLocale
}): Promise<ExtractedBrandResult> {
  const base = opts.existing
    ? { ...opts.existing, projectId: opts.projectId }
    : createDefaultBrandKit(opts.projectId, '', opts.locale)

  const ext = (opts.fileName.split('.').pop() || '').toLowerCase()

  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
    const dataUrl = `data:${mime};base64,${opts.buffer.toString('base64')}`
    return {
      brandKit: {
        ...base,
        logoDataUrl: dataUrl,
        headerLogoDataUrl: dataUrl,
        logoInHeader: true,
        logoPlacement: 'header',
        updatedAt: Date.now()
      },
      analysis: null
    }
  }

  let analysis: LetterheadAnalysis | null = null
  try {
    analysis = await analyzeLetterheadFile(opts.fileName, opts.buffer)
  } catch {
    analysis = null
  }

  if (ext === 'pdf') {
    let institutionName = base.institutionName
    let headerText = base.headerText || ''
    let footerText = base.footerText || ''

    try {
      const pdfRes = await extractPdfText(new Uint8Array(opts.buffer), { mergePages: false })
      const firstPage = Array.isArray(pdfRes.text) ? String(pdfRes.text[0] || '') : String(pdfRes.text || '')
      const lines = firstPage
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line.length > 1)

      if (lines.length > 0) {
        const topLines = lines.slice(0, 2).filter((line) => line.length <= 90)
        if (topLines.length > 0) {
          institutionName = topLines[0]
          headerText = topLines.join(' · ')
        }
        if (lines.length >= 4) {
          const lastLine = lines[lines.length - 1]
          if (lastLine.length <= 120 && !topLines.includes(lastLine)) {
            footerText = lastLine
          }
        }
      }
    } catch {
      // Keep existing values if PDF text extraction fails (e.g. scanned image PDF)
    }

    return {
      brandKit: {
        ...base,
        name: institutionName || base.name,
        institutionName,
        headerText,
        footerText,
        updatedAt: Date.now()
      },
      analysis
    }
  }

  // DOCX extraction
  const files = unzipSync(new Uint8Array(opts.buffer))
  const headerKeys = Object.keys(files).filter((k) => /^word\/header\d*\.xml$/i.test(k)).sort()
  const footerKeys = Object.keys(files).filter((k) => /^word\/footer\d*\.xml$/i.test(k)).sort()

  const headerLines = headerKeys.flatMap((k) => extractParagraphLinesFromWordXml(strFromU8(files[k])))
  const footerLines = footerKeys.flatMap((k) => extractParagraphLinesFromWordXml(strFromU8(files[k])))
  const docLines = files['word/document.xml']
    ? extractParagraphLinesFromWordXml(strFromU8(files['word/document.xml'])).slice(0, 5)
    : []

  const headerText = headerLines.join(' · ').slice(0, 220)
  const footerText = footerLines.join(' · ').slice(0, 220)
  const institutionName =
    headerLines[0] ||
    docLines.find((line) => line.length >= 3 && line.length <= 80 && !/\{\{|____/.test(line)) ||
    base.institutionName

  const logoDataUrl = extractDocxLogoDataUrl(files) || base.headerLogoDataUrl || base.logoDataUrl || ''
  const tokens = extractDocxVisualTokens(files)

  return {
    brandKit: {
      ...base,
      name: institutionName || base.name,
      institutionName,
      headerText: headerText || base.headerText || '',
      footerText: footerText || base.footerText || '',
      logoDataUrl: logoDataUrl || undefined,
      headerLogoDataUrl: logoDataUrl || undefined,
      logoInHeader: logoDataUrl ? true : base.logoInHeader,
      logoPlacement: logoDataUrl ? 'header' : base.logoPlacement,
      primaryColor: tokens.primaryColor || base.primaryColor,
      accentColor: tokens.accentColor || base.accentColor,
      headingFont: tokens.headingFont || base.headingFont,
      bodyFont: tokens.bodyFont || base.bodyFont,
      updatedAt: Date.now()
    },
    analysis
  }
}
