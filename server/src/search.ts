import type { Request, Response } from 'express'

// Simple DuckDuckGo HTML search scraper (no API key required)
// Falls back gracefully and returns a minimal list of results
export async function searchWeb(req: Request, res: Response) {
    try {
        const { q, limit } = req.body || {}
        const query = (q || '').toString().trim()
        const max = Math.max(1, Math.min(Number(limit) || 5, 10))

        console.log('[Web Search] Query:', query, 'Limit:', max)

        if (!query) {
            return res.status(400).json({ error: 'Missing query' })
        }

        // Use the HTML-only endpoint to simplify parsing
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
        const response = await fetch(ddgUrl, { signal: AbortSignal.timeout(10000) })
        if (!response.ok) {
            return res.status(502).json({ error: 'Failed to fetch search results' })
        }

        const html = await response.text()

        // Very light parsing to extract results
        // Results are in <a class="result__a" href="...">Title</a>
        // Snippets in <a class="result__snippet"> or <div class="result__snippet">
        const results: Array<{ title: string; url: string; snippet: string }> = []

        // Split by result blocks
        const blocks = html.split('<div class="result__body">')
        for (const block of blocks) {
            const aMatch = block.match(/<a[^>]*class=\"result__a\"[^>]*href=\"(.*?)\"[^>]*>([\s\S]*?)<\/a>/i)
            if (!aMatch) continue
            const url = decodeHTMLEntities(aMatch[1])
            const title = stripTags(aMatch[2]).trim()

            let snippet = ''
            const snippetMatch = block.match(/<(?:a|div)[^>]*class=\"result__snippet[^\"]*\"[^>]*>([\s\S]*?)<\/(?:a|div)>/i)
            if (snippetMatch) {
                snippet = stripTags(snippetMatch[1]).trim()
            }

            if (url && title) {
                results.push({ title, url, snippet })
            }
            if (results.length >= max) break
        }

        console.log('[Web Search] Found', results.length, 'results')
        return res.json({ results })
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Search failed' })
    }
}

function stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
}

function decodeHTMLEntities(text: string): string {
    const entities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
    }
    return text.replace(/(&amp;|&lt;|&gt;|&quot;|&#39;)/g, (m) => entities[m] || m)
}


