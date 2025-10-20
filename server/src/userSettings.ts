import { Request, Response } from 'express'
import db from './database.js'
import { AuthRequest } from './auth.js'
import { encrypt, decrypt } from './utils/crypto.js'
import { clearClientCache } from './embeddings.js'

interface UserSettings {
    displayName?: string
    systemPrompt?: string
    provider?: 'openrouter' | 'openai' | 'anthropic' | 'openai_compatible' | 'ollama'
    providerApiKey?: string
    providerBaseUrl?: string
    embeddingApiKey?: string
    embeddingModel?: string
    onboardingComplete?: boolean
}

/**
 * Get user settings (API keys are masked for security)
 */
export const getUserSettings = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).userId!

        const settings = db.prepare(`
            SELECT 
                display_name,
                system_prompt,
                provider,
                provider_api_key_encrypted,
                provider_base_url,
                selected_model,
                embedding_api_key_encrypted,
                embedding_model,
                onboarding_complete,
                font_size,
                font_family
            FROM user_settings
            WHERE user_id = ?
        `).get(userId) as any

        if (!settings) {
            // Return defaults if no settings yet
            return res.json({
                display_name: '',
                system_prompt: '',
                provider: null,
                provider_api_key_masked: null,
                provider_base_url: null,
                selected_model: null,
                embedding_api_key_masked: null,
                embedding_model: null,
                onboarding_complete: false,
                font_size: 'medium',
                font_family: 'inter'
            })
        }

        // Mask API keys for security (show only first 8 chars)
        const maskKey = (encrypted: string | null) => {
            if (!encrypted) return null
            try {
                const decrypted = decrypt(encrypted)
                return decrypted.length > 8 ? `${decrypted.slice(0, 8)}...` : '***'
            } catch {
                return null
            }
        }
        
        // Get full decrypted keys (user can choose to reveal them)
        const getFullKey = (encrypted: string | null) => {
            if (!encrypted) return null
            try {
                return decrypt(encrypted)
            } catch {
                return null
            }
        }

        // Load provider-scoped settings for the currently selected provider
        const prov = settings.provider as string | null
        const providerRow = prov ? db.prepare(`
            SELECT api_key_encrypted, base_url, selected_model FROM user_provider_settings
            WHERE user_id = ? AND provider = ?
        `).get(userId, prov) as any : null

        const isOllama = settings.provider === 'ollama'

        res.json({
            display_name: settings.display_name || '',
            system_prompt: settings.system_prompt || '',
            provider: settings.provider || null,
            // Do not return any provider API key values when provider is Ollama (optional/no key)
            // Prefer provider-scoped storage; fall back to legacy columns
            provider_api_key_masked: isOllama ? null : maskKey(providerRow?.api_key_encrypted ?? settings.provider_api_key_encrypted),
            provider_api_key: isOllama ? null : getFullKey(providerRow?.api_key_encrypted ?? settings.provider_api_key_encrypted),
            provider_base_url: (providerRow?.base_url ?? settings.provider_base_url) || null,
            // Do not fall back to global selected_model across providers to avoid cross-provider bleed
            selected_model: providerRow?.selected_model || null,
            embedding_api_key_masked: maskKey(settings.embedding_api_key_encrypted),
            embedding_api_key: getFullKey(settings.embedding_api_key_encrypted),
            embedding_model: settings.embedding_model || null,
            onboarding_complete: settings.onboarding_complete === 1,
            font_size: settings.font_size || 'medium',
            font_family: settings.font_family || 'inter'
        })
    } catch (error) {
        console.error('Get user settings error:', error)
        res.status(500).json({ error: 'Failed to get user settings' })
    }
}

/**
 * Update user settings (encrypt API keys before storing)
 */
export const updateUserSettings = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).userId!
        
        console.log('Update settings request body:', JSON.stringify(req.body, null, 2))
        
        const {
            display_name,
            displayName,
            system_prompt,
            systemPrompt,
            provider,
            provider_api_key,
            providerApiKey,
            provider_base_url,
            providerBaseUrl,
            selected_model,
            selectedModel,
            embedding_api_key,
            embeddingApiKey,
            embedding_model,
            embeddingModel,
            onboarding_complete,
            onboardingComplete,
            font_size,
            fontSize,
            font_family,
            fontFamily
        } = req.body

        // Support both camelCase and snake_case for flexibility
        const finalDisplayName = display_name || displayName
        const finalSystemPrompt = system_prompt || systemPrompt
        const finalProviderApiKey = provider_api_key || providerApiKey
        const finalProviderBaseUrl = provider_base_url || providerBaseUrl
        const finalSelectedModel = selected_model || selectedModel
        const finalEmbeddingApiKey = embedding_api_key || embeddingApiKey
        const finalEmbeddingModel = embedding_model || embeddingModel
        const finalOnboardingComplete = onboarding_complete !== undefined ? onboarding_complete : onboardingComplete
        const finalFontSize = font_size || fontSize
        const finalFontFamily = font_family || fontFamily
        
        console.log('Parsed values:', {
            finalDisplayName,
            finalSystemPrompt: finalSystemPrompt ? 'present' : 'missing',
            provider,
            finalProviderApiKey: finalProviderApiKey ? 'present' : 'missing',
            finalProviderBaseUrl,
            finalEmbeddingApiKey: finalEmbeddingApiKey ? 'present' : 'missing',
            finalEmbeddingModel,
            finalOnboardingComplete
        })

        // Check if settings exist
        const existing = db.prepare('SELECT user_id FROM user_settings WHERE user_id = ?').get(userId)

        if (existing) {
            // Update existing settings
            const updates: string[] = []
            const values: any[] = []

            if (finalDisplayName !== undefined) {
                updates.push('display_name = ?')
                values.push(finalDisplayName)
            }
            if (finalSystemPrompt !== undefined) {
                updates.push('system_prompt = ?')
                values.push(finalSystemPrompt)
            }
            if (provider !== undefined) {
                updates.push('provider = ?')
                values.push(provider)
            }
            // Provider-scoped upsert (do not erase other providers)
            if (provider !== undefined) {
                const encryptedKey = finalProviderApiKey && !finalProviderApiKey.endsWith('...')
                    ? encrypt(finalProviderApiKey)
                    : undefined
                const hasExisting = db.prepare('SELECT 1 FROM user_provider_settings WHERE user_id = ? AND provider = ?').get(userId, provider)
                if (hasExisting) {
                    const parts: string[] = []
                    const vals: any[] = []
                    if (encryptedKey !== undefined) { parts.push('api_key_encrypted = ?'); vals.push(encryptedKey) }
                    if (finalProviderBaseUrl !== undefined) { parts.push('base_url = ?'); vals.push(finalProviderBaseUrl) }
                    if (finalSelectedModel !== undefined) { parts.push('selected_model = ?'); vals.push(finalSelectedModel) }
                    if (parts.length > 0) {
                        vals.push(userId, provider)
                        db.prepare(`UPDATE user_provider_settings SET ${parts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND provider = ?`).run(...vals)
                    }
                } else {
                    db.prepare(`
                        INSERT INTO user_provider_settings (user_id, provider, api_key_encrypted, base_url, selected_model)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(userId, provider, encryptedKey ?? null, finalProviderBaseUrl ?? null, finalSelectedModel ?? null)
                }
            }
            if (finalEmbeddingApiKey !== undefined && finalEmbeddingApiKey !== null) {
                // Only update if not masked
                if (!finalEmbeddingApiKey.endsWith('...')) {
                    try {
                        const encrypted = encrypt(finalEmbeddingApiKey)
                        updates.push('embedding_api_key_encrypted = ?')
                        values.push(encrypted)
                        console.log('Embedding API key encrypted successfully')
                        // Clear the embedding client cache when key changes
                        clearClientCache(userId)
                    } catch (encryptError) {
                        console.error('Failed to encrypt embedding API key:', encryptError)
                        throw new Error('Failed to encrypt API key')
                    }
                }
            }
            if (finalEmbeddingModel !== undefined) {
                updates.push('embedding_model = ?')
                values.push(finalEmbeddingModel)
            }
            if (finalOnboardingComplete !== undefined) {
                updates.push('onboarding_complete = ?')
                values.push(finalOnboardingComplete ? 1 : 0)
            }
            if (finalFontSize !== undefined) {
                updates.push('font_size = ?')
                values.push(finalFontSize)
            }
            if (finalFontFamily !== undefined) {
                updates.push('font_family = ?')
                values.push(finalFontFamily)
            }

            if (updates.length > 0) {
                updates.push('updated_at = CURRENT_TIMESTAMP')
                values.push(userId)

                const sql = `
                    UPDATE user_settings
                    SET ${updates.join(', ')}
                    WHERE user_id = ?
                `
                console.log('Executing UPDATE with', updates.length - 1, 'fields')
                try {
                    db.prepare(sql).run(...values)
                    console.log('UPDATE successful')
                } catch (dbError) {
                    console.error('Database UPDATE error:', dbError)
                    throw dbError
                }
            } else {
                console.log('No updates to perform')
            }
        } else {
            // Insert new settings
            console.log('Creating new user_settings row for user', userId)
            try {
                db.prepare(`
                    INSERT INTO user_settings (
                        user_id,
                        display_name,
                        system_prompt,
                        provider,
                        provider_api_key_encrypted,
                        provider_base_url,
                        selected_model,
                        embedding_api_key_encrypted,
                        embedding_model,
                        onboarding_complete,
                        font_size,
                        font_family
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    userId,
                    finalDisplayName || '',
                    finalSystemPrompt || '',
                    provider || null,
                    finalProviderApiKey ? encrypt(finalProviderApiKey) : null,
                    finalProviderBaseUrl || null,
                    finalSelectedModel || null,
                    finalEmbeddingApiKey ? encrypt(finalEmbeddingApiKey) : null,
                    finalEmbeddingModel || null,
                    finalOnboardingComplete ? 1 : 0,
                    finalFontSize || 'medium',
                    finalFontFamily || 'inter'
                )
                console.log('INSERT successful')
            } catch (dbError) {
                console.error('Database INSERT error:', dbError)
                throw dbError
            }
        }

        console.log('User settings saved successfully')
        res.json({ success: true })
    } catch (error) {
        console.error('Update user settings error:', error)
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to update user settings' 
        })
    }
}

/**
 * Fetch available models from the provider
 */
export const getProviderModels = async (req: Request, res: Response) => {
    try {
        const { provider, apiKey, baseUrl } = req.body

        if (!provider) {
            return res.status(400).json({ error: 'Provider is required' })
        }
        
        // Ollama doesn't require an API key for local installations
        if (provider !== 'ollama' && !apiKey) {
            return res.status(400).json({ error: 'API key is required' })
        }

        let apiUrl: string
        let headers: Record<string, string> = {}

        switch (provider) {
            case 'openai':
                apiUrl = 'https://api.openai.com/v1/models'
                headers = {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
                break

            case 'anthropic':
                // Anthropic doesn't have a public models endpoint, return static list
                return res.json({ 
                    models: [
                        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
                        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
                        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
                        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
                        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
                    ]
                })

            case 'openai_compatible':
                if (!baseUrl) {
                    return res.status(400).json({ error: 'Base URL is required' })
                }
                apiUrl = `${baseUrl.replace(/\/$/, '')}/v1/models`
                headers = {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
                break

            case 'ollama':
                if (!baseUrl) {
                    return res.status(400).json({ error: 'Base URL is required for Ollama' })
                }
                apiUrl = `${baseUrl.replace(/\/$/, '')}/api/tags`
                // Ollama doesn't use auth by default
                break

            case 'openrouter':
                // Return empty array - OpenRouter uses predefined models in frontend
                return res.json({ models: [] })

            default:
                return res.status(400).json({ error: 'Unsupported provider' })
        }

        const response = await fetch(apiUrl, { 
            headers,
            signal: AbortSignal.timeout(10000) // 10 second timeout
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Failed to fetch models from ${provider}:`, errorText)
            return res.status(response.status).json({ 
                error: `Failed to fetch models: ${response.statusText}` 
            })
        }

        const data = await response.json()

        // Format response based on provider
        let models: Array<{ id: string; name: string }>

        switch (provider) {
            case 'openai':
            case 'openai_compatible':
                // OpenAI format: { data: [{ id: "gpt-4", ... }] }
                models = data.data
                    ?.filter((m: any) => m.id)
                    .map((m: any) => ({ id: m.id, name: m.id })) || []
                break

            case 'ollama':
                // Ollama format: { models: [{ name: "llama2", ... }] }
                models = data.models
                    ?.filter((m: any) => m.name)
                    .map((m: any) => ({ id: m.name, name: m.name })) || []
                break

            default:
                models = []
        }

        res.json({ models })
    } catch (error: any) {
        console.error('Error fetching provider models:', error)
        res.status(500).json({ 
            error: error.message || 'Failed to fetch models' 
        })
    }
}

/**
 * Validate AI provider credentials
 */
export const validateProvider = async (req: Request, res: Response) => {
    try {
        const { provider, apiKey, baseUrl } = req.body

        if (!provider) {
            return res.status(400).json({ error: 'Provider is required' })
        }
        
        // Ollama doesn't require an API key for local installations
        if (provider !== 'ollama' && !apiKey) {
            return res.status(400).json({ error: 'API key is required' })
        }

        // Test the provider with a simple API call
        let testUrl = ''
        let testHeaders: Record<string, string> = {}

        switch (provider) {
            case 'openrouter':
                testUrl = 'https://openrouter.ai/api/v1/models'
                testHeaders = {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
                break

            case 'openai':
                testUrl = 'https://api.openai.com/v1/models'
                testHeaders = {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
                break

            case 'anthropic':
                testUrl = 'https://api.anthropic.com/v1/messages'
                testHeaders = {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                }
                // For Anthropic, we'll do a minimal test request
                const anthropicResponse = await fetch(testUrl, {
                    method: 'POST',
                    headers: testHeaders,
                    body: JSON.stringify({
                        model: 'claude-3-haiku-20240307',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'test' }]
                    })
                })
                
                if (anthropicResponse.ok || anthropicResponse.status === 400) {
                    // 400 is acceptable (rate limit or minimal request issue), means auth worked
                    return res.json({ valid: true })
                }
                return res.status(400).json({ error: 'Invalid Anthropic API key' })

            case 'openai_compatible':
                if (!baseUrl) {
                    return res.status(400).json({ error: 'Base URL is required for OpenAI-compatible provider' })
                }
                testUrl = `${baseUrl.replace(/\/$/, '')}/v1/models`
                testHeaders = {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
                break

            case 'ollama':
                if (!baseUrl) {
                    return res.status(400).json({ error: 'Base URL is required for Ollama' })
                }
                testUrl = `${baseUrl.replace(/\/$/, '')}/api/tags`
                // Ollama doesn't use auth by default
                break

            default:
                return res.status(400).json({ error: 'Unsupported provider' })
        }

        const response = await fetch(testUrl, { 
            headers: testHeaders,
            signal: AbortSignal.timeout(5000) // 5 second timeout
        })

        if (response.ok) {
            res.json({ valid: true })
        } else {
            const errorText = await response.text()
            console.error('Provider validation failed:', errorText)
            res.status(400).json({ error: 'Invalid credentials or provider unavailable' })
        }
    } catch (error) {
        console.error('Validate provider error:', error)
        res.status(400).json({ error: 'Failed to validate provider. Check your credentials and network.' })
    }
}

/**
 * Validate OpenAI embedding credentials
 */
export const validateEmbedding = async (req: Request, res: Response) => {
    try {
        const { apiKey, model } = req.body

        if (!apiKey) {
            return res.status(400).json({ error: 'API key is required' })
        }

        // Test with a minimal embedding request
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || 'text-embedding-3-small',
                input: 'test'
            }),
            signal: AbortSignal.timeout(5000)
        })

        if (response.ok) {
            res.json({ valid: true })
        } else {
            const errorText = await response.text()
            console.error('Embedding validation failed:', errorText)
            res.status(400).json({ error: 'Invalid OpenAI API key or model unavailable' })
        }
    } catch (error) {
        console.error('Validate embedding error:', error)
        res.status(400).json({ error: 'Failed to validate embedding. Check your API key and network.' })
    }
}

/**
 * Get provider-scoped settings for a specific provider
 */
export const getProviderSettings = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).userId!
        const { provider } = req.body as { provider?: string }

        if (!provider) {
            return res.status(400).json({ error: 'Provider is required' })
        }

        const row = db.prepare(`
            SELECT api_key_encrypted, base_url, selected_model
            FROM user_provider_settings
            WHERE user_id = ? AND provider = ?
        `).get(userId, provider) as any

        const maskKey = (encrypted: string | null) => {
            if (!encrypted) return null
            try {
                const decrypted = decrypt(encrypted)
                return decrypted.length > 8 ? `${decrypted.slice(0, 8)}...` : '***'
            } catch {
                return null
            }
        }

        const getFullKey = (encrypted: string | null) => {
            if (!encrypted) return null
            try {
                return decrypt(encrypted)
            } catch {
                return null
            }
        }

        return res.json({
            provider,
            api_key_masked: maskKey(row?.api_key_encrypted ?? null),
            api_key: getFullKey(row?.api_key_encrypted ?? null),
            base_url: row?.base_url ?? null,
            selected_model: row?.selected_model ?? null
        })
    } catch (error) {
        console.error('Get provider settings error:', error)
        res.status(500).json({ error: 'Failed to get provider settings' })
    }
}

/**
 * Update provider-scoped settings for a specific provider
 */
export const updateProviderSettings = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).userId!
        const { provider, apiKey, baseUrl, selected_model } = req.body as {
            provider?: string
            apiKey?: string | null
            baseUrl?: string | null
            selected_model?: string | null
        }

        if (!provider) {
            return res.status(400).json({ error: 'Provider is required' })
        }

        const hasExisting = db.prepare('SELECT 1 FROM user_provider_settings WHERE user_id = ? AND provider = ?').get(userId, provider)

        const encrypted = apiKey && !apiKey.endsWith('...') ? encrypt(apiKey) : undefined

        if (hasExisting) {
            const parts: string[] = []
            const vals: any[] = []
            if (encrypted !== undefined) { parts.push('api_key_encrypted = ?'); vals.push(encrypted) }
            if (baseUrl !== undefined) { parts.push('base_url = ?'); vals.push(baseUrl) }
            if (selected_model !== undefined) { parts.push('selected_model = ?'); vals.push(selected_model) }
            if (parts.length > 0) {
                vals.push(userId, provider)
                db.prepare(`UPDATE user_provider_settings SET ${parts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND provider = ?`).run(...vals)
            }
        } else {
            db.prepare(`
                INSERT INTO user_provider_settings (user_id, provider, api_key_encrypted, base_url, selected_model)
                VALUES (?, ?, ?, ?, ?)
            `).run(userId, provider, encrypted ?? null, baseUrl ?? null, selected_model ?? null)
        }

        res.json({ success: true })
    } catch (error) {
        console.error('Update provider settings error:', error)
        res.status(500).json({ error: 'Failed to update provider settings' })
    }
}
