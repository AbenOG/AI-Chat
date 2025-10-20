import { Response } from 'express'
import { AuthRequest } from './auth.js'
import db from './database.js'

// Get all chats for user
export function getChats(req: AuthRequest, res: Response) {
    try {
        const chats = db.prepare(`
            SELECT id, title, mode, created_at, updated_at
            FROM chats
            WHERE user_id = ?
            ORDER BY updated_at DESC
        `).all(req.userId) as Array<{
            id: number
            title: string
            mode: string
            created_at: string
            updated_at: string
        }>

        res.json({ chats })
    } catch (error) {
        console.error('Get chats error:', error)
        res.status(500).json({ error: 'Failed to fetch chats' })
    }
}

// Get single chat with messages
export function getChat(req: AuthRequest, res: Response) {
    const { chatId } = req.params
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
    const before = req.query.before ? parseInt(req.query.before as string) : undefined

    try {
        // Get chat
        const chat = db.prepare(`
            SELECT id, title, mode, created_at, updated_at
            FROM chats
            WHERE id = ? AND user_id = ?
        `).get(chatId, req.userId) as {
            id: number
            title: string
            mode: string
            created_at: string
            updated_at: string
        } | undefined

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' })
        }

        // Get total message count
        const totalCount = db.prepare(`
            SELECT COUNT(*) as count FROM messages WHERE chat_id = ?
        `).get(chatId) as { count: number }

        // Get messages with pagination
        let messagesQuery = `
            SELECT id, role, content, model, 
                   tokens_input, tokens_output, tokens_thinking,
                   cost, thinking, research_metadata, created_at
            FROM messages
            WHERE chat_id = ?
        `
        
        const params: any[] = [chatId]
        
        // If 'before' is specified, get messages before that ID
        if (before) {
            messagesQuery += ` AND id < ?`
            params.push(before)
        }
        
        messagesQuery += ` ORDER BY created_at DESC`
        
        // Apply limit if specified (for pagination)
        if (limit) {
            messagesQuery += ` LIMIT ?`
            params.push(limit)
        }

        let messages = db.prepare(messagesQuery).all(...params) as Array<any>
        
        // Reverse to get chronological order (oldest first)
        messages = messages.reverse()

        // Get attachments and quoted texts for each message
        for (const message of messages) {
            // Get attachments
            message.attachments = db.prepare(`
                SELECT id, type, name, url, mime_type as mimeType, size, extracted_text as extractedText
                FROM attachments
                WHERE message_id = ?
            `).all(message.id)

            // Get quoted text
            const quotedText = db.prepare(`
                SELECT text, quoted_message_id as messageId
                FROM quoted_texts
                WHERE message_id = ?
            `).get(message.id) as { text: string; messageId: string } | undefined

            if (quotedText) {
                message.quotedText = quotedText
            }

            // Format tokens
            if (message.tokens_input || message.tokens_output || message.tokens_thinking) {
                message.tokens = {
                    input: message.tokens_input || 0,
                    output: message.tokens_output || 0,
                    thinking: message.tokens_thinking || 0
                }
            }

            // Parse research metadata if present
            if (message.research_metadata) {
                try {
                    message.researchMetadata = JSON.parse(message.research_metadata)
                    message.isResearch = true
                } catch (e) {
                    console.error('Failed to parse research metadata:', e)
                }
            }

            // Clean up redundant fields
            delete message.tokens_input
            delete message.tokens_output
            delete message.tokens_thinking
            delete message.research_metadata

            // Convert timestamp to Date for frontend
            message.timestamp = message.created_at
            delete message.created_at
        }

        res.json({
            chat: {
                ...chat,
                messages,
                totalMessages: totalCount.count,
                hasMore: before ? messages.length === limit : totalCount.count > (limit || totalCount.count)
            }
        })
    } catch (error) {
        console.error('Get chat error:', error)
        res.status(500).json({ error: 'Failed to fetch chat' })
    }
}

// Create new chat
export function createChat(req: AuthRequest, res: Response) {
    const { title, messages, mode } = req.body

    if (!title || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Title and messages are required' })
    }

    try {
        // Start transaction
        const createChatStmt = db.prepare('INSERT INTO chats (user_id, title, mode) VALUES (?, ?, ?)')
        const createMessageStmt = db.prepare(`
            INSERT INTO messages (chat_id, role, content, model, tokens_input, tokens_output, tokens_thinking, cost, thinking, research_metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        const createAttachmentStmt = db.prepare(`
            INSERT INTO attachments (message_id, type, name, url, mime_type, size, extracted_text, document_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        const createQuotedTextStmt = db.prepare(`
            INSERT INTO quoted_texts (message_id, text, quoted_message_id)
            VALUES (?, ?, ?)
        `)

        const transaction = db.transaction(() => {
            // Create chat
            const chatResult = createChatStmt.run(req.userId, title, mode || 'chat')
            const chatId = chatResult.lastInsertRowid as number

            // Create messages
            for (const message of messages) {
                const researchMetadataJson = message.researchMetadata ? JSON.stringify(message.researchMetadata) : null

                const messageResult = createMessageStmt.run(
                    chatId,
                    message.role,
                    message.content,
                    message.model || null,
                    message.tokens?.input || null,
                    message.tokens?.output || null,
                    message.tokens?.thinking || null,
                    message.cost || null,
                    message.thinking || null,
                    researchMetadataJson
                )
                const messageId = messageResult.lastInsertRowid as number

                // Create attachments
                if (message.attachments && message.attachments.length > 0) {
                    for (const attachment of message.attachments) {
                        createAttachmentStmt.run(
                            messageId,
                            attachment.type,
                            attachment.name,
                            attachment.url || null,
                            attachment.mimeType,
                            attachment.size,
                            attachment.extractedText || null,
                            attachment.documentId || null
                        )
                    }
                }

                // Create quoted text
                if (message.quotedText) {
                    createQuotedTextStmt.run(
                        messageId,
                        message.quotedText.text,
                        message.quotedText.messageId
                    )
                }
            }

            return chatId
        })

        const chatId = transaction()

        res.json({
            success: true,
            chatId
        })
    } catch (error) {
        console.error('Create chat error:', error)
        res.status(500).json({ error: 'Failed to create chat' })
    }
}

// Update chat (add message or update title or mode)
export function updateChat(req: AuthRequest, res: Response) {
    const { chatId } = req.params
    const { title, message, mode } = req.body

    try {
        // Verify chat belongs to user
        const chat = db.prepare('SELECT id FROM chats WHERE id = ? AND user_id = ?').get(chatId, req.userId)
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' })
        }

        if (title) {
            // Update title
            db.prepare('UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, chatId)
        }

        if (mode) {
            // Update mode
            db.prepare('UPDATE chats SET mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(mode, chatId)
        }

        if (message) {
            // Add message
            const researchMetadataJson = message.researchMetadata ? JSON.stringify(message.researchMetadata) : null

            const messageResult = db.prepare(`
                INSERT INTO messages (chat_id, role, content, model, tokens_input, tokens_output, tokens_thinking, cost, thinking, research_metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                chatId,
                message.role,
                message.content,
                message.model || null,
                message.tokens?.input || null,
                message.tokens?.output || null,
                message.tokens?.thinking || null,
                message.cost || null,
                message.thinking || null,
                researchMetadataJson
            )
            const messageId = messageResult.lastInsertRowid as number

            // Add attachments if present
            if (message.attachments && message.attachments.length > 0) {
                const stmt = db.prepare(`
                    INSERT INTO attachments (message_id, type, name, url, mime_type, size, extracted_text, document_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `)
                for (const attachment of message.attachments) {
                    stmt.run(
                        messageId,
                        attachment.type,
                        attachment.name,
                        attachment.url || null,
                        attachment.mimeType,
                        attachment.size,
                        attachment.extractedText || null,
                        attachment.documentId || null
                    )
                }
            }

            // Add quoted text if present
            if (message.quotedText) {
                db.prepare(`
                    INSERT INTO quoted_texts (message_id, text, quoted_message_id)
                    VALUES (?, ?, ?)
                `).run(messageId, message.quotedText.text, message.quotedText.messageId)
            }

            // Update chat timestamp
            db.prepare('UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(chatId)
        }

        res.json({ success: true })
    } catch (error) {
        console.error('Update chat error:', error)
        res.status(500).json({ error: 'Failed to update chat' })
    }
}

// Delete chat
export function deleteChat(req: AuthRequest, res: Response) {
    const { chatId } = req.params

    try {
        const result = db.prepare('DELETE FROM chats WHERE id = ? AND user_id = ?').run(chatId, req.userId)

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Chat not found' })
        }

        res.json({ success: true })
    } catch (error) {
        console.error('Delete chat error:', error)
        res.status(500).json({ error: 'Failed to delete chat' })
    }
}

// Update user's selected model
export function updateSelectedModel(req: AuthRequest, res: Response) {
    const { model } = req.body

    if (!model) {
        return res.status(400).json({ error: 'Model is required' })
    }

    try {
        db.prepare('UPDATE users SET selected_model = ? WHERE id = ?').run(model, req.userId)
        res.json({ success: true })
    } catch (error) {
        console.error('Update model error:', error)
        res.status(500).json({ error: 'Failed to update selected model' })
    }
}

