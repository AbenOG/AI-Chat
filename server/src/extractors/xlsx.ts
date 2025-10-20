import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

export async function extractTextFromXLSX(filePath: string): Promise<string> {
    try {
        // Node.js xlsx extractor
        const workbook = XLSX.readFile(filePath)
        const textParts: string[] = []

        // Iterate through all sheets
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]
            
            // Add sheet name as header
            textParts.push(`\n=== Sheet: ${sheetName} ===\n`)
            
            // Convert sheet to CSV and add to text
            const csv = XLSX.utils.sheet_to_csv(sheet)
            textParts.push(csv)
        }

        return textParts.join('\n')
    } catch (error) {
        console.error('Error extracting text from XLSX:', error)
        throw new Error(`Failed to extract text from XLSX: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

