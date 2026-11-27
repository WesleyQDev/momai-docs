import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { extractText as extractPdfText } from 'unpdf'
import type { BrandKit, DesignTokens, TemplateManifest, ToolId } from '../types.ts'
import type { DocumentImageAttachment, RenderedBlock } from './docx-pdf-engine.ts'
import { normalizeLocale } from '../i18n.ts'
import { translateCore } from '../translate.ts'

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function resolveChromiumBinary(): string {
  const envCandidates = [process.env.CHROME_PATH, process.env.EDGE_PATH, process.env.CHROMIUM_PATH].filter(Boolean) as string[]
  const platformCandidates =
    process.platform === 'win32'
      ? [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : ''
      ]
      : process.platform === 'darwin'
        ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ]
        : [
          '/usr/bin/google-chrome',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/microsoft-edge'
        ]

  for (const candidate of [...envCandidates, ...platformCandidates]) {
    if (!candidate) continue
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch { }
  }
  throw new Error('No Chromium/Edge browser found to render HTML/CSS PDF.')
}

export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const bin = resolveChromiumBinary()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momai-docs-pdf-'))
  const htmlPath = path.join(tmpDir, `doc-${randomUUID().slice(0, 8)}.html`)
  const pdfPath = path.join(tmpDir, `doc-${randomUUID().slice(0, 8)}.pdf`)
  const userDataDir = path.join(tmpDir, 'profile')

  try {
    fs.writeFileSync(htmlPath, html, 'utf8')
    const fileUrl = pathToFileURL(htmlPath).href
    const runChromium = (headlessMode: string) =>
      new Promise<void>((resolve, reject) => {
        const args = [
          headlessMode,
          '--disable-gpu',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-extensions',
          `--user-data-dir=${userDataDir}-${headlessMode.includes('old') ? 'old' : 'new'}`,
          '--print-to-pdf-no-header',
          '--no-pdf-header-footer',
          `--print-to-pdf=${pdfPath}`,
          fileUrl
        ]
        const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
        let stderr = ''
        child.stderr?.on('data', (d) => {
          stderr += String(d)
        })
        const timer = setTimeout(() => {
          try {
            child.kill()
          } catch { }
          reject(new Error('Timed out while rendering PDF with headless Chromium.'))
        }, 30_000)

        child.on('error', (err) => {
          clearTimeout(timer)
          reject(err)
        })
        child.on('close', async (code) => {
          clearTimeout(timer)
          if (code === 0 && !fs.existsSync(pdfPath)) {
            await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000))
          }
          if (code === 0 && fs.existsSync(pdfPath)) {
            resolve()
          } else {
            reject(new Error(`Failed to generate PDF with Chromium (code=${code}): ${stderr.slice(0, 300)}`))
          }
        })
      })

    try {
      await runChromium('--headless=new')
    } catch (err) {
      // Some managed Edge builds exit successfully in new headless mode without writing the PDF.
      if (!(err instanceof Error) || !err.message.includes('code=0')) throw err
      await runChromium('--headless=old')
    }
    return fs.readFileSync(pdfPath)
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch { }
  }
}

function buildInlineSvgIcon(kind: 'target' | 'spark' | 'info' | 'check' | 'alert' | 'search', color: string): string {
  if (kind === 'target') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="${color}"/></svg>`
  }
  if (kind === 'spark') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.4 1 2.3h6c0-.9.3-1.7 1-2.3A7 7 0 0 0 12 2z"/></svg>`
  }
  if (kind === 'alert') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  }
  if (kind === 'search') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
  }
  if (kind === 'check') {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
  }
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
}

function renderParagraphLines(text: string): string {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function normalizeSearchText(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function renderHtmlWithPaginatedToc(opts: {
  toolId: ToolId
  template: TemplateManifest
  tokens: DesignTokens
  blocks: RenderedBlock[]
  data: Record<string, any>
  brandKit?: BrandKit | null
  attachments?: DocumentImageAttachment[]
  locale?: string
}): Promise<Buffer> {
  const pass1Html = buildDocumentHtml(opts)
  const pass1Buf = await renderHtmlToPdfBuffer(pass1Html)
  const tocBlock = opts.blocks.find((b) => b.kind === 'toc')
  if (!tocBlock || !tocBlock.tocEntries?.length) return pass1Buf

  try {
    const extracted = await extractPdfText(new Uint8Array(pass1Buf), { mergePages: false })
    const pages = Array.isArray(extracted.text) ? extracted.text : []
    if (pages.length <= 2) return pass1Buf

    const pageNumbers: Record<string, number> = {}
    const normalizedPages = pages.map((p) => normalizeSearchText(p))
    const tocPageIdx = normalizedPages.findIndex((p, idx) => idx > 0 && p.includes(normalizeSearchText(translateCore(normalizeLocale(opts.locale), 'Sumário'))))
    const searchStartIdx = tocPageIdx >= 0 ? tocPageIdx + 1 : 2
    let lastFoundIdx = searchStartIdx

    for (const entry of tocBlock.tocEntries) {
      const needle = normalizeSearchText(entry.label)
      if (!needle) continue
      const isClosingEntry = /^(answer_key|conclusion|glossary|references)$/.test(entry.key)
      const startIdx = isClosingEntry ? Math.max(searchStartIdx, lastFoundIdx) : searchStartIdx
      for (let pIdx = startIdx; pIdx < normalizedPages.length; pIdx++) {
        // Match standalone heading line or exact phrase after the previous section
        const lines = pages[pIdx].split(/\r?\n/).map((l) => normalizeSearchText(l))
        if (lines.some((l) => l === needle || (l.startsWith(needle) && l.length <= needle.length + 12))) {
          pageNumbers[entry.key] = pIdx + 1
          lastFoundIdx = pIdx
          break
        }
      }
      if (!pageNumbers[entry.key]) {
        for (let pIdx = startIdx; pIdx < normalizedPages.length; pIdx++) {
          if (normalizedPages[pIdx].includes(needle)) {
            pageNumbers[entry.key] = pIdx + 1
            lastFoundIdx = pIdx
            break
          }
        }
      }
    }
    if (Object.keys(pageNumbers).length === 0) return pass1Buf
    const pass2Html = buildDocumentHtml({ ...opts, tocPageNumbers: pageNumbers })
    return await renderHtmlToPdfBuffer(pass2Html)
  } catch {
    return pass1Buf
  }
}

export function buildDocumentHtml(opts: {
  toolId: ToolId
  template: TemplateManifest
  tokens: DesignTokens
  blocks: RenderedBlock[]
  data: Record<string, any>
  brandKit?: BrandKit | null
  attachments?: DocumentImageAttachment[]
  locale?: string
  tocPageNumbers?: Record<string, number>
}): string {
  const locale = normalizeLocale(opts.locale)
  const tr = (text: string, vars?: Record<string, string | number>) => translateCore(locale, text, vars)
  const isAbnt = opts.toolId === 'abnt'
  const isApostila = opts.toolId === 'apostila'
  const preset = opts.template.layoutPreset || 'classic'

  const forceSerifBody = isAbnt || preset === 'editorial' || preset === 'academic' || isApostila
  const headingFont =
    isAbnt || preset === 'editorial' || preset === 'academic'
      ? `'Georgia', 'Cambria', 'Times New Roman', serif`
      : `'Plus Jakarta Sans', 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif`
  const bodyFont = forceSerifBody
    ? `'Georgia', 'Cambria', 'Times New Roman', serif`
    : `'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif`
  const uiFont = `'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif`

  const headerLogoDataUrl = opts.brandKit?.headerLogoDataUrl || opts.brandKit?.logoDataUrl || ''
  const showLogoInHeader =
    Boolean(headerLogoDataUrl) &&
    (opts.brandKit?.logoInHeader !== undefined
      ? Boolean(opts.brandKit.logoInHeader)
      : opts.brandKit?.headerLogoDataUrl
        ? true
        : (opts.brandKit?.logoPlacement || 'header') !== 'footer')
  const isResume = opts.toolId === 'resume'
  const isOficio = opts.toolId === 'oficio'
  const suppressRunningHeader = isAbnt || isResume || isOficio
  const explicitHeader = opts.brandKit?.headerText || ''
  const headerText = suppressRunningHeader ? '' : explicitHeader
  const footerText = opts.brandKit?.footerText || ''

  const pageMargins = isAbnt ? '30mm 20mm 20mm 30mm' : '19mm 17mm 19mm 17mm'
  const runningLeft = escapeHtml(headerText)
  const runningRight: string = ''
  const runningFooterLeft = escapeHtml(footerText)

  const validAttachments = (opts.attachments || []).filter((att) =>
    /^data:image\/(png|jpe?g|webp);base64,/i.test(att.base64 || '')
  )

  const bodyParts: string[] = []
  let insideCover = false
  let inExercises = false

  for (let i = 0; i < opts.blocks.length; i++) {
    const b = opts.blocks[i]

    if (b.kind === 'page_break') {
      if (insideCover) {
        insideCover = false
        continue
      }
      bodyParts.push(`<div class="page-break"></div>`)
      continue
    }

    if (b.kind === 'cover') {
      insideCover = true
      const initials = (b.institution || b.text || 'MD')
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('') || 'MD'

      const logoHtml =
        showLogoInHeader && headerLogoDataUrl
          ? `<div class="cover-logo-wrap"><img src="${escapeHtml(headerLogoDataUrl)}" alt="Logo" /></div>`
          : `<div class="cover-emblem">${escapeHtml(initials)}</div>`

      const badgeText = b.badgeLabel || (isApostila ? tr('Apostila Didática') : '')

      const studentFieldsHtml =
        Array.isArray(b.studentFields) && b.studentFields.length > 0
          ? `<div class="student-card">
               <div class="student-card-title">${escapeHtml(tr('Identificação do Estudante'))}</div>
               <div class="student-grid">
                 ${b.studentFields
            .slice(0, 4)
            .map(
              (f) => `<div class="student-field">
                               <span class="student-label">${escapeHtml(f)}</span>
                               <span class="student-line"></span>
                             </div>`
            )
            .join('')}
               </div>
             </div>`
          : ''

      const isLeftAlignedCover = preset === 'modern' || preset === 'executive' || preset === 'editorial'
      bodyParts.push(`
        <section class="cover preset-${escapeHtml(preset)} ${isLeftAlignedCover ? 'cover-left' : 'cover-center'}">
          <div class="cover-decor"></div>
          <div class="cover-inner">
            <div class="cover-top-row">
              ${logoHtml}
              <div class="cover-top-meta">
                ${b.institution ? `<div class="cover-institution">${escapeHtml(b.institution)}</div>` : ''}
                ${badgeText ? `<div class="cover-badge">${escapeHtml(badgeText)}</div>` : ''}
              </div>
            </div>
            <div class="cover-hero">
              <h1 class="cover-title">${escapeHtml(b.text || '')}</h1>
              <div class="cover-rule"></div>
              ${b.subtitle ? `<p class="cover-subtitle">${escapeHtml(b.subtitle)}</p>` : ''}
              ${b.coverIllustrationPng
          ? `<div class="cover-illustration"><img src="${escapeHtml(b.coverIllustrationPng)}" alt="" /></div>`
          : ''
        }
            </div>
            <div class="cover-bottom">
              ${studentFieldsHtml}
              ${b.institution
          ? `<div class="cover-footer-note">${escapeHtml(b.institution)}</div>`
          : ''
        }
            </div>
          </div>
        </section>
      `)
      continue
    }

    if (b.kind === 'presentation_page') {
      const roadmapItems = Array.isArray(b.tocEntries) ? b.tocEntries : []
      bodyParts.push(`
        <section class="presentation-section">
          <h2 class="section-display-title">${escapeHtml(tr('Apresentação'))}</h2>
          <div class="accent-bar"></div>
          <div class="presentation-lead">${renderParagraphLines(b.text || '')}</div>
          ${roadmapItems.length > 0
          ? `<div class="cover-roadmap" style="margin-top: 22pt;">
                   <div class="cover-roadmap-title">${escapeHtml(tr('Nesta edição'))}</div>
                   <div class="cover-roadmap-grid">
                     ${roadmapItems
            .map(
              (item) => `<div class="cover-roadmap-item">
                           <span class="roadmap-num">${escapeHtml(item.badge)}</span>
                           <span class="roadmap-text">${escapeHtml(item.label)}</span>
                         </div>`
            )
            .join('')}
                   </div>
                 </div>`
          : ''
        }
        </section>
      `)
      continue
    }

    if (b.kind === 'toc') {
      const entries =
        b.tocEntries && b.tocEntries.length > 0
          ? b.tocEntries
          : (b.tocItems || []).map((t, idx) => ({ key: `item-${idx}`, badge: String(idx + 1).padStart(2, '0'), label: t }))
      bodyParts.push(`
        <section class="toc-section">
          <h2 class="section-display-title">${escapeHtml(b.text || tr('Sumário'))}</h2>
          <div class="accent-bar"></div>
          <div class="toc-list">
            ${entries
          .map((e) => {
            const pNum = opts.tocPageNumbers?.[e.key]
            const pLabel = pNum ? String(pNum).padStart(2, '0') : ''
            return `<a class="toc-row" href="#${escapeHtml(e.key)}">
                  <span class="toc-badge">${escapeHtml(e.badge)}</span>
                  <span class="toc-label">${escapeHtml(e.label)}</span>
                  <span class="toc-dots"></span>
                  ${pLabel ? `<span class="toc-page">${escapeHtml(pLabel)}</span>` : ''}
                </a>`
          })
          .join('')}
          </div>
        </section>
      `)
      continue
    }

    if (b.kind === 'chapter_heading') {
      inExercises = false
      const modLabel = b.moduleNumber ? `${tr('MÓDULO')} ${String(b.moduleNumber).padStart(2, '0')}` : ''
      const isBannerPreset = preset === 'whiteboard' || preset === 'playful' || preset === 'executive'
      bodyParts.push(`
        <header ${b.tocKey ? `id="${escapeHtml(b.tocKey)}"` : ''} class="chapter-header ${isBannerPreset ? 'chapter-banner' : 'chapter-clean'}">
          ${modLabel ? `<div class="chapter-kicker">${escapeHtml(modLabel)}</div>` : ''}
          <h2 class="chapter-title">${escapeHtml(b.text || '')}</h2>
          ${!isBannerPreset ? `<div class="chapter-rule"><span></span></div>` : ''}
        </header>
      `)
      continue
    }

    if (b.kind === 'title') {
      inExercises = false
      bodyParts.push(`<h1 class="doc-title ${isAbnt ? 'text-center' : ''}">${escapeHtml(b.text || '')}</h1>`)
      continue
    }

    if (b.kind === 'subtitle') {
      bodyParts.push(`<p class="doc-subtitle ${isAbnt ? 'text-center' : ''}">${escapeHtml(b.text || '')}</p>`)
      continue
    }

    if (b.kind === 'heading') {
      const hText = String(b.text || '')
      inExercises = /exerc[ií]cio|fixa[çc][aã]o|quest[õo]es/i.test(hText)
      bodyParts.push(`<h3 ${b.tocKey ? `id="${escapeHtml(b.tocKey)}"` : ''} class="doc-heading">${escapeHtml(hText)}</h3>`)
      continue
    }

    if (b.kind === 'exercise') {
      const qNum = b.exerciseNumber ? String(b.exerciseNumber).padStart(2, '0') : '•'
      const optsHtml =
        Array.isArray(b.options) && b.options.length > 0
          ? `<ul class="exercise-options">${b.options.map((opt) => `<li>${escapeHtml(opt)}</li>`).join('')}</ul>`
          : ''
      bodyParts.push(`
        <div class="exercise-card">
          <div class="exercise-item">
            <span class="exercise-num">${escapeHtml(qNum)}</span>
            <div class="exercise-text">${escapeHtml(b.text || '')}</div>
          </div>
          ${optsHtml}
        </div>
      `)
      continue
    }

    if (b.kind === 'paragraph') {
      if (!b.text?.trim()) continue
      bodyParts.push(`<div class="doc-paragraph ${isAbnt ? 'abnt-para' : ''}">${renderParagraphLines(b.text)}</div>`)
      continue
    }

    if (b.kind === 'quote') {
      bodyParts.push(`<blockquote class="doc-quote">${escapeHtml(b.text || '')}</blockquote>`)
      continue
    }

    if (b.kind === 'bullet') {
      if (inExercises) {
        const rawQ = String(b.text || '')
        const numMatch = rawQ.match(/^(\d+)[\.\)]\s*([\s\S]+)$/)
        const qNum = numMatch ? numMatch[1].padStart(2, '0') : '•'
        const qBody = numMatch ? numMatch[2] : rawQ
        bodyParts.push(`
          <div class="exercise-item">
            <span class="exercise-num">${escapeHtml(qNum)}</span>
            <div class="exercise-text">${escapeHtml(qBody)}</div>
          </div>
        `)
        continue
      }
      const items: string[] = [b.text || '']
      while (i + 1 < opts.blocks.length && opts.blocks[i + 1].kind === 'bullet') {
        i++
        items.push(opts.blocks[i].text || '')
      }
      bodyParts.push(`<ul class="doc-list">${items.map((it) => `<li>${escapeHtml(it)}</li>`).join('')}</ul>`)
      continue
    }

    if (b.kind === 'callout') {
      const raw = String(b.text || '').trim()
      if (!raw) continue
      const lines = raw.split('\n')
      const firstLine = lines[0]?.trim() || ''
      const hasHeader = firstLine.endsWith(':') || firstLine.length <= 42
      const isObjectives = /objetivo/i.test(firstLine)
      const isExample = /exemplo/i.test(firstLine)
      const bodyText = hasHeader ? lines.slice(1).join('\n').trim() : raw

      if (isObjectives) {
        const objItems = bodyText
          .split('\n')
          .map((l) => l.replace(/^[-•*]\s*/, '').trim())
          .filter(Boolean)
        bodyParts.push(`
          <aside class="objectives-strip">
            <div class="objectives-head">${buildInlineSvgIcon('target', opts.tokens.primary)}<span>${escapeHtml(firstLine.replace(/:$/, ''))}</span></div>
            <ul class="objectives-list">
              ${objItems.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}
            </ul>
          </aside>
        `)
        continue
      }

      if (isExample) {
        bodyParts.push(`
          <aside class="example-box">
            <div class="example-tag">${buildInlineSvgIcon('spark', opts.tokens.accent)}<span>${escapeHtml(firstLine.replace(/:$/, ''))}</span></div>
            <div class="example-body">${renderParagraphLines(bodyText)}</div>
          </aside>
        `)
        continue
      }

      const isAlert = /aten[çc][aã]o|cuidado|regra|prazo|alerta|warning/i.test(firstLine)
      const isLearnMore = /saiba mais|leia mais|dica|curiosidade|explore/i.test(firstLine)
      const calloutIcon = isAlert ? 'alert' : isLearnMore ? 'search' : 'info'
      const calloutCls = isAlert ? 'callout callout-alert' : isLearnMore ? 'callout callout-learnmore' : 'callout'
      const iconColor = isAlert ? opts.tokens.accent : opts.tokens.primary

      bodyParts.push(`
        <aside class="${calloutCls}">
          ${hasHeader ? `<div class="callout-head">${buildInlineSvgIcon(calloutIcon, iconColor)}<span>${escapeHtml(firstLine)}</span></div>` : ''}
          ${bodyText ? `<div class="callout-body">${renderParagraphLines(bodyText)}</div>` : ''}
        </aside>
      `)
      continue
    }

    if (b.kind === 'answer') {
      const cleanAns = String(b.text || '').replace(/^gabarito\s*:\s*/i, '')
      const ansTag = b.exerciseNumber
        ? `${escapeHtml(tr('Gabarito:').replace(/:$/, ''))} ${String(b.exerciseNumber).padStart(2, '0')}`
        : escapeHtml(tr('Gabarito:').replace(/:$/, ''))
      bodyParts.push(`
        <div class="answer-box">
          <span class="answer-tag">${ansTag}</span>
          <span class="answer-text">${escapeHtml(cleanAns)}</span>
        </div>
      `)
      continue
    }

    if (b.kind === 'glossary_item') {
      bodyParts.push(`
        <div class="glossary-item">
          <span class="glossary-term">${escapeHtml(b.term || '')}</span>
          <span class="glossary-def">${escapeHtml(b.text || '')}</span>
        </div>
      `)
      continue
    }

    if (b.kind === 'kpi_grid' && Array.isArray(b.kpis)) {
      bodyParts.push(`
        <div class="kpi-grid">
          ${b.kpis
          .map(
            (k) => `<div class="kpi-card">
                <div class="kpi-label">${escapeHtml(k.label)}</div>
                <div class="kpi-value">${escapeHtml(k.value)}</div>
                ${k.trend ? `<div class="kpi-trend">${escapeHtml(k.trend)}</div>` : ''}
              </div>`
          )
          .join('')}
        </div>
      `)
      continue
    }

    if (b.kind === 'table' && b.headers && b.rows) {
      bodyParts.push(`
        <div class="table-wrap">
          ${b.caption ? `<div class="table-caption">${escapeHtml(b.caption)}</div>` : ''}
          <table class="doc-table">
            <thead>
              <tr>${b.headers.map((h) => `<th>${escapeHtml(String(h ?? ''))}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${b.rows
          .map(
            (r) =>
              `<tr>${b.headers!.map((_, cIdx) => `<td>${escapeHtml(String(r[cIdx] ?? ''))}</td>`).join('')}</tr>`
          )
          .join('')}
            </tbody>
          </table>
          ${b.chartPngDataUrl
          ? `<figure class="visual-graphic"><img src="${escapeHtml(b.chartPngDataUrl)}" alt="${escapeHtml(tr('Gráfico'))}" />${b.figureCaption ? `<figcaption class="figure-caption">${escapeHtml(b.figureCaption)}</figcaption>` : ''
          }</figure>`
          : ''
        }
        </div>
      `)
      continue
    }

    if (b.kind === 'comparison') {
      bodyParts.push(`
        <div class="comparison-grid">
          <div class="comparison-card">
            ${b.leftTitle ? `<div class="comparison-title">${escapeHtml(b.leftTitle)}</div>` : ''}
            <ul>${(b.leftItems || []).map((it) => `<li>${escapeHtml(it)}</li>`).join('')}</ul>
          </div>
          <div class="comparison-card">
            ${b.rightTitle ? `<div class="comparison-title">${escapeHtml(b.rightTitle)}</div>` : ''}
            <ul>${(b.rightItems || []).map((it) => `<li>${escapeHtml(it)}</li>`).join('')}</ul>
          </div>
        </div>
      `)
      continue
    }

    if (b.kind === 'concept_map' && b.diagramPngDataUrl) {
      bodyParts.push(`
        <figure class="visual-graphic">
          <img src="${escapeHtml(b.diagramPngDataUrl)}" alt="${escapeHtml(tr('Mapa conceitual'))}" />
          ${b.figureCaption ? `<figcaption class="figure-caption">${escapeHtml(b.figureCaption)}</figcaption>` : ''}
        </figure>
      `)
      continue
    }

    if (b.kind === 'timeline' && Array.isArray(b.timelineItems)) {
      const stripNum = (s: string) => String(s || '').replace(/^\d+[\.\)]\s*/, '').trim()
      if (b.diagramPngDataUrl) {
        bodyParts.push(`
          <figure class="visual-graphic">
            <img src="${escapeHtml(b.diagramPngDataUrl)}" alt="${escapeHtml(tr('Diagrama'))}" />
            ${b.figureCaption ? `<figcaption class="figure-caption">${escapeHtml(b.figureCaption)}</figcaption>` : ''}
          </figure>
          <div class="timeline-notes">
            ${b.timelineItems
            .filter((it) => Boolean(it.detail))
            .map(
              (it, idx) => `<div class="timeline-note-row">
                  <span class="timeline-note-idx">${idx + 1}.</span>
                  <span><strong>${escapeHtml(stripNum(it.step))}:</strong> ${escapeHtml(it.detail)}</span>
                </div>`
            )
            .join('')}
          </div>
        `)
        continue
      }
      bodyParts.push(`
        <div class="timeline">
          ${b.timelineItems
          .map(
            (it, idx) => `<div class="timeline-item">
                <div class="timeline-marker">${idx + 1}</div>
                <div class="timeline-content">
                  <div class="timeline-step">${escapeHtml(stripNum(it.step))}</div>
                  ${it.detail ? `<div class="timeline-detail">${escapeHtml(it.detail)}</div>` : ''}
                </div>
              </div>`
          )
          .join('')}
        </div>
      `)
      continue
    }

    if (b.kind === 'checklist' && Array.isArray(b.checklistItems)) {
      bodyParts.push(`
        <div class="checklist-card">
          ${b.checklistTitle ? `<div class="checklist-title">${escapeHtml(b.checklistTitle)}</div>` : ''}
          <ul class="checklist-items">
            ${b.checklistItems
          .map(
            (it) => `<li><span class="chk-box">${buildInlineSvgIcon('check', opts.tokens.accent)}</span><span>${escapeHtml(it)}</span></li>`
          )
          .join('')}
          </ul>
        </div>
      `)
      continue
    }
  }

  if (validAttachments.length > 0) {
    bodyParts.push(`<h3 class="doc-heading">${escapeHtml(tr('Anexos'))}</h3>`)
    for (const att of validAttachments) {
      bodyParts.push(`
        <figure class="attachment-fig">
          <img src="${escapeHtml(att.base64)}" alt="${escapeHtml(att.caption || att.name)}" />
          <figcaption>${escapeHtml(att.caption || att.name)}</figcaption>
        </figure>
      `)
    }
  }

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8" />
<style>
  :root {
    --primary: ${opts.tokens.primary};
    --secondary: ${opts.tokens.secondary};
    --accent: ${opts.tokens.accent};
    --surface: ${opts.tokens.surface};
    --surface-alt: ${opts.tokens.surfaceAlt};
    --text: ${opts.tokens.textPrimary === '#0F172A' ? '#1E293B' : opts.tokens.textPrimary};
    --muted: ${opts.tokens.textMuted};
    --border: ${opts.tokens.border};
    --font-heading: ${headingFont};
    --font-body: ${bodyFont};
    --font-ui: ${uiFont};
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @page {
    size: A4 portrait;
    margin: ${pageMargins};
    @top-left {
      content: "${runningLeft ? runningLeft.replace(/"/g, '\\"') : ''}";
      font-family: var(--font-ui);
      font-size: 7.5pt;
      color: var(--muted);
      ${runningLeft || runningRight ? 'border-bottom: 0.5pt solid var(--border); padding-bottom: 4pt; margin-bottom: 6pt;' : 'border: none;'}
    }
    @top-center {
      content: "";
      border: none;
    }
    @top-right {
      content: "${runningRight ? runningRight.replace(/"/g, '\\"') : ''}";
      font-family: var(--font-ui);
      font-size: 7.5pt;
      font-weight: 600;
      color: var(--accent);
      ${runningLeft || runningRight ? 'border-bottom: 0.5pt solid var(--border); padding-bottom: 4pt; margin-bottom: 6pt;' : 'border: none;'}
    }
    @bottom-left {
      content: "${runningFooterLeft ? runningFooterLeft.replace(/"/g, '\\"') : ''}";
      font-family: var(--font-ui);
      font-size: 7.5pt;
      color: var(--muted);
      ${runningFooterLeft ? 'border-top: 0.5pt solid var(--border); padding-top: 4pt;' : 'border: none;'}
    }
    @bottom-center {
      content: "";
      border: none;
    }
    @bottom-right {
      content: ${isResume ? '""' : `"${escapeHtml(tr('Pág.'))} " counter(page) " / " counter(pages)`};
      font-family: var(--font-ui);
      font-size: 7.5pt;
      font-weight: 600;
      color: var(--muted);
      ${runningFooterLeft ? 'border-top: 0.5pt solid var(--border); padding-top: 4pt;' : 'border: none;'}
    }
  }
  ${isApostila
      ? `@page :first {
           margin: 0;
           @top-left { content: ""; border: none; }
           @top-center { content: ""; border: none; }
           @top-right { content: ""; border: none; }
           @bottom-left { content: ""; border: none; }
           @bottom-center { content: ""; border: none; }
           @bottom-right { content: ""; border: none; }
         }`
      : `@page :first {
           @top-left { content: ""; border: none; }
           @top-center { content: ""; border: none; }
           @top-right { content: ""; border: none; }
           ${isResume || isOficio ? '@bottom-left { content: ""; border: none; } @bottom-center { content: ""; border: none; } @bottom-right { content: ""; border: none; }' : ''}
         }`
    }
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 10.2pt;
    line-height: ${isAbnt ? '1.55' : '1.56'};
  }
  p {
    orphans: 3;
    widows: 3;
  }
  .page-break {
    break-before: page;
    page-break-before: always;
    height: 0;
  }
  .text-center { text-align: center; }

  /* Cover */
  .cover {
    position: relative;
    width: 100%;
    height: 296.5mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    break-after: page;
    page-break-after: always;
    background: #FFFFFF;
    font-family: var(--font-ui);
  }
  .cover-inner {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    padding: 20mm 20mm 16mm 22mm;
  }
  .cover .cover-decor {
    display: none;
  }
  .cover.preset-minimal .cover-inner {
    padding-top: 24mm;
  }
  .cover-top-row {
    display: flex;
    align-items: center;
    gap: 12pt;
    padding-bottom: 10pt;
    border-bottom: 0.7pt solid var(--border);
  }
  .cover-center .cover-top-row {
    flex-direction: column;
    text-align: center;
    border-bottom: none;
    padding-bottom: 0;
  }
  .cover-top-meta {
    display: flex;
    flex-direction: column;
    gap: 5pt;
  }
  .cover-center .cover-top-meta {
    align-items: center;
  }
  .cover-logo-wrap img {
    max-width: 68px;
    max-height: 68px;
    object-fit: contain;
  }
  .cover-emblem {
    width: 46pt;
    height: 46pt;
    border-radius: 10pt;
    background: var(--primary);
    color: #FFFFFF;
    font-family: var(--font-heading);
    font-size: 15pt;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cover-institution {
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--primary);
  }
  .cover-badge {
    display: inline-block;
    width: fit-content;
    padding: 3pt 10pt;
    border-radius: 4pt;
    background: color-mix(in srgb, var(--accent) 12%, #ffffff);
    color: var(--accent);
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .cover-hero {
    padding: 6mm 0 2mm 0;
  }
  .cover-center .cover-hero {
    text-align: center;
  }
  .cover-title {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 27pt;
    line-height: 1.15;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--primary);
  }
  .cover-rule {
    width: 56pt;
    height: 3.5pt;
    border-radius: 2pt;
    background: var(--accent);
    margin: 12pt 0;
  }
  .cover-center .cover-rule {
    margin: 12pt auto;
  }
  .cover-subtitle {
    margin: 0;
    font-family: var(--font-body);
    font-size: 11.5pt;
    line-height: 1.5;
    color: var(--muted);
    max-width: 92%;
  }
  .cover-center .cover-subtitle {
    margin: 0 auto;
  }
  .cover-illustration {
    margin-top: 14pt;
    text-align: center;
  }
  .cover-illustration img {
    max-width: 78%;
    height: auto;
  }

  /* Cover Roadmap (eliminates dead whitespace in the middle) */
  .cover-roadmap {
    background: color-mix(in srgb, var(--primary) 3%, #ffffff);
    border: 0.7pt solid var(--border);
    border-radius: 8pt;
    padding: 11pt 14pt;
  }
  .cover-roadmap-title {
    font-size: 7.8pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8pt;
  }
  .cover-roadmap-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7pt 14pt;
  }
  .cover-roadmap-item {
    display: flex;
    align-items: flex-start;
    gap: 7pt;
    font-size: 9pt;
    line-height: 1.35;
    color: var(--text);
  }
  .roadmap-num {
    min-width: 18pt;
    height: 15pt;
    border-radius: 3pt;
    background: var(--primary);
    color: #FFFFFF;
    font-size: 7.5pt;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 1pt;
  }
  .roadmap-text {
    font-weight: 600;
  }

  .cover-bottom {
    display: flex;
    flex-direction: column;
    gap: 10pt;
  }
  .student-card {
    background: #FFFFFF;
    border: 0.8pt solid var(--border);
    border-radius: 6pt;
    padding: 10pt 13pt;
  }
  .student-card-title {
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8pt;
  }
  .student-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9pt 16pt;
  }
  .student-field {
    display: flex;
    align-items: flex-end;
    gap: 6pt;
  }
  .student-label {
    font-size: 8.5pt;
    font-weight: 700;
    color: var(--primary);
    white-space: nowrap;
  }
  .student-line {
    flex: 1;
    border-bottom: 0.8pt solid var(--border);
    height: 10pt;
  }
  .cover-presentation {
    border-top: 1.5pt solid var(--accent);
    padding-top: 8pt;
  }
  .cover-presentation-title {
    font-family: var(--font-ui);
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--primary);
    margin-bottom: 4pt;
  }
  .cover-presentation-body p {
    margin: 0;
    font-family: var(--font-body);
    font-size: 9.4pt;
    line-height: 1.48;
    color: var(--muted);
  }
  .cover-footer-note {
    text-align: center;
    font-size: 8.5pt;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    padding-top: 10pt;
    border-top: 0.6pt solid var(--border);
  }
  .presentation-lead p {
    font-size: 10.8pt;
    line-height: 1.65;
    margin: 0 0 11pt 0;
    color: var(--text);
  }

  /* TOC */
  .section-display-title {
    margin: 0 0 6pt 0;
    font-family: var(--font-heading);
    font-size: 20pt;
    font-weight: 800;
    letter-spacing: -0.015em;
    color: var(--primary);
  }
  .accent-bar {
    width: 44pt;
    height: 3pt;
    border-radius: 2pt;
    background: var(--accent);
    margin-bottom: 16pt;
  }
  .toc-list {
    display: flex;
    flex-direction: column;
    gap: 4pt;
    font-family: var(--font-ui);
  }
  .toc-row {
    display: flex;
    align-items: baseline;
    gap: 10pt;
    padding: 7pt 4pt;
    border-bottom: 0.5pt solid color-mix(in srgb, var(--border) 60%, #ffffff);
    text-decoration: none;
    break-inside: avoid;
  }
  .toc-badge {
    min-width: 22pt;
    height: 16pt;
    border-radius: 3pt;
    background: var(--primary);
    color: #FFFFFF;
    font-size: 8pt;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .toc-label {
    font-size: 10pt;
    font-weight: 600;
    color: var(--text);
  }
  .toc-dots {
    flex: 1;
    border-bottom: 1pt dotted var(--border);
    margin: 0 4pt;
  }
  .toc-page {
    font-size: 9.5pt;
    font-weight: 700;
    color: var(--accent);
    min-width: 18pt;
    text-align: right;
  }

  /* Chapters & Headings */
  .chapter-header {
    margin: 22pt 0 12pt 0;
    break-after: avoid;
    page-break-after: avoid;
    break-inside: avoid;
    font-family: var(--font-ui);
  }
  .chapter-header:first-child { margin-top: 0; }
  .chapter-banner {
    background: var(--primary);
    border-left: 5pt solid var(--accent);
    border-radius: 4pt;
    padding: 11pt 14pt;
    color: #FFFFFF;
  }
  .chapter-banner .chapter-kicker {
    font-size: 7.8pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.82);
    margin-bottom: 3pt;
  }
  .chapter-banner .chapter-title {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 15.5pt;
    font-weight: 800;
    line-height: 1.22;
    color: #FFFFFF;
  }
  .chapter-clean .chapter-kicker {
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 4pt;
  }
  .chapter-clean .chapter-title {
    margin: 0 0 7pt 0;
    font-family: var(--font-heading);
    font-size: 17pt;
    font-weight: 800;
    line-height: 1.22;
    letter-spacing: -0.015em;
    color: var(--primary);
  }
  .chapter-rule {
    display: flex;
    align-items: center;
    gap: 6pt;
    height: 2.5pt;
  }
  .chapter-rule span {
    width: 40pt;
    height: 2.5pt;
    background: var(--accent);
  }
  .chapter-rule::after {
    content: "";
    flex: 1;
    height: 0.7pt;
    background: var(--border);
  }

  .doc-title {
    margin: 0 0 6pt 0;
    font-family: var(--font-heading);
    font-size: 21pt;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.18;
    color: var(--primary);
  }
  .doc-subtitle {
    margin: 0 0 14pt 0;
    font-size: 11pt;
    color: var(--muted);
  }
  .doc-heading {
    margin: 15pt 0 6pt 0;
    font-family: var(--font-heading);
    font-size: 12.2pt;
    font-weight: 700;
    color: var(--primary);
    break-after: avoid;
    page-break-after: avoid;
  }
  .doc-paragraph p {
    margin: 0 0 8.5pt 0;
    text-align: ${isAbnt ? 'justify' : 'left'};
  }
  .doc-paragraph.abnt-para p {
    text-indent: 1.25cm;
  }
  .doc-quote {
    margin: 10pt 0 12pt 4cm;
    font-size: 9.5pt;
    line-height: 1.35;
    color: var(--text);
  }
  .doc-list {
    margin: 4pt 0 10pt 0;
    padding-left: 16pt;
  }
  .doc-list li {
    margin-bottom: 4.5pt;
  }
  .doc-list li::marker {
    color: var(--accent);
  }

  /* Objectives (clean textbook top/bottom rules, distinct from cards) */
  .objectives-strip {
    margin: 8pt 0 14pt 0;
    padding: 9pt 2pt;
    border-top: 1.2pt solid var(--primary);
    border-bottom: 0.7pt solid var(--border);
    break-inside: avoid;
    font-family: var(--font-ui);
  }
  .objectives-head {
    display: flex;
    align-items: center;
    gap: 6pt;
    font-size: 8.5pt;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 6pt;
  }
  .objectives-list {
    margin: 0;
    padding-left: 15pt;
    font-size: 9.4pt;
    line-height: 1.45;
    color: var(--text);
  }
  .objectives-list li { margin-bottom: 3pt; }
  .objectives-list li::marker { color: var(--accent); }

  /* Example Box (editorial tinted box with pill tag) */
  .example-box {
    margin: 10pt 0 13pt 0;
    padding: 10pt 13pt;
    background: color-mix(in srgb, var(--accent) 6%, #ffffff);
    border-left: 3pt solid var(--accent);
    break-inside: avoid;
  }
  .example-tag {
    display: inline-flex;
    align-items: center;
    gap: 5pt;
    font-family: var(--font-ui);
    font-size: 7.8pt;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 4pt;
  }
  .example-body p {
    margin: 0;
    font-size: 9.6pt;
    line-height: 1.48;
  }

  /* Generic Callout */
  .callout {
    margin: 10pt 0 12pt 0;
    padding: 10pt 13pt;
    border: 0.7pt solid var(--border);
    border-left: 3.5pt solid var(--primary);
    background: color-mix(in srgb, var(--primary) 4%, #ffffff);
    break-inside: avoid;
  }
  .callout-alert {
    border-left-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, #ffffff);
  }
  .callout-learnmore {
    border-left-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 5%, #ffffff);
  }
  .table-caption {
    font-family: var(--font-ui);
    font-size: 9pt;
    font-weight: 700;
    color: var(--primary);
    margin-bottom: 5pt;
  }
  .figure-caption {
    font-family: var(--font-ui);
    font-size: 8.5pt;
    font-weight: 600;
    color: var(--muted);
    margin-top: 4pt;
    text-align: center;
  }
  .callout-head {
    display: flex;
    align-items: center;
    gap: 6pt;
    font-family: var(--font-ui);
    font-size: 9.5pt;
    font-weight: 700;
    color: var(--primary);
    margin-bottom: 4pt;
  }
  .callout-body p {
    margin: 0 0 4pt 0;
    font-size: 9.6pt;
    line-height: 1.48;
  }
  .callout-body p:last-child { margin-bottom: 0; }

  /* Exercises & Answers */
  .exercise-card {
    margin: 9pt 0 11pt 0;
    break-inside: avoid;
  }
  .exercise-item {
    display: flex;
    align-items: flex-start;
    gap: 9pt;
  }
  .exercise-options {
    list-style: none;
    margin: 6pt 0 0 29pt;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4pt;
    font-size: 9.6pt;
    line-height: 1.45;
  }
  .exercise-options li {
    padding: 3pt 8pt;
    border-radius: 4pt;
    background: color-mix(in srgb, var(--primary) 2.5%, #ffffff);
    border: 0.5pt solid color-mix(in srgb, var(--border) 70%, #ffffff);
  }
  .visual-graphic {
    margin: 10pt 0 12pt 0;
    text-align: center;
    break-inside: avoid;
  }
  .visual-graphic img {
    max-width: 100%;
    height: auto;
    border-radius: 6pt;
  }
  .exercise-num {
    min-width: 20pt;
    height: 18pt;
    border-radius: 3pt;
    background: var(--primary);
    color: #FFFFFF;
    font-family: var(--font-ui);
    font-size: 8.5pt;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 1pt;
  }
  .exercise-text {
    font-weight: 600;
    font-size: 10pt;
    line-height: 1.45;
  }
  .answer-box {
    margin: 4pt 0 9pt 0;
    padding: 7pt 11pt;
    border-left: 2pt solid var(--accent);
    background: color-mix(in srgb, var(--accent) 5%, #ffffff);
    font-size: 9.3pt;
    line-height: 1.45;
    break-inside: avoid;
  }
  .answer-tag {
    display: inline-block;
    font-family: var(--font-ui);
    font-size: 7.2pt;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--accent);
    margin-right: 6pt;
  }
  .answer-text {
    color: var(--muted);
  }

  /* KPI Grid (for executive reports) */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10pt;
    margin: 10pt 0 14pt 0;
    break-inside: avoid;
    font-family: var(--font-ui);
  }
  .kpi-card {
    padding: 10pt 12pt;
    border: 0.7pt solid var(--border);
    border-top: 2.5pt solid var(--accent);
    border-radius: 4pt;
    background: color-mix(in srgb, var(--primary) 3%, #ffffff);
  }
  .kpi-label {
    font-size: 7.8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 4pt;
  }
  .kpi-value {
    font-size: 17pt;
    font-weight: 800;
    color: var(--primary);
    line-height: 1.15;
  }
  .kpi-trend {
    margin-top: 3pt;
    font-size: 8.2pt;
    font-weight: 600;
    color: var(--accent);
  }

  /* Editorial Tables (clean horizontal rules, no heavy vertical Excel grid) */
  .table-wrap {
    margin: 10pt 0 14pt 0;
    font-family: var(--font-ui);
  }
  .doc-table {
    width: 100%;
    table-layout: auto;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .doc-table thead { display: table-header-group; }
  .doc-table tr { break-inside: avoid; }
  .doc-table th {
    background: color-mix(in srgb, var(--primary) 4%, #ffffff);
    color: var(--primary);
    font-weight: 700;
    text-align: left;
    padding: 7pt 8pt;
    border-top: none;
    border-bottom: 0.5pt solid var(--border);
    overflow-wrap: break-word;
  }
  .doc-table td {
    padding: 6.5pt 8pt;
    border-bottom: 0.5pt solid var(--border);
    vertical-align: top;
    line-height: 1.42;
    overflow-wrap: break-word;
  }
  .doc-table tbody tr:nth-child(even) td {
    background: color-mix(in srgb, var(--primary) 2.5%, #ffffff);
  }

  /* Comparison */
  .comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12pt;
    margin: 10pt 0 14pt 0;
    break-inside: avoid;
    font-family: var(--font-ui);
  }
  .comparison-card {
    background: #FFFFFF;
    border: 0.7pt solid var(--border);
    border-top: 2.5pt solid var(--primary);
    border-radius: 4pt;
    padding: 10pt 12pt;
  }
  .comparison-card:last-child {
    border-top-color: var(--accent);
  }
  .comparison-title {
    font-size: 9.8pt;
    font-weight: 700;
    color: var(--primary);
    margin-bottom: 6pt;
    padding-bottom: 4pt;
    border-bottom: 0.5pt solid var(--border);
  }
  .comparison-card ul {
    margin: 0;
    padding-left: 14pt;
    font-size: 9.2pt;
    line-height: 1.45;
  }
  .comparison-card li { margin-bottom: 3.5pt; }
  .comparison-card li::marker { color: var(--accent); }

  /* Timeline */
  .timeline {
    margin: 10pt 0 14pt 0;
    display: flex;
    flex-direction: column;
    font-family: var(--font-ui);
  }
  .timeline-item {
    position: relative;
    display: flex;
    gap: 10pt;
    padding-bottom: 10pt;
    break-inside: avoid;
  }
  .timeline-item:not(:last-child)::before {
    content: "";
    position: absolute;
    left: 8.5pt;
    top: 17pt;
    bottom: 0;
    width: 1.2pt;
    background: var(--border);
  }
  .timeline-marker {
    width: 17pt;
    height: 17pt;
    min-width: 17pt;
    border-radius: 50%;
    background: var(--accent);
    color: #FFFFFF;
    font-size: 8.5pt;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
  }
  .timeline-step {
    font-weight: 700;
    font-size: 10pt;
    color: var(--primary);
    margin-bottom: 2pt;
  }
  .timeline-detail {
    font-size: 9.2pt;
    color: var(--muted);
    line-height: 1.42;
  }
  .timeline-notes {
    margin: 4pt 0 14pt 0;
    padding: 8pt 12pt;
    background: color-mix(in srgb, var(--primary) 2.5%, #ffffff);
    border-radius: 6pt;
    border: 0.6pt solid var(--border);
    font-family: var(--font-ui);
    font-size: 9.2pt;
    line-height: 1.45;
  }
  .timeline-note-row {
    display: flex;
    gap: 6pt;
    margin-bottom: 4pt;
    break-inside: avoid;
  }
  .timeline-note-row:last-child { margin-bottom: 0; }
  .timeline-note-idx {
    font-weight: 700;
    color: var(--accent);
    min-width: 14pt;
  }

  /* Checklist */
  .checklist-card {
    margin: 10pt 0 14pt 0;
    padding: 10pt 13pt;
    border: 0.7pt solid var(--border);
    border-left: 3pt solid var(--accent);
    background: color-mix(in srgb, var(--accent) 4%, #ffffff);
    break-inside: avoid;
    font-family: var(--font-ui);
  }
  .checklist-title {
    font-size: 9.5pt;
    font-weight: 700;
    color: var(--primary);
    margin-bottom: 6pt;
  }
  .checklist-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4.5pt;
  }
  .checklist-items li {
    display: flex;
    align-items: flex-start;
    gap: 7pt;
    font-size: 9.3pt;
  }
  .chk-box {
    width: 12pt;
    height: 12pt;
    min-width: 12pt;
    border-radius: 2.5pt;
    border: 1pt solid var(--accent);
    background: #FFFFFF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 1.5pt;
  }

  /* Glossary */
  .glossary-item {
    display: grid;
    grid-template-columns: 135pt 1fr;
    gap: 10pt;
    padding: 5.5pt 0;
    border-bottom: 0.5pt solid color-mix(in srgb, var(--border) 60%, #ffffff);
    font-size: 9.4pt;
    break-inside: avoid;
  }
  .glossary-term {
    font-family: var(--font-ui);
    font-weight: 700;
    color: var(--primary);
  }
  .glossary-def {
    color: var(--text);
    line-height: 1.44;
  }

  /* Attachments */
  .attachment-fig {
    margin: 10pt 0 14pt 0;
    text-align: center;
    break-inside: avoid;
  }
  .attachment-fig img {
    max-width: 100%;
    max-height: 220pt;
    object-fit: contain;
    border-radius: 4pt;
    border: 0.6pt solid var(--border);
  }
  .attachment-fig figcaption {
    margin-top: 4pt;
    font-family: var(--font-ui);
    font-size: 8.5pt;
    color: var(--muted);
  }
</style>
</head>
<body>
${bodyParts.join('\n')}
</body>
</html>`
}
