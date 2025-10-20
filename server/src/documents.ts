import db from './database.js'
import { extractTextFromPDF } from './extractors/pdf.js'
import { extractTextFromDOCX } from './extractors/docx.js'
import { extractTextFromXLSX } from './extractors/xlsx.js'
import { chunkText } from './chunking.js'
import { generateEmbeddings } from './embeddings.js'
import fs from 'fs/promises'
import path from 'path'

export interface Document {
    id: number
    user_id: number
    filename: string
    mime_type: string
    size_bytes: number
    status: 'uploading' | 'processing' | 'completed' | 'failed'
    error_message: string | null
    file_path: string
    created_at: string
}

export interface DocumentChunk {
    id: number
    document_id: number
    chunk_index: number
    content: string
    token_count: number
}

export interface SearchResult {
    chunk: DocumentChunk
    document: Document
    similarity: number
}

/**
 * Get document content by ID (returns all chunks concatenated)
 */
export function getDocumentContent(documentId: number, userId: number): string {
    // Verify document belongs to user
    const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(documentId, userId) as Document | undefined
    
    if (!doc) {
        throw new Error('Document not found or access denied')
    }
    
    if (doc.status !== 'completed') {
        throw new Error(`Document is not ready (status: ${doc.status})`)
    }
    
    // Get all chunks ordered by index
    const chunks = db.prepare(`
        SELECT content 
        FROM document_chunks 
        WHERE document_id = ? 
        ORDER BY chunk_index ASC
    `).all(documentId) as Array<{ content: string }>
    
    if (chunks.length === 0) {
        throw new Error('No content found for document')
    }
    
    // Concatenate all chunks with double newlines
    return chunks.map(c => c.content).join('\n\n')
}

/**
 * Extract text from a document based on its MIME type
 */
async function extractText(filePath: string, mimeType: string): Promise<string> {
    switch (mimeType) {
        case 'application/pdf':
            return await extractTextFromPDF(filePath)
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            return await extractTextFromDOCX(filePath)
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
            return await extractTextFromXLSX(filePath)
        default:
            throw new Error(`Unsupported file type: ${mimeType}`)
    }
}

/**
 * Process a document: extract text, chunk, and generate embeddings
 */
export async function processDocument(documentId: number, userId?: number): Promise<void> {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId) as Document | undefined

    if (!doc) {
        throw new Error(`Document ${documentId} not found`)
    }

    // Use document's user_id if userId not provided
    const effectiveUserId = userId || doc.user_id

    try {
        // Update status to processing
        db.prepare('UPDATE documents SET status = ? WHERE id = ?').run('processing', documentId)

        // Extract text
        let text = await extractText(doc.file_path, doc.mime_type)

        // Trim text aggressively to avoid OOM before chunking
        const MAX_TEXT_CHARS = Number.isFinite(Number(process.env.DOC_MAX_TEXT_CHARS)) ? Math.max(50_000, Number(process.env.DOC_MAX_TEXT_CHARS)) : 300_000
        if (text.length > MAX_TEXT_CHARS) {
            text = text.slice(0, MAX_TEXT_CHARS)
        }

        if (!text || text.trim().length === 0) {
            throw new Error('No text content found in document')
        }

        // Chunk the text
        const MAX_CHUNKS = Number.isFinite(Number(process.env.DOC_MAX_CHUNKS)) ? Math.max(1, Number(process.env.DOC_MAX_CHUNKS)) : 200
        const chunks = chunkText(text, undefined as any, undefined as any, undefined as any, MAX_CHUNKS)

        // Free base text early to reduce memory pressure
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _free = (() => { return null })();
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).__freeTextRef = undefined

        if (chunks.length === 0) {
            throw new Error('No chunks generated from document')
        }

        // Insert chunks and embeddings incrementally to avoid large memory usage
        const trimmedChunks = chunks

        const insertChunk = db.prepare(`
            INSERT INTO document_chunks (document_id, chunk_index, content, token_count)
            VALUES (?, ?, ?, ?)
        `)
        const insertEmbedding = db.prepare(`
            INSERT INTO document_embeddings (chunk_id, vector_json)
            VALUES (?, ?)
        `)

        for (const chunk of trimmedChunks) {
            const result = insertChunk.run(documentId, chunk.index, chunk.content, chunk.tokenCount)
            const chunkId = result.lastInsertRowid as number
            const [embedding] = await generateEmbeddings([chunk.content], effectiveUserId)
            insertEmbedding.run(chunkId, JSON.stringify(embedding))
        }

        // Mark as completed
        db.prepare('UPDATE documents SET status = ?, error_message = NULL WHERE id = ?')
            .run('completed', documentId)

        console.log(`Document ${documentId} processed successfully: ${trimmedChunks.length} chunks, ${trimmedChunks.length} embeddings`)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error processing document ${documentId}:`, errorMessage)
        
        db.prepare('UPDATE documents SET status = ?, error_message = ? WHERE id = ?')
            .run('failed', errorMessage, documentId)
        
        throw error
    }
}

/**
 * Get all documents for a user
 */
export function getUserDocuments(userId: number): Document[] {
    return db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC')
        .all(userId) as Document[]
}

/**
 * Get a single document
 */
export function getDocument(documentId: number, userId: number): Document | undefined {
    return db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?')
        .get(documentId, userId) as Document | undefined
}

/**
 * Get a document by id (regardless of user). For internal server cleanup only.
 */
export function getDocumentById(documentId: number): Document | undefined {
    return db.prepare('SELECT * FROM documents WHERE id = ?')
        .get(documentId) as Document | undefined
}

/**
 * Delete a document and its associated files
 */
export async function deleteDocument(documentId: number, userId: number): Promise<void> {
    const doc = getDocument(documentId, userId)
    
    if (!doc) {
        throw new Error('Document not found')
    }

    // Delete file from disk
    try {
        await fs.unlink(doc.file_path)
    } catch (error) {
        console.error('Error deleting file:', error)
        // Continue with database deletion even if file deletion fails
    }

    // Delete from database (cascades to chunks and embeddings)
    db.prepare('DELETE FROM documents WHERE id = ?').run(documentId)
}

/**
 * Delete a document by id without requiring userId (server-internal cleanup).
 */
export async function deleteDocumentById(documentId: number): Promise<void> {
    const doc = getDocumentById(documentId)
    if (!doc) return

    // Delete file from disk
    try {
        await fs.unlink(doc.file_path)
    } catch (error) {
        console.error('Error deleting file:', error)
        // proceed
    }

    // Delete from database (cascades to chunks and embeddings)
    db.prepare('DELETE FROM documents WHERE id = ?').run(documentId)
}

/**
 * Delete all failed documents for a user (cleanup endpoint convenience).
 */
export async function deleteFailedDocumentsForUser(userId: number): Promise<number> {
    const failedDocs = db.prepare('SELECT id FROM documents WHERE user_id = ? AND status = ?').all(userId, 'failed') as Array<{ id: number }>
    for (const row of failedDocs) {
        await deleteDocumentById(row.id)
    }
    return failedDocs.length
}

/**
 * Search for similar chunks across all user documents
 */
export async function searchDocuments(
    userId: number,
    queryEmbedding: number[],
    topK: number = 6,
    maxPerDoc: number = 2
): Promise<SearchResult[]> {
    // Get all chunks with embeddings for this user
    const chunks = db.prepare(`
        SELECT 
            dc.id, dc.document_id, dc.chunk_index, dc.content, dc.token_count,
            de.vector_json,
            d.filename, d.mime_type, d.size_bytes, d.status, d.file_path, d.created_at
        FROM document_chunks dc
        JOIN document_embeddings de ON dc.id = de.chunk_id
        JOIN documents d ON dc.document_id = d.id
        WHERE d.user_id = ? AND d.status = 'completed'
    `).all(userId) as Array<DocumentChunk & { vector_json: string } & Omit<Document, 'id' | 'user_id' | 'error_message'> & { document_id: number }>

    if (chunks.length === 0) {
        return []
    }

    // Calculate similarities
    const results: SearchResult[] = []
    
    for (const chunk of chunks) {
        const embedding = JSON.parse(chunk.vector_json) as number[]
        
        // Calculate cosine similarity
        let dotProduct = 0
        let normA = 0
        let normB = 0

        for (let i = 0; i < queryEmbedding.length; i++) {
            dotProduct += queryEmbedding[i] * embedding[i]
            normA += queryEmbedding[i] * queryEmbedding[i]
            normB += embedding[i] * embedding[i]
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB)
        const similarity = denominator === 0 ? 0 : dotProduct / denominator

        results.push({
            chunk: {
                id: chunk.id,
                document_id: chunk.document_id,
                chunk_index: chunk.chunk_index,
                content: chunk.content,
                token_count: chunk.token_count
            },
            document: {
                id: chunk.document_id,
                user_id: userId,
                filename: chunk.filename,
                mime_type: chunk.mime_type,
                size_bytes: chunk.size_bytes,
                status: chunk.status,
                error_message: null,
                file_path: chunk.file_path,
                created_at: chunk.created_at
            },
            similarity
        })
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity)

    // Apply per-document limit and take top-k
    const docCounts = new Map<number, number>()
    const filtered: SearchResult[] = []

    for (const result of results) {
        const count = docCounts.get(result.document.id) || 0
        if (count < maxPerDoc) {
            filtered.push(result)
            docCounts.set(result.document.id, count + 1)
        }
        if (filtered.length >= topK) break
    }

    return filtered
}

/**
 * Get total storage used by a user (in bytes)
 */
export function getUserStorageUsed(userId: number): number {
    const result = db.prepare('SELECT SUM(size_bytes) as total FROM documents WHERE user_id = ?')
        .get(userId) as { total: number | null }
    return result.total || 0
}

