import { randomUUID } from 'node:crypto'
import type { SourceSuggestion } from '../types.ts'

const REPUTABLE_DOMAIN_PATTERNS: Array<{ pattern: RegExp; score: number; label: 'high' | 'medium' }> = [
  { pattern: /\.(gov|edu|mil)\b/i, score: 95, label: 'high' },
  { pattern: /\.(gov\.br|edu\.br|jus\.br|leg\.br|org\.br)\b/i, score: 95, label: 'high' },
  { pattern: /(scielo|scholar\.google|pubmed|arxiv\.org|nature\.com|ieee\.org|acm\.org|abnt\.org)/i, score: 92, label: 'high' },
  { pattern: /(wikipedia\.org|github\.com|developer\.mozilla\.org|microsoft\.com|w3\.org)/i, score: 85, label: 'high' },
  { pattern: /\.(org|edu)\b/i, score: 78, label: 'medium' }
]

function evaluateDomain(url: string): { domain: string; score: number; label: 'high' | 'medium' | 'general' } {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    for (const rule of REPUTABLE_DOMAIN_PATTERNS) {
      if (rule.pattern.test(host)) {
        return { domain: host, score: rule.score, label: rule.label }
      }
    }
    return { domain: host, score: 60, label: 'general' }
  } catch {
    return { domain: 'web', score: 40, label: 'general' }
  }
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim()
}

function unwrapSearchUrl(rawHref: string): string {
  if (!rawHref) return ''
  try {
    const fixed = rawHref.startsWith('//') ? `https:${rawHref}` : rawHref.startsWith('/') ? `https://duckduckgo.com${rawHref}` : rawHref
    const parsed = new URL(fixed)
    const uddg = parsed.searchParams.get('uddg')
    if (uddg && uddg.startsWith('http')) return uddg
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return fixed
  } catch {}
  return ''
}

export async function discoverCuratedSources(opts: {
  query: string
  limit?: number
  includeYouTube?: boolean
}): Promise<SourceSuggestion[]> {
  const cleanQuery = String(opts.query || '').trim()
  if (!cleanQuery) return []
  const limit = Math.min(Math.max(1, opts.limit || 6), 12)

  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`
  const suggestions: SourceSuggestion[] = []
  const seenUrls = new Set<string>()
  const seenTitles = new Set<string>()

  const pushSuggestion = (title: string, url: string, snippet: string) => {
    const cleanUrl = unwrapSearchUrl(url)
    const cleanTitle = decodeHtml(title)
    if (!cleanUrl || !cleanTitle) return
    const normUrl = cleanUrl.split('#')[0]
    const normTitle = cleanTitle.toLowerCase()
    if (seenUrls.has(normUrl) || seenTitles.has(normTitle)) return
    seenUrls.add(normUrl)
    seenTitles.add(normTitle)
    const rel = evaluateDomain(cleanUrl)
    suggestions.push({
      id: `sug-${randomUUID().slice(0, 8)}`,
      title: cleanTitle,
      url: cleanUrl,
      domain: rel.domain,
      kind: /youtube\.com|youtu\.be/i.test(cleanUrl) ? 'youtube' : 'url',
      reliabilityScore: rel.score,
      reliabilityLabel: rel.label,
      snippet: decodeHtml(snippet) || 'Página web sugerida',
      summary: decodeHtml(snippet) || cleanTitle
    })
  }

  try {
    const res = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(8000)
    })
    if (res.ok) {
      const html = await res.text()
      const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
      let current: { title: string; url: string; snippet: string } | null = null
      for (const m of anchors) {
        const attrs = m[1]
        if (/class=["'][^"']*result__a/i.test(attrs)) {
          if (current) {
            pushSuggestion(current.title, current.url, current.snippet)
          }
          const hrefMatch = /href=["']([^"']+)["']/i.exec(attrs)
          const rawHref = hrefMatch ? decodeHtml(hrefMatch[1]) : ''
          const unwrapped = unwrapSearchUrl(rawHref)
          current = unwrapped ? { title: decodeHtml(m[2]), url: unwrapped, snippet: '' } : null
        } else if (current && !current.snippet && /class=["'][^"']*result__snippet/i.test(attrs)) {
          current.snippet = decodeHtml(m[2])
        }
      }
      if (current) {
        pushSuggestion(current.title, current.url, current.snippet)
      }
    }
  } catch {
    // Fallback below
  }

  // Reliable Wikipedia OpenSearch fallback (pt + en) when HTML search yields few/no results
  if (suggestions.length < limit) {
    for (const lang of ['pt', 'en']) {
      if (suggestions.length >= limit) break
      try {
        const wikiUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQuery)}&limit=${limit}&namespace=0&format=json`
        const wRes = await fetch(wikiUrl, {
          headers: { 'User-Agent': 'MomAI-Docs/1.0' },
          signal: AbortSignal.timeout(5000)
        })
        if (wRes.ok) {
          const data = (await wRes.json()) as [string, string[], string[], string[]]
          const titles = Array.isArray(data?.[1]) ? data[1] : []
          const descs = Array.isArray(data?.[2]) ? data[2] : []
          const urls = Array.isArray(data?.[3]) ? data[3] : []
          for (let i = 0; i < titles.length; i++) {
            if (urls[i]) pushSuggestion(titles[i], urls[i], descs[i] || `Artigo da Wikipédia (${lang.toUpperCase()})`)
          }
        }
      } catch {}
    }
  }

  return suggestions
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore)
    .slice(0, limit)
}
