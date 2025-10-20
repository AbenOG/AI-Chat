import type { Request, Response } from 'express'
import type { AuthRequest } from './auth.js'
import db from './database.js'
import { decrypt } from './utils/crypto.js'

/**
 * Proxy chat requests to the configured AI provider
 * Uses user's stored API key and provider settings
 */
export const proxyChat = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).userId!
        
        // Get user's provider settings
        const settings = db.prepare(`
            SELECT provider, provider_api_key_encrypted, provider_base_url, system_prompt
            FROM user_settings
            WHERE user_id = ?
        `).get(userId) as any

        if (!settings || !settings.provider) {
            return res.status(400).json({ 
                error: 'No AI provider configured. Please complete your settings first.' 
            })
        }

        // Decrypt the API key (if present - Ollama doesn't require one for local)
        let apiKey: string | null = null
        if (settings.provider_api_key_encrypted) {
            try {
                apiKey = decrypt(settings.provider_api_key_encrypted)
            } catch (error) {
                console.error('Failed to decrypt provider API key:', error)
                return res.status(500).json({ 
                    error: 'Failed to decrypt your API key. Please update your provider settings.' 
                })
            }
        } else if (settings.provider !== 'ollama') {
            // API key is required for all providers except Ollama
            return res.status(400).json({ 
                error: 'API key not configured. Please update your provider settings.' 
            })
        }

        const provider = settings.provider
        const baseUrl = settings.provider_base_url
        const systemPrompt = settings.system_prompt

        // Get request body
        const { messages, model, stream = false, ...otherParams } = req.body

        // Get current date for date awareness
        const now = new Date()
        const dateStr = now.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        }) // Format: DD/MM/YYYY
        const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
        const dateContext = `Today is ${dayName}, ${dateStr}.`

        // Apply system prompt if configured and not already in messages
        let finalMessages = messages
        if (systemPrompt && messages.length > 0) {
            const hasSystemMessage = messages.some((m: any) => m.role === 'system')
            if (!hasSystemMessage) {
                finalMessages = [
                    { role: 'system', content: `${dateContext}\n\n${systemPrompt}` },
                    ...messages
                ]
            } else {
                // Prepend date to existing system message
                finalMessages = messages.map((m: any, idx: number) => 
                    idx === 0 && m.role === 'system' 
                        ? { ...m, content: `${dateContext}\n\n${m.content}` }
                        : m
                )
            }
        } else if (messages.length > 0) {
            // No custom system prompt, but still add date awareness
            const hasSystemMessage = messages.some((m: any) => m.role === 'system')
            if (!hasSystemMessage) {
                finalMessages = [
                    { role: 'system', content: dateContext },
                    ...messages
                ]
            } else {
                // Prepend date to existing system message
                finalMessages = messages.map((m: any, idx: number) => 
                    idx === 0 && m.role === 'system' 
                        ? { ...m, content: `${dateContext}\n\n${m.content}` }
                        : m
                )
            }
        }

        // Build the appropriate API request based on provider
        let apiUrl: string
        let headers: Record<string, string>
        let body: any

        switch (provider) {
            case 'openrouter':
                apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
                headers = {
                    'Authorization': `Bearer ${apiKey!}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': req.headers.referer || req.headers.origin || 'http://localhost:5173',
                    'X-Title': 'AI Chat'
                }
                body = {
                    model,
                    messages: finalMessages,
                    stream,
                    ...otherParams
                }
                break

            case 'openai':
                apiUrl = 'https://api.openai.com/v1/chat/completions'
                headers = {
                    'Authorization': `Bearer ${apiKey!}`,
                    'Content-Type': 'application/json'
                }
                body = {
                    model,
                    messages: finalMessages,
                    stream,
                    ...otherParams
                }
                break

            case 'anthropic':
                apiUrl = 'https://api.anthropic.com/v1/messages'
                headers = {
                    'x-api-key': apiKey!,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                }
                // Anthropic has a different format - extract system from messages
                const systemMsg = finalMessages.find((m: any) => m.role === 'system')
                const nonSystemMessages = finalMessages.filter((m: any) => m.role !== 'system')
                body = {
                    model,
                    messages: nonSystemMessages,
                    ...(systemMsg && { system: systemMsg.content }),
                    max_tokens: otherParams.max_tokens || 4096,
                    stream,
                    ...otherParams
                }
                break

            case 'openai_compatible':
            case 'ollama':
                if (!baseUrl) {
                    return res.status(400).json({ 
                        error: 'Base URL is required for this provider' 
                    })
                }
                apiUrl = `${baseUrl}/v1/chat/completions`
                headers = {
                    'Content-Type': 'application/json'
                }
                // Only add auth header for openai_compatible (Ollama doesn't need it for local)
                if (provider === 'openai_compatible' && apiKey) {
                    headers['Authorization'] = `Bearer ${apiKey}`
                }
                body = {
                    model,
                    messages: finalMessages,
                    stream,
                    ...otherParams
                }
                break

            default:
                return res.status(400).json({ 
                    error: `Unsupported provider: ${provider}` 
                })
        }

        // Make the request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        })

        // Handle streaming responses
        if (stream && response.body) {
            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')

            // Pipe the response directly to the client
            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    const chunk = decoder.decode(value, { stream: true })
                    res.write(chunk)
                }
                res.end()
            } catch (error) {
                console.error('Stream error:', error)
                res.end()
            }
        } else {
            // Handle non-streaming responses
            const data = await response.json()
            
            if (!response.ok) {
                console.error('Provider API error:', data)
                return res.status(response.status).json({
                    error: data.error?.message || data.error || 'Provider API request failed'
                })
            }

            res.json(data)
        }
    } catch (error: any) {
        console.error('Chat proxy error:', error)
        res.status(500).json({ 
            error: error.message || 'An error occurred while processing your request'
        })
    }
}

