/**
 * Shared helper for fetching illustrative images, logos, and coats of arms
 * from Wikimedia Commons as PNG/JPEG data URLs.
 */
import { renderSvgToPng } from '../engines/video-engine.ts'

export interface WikimediaImageMatch {
  title: string
  dataUrl: string
}

async function downloadWikimediaEntry(
  imgUrl: string,
  infoMime: string,
  isSvgWithPngThumb: boolean,
  rawSvgUrl?: string
): Promise<string | null> {
  try {
    const imgRes = await fetch(imgUrl, {
      headers: { 'User-Agent': 'MomAIDocs/1.0 (https://momai.dev)' },
      signal: AbortSignal.timeout(6000)
    })
    if (imgRes.ok) {
      const rawType = String(imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      const finalMime =
        rawType === 'image/jpeg' || rawType === 'image/png'
          ? rawType
          : isSvgWithPngThumb
            ? 'image/png'
            : infoMime
      if (finalMime === 'image/jpeg' || finalMime === 'image/png') {
        const buf = Buffer.from(await imgRes.arrayBuffer())
        if (buf.length >= 512 && buf.length <= 4 * 1024 * 1024) {
          return `data:${finalMime};base64,${buf.toString('base64')}`
        }
      }
      if (rawType === 'image/svg+xml') {
        const svgText = await imgRes.text()
        const pngBuf = await renderSvgToPng(svgText)
        if (pngBuf.length >= 256) {
          return `data:image/png;base64,${pngBuf.toString('base64')}`
        }
      }
    }
    if (rawSvgUrl && rawSvgUrl !== imgUrl) {
      const svgRes = await fetch(rawSvgUrl, {
        headers: { 'User-Agent': 'MomAIDocs/1.0 (https://momai.dev)' },
        signal: AbortSignal.timeout(6000)
      })
      if (svgRes.ok) {
        const svgText = await svgRes.text()
        const pngBuf = await renderSvgToPng(svgText)
        if (pngBuf.length >= 256) {
          return `data:image/png;base64,${pngBuf.toString('base64')}`
        }
      }
    }
    return null
  } catch {
    return null
  }
}

export async function fetchWikimediaImageDataUrl(
  query: string,
  usedUrls: Set<string> = new Set(),
  width = 800,
  opts?: { emblemOnly?: boolean }
): Promise<string | null> {
  if (typeof fetch !== 'function' || !query.trim()) return null
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query.trim()
    )}&gsrlimit=10&prop=imageinfo&iiprop=url|mime&iiurlwidth=${width}&format=json`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MomAIDocs/1.0 (https://momai.dev)' },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ mime?: string; thumburl?: string; url?: string }> }> }
    }
    const pages = Object.values(data?.query?.pages || {})
    const emblemRe = /(bras[aã]o|coat[_ ]of[_ ]arms|escudo|emblem|logo|seal|bandeira|flag|simbolo|crest)/i
    const sorted = [...pages].sort((a, b) => {
      const aTitle = String(a?.title || '')
      const bTitle = String(b?.title || '')
      const aMime = String(a?.imageinfo?.[0]?.mime || '').toLowerCase()
      const bMime = String(b?.imageinfo?.[0]?.mime || '').toLowerCase()
      const aScore = (emblemRe.test(aTitle) ? 4 : 0) + (aMime === 'image/svg+xml' ? 3 : aMime === 'image/png' ? 2 : 0)
      const bScore = (emblemRe.test(bTitle) ? 4 : 0) + (bMime === 'image/svg+xml' ? 3 : bMime === 'image/png' ? 2 : 0)
      return bScore - aScore
    })
    for (const page of sorted) {
      const title = String(page?.title || '')
      const info = page?.imageinfo?.[0]
      const infoMime = String(info?.mime || '').toLowerCase()
      const isRaster = infoMime === 'image/jpeg' || infoMime === 'image/png'
      const isSvg = infoMime === 'image/svg+xml'
      if (!isRaster && !isSvg) continue
      if (opts?.emblemOnly && infoMime === 'image/jpeg' && !emblemRe.test(title)) {
        continue
      }
      const imgUrl = info?.thumburl || info?.url
      if (!imgUrl || usedUrls.has(imgUrl)) continue
      const dataUrl = await downloadWikimediaEntry(imgUrl, infoMime, isSvg && Boolean(info?.thumburl), isSvg ? info?.url : undefined)
      if (!dataUrl) continue
      usedUrls.add(imgUrl)
      return dataUrl
    }
  } catch {
    return null
  }
  return null
}

/**
 * Searches Wikimedia Commons for coats of arms, logos, and emblems, returning
 * ready-to-use PNG/JPEG data URLs for UI preview and header/footer selection.
 */
export async function searchWikimediaImages(
  query: string,
  limit = 6
): Promise<WikimediaImageMatch[]> {  if (typeof fetch !== 'function' || !query.trim()) return []
  try {
    const safeLimit = Math.min(12, Math.max(1, Math.floor(limit)))
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query.trim()
    )}&gsrlimit=${safeLimit}&prop=imageinfo&iiprop=url|mime&iiurlwidth=400&format=json`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MomAIDocs/1.0 (https://momai.dev)' },
      signal: AbortSignal.timeout(6000)
    })
    if (!res.ok) return []
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; imageinfo?: Array<{ mime?: string; thumburl?: string; url?: string }> }
        >
      }
    }
    const pages = Object.values(data?.query?.pages || {})
    const settled = await Promise.all(
      pages.map(async (page): Promise<WikimediaImageMatch | null> => {
        const info = page?.imageinfo?.[0]
        const infoMime = String(info?.mime || '').toLowerCase()
        const isRaster = infoMime === 'image/jpeg' || infoMime === 'image/png'
        const isSvg = infoMime === 'image/svg+xml'
        const isSvgWithPngThumb = isSvg && Boolean(info?.thumburl)
        if (!isRaster && !isSvg) return null
        const imgUrl = info?.thumburl || info?.url
        if (!imgUrl) return null
        const dataUrl = await downloadWikimediaEntry(imgUrl, infoMime, isSvgWithPngThumb, isSvg ? info?.url : undefined)
        if (!dataUrl) return null
        const cleanTitle = String(page?.title || 'Imagem')
          .replace(/^File:/i, '')
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/_/g, ' ')
          .trim()
        return { title: cleanTitle || 'Imagem', dataUrl }
      })
    )
    return settled.filter((x): x is WikimediaImageMatch => x !== null)
  } catch {
    return []
  }
}

/**
 * Extracts a likely entity name from an instruction that asks for a logo,
 * coat of arms or emblem, e.g. "use o logo da prefeitura" -> "prefeitura".
 */
export function extractRequestedLogoQuery(instructions?: string): string | null {
  const text = String(instructions || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  const match = text.match(
    /(logo|logotipo|marca|bras[aã]o|emblema|escudo)\s+(?:d[aeo]s?\s+|do\s+|da\s+|de\s+)?([^.,;:\n]{2,80})/i
  )
  if (!match) return null
  const kindWord = match[1].toLowerCase()
  const entity = match[2]
    .replace(/\b(?:no|na|nos|nas|para|em|com|centralizad[oa]|alinhad[oa]|posicionad[oa]|topo|capa|cabe[çc]alho|rodap[ée])\b[\s\S]*$/i, '')
    .replace(/\bprefeitura\s+(?:municipal\s+)?(?:de|da|do)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim()
  if (entity.length < 2) return null
  const prefix = /bras[aã]o|escudo/.test(kindWord) ? 'Coat of arms' : kindWord
  return `${prefix} ${entity}`.slice(0, 80)
}

