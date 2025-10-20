import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs/promises'
import { initDatabase } from './database.js'
import {
    register,
    login,
    logout,
    getCurrentUser,
    authenticateToken,
    AuthRequest
} from './auth.js'
import {
    getChats,
    getChat,
    createChat,
    updateChat,
    deleteChat,
    updateSelectedModel
} from './chats.js'
import {
    getUserDocuments,
    getDocument,
    getDocumentContent,
    deleteDocument,
    getUserStorageUsed,
    searchDocuments,
    deleteFailedDocumentsForUser
} from './documents.js'
import {
    getUserSettings,
    updateUserSettings,
    validateProvider,
    validateEmbedding,
    getProviderModels,
    getProviderSettings,
    updateProviderSettings
} from './userSettings.js'
import { proxyChat } from './chat.js'
import { searchWeb } from './search.js'
import { documentWorker } from './worker.js'
import { generateQueryEmbedding } from './embeddings.js'
import db from './database.js'

const app = express()
const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

// Middleware
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({ limit: '50mb' })) // Increased limit for attachments
app.use(cookieParser())

// Initialize database
initDatabase()

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../database/uploads')

// Ensure uploads directory exists
await fs.mkdir(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const userId = (req as AuthRequest).userId
        if (!userId) {
            return cb(new Error('User not authenticated'), '')
        }
        
        const userDir = path.join(uploadsDir, String(userId))
        await fs.mkdir(userDir, { recursive: true })
        cb(null, userDir)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = path.extname(file.originalname)
        cb(null, uniqueSuffix + ext)
    }
})

const upload = multer({
    storage,
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ]
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error('Invalid file type. Only PDF, DOCX, and XLSX files are allowed.'))
        }
    }
})

// Auth routes
app.post('/api/auth/register', register)
app.post('/api/auth/login', login)
app.post('/api/auth/logout', logout)
app.get('/api/auth/me', authenticateToken, getCurrentUser)

// Chat routes (all require authentication)
app.get('/api/chats', authenticateToken, getChats)
app.get('/api/chats/:chatId', authenticateToken, getChat)
app.post('/api/chats', authenticateToken, createChat)
app.put('/api/chats/:chatId', authenticateToken, updateChat)
app.delete('/api/chats/:chatId', authenticateToken, deleteChat)

// User settings
app.get('/api/user/settings', authenticateToken, getUserSettings)
app.put('/api/user/settings', authenticateToken, updateUserSettings)
app.post('/api/user/validate-provider', authenticateToken, validateProvider)
app.post('/api/user/validate-embedding', authenticateToken, validateEmbedding)
app.post('/api/user/provider-models', authenticateToken, getProviderModels)
app.post('/api/user/provider-settings/get', authenticateToken, getProviderSettings)
app.post('/api/user/provider-settings/update', authenticateToken, updateProviderSettings)
app.put('/api/user/model', authenticateToken, updateSelectedModel)

// Chat proxy (uses user's stored provider settings)
app.post('/api/chat', authenticateToken, proxyChat)

// Web search (provider-agnostic)
app.post('/api/search', authenticateToken, searchWeb)

// Document routes (all require authentication)
// Upload document
app.post('/api/docs/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' })
        }

        const userId = (req as AuthRequest).userId!
        const storageUsed = getUserStorageUsed(userId)
        const maxStorage = 200 * 1024 * 1024 // 200MB

        if (storageUsed + req.file.size > maxStorage) {
            // Delete uploaded file
            await fs.unlink(req.file.path)
            return res.status(413).json({ error: 'Storage limit exceeded (200MB max)' })
        }

        // Insert document record
        const result = db.prepare(`
            INSERT INTO documents (user_id, filename, mime_type, size_bytes, status, file_path)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, req.file.originalname, req.file.mimetype, req.file.size, 'uploading', req.file.path)

        const documentId = result.lastInsertRowid as number

        // Enqueue for processing
        documentWorker.enqueue(documentId, userId)

        res.json({ documentId, status: 'uploading' })
    } catch (error) {
        console.error('Upload error:', error)
        res.status(500).json({ error: 'Failed to upload document' })
    }
})

// List user documents
app.get('/api/docs', authenticateToken, (req, res) => {
    try {
        const userId = (req as AuthRequest).userId!
        const documents = getUserDocuments(userId)
        const storageUsed = getUserStorageUsed(userId)
        
        res.json({ documents, storageUsed })
    } catch (error) {
        console.error('List documents error:', error)
        res.status(500).json({ error: 'Failed to list documents' })
    }
})

// Get document details
app.get('/api/docs/:id', authenticateToken, (req, res) => {
    try {
        const userId = (req as AuthRequest).userId!
        const documentId = parseInt(req.params.id)
        
        const document = getDocument(documentId, userId)
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' })
        }
        
        res.json(document)
    } catch (error) {
        console.error('Get document error:', error)
        res.status(500).json({ error: 'Failed to get document' })
    }
})

// Get document content
app.get('/api/docs/:id/content', authenticateToken, (req, res) => {
    try {
        const userId = (req as AuthRequest).userId!
        const documentId = parseInt(req.params.id)
        
        const document = getDocument(documentId, userId)
        if (!document) {
            return res.status(404).json({ error: 'Document not found' })
        }
        
        const content = getDocumentContent(documentId, userId)
        
        res.json({ content, document })
    } catch (error) {
        console.error('Get document content error:', error)
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get document content' })
    }
})

// Delete document
app.delete('/api/docs/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).userId!
        const documentId = parseInt(req.params.id)
        
        await deleteDocument(documentId, userId)
        
        res.json({ success: true })
    } catch (error) {
        console.error('Delete document error:', error)
        res.status(500).json({ error: 'Failed to delete document' })
    }
})

// Search documents (debug endpoint)
app.post('/api/docs/search', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).userId!
        const { query, topK = 6 } = req.body
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' })
        }
        
        const queryEmbedding = await generateQueryEmbedding(query, userId)
        const results = await searchDocuments(userId, queryEmbedding, topK)
        
        res.json({ results })
    } catch (error) {
        console.error('Search error:', error)
        res.status(500).json({ error: 'Failed to search documents' })
    }
})

// Cleanup routes
// Flush queue (no processing) — for the current user this just clears pending jobs globally
app.post('/api/docs/queue/flush', authenticateToken, (req, res) => {
    try {
        const removed = documentWorker.flushQueue()
        res.json({ success: true, removed })
    } catch (error) {
        console.error('Flush queue error:', error)
        res.status(500).json({ error: 'Failed to flush queue' })
    }
})

// Delete all failed documents for the current user
app.delete('/api/docs/failed', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).userId!
        const count = await deleteFailedDocumentsForUser(userId)
        res.json({ success: true, deleted: count })
    } catch (error) {
        console.error('Delete failed documents error:', error)
        res.status(500).json({ error: 'Failed to delete failed documents' })
    }
})

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' })
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})

