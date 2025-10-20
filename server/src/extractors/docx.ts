import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const mammoth = require('mammoth')

export async function extractTextFromDOCX(filePath: string): Promise<string> {
    try {
        // Node.js mammoth extractor
        const result = await mammoth.extractRawText({ path: filePath })
        return result.value
    } catch (error) {
        console.error('Error extracting text from DOCX:', error)
        throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

