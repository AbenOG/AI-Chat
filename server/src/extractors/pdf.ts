import { createRequire } from 'module'
import fs from 'fs/promises'

const require = createRequire(import.meta.url)

const PDF_EXTRACTOR = process.env.PDF_EXTRACTOR // 'unpdf' | 'pdfjs'

function getCaps() {
    const MAX_PAGES = Number.isFinite(Number(process.env.PDF_MAX_PAGES)) ? Math.max(1, Number(process.env.PDF_MAX_PAGES)) : 40
    const MAX_TEXT_CHARS = Number.isFinite(Number(process.env.PDF_MAX_TEXT_CHARS)) ? Math.max(5_000, Number(process.env.PDF_MAX_TEXT_CHARS)) : 250_000
    return { MAX_PAGES, MAX_TEXT_CHARS }
}

async function extractWithUnpdf(filePath: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractText, getDocumentProxy } = require('unpdf')
    const { MAX_PAGES, MAX_TEXT_CHARS } = getCaps()

    const dataBuffer = await fs.readFile(filePath)
    const pdf = await getDocumentProxy(new Uint8Array(dataBuffer))
    const { totalPages, text } = await extractText(pdf, { mergePages: false })

    const pages = Array.isArray(text) ? text.slice(0, Math.min(totalPages, MAX_PAGES)) : [String(text)]
    let merged = pages.join('\n')
    if (merged.length > MAX_TEXT_CHARS) merged = merged.slice(0, MAX_TEXT_CHARS)
    if (!merged.trim()) throw new Error('No text content found in PDF')
    return merged
}

function loadPdfjsLib(): any {
    try { return require('pdfjs-dist/legacy/build/pdf.js') } catch {}
    try { return require('pdfjs-dist/build/pdf.js') } catch {}
    try { return require('pdfjs-dist') } catch {}
    throw new Error('Missing pdfjs-dist. Install with: npm i pdfjs-dist')
}

async function extractWithPdfjs(filePath: string): Promise<string> {
    const pdfjsLib = loadPdfjsLib()
    const { MAX_PAGES, MAX_TEXT_CHARS } = getCaps()

    const dataBuffer = await fs.readFile(filePath)
    const data = new Uint8Array(dataBuffer)

    const loadingTask = pdfjsLib.getDocument({ data, disableWorker: true })
    const pdf = await loadingTask.promise

    const pagesToRead = Math.min(pdf.numPages, MAX_PAGES)
    const parts: string[] = []
    let total = 0

    for (let i = 1; i <= pagesToRead; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
        let lastY: number | null = null
        let pageText = ''
        for (const item of textContent.items as Array<any>) {
            const y = item.transform ? item.transform[5] : null
            pageText += (lastY === y || lastY === null) ? item.str : ('\n' + item.str)
            lastY = y
        }
        if (pageText) {
            parts.push(pageText)
            total += pageText.length
            if (total >= MAX_TEXT_CHARS) break
        }
    }

    let text = parts.join('\n')
    if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS)
    if (!text.trim()) throw new Error('No text content found in PDF')
    return text
}

export async function extractTextFromPDF(filePath: string): Promise<string> {
    // Forced extractor by env
    if (PDF_EXTRACTOR === 'unpdf') {
        try { return await extractWithUnpdf(filePath) } catch (e) { throw e }
    }
    if (PDF_EXTRACTOR === 'pdfjs') {
        try { return await extractWithPdfjs(filePath) } catch (e) { throw e }
    }

    // Auto: unpdf -> pdfjs -> helpful error
    try {
        return await extractWithUnpdf(filePath)
    } catch (eUnpdf) {
        try {
            return await extractWithPdfjs(filePath)
        } catch (ePdfjs) {
            const hint = 'Install one of: npm i unpdf OR npm i pdfjs-dist.'
            const details = `unpdf error: ${(eUnpdf as Error).message}; pdfjs error: ${(ePdfjs as Error).message}`
            throw new Error(`No PDF extractor available. ${hint} Details: ${details}`)
        }
    }
}

