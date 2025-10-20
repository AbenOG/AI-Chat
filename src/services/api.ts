import type { Message, User, UserSettings } from '@/types'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

export interface Chat {
    id: number
    title: string
    created_at: string
    updated_at: string
    messages?: Message[]
}

class ApiService {
    // Auth
    async register(username: string, password: string): Promise<{ user: User }> {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        })

        if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Registration failed')
        }

        return res.json()
    }

    async login(username: string, password: string): Promise<{ user: User }> {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        })

        if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Login failed')
        }

        return res.json()
    }

    async logout(): Promise<void> {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        })
    }

    async getCurrentUser(): Promise<{ user: User }> {
        const res = await fetch(`${API_URL}/auth/me`, {
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error('Not authenticated')
        }

        return res.json()
    }

    // Chats
    async getChats(): Promise<{ chats: Chat[] }> {
        const res = await fetch(`${API_URL}/chats`, {
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error('Failed to fetch chats')
        }

        return res.json()
    }

    async getChat(chatId: number, options?: { limit?: number; before?: number }): Promise<{ chat: Chat & { totalMessages?: number; hasMore?: boolean } }> {
        const params = new URLSearchParams()
        if (options?.limit) params.append('limit', options.limit.toString())
        if (options?.before) params.append('before', options.before.toString())
        
        const url = `${API_URL}/chats/${chatId}${params.toString() ? '?' + params.toString() : ''}`
        const res = await fetch(url, {
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error('Failed to fetch chat')
        }

        return res.json()
    }

    async createChat(title: string, messages: Message[], mode?: string): Promise<{ chatId: number }> {
        const res = await fetch(`${API_URL}/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title, messages, mode })
        })

        if (!res.ok) {
            throw new Error('Failed to create chat')
        }

        return res.json()
    }

    async updateChat(chatId: number, data: { title?: string; message?: Message; mode?: string }): Promise<void> {
        const res = await fetch(`${API_URL}/chats/${chatId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        })

        if (!res.ok) {
            throw new Error('Failed to update chat')
        }
    }

    async deleteChat(chatId: number): Promise<void> {
        const res = await fetch(`${API_URL}/chats/${chatId}`, {
            method: 'DELETE',
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error('Failed to delete chat')
        }
    }

    async updateSelectedModel(model: string): Promise<void> {
        const res = await fetch(`${API_URL}/user/model`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ model })
        })

        if (!res.ok) {
            throw new Error('Failed to update model')
        }
    }

    // User Settings
    async getUserSettings(): Promise<UserSettings> {
        const res = await fetch(`${API_URL}/user/settings`, {
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error('Failed to fetch settings')
        }

        return res.json()
    }

    async updateUserSettings(settings: Partial<UserSettings> & { provider_api_key?: string; embedding_api_key?: string }): Promise<void> {
        const res = await fetch(`${API_URL}/user/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(settings)
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Failed to update settings' }))
            console.error('Update settings error:', errorData)
            throw new Error(errorData.error || 'Failed to update settings')
        }
    }

    async validateProvider({ provider, apiKey, baseUrl }: { provider: string; apiKey: string; baseUrl?: string }): Promise<{ valid: boolean; error?: string }> {
        const res = await fetch(`${API_URL}/user/validate-provider`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ provider, apiKey, baseUrl })
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Validation request failed' }))
            throw new Error(errorData.error || 'Validation request failed')
        }

        return res.json()
    }

    async validateEmbedding({ apiKey, model }: { apiKey: string; model: string }): Promise<{ valid: boolean; error?: string }> {
        const res = await fetch(`${API_URL}/user/validate-embedding`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apiKey, model })
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Validation request failed' }))
            throw new Error(errorData.error || 'Validation request failed')
        }

        return res.json()
    }

    async getProviderModels({ provider, apiKey, baseUrl }: { provider: string; apiKey?: string; baseUrl?: string }): Promise<{ models: Array<{ id: string; name: string }> }> {
        const res = await fetch(`${API_URL}/user/provider-models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ provider, apiKey, baseUrl })
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Failed to fetch models' }))
            throw new Error(errorData.error || 'Failed to fetch models')
        }

        return res.json()
    }

    // Provider-scoped settings
    async getProviderSettings(provider: string): Promise<{ provider: string; api_key_masked: string | null; api_key: string | null; base_url: string | null; selected_model: string | null }> {
        const res = await fetch(`${API_URL}/user/provider-settings/get`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ provider })
        })
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Failed to fetch provider settings' }))
            throw new Error(errorData.error || 'Failed to fetch provider settings')
        }
        return res.json()
    }

    async updateProviderSettings({ provider, apiKey, baseUrl, selected_model }: { provider: string; apiKey?: string | null; baseUrl?: string | null; selected_model?: string | null }): Promise<void> {
        const res = await fetch(`${API_URL}/user/provider-settings/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ provider, apiKey: apiKey ?? null, baseUrl: baseUrl ?? null, selected_model: selected_model ?? null })
        })
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Failed to update provider settings' }))
            throw new Error(errorData.error || 'Failed to update provider settings')
        }
    }

    // Provider-agnostic web search
    async searchWeb(query: string, limit: number = 5): Promise<{ results: Array<{ title: string; url: string; snippet: string }> }> {
        console.log('[API] searchWeb called with query:', query, 'limit:', limit)
        try {
            const res = await fetch(`${API_URL}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ q: query, limit })
            })

            console.log('[API] searchWeb response status:', res.status, res.statusText)

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Search request failed' }))
                console.error('[API] searchWeb error:', errorData)
                throw new Error(errorData.error || 'Search request failed')
            }

            const data = await res.json()
            console.log('[API] searchWeb success, results:', data.results?.length || 0)
            return data
        } catch (error) {
            console.error('[API] searchWeb exception:', error)
            throw error
        }
    }

    async updateModel(modelId: string): Promise<void> {
        const res = await fetch(`${API_URL}/user/model`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ model: modelId })
        })

        if (!res.ok) {
            throw new Error('Failed to update model')
        }
    }

    // Chat proxy (uses user's stored provider settings)
    async chat(params: {
        messages: Array<{ role: string; content: any }>
        model: string
        stream?: boolean
        [key: string]: any
    }): Promise<Response> {
        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(params)
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Chat request failed' }))
            throw new Error(errorData.error || 'Chat request failed')
        }

        return res
    }

    // Documents
    async uploadDocument(file: File, onProgress?: (progress: number) => void): Promise<{ documentId: number; status: string }> {
        const formData = new FormData()
        formData.append('file', file)

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const progress = (e.loaded / e.total) * 100
                        onProgress(progress)
                    }
                })
            }

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText))
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText)
                        reject(new Error(error.error || 'Upload failed'))
                    } catch {
                        reject(new Error('Upload failed'))
                    }
                }
            })

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'))
            })

            xhr.open('POST', `${API_URL}/docs/upload`)
            xhr.withCredentials = true
            xhr.send(formData)
        })
    }

    async getDocuments(): Promise<{ documents: any[]; storageUsed: number }> {
        const res = await fetch(`${API_URL}/docs`, {
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error('Failed to get documents')
        }

        return res.json()
    }

    async getDocument(documentId: number): Promise<any> {
        const res = await fetch(`${API_URL}/docs/${documentId}`, {
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error('Failed to get document')
        }

        return res.json()
    }

    async getDocumentContent(documentId: number): Promise<{ content: string; document: any }> {
        const res = await fetch(`${API_URL}/docs/${documentId}/content`, {
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error('Failed to get document content')
        }

        return res.json()
    }

    async deleteDocument(documentId: number): Promise<void> {
        const res = await fetch(`${API_URL}/docs/${documentId}`, {
            method: 'DELETE',
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error('Failed to delete document')
        }
    }

    async searchDocuments(query: string, topK: number = 6): Promise<any> {
        const res = await fetch(`${API_URL}/docs/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ query, topK })
        })

        if (!res.ok) {
            throw new Error('Failed to search documents')
        }

        return res.json()
    }
}

export const api = new ApiService()

