import db from './database.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function cleanupAll() {
    console.log('🧹 Starting complete cleanup...')

    // 1. Delete all document records from database
    const deleteEmbeddings = db.prepare('DELETE FROM document_embeddings')
    const deleteChunks = db.prepare('DELETE FROM document_chunks')
    const deleteDocuments = db.prepare('DELETE FROM documents')

    const embeddingsDeleted = deleteEmbeddings.run().changes
    const chunksDeleted = deleteChunks.run().changes
    const documentsDeleted = deleteDocuments.run().changes

    console.log(`✅ Deleted ${documentsDeleted} documents, ${chunksDeleted} chunks, ${embeddingsDeleted} embeddings from database`)

    // 2. Delete all uploaded files
    const uploadsDir = path.join(__dirname, '../database/uploads')
    
    try {
        const entries = await fs.readdir(uploadsDir, { withFileTypes: true })
        let filesDeleted = 0
        
        for (const entry of entries) {
            const fullPath = path.join(uploadsDir, entry.name)
            if (entry.isDirectory()) {
                // Delete user directory and all files inside
                await fs.rm(fullPath, { recursive: true, force: true })
                filesDeleted++
            } else {
                // Delete individual file
                await fs.unlink(fullPath)
                filesDeleted++
            }
        }
        
        console.log(`✅ Deleted ${filesDeleted} files/directories from uploads`)
    } catch (error) {
        console.log('⚠️  No uploads directory or already empty')
    }

    console.log('✨ Cleanup complete! Database and file system are clean.')
    console.log('🔄 Restart the server to clear the processing queue.')
}

cleanupAll()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Cleanup failed:', error)
        process.exit(1)
    })

