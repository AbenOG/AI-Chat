import { estimateTokenCount } from './embeddings.js'

export interface TextChunk {
    content: string
    index: number
    tokenCount: number
}

/**
 * Split text into overlapping chunks
 * @param text - The text to chunk
 * @param minChunkSize - Minimum chunk size in characters (default: 1200)
 * @param maxChunkSize - Maximum chunk size in characters (default: 1600)
 * @param overlap - Overlap size in characters (default: 200)
 */
export function chunkText(
    text: string,
    minChunkSize: number = 1200,
    maxChunkSize: number = 1600,
    overlap: number = 200,
    maxChunks?: number
): TextChunk[] {
    const chunks: TextChunk[] = []
    
    // Clean and normalize text
    const cleanedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    if (cleanedText.length === 0) {
        return chunks
    }

    // If text is smaller than min chunk size, return as single chunk
    if (cleanedText.length <= minChunkSize) {
        chunks.push({
            content: cleanedText,
            index: 0,
            tokenCount: estimateTokenCount(cleanedText)
        })
        return chunks
    }

    let startIndex = 0
    let chunkIndex = 0

    while (startIndex < cleanedText.length) {
        let endIndex = Math.min(startIndex + maxChunkSize, cleanedText.length)

        // If not at the end, try to break at a sentence or paragraph boundary
        if (endIndex < cleanedText.length) {
            // Look for paragraph break first
            const paragraphBreak = cleanedText.lastIndexOf('\n\n', endIndex)
            if (paragraphBreak > startIndex + minChunkSize) {
                endIndex = paragraphBreak + 2
            } else {
                // Look for sentence break
                const sentenceBreak = Math.max(
                    cleanedText.lastIndexOf('. ', endIndex),
                    cleanedText.lastIndexOf('.\n', endIndex),
                    cleanedText.lastIndexOf('! ', endIndex),
                    cleanedText.lastIndexOf('? ', endIndex)
                )
                if (sentenceBreak > startIndex + minChunkSize) {
                    endIndex = sentenceBreak + 2
                }
            }
        }

        const chunkContent = cleanedText.substring(startIndex, endIndex).trim()
        
        if (chunkContent.length > 0) {
            chunks.push({
                content: chunkContent,
                index: chunkIndex,
                tokenCount: estimateTokenCount(chunkContent)
            })
            chunkIndex++
            if (typeof maxChunks === 'number' && chunks.length >= maxChunks) {
                break
            }
        }

        // Move start index forward, accounting for overlap
        startIndex = endIndex - overlap
        
        // Ensure we make progress
        if (startIndex <= chunks[chunks.length - 1]?.content.length || 0) {
            startIndex = endIndex
        }
    }

    return chunks
}

