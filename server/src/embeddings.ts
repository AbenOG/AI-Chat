import OpenAI from 'openai'
import db from './database.js'
import { decrypt } from './utils/crypto.js'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536
const BATCH_SIZE = 64

// Cache for OpenAI clients per user (to avoid recreating)
const clientCache = new Map<number, OpenAI>()

/**
 * Get or create OpenAI client for a user
 */
function getClientForUser(userId?: number): OpenAI {
    // If no userId provided, try to use env var (fallback for legacy code)
    if (!userId) {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            throw new Error('OpenAI API key not configured. Please complete onboarding or set OPENAI_API_KEY.')
        }
        return new OpenAI({ apiKey })
    }

    // Check cache first
    if (clientCache.has(userId)) {
        return clientCache.get(userId)!
    }

    // Get user's embedding key from settings
    const settings = db.prepare(`
        SELECT embedding_api_key_encrypted, embedding_model 
        FROM user_settings 
        WHERE user_id = ?
    `).get(userId) as { embedding_api_key_encrypted: string; embedding_model: string } | undefined

    if (!settings?.embedding_api_key_encrypted) {
        throw new Error('Embeddings not configured. Please complete onboarding.')
    }

    const apiKey = decrypt(settings.embedding_api_key_encrypted)
    const client = new OpenAI({ apiKey })
    
    // Cache it
    clientCache.set(userId, client)
    
    return client
}

/**
 * Clear cached client for a user (call when they update their key)
 */
export function clearClientCache(userId: number) {
    clientCache.delete(userId)
}

/**
 * Generate embeddings for a single text or batch of texts
 */
export async function generateEmbeddings(texts: string[], userId?: number): Promise<number[][]> {
    if (texts.length === 0) return []

    const client = getClientForUser(userId)
    const embeddings: number[][] = []

    // Process in batches
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE)
        
        try {
            const response = await client.embeddings.create({
                model: EMBEDDING_MODEL,
                input: batch,
                encoding_format: 'float'
            })

            for (const item of response.data) {
                embeddings.push(item.embedding)
            }
        } catch (error) {
            console.error('Error generating embeddings:', error)
            throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    return embeddings
}

/**
 * Generate a single embedding for a query
 */
export async function generateQueryEmbedding(query: string, userId?: number): Promise<number[]> {
    const embeddings = await generateEmbeddings([query], userId)
    return embeddings[0] || []
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    
    if (denominator === 0) return 0
    
    return dotProduct / denominator
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
export function estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4)
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS }

