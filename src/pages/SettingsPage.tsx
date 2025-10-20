import { useState, useEffect, useCallback } from 'react'
import { Upload, Trash2, Loader2, CheckCircle, XCircle, Clock, User, Cpu, Database, Eye, EyeOff, Check, ArrowLeft, AlertCircle, X, Type } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'

interface Document {
    id: number
    filename: string
    mime_type: string
    size_bytes: number
    status: 'uploading' | 'processing' | 'completed' | 'failed'
    error_message: string | null
    created_at: string
}

interface UploadingFile {
    file: File
    progress: number
    documentId?: number
    error?: string
}

interface SettingsPageProps {
    selectedModel: string
    onModelChange: (model: string) => void
    onClose: () => void
}

const MODELS = [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', context: '128K', inputPrice: '$0.15/M', outputPrice: '$0.60/M', imagePrice: '$0.217/K' },
    { id: 'openai/gpt-5', name: 'GPT-5', provider: 'OpenAI', context: '400K', inputPrice: '$1.25/M', outputPrice: '$10/M' },
    { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', context: '400K', inputPrice: '$0.25/M', outputPrice: '$2/M' },
    { id: 'google/gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash', provider: 'Google', context: '1.05M', inputPrice: '$0.30/M', outputPrice: '$2.50/M', imagePrice: '$1.238/K', researchCapable: true },
    { id: 'google/gemini-2.5-flash-lite-preview-09-2025', name: 'Gemini 2.5 Flash Lite', provider: 'Google', context: '1.05M', inputPrice: '$0.10/M', outputPrice: '$0.40/M' },
    { id: 'x-ai/grok-4-fast', name: 'Grok 4 Fast', provider: 'X.AI', context: '2M', inputPrice: '$0.20/M', outputPrice: '$0.50/M' },
    { id: 'qwen/qwen3-coder-plus', name: 'Qwen3 Coder Plus', provider: 'Alibaba', context: '128K', inputPrice: '$1/M', outputPrice: '$5/M' },
    { id: 'qwen/qwen3-235b-a22b-thinking-2507', name: 'Qwen3 235B A22B Thinking', provider: 'Qwen', context: '262K', inputPrice: '$0.11/M', outputPrice: '$0.60/M' },
    { id: 'z-ai/glm-4.6', name: 'GLM 4.6', provider: 'Z.AI', context: '203K', inputPrice: '$0.50/M', outputPrice: '$1.75/M' },
    { id: 'z-ai/glm-4.5-air', name: 'GLM 4.5 Air', provider: 'Z.AI', context: '131K', inputPrice: '$0.14/M', outputPrice: '$0.86/M' },
    { id: 'deepseek/deepseek-v3.2-exp', name: 'DeepSeek V3.2', provider: 'DeepSeek', context: '164K', inputPrice: '$0.27/M', outputPrice: '$0.40/M' },
    { id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek R1', provider: 'DeepSeek', context: '164K', inputPrice: '$0.40/M', outputPrice: '$1.75/M' }
]

const EMBEDDING_MODELS = [
    { id: 'text-embedding-3-small', name: 'text-embedding-3-small (Recommended)', description: 'Fast and cost-effective' },
    { id: 'text-embedding-3-large', name: 'text-embedding-3-large', description: 'Higher quality embeddings' },
    { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002', description: 'Legacy model' }
]

const PROVIDERS = [
    { id: 'openrouter', name: 'OpenRouter', requiresBaseUrl: false },
    { id: 'openai', name: 'OpenAI', requiresBaseUrl: false },
    { id: 'anthropic', name: 'Anthropic', requiresBaseUrl: false },
    { id: 'openai_compatible', name: 'OpenAI Compatible', requiresBaseUrl: true },
    { id: 'ollama', name: 'Ollama', requiresBaseUrl: true, defaultBaseUrl: 'http://localhost:11434' }
]

const MAX_STORAGE = 200 * 1024 * 1024 // 200MB
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

const DEFAULT_SYSTEM_PROMPT = `You are a helpful, intelligent, and friendly AI assistant. Your goal is to:
- Provide clear, accurate, and thoughtful responses
- Be concise but thorough when needed
- Ask clarifying questions when appropriate
- Admit when you don't know something
- Use a casual, conversational tone`

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function getFileIcon(mimeType: string) {
    if (mimeType === 'application/pdf') return '📄'
    if (mimeType.includes('wordprocessingml')) return '📝'
    if (mimeType.includes('spreadsheetml') || mimeType.includes('excel')) return '📊'
    return '📁'
}

function getStatusColor(status: string) {
    switch (status) {
        case 'completed': return 'text-green-400'
        case 'processing': return 'text-yellow-400'
        case 'uploading': return 'text-white/60'
        case 'failed': return 'text-red-400'
        default: return 'text-white/60'
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case 'completed': return <CheckCircle className="w-4 h-4" />
        case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />
        case 'uploading': return <Clock className="w-4 h-4" />
        case 'failed': return <XCircle className="w-4 h-4" />
        default: return null
    }
}

export function SettingsPage({ selectedModel, onModelChange, onClose }: SettingsPageProps) {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState<'profile' | 'provider' | 'embeddings' | 'models' | 'documents' | 'display'>('profile')
    
    // Document state
    const [documents, setDocuments] = useState<Document[]>([])
    const [storageUsed, setStorageUsed] = useState(0)
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
    const [modelSaving, setModelSaving] = useState(false)
    
    // User settings state
    const [loadingSettings, setLoadingSettings] = useState(true)
    const [savingSettings, setSavingSettings] = useState(false)
    const [displayName, setDisplayName] = useState('')
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
    const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large' | 'extra-large'>('medium')
    const [fontFamily, setFontFamily] = useState<'inter' | 'atkinson' | 'opendyslexic' | 'literata' | 'system'>('inter')
    const [provider, setProvider] = useState('')
    const [providerApiKey, setProviderApiKey] = useState('')
    const [providerBaseUrl, setProviderBaseUrl] = useState('')
    const [showProviderKey, setShowProviderKey] = useState(false)
    const [providerError, setProviderError] = useState('')
    const [hasExistingProviderKey, setHasExistingProviderKey] = useState(false)
    
    // Model selection state
    const [selectedModelId, setSelectedModelId] = useState('')
    const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([])
    const [loadingModels, setLoadingModels] = useState(false)
    const [customModelInput, setCustomModelInput] = useState('')
    const [showCustomModelInput, setShowCustomModelInput] = useState(false)
    
    const [embeddingApiKey, setEmbeddingApiKey] = useState('')
    const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small')
    const [showEmbeddingKey, setShowEmbeddingKey] = useState(false)
    const [embeddingError, setEmbeddingError] = useState('')
    const [hasExistingEmbeddingKey, setHasExistingEmbeddingKey] = useState(false)
    
    // Toast notifications
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    // Show toast notification
    const showToast = useCallback((type: 'success' | 'error', message: string) => {
        setToastMessage({ type, message })
        setTimeout(() => setToastMessage(null), 3500)
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Alt + 1-6 for tab navigation
            if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
                const tabs: Array<'profile' | 'provider' | 'embeddings' | 'models' | 'documents' | 'display'> = ['profile', 'provider', 'embeddings', 'models', 'documents', 'display']
                const key = parseInt(e.key)
                if (key >= 1 && key <= 6) {
                    e.preventDefault()
                    setActiveTab(tabs[key - 1])
                }
            }
            // Escape to close
            if (e.key === 'Escape' && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    // Close if not authenticated
    useEffect(() => {
        if (!user) {
            onClose()
        }
    }, [user, onClose])

    // Load user settings on mount
    useEffect(() => {
        if (user) {
            loadUserSettings()
        }
    }, [user])

    // Load documents when documents tab is active
    useEffect(() => {
        if (activeTab === 'documents' && user) {
            loadDocuments()
            const interval = setInterval(loadDocuments, 3000)
            return () => clearInterval(interval)
        }
    }, [activeTab, user])
    
    const loadUserSettings = async () => {
        try {
            setLoadingSettings(true)
            const settings = await api.getUserSettings()
            
            // Populate form fields
            setDisplayName(settings.display_name || '')
            setSystemPrompt(settings.system_prompt || DEFAULT_SYSTEM_PROMPT)
            setProvider(settings.provider || '')
            setProviderBaseUrl(settings.provider_base_url || '')
            setSelectedModelId(settings.selected_model || '')
            setEmbeddingModel(settings.embedding_model || 'text-embedding-3-small')
            setFontSize(settings.font_size || 'medium')
            setFontFamily(settings.font_family || 'inter')
            
            // Set the full API keys (not masked) so they can be revealed
            // For Ollama, clear any previously shown API key (not required)
            if (settings.provider === 'ollama') {
                setProviderApiKey('')
                setHasExistingProviderKey(false)
                setShowProviderKey(false)
            } else if (settings.provider_api_key) {
                setProviderApiKey(settings.provider_api_key)
                setHasExistingProviderKey(true)
            }

            // Load provider-scoped settings for whichever provider is currently selected
            if (settings.provider) {
                try {
                    const ps = await api.getProviderSettings(settings.provider)
                    if (settings.provider === 'ollama') {
                        setProviderApiKey('')
                        setHasExistingProviderKey(false)
                        setShowProviderKey(false)
                    } else if (ps.api_key) {
                        setProviderApiKey(ps.api_key)
                        setHasExistingProviderKey(true)
                    }
                    if (ps.base_url) {
                        setProviderBaseUrl(ps.base_url)
                    }
                    // Only set model from provider-scoped settings; do not default to any other provider
                    setSelectedModelId(ps.selected_model || '')
                } catch (e) {
                    // Non-fatal; continue
                }
            }
            if (settings.embedding_api_key) {
                setEmbeddingApiKey(settings.embedding_api_key)
                setHasExistingEmbeddingKey(true)
            }
            
            // Fetch available models if provider is set
            if (settings.provider) {
                await fetchAvailableModels(
                    settings.provider,
                    settings.provider_api_key || undefined,
                    settings.provider_base_url || undefined
                )
            }
        } catch (error) {
            console.error('Failed to load user settings:', error)
            setProviderError('Unable to load your settings. Please refresh the page.')
        } finally {
            setLoadingSettings(false)
        }
    }

    const fetchAvailableModels = async (prov: string, apiKey?: string, baseUrl?: string) => {
        try {
            setLoadingModels(true)
            
            // For OpenRouter, use the predefined models
            if (prov === 'openrouter') {
                setAvailableModels(MODELS.map(m => ({ id: m.id, name: m.name })))
                return
            }
            
            const result = await api.getProviderModels({
                provider: prov,
                apiKey,
                baseUrl
            })
            
            setAvailableModels(result.models)
        } catch (error) {
            console.error('Failed to fetch models:', error)
            setAvailableModels([])
        } finally {
            setLoadingModels(false)
        }
    }

    const loadDocuments = async () => {
        try {
            const data = await api.getDocuments()
            setDocuments(data.documents)
            setStorageUsed(data.storageUsed)
        } catch (error) {
            console.error('Failed to load documents:', error)
        }
    }

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || [])
        
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                // Inline warning banner, no layout shift
                setProviderError(`File "${file.name}" exceeds the 15MB size limit`)
                setTimeout(() => setProviderError(''), 3000)
                continue
            }
            
            if (storageUsed + file.size > MAX_STORAGE) {
                setProviderError('Storage limit exceeded. Please delete some documents first.')
                setTimeout(() => setProviderError(''), 3000)
                break
            }
            
            const uploadingFile: UploadingFile = { file, progress: 0 }
            setUploadingFiles(prev => [...prev, uploadingFile])
            
            try {
                const formData = new FormData()
                formData.append('file', file)
                
                const xhr = new XMLHttpRequest()
                
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const progress = (e.loaded / e.total) * 100
                        setUploadingFiles(prev =>
                            prev.map(f => f.file === file ? { ...f, progress } : f)
                        )
                    }
                })
                
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText)
                        setUploadingFiles(prev =>
                            prev.map(f => f.file === file ? { ...f, documentId: response.documentId, progress: 100 } : f)
                        )
                        loadDocuments()
                        setTimeout(() => {
                            setUploadingFiles(prev => prev.filter(f => f.file !== file))
                        }, 2000)
                    } else {
                        throw new Error('Upload failed')
                    }
                })
                
                xhr.addEventListener('error', () => {
                    setUploadingFiles(prev =>
                        prev.map(f => f.file === file ? { ...f, error: 'Upload failed. Please try again.' } : f)
                    )
                })
                
                xhr.open('POST', '/api/documents/upload')
                xhr.withCredentials = true
                xhr.send(formData)
            } catch (error) {
                setUploadingFiles(prev =>
                    prev.map(f => f.file === file ? { ...f, error: 'An error occurred during upload.' } : f)
                )
            }
        }
        
        event.target.value = ''
    }

    const handleDeleteDocument = async (id: number) => {
        if (!confirm('Are you sure you want to delete this document?')) return
        
        try {
            await api.deleteDocument(id)
            loadDocuments()
        } catch (error) {
            setProviderError('Failed to delete document. Please try again.')
            setTimeout(() => setProviderError(''), 3000)
        }
    }

    const handleSaveProfile = async () => {
        try {
            setSavingSettings(true)
            await api.updateUserSettings({
                display_name: displayName,
                system_prompt: systemPrompt
            })
            showToast('success', 'Profile settings saved successfully')
        } catch (error: any) {
            showToast('error', error.message || 'Failed to save profile settings')
        } finally {
            setSavingSettings(false)
        }
    }

    const handleSaveDisplay = async () => {
        try {
            setSavingSettings(true)
            await api.updateUserSettings({
                font_size: fontSize,
                font_family: fontFamily
            })
            // Apply settings immediately to document
            document.documentElement.setAttribute('data-font-size', fontSize)
            document.documentElement.setAttribute('data-font-family', fontFamily)
            showToast('success', 'Display settings saved successfully')
        } catch (error: any) {
            showToast('error', error.message || 'Failed to save display settings')
        } finally {
            setSavingSettings(false)
        }
    }

    const handleSaveProvider = async () => {
        try {
            setSavingSettings(true)
            setProviderError('')
            
            // Persist provider-scoped settings without affecting other providers
            await api.updateProviderSettings({
                provider,
                apiKey: providerApiKey || null,
                baseUrl: providerBaseUrl || null,
                selected_model: selectedModelId || null
            })

            // Also store the currently active provider for the user
            await api.updateUserSettings({ provider })
            setHasExistingProviderKey(true)
            showToast('success', 'Provider settings saved successfully')
            
            // Fetch available models after saving
            await fetchAvailableModels(provider, providerApiKey, providerBaseUrl)
            
            // Reload settings to get the saved key
            await loadUserSettings()
        } catch (error: any) {
            showToast('error', error.message || 'Failed to save provider settings')
        } finally {
            setSavingSettings(false)
        }
    }

    const handleSaveModel = async () => {
        try {
            setModelSaving(true)
            const modelToSave = showCustomModelInput ? customModelInput : selectedModelId
            
            // Persist per-provider selected model
            await api.updateProviderSettings({
                provider,
                selected_model: modelToSave
            })
            
            setSelectedModelId(modelToSave)
            if (showCustomModelInput) {
                setShowCustomModelInput(false)
            }
            
            // Also update the global model state
            onModelChange(modelToSave)
            
            showToast('success', 'Model saved successfully')
        } catch (error: any) {
            showToast('error', error.message || 'Failed to save model')
        } finally {
            setModelSaving(false)
        }
    }

    const handleSaveEmbedding = async () => {
        try {
            setSavingSettings(true)
            setEmbeddingError('')
            await api.updateUserSettings({
                embedding_api_key: embeddingApiKey,
                embedding_model: embeddingModel
            })
            setHasExistingEmbeddingKey(true)
            showToast('success', 'Embedding settings saved successfully')
            
            // Reload settings to get the saved key
            await loadUserSettings()
        } catch (error: any) {
            showToast('error', error.message || 'Failed to save embedding settings')
        } finally {
            setSavingSettings(false)
        }
    }

    if (!user) {
        return null
    }

    if (loadingSettings) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/60" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Toast Notification */}
            {toastMessage && (
                <div 
                    className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in duration-300"
                    role="alert"
                    aria-live="polite"
                >
                    <div className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-xl border
                        ${toastMessage.type === 'success' 
                            ? 'bg-green-500/20 border-green-500/30 text-green-100' 
                            : 'bg-red-500/20 border-red-500/30 text-red-100'
                        }
                    `}>
                        {toastMessage.type === 'success' ? (
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium">{toastMessage.message}</span>
                        <button
                            onClick={() => setToastMessage(null)}
                            className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
                            aria-label="Close notification"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="border-b border-white/10 bg-[#0a0a0a]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-black"
                            aria-label="Go back to chat (Escape)"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-semibold">Settings</h1>
                            <p className="text-xs text-white/50 mt-0.5">Use Alt+1-5 to navigate tabs, Esc to close</p>
                        </div>
                    </div>
                    <div className="text-sm text-white/60">
                        {user.username}
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex gap-8">
                    {/* Sidebar Navigation */}
                    <nav className="w-64 flex-shrink-0" role="navigation" aria-label="Settings navigation">
                        <div className="space-y-1">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                                    activeTab === 'profile'
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                }`}
                                aria-current={activeTab === 'profile' ? 'page' : undefined}
                            >
                                <div className="flex items-center gap-3">
                                    <User className="w-5 h-5" />
                                    <span className="font-medium">Profile</span>
                                </div>
                                <span className="text-xs text-white/40">Alt+1</span>
                            </button>
                            
                            <button
                                onClick={() => setActiveTab('provider')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                                    activeTab === 'provider'
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                }`}
                                aria-current={activeTab === 'provider' ? 'page' : undefined}
                            >
                                <div className="flex items-center gap-3">
                                    <Cpu className="w-5 h-5" />
                                    <span className="font-medium">AI Provider</span>
                                </div>
                                <span className="text-xs text-white/40">Alt+2</span>
                            </button>
                            
                            <button
                                onClick={() => setActiveTab('embeddings')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                                    activeTab === 'embeddings'
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                }`}
                                aria-current={activeTab === 'embeddings' ? 'page' : undefined}
                            >
                                <div className="flex items-center gap-3">
                                    <Database className="w-5 h-5" />
                                    <span className="font-medium">Embeddings</span>
                                </div>
                                <span className="text-xs text-white/40">Alt+3</span>
                            </button>
                            
                            <button
                                onClick={() => setActiveTab('models')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                                    activeTab === 'models'
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                }`}
                                aria-current={activeTab === 'models' ? 'page' : undefined}
                            >
                                <div className="flex items-center gap-3">
                                    <Cpu className="w-5 h-5" />
                                    <span className="font-medium">Model Selection</span>
                                </div>
                                <span className="text-xs text-white/40">Alt+4</span>
                            </button>
                            
                            <button
                                onClick={() => setActiveTab('documents')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                                    activeTab === 'documents'
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                }`}
                                aria-current={activeTab === 'documents' ? 'page' : undefined}
                            >
                                <div className="flex items-center gap-3">
                                    <Database className="w-5 h-5" />
                                    <span className="font-medium">Document Library</span>
                                </div>
                                <span className="text-xs text-white/40">Alt+5</span>
                            </button>
                            
                            <button
                                onClick={() => setActiveTab('display')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${
                                    activeTab === 'display'
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                }`}
                                aria-current={activeTab === 'display' ? 'page' : undefined}
                            >
                                <div className="flex items-center gap-3">
                                    <Type className="w-5 h-5" />
                                    <span className="font-medium">Display</span>
                                </div>
                                <span className="text-xs text-white/40">Alt+6</span>
                            </button>
                        </div>
                    </nav>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0" role="main">
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8">
                            {/* Profile Tab */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6 max-w-2xl">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white mb-2">Profile Settings</h2>
                                        <p className="text-sm text-white/60">
                                            Customise your display name and system prompt
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="displayName" className="block text-sm font-medium text-white/80 mb-2">
                                                Display Name
                                            </label>
                                            <input
                                                id="displayName"
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                placeholder="Enter your name"
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30"
                                                aria-describedby="displayNameHelp"
                                            />
                                            <p id="displayNameHelp" className="text-xs text-white/50 mt-1">
                                                This name will be used throughout the application
                                            </p>
                                        </div>

                                        <div>
                                            <label htmlFor="systemPrompt" className="block text-sm font-medium text-white/80 mb-2">
                                                System Prompt
                                            </label>
                                            <textarea
                                                id="systemPrompt"
                                                value={systemPrompt}
                                                onChange={(e) => setSystemPrompt(e.target.value)}
                                                rows={8}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30 resize-none"
                                                aria-describedby="systemPromptHelp"
                                            />
                                            <p id="systemPromptHelp" className="text-xs text-white/50 mt-1">
                                                Define how the AI should behave in conversations
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={savingSettings}
                                            className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
                                            aria-label="Save profile settings"
                                        >
                                            {savingSettings && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                            {savingSettings ? 'Saving...' : 'Save Profile'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* AI Provider Tab */}
                            {activeTab === 'provider' && (
                                <div className="space-y-6 max-w-2xl">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white mb-2">AI Provider Configuration</h2>
                                        <p className="text-sm text-white/60">
                                            Configure your AI provider credentials
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="provider" className="block text-sm font-medium text-white/80 mb-2">
                                                Provider
                                            </label>
                                            <select
                                                id="provider"
                                                value={provider}
                                                onChange={(e) => {
                                                    setProvider(e.target.value)
                                                    // Clear API key when switching providers to avoid confusion
                                                    setProviderApiKey('')
                                                    setHasExistingProviderKey(false)
                                                    setShowProviderKey(false)
                                                    setProviderError('')
                                                    // Load persisted provider-specific settings
                                                    api.getProviderSettings(e.target.value).then(ps => {
                                                        if (e.target.value === 'ollama') {
                                                            setProviderApiKey('')
                                                            setHasExistingProviderKey(false)
                                                            setShowProviderKey(false)
                                                        } else if (ps.api_key) {
                                                            setProviderApiKey(ps.api_key)
                                                            setHasExistingProviderKey(true)
                                                        }
                                                        setProviderBaseUrl(ps.base_url || (PROVIDERS.find(p => p.id === e.target.value)?.defaultBaseUrl || ''))
                                                        setSelectedModelId(ps.selected_model || '')
                                                    }).catch(() => {
                                                        // Ignore load error; user can enter new credentials
                                                    })
                                                    // Do not clear selectedModelId; it will be replaced when provider-scoped settings load
                                                    setAvailableModels([])
                                                    const selectedProvider = PROVIDERS.find(p => p.id === e.target.value)
                                                    if (selectedProvider?.defaultBaseUrl) {
                                                        setProviderBaseUrl(selectedProvider.defaultBaseUrl)
                                                    } else {
                                                        setProviderBaseUrl('')
                                                    }
                                                }}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30"
                                                aria-describedby="providerHelp"
                                            >
                                                <option value="" className="bg-[#1a1a1a]">Select a provider</option>
                                                {PROVIDERS.map((p) => (
                                                    <option key={p.id} value={p.id} className="bg-[#1a1a1a]">
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <p id="providerHelp" className="text-xs text-white/50 mt-1">
                                                Choose your AI service provider
                                            </p>
                                        </div>

                                        {provider && PROVIDERS.find(p => p.id === provider)?.requiresBaseUrl && (
                                            <div>
                                                <label htmlFor="baseUrl" className="block text-sm font-medium text-white/80 mb-2">
                                                    Base URL
                                                </label>
                                                <input
                                                    id="baseUrl"
                                                    type="url"
                                                    value={providerBaseUrl}
                                                    onChange={(e) => setProviderBaseUrl(e.target.value)}
                                                    placeholder="https://api.example.com"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/20"
                                                    aria-describedby="baseUrlHelp"
                                                />
                                                <p id="baseUrlHelp" className="text-xs text-white/50 mt-1">
                                                    The base URL for your API endpoint
                                                </p>
                                            </div>
                                        )}

                                        {provider && (
                                            <div>
                                                <label htmlFor="providerApiKey" className="block text-sm font-medium text-white/80 mb-2">
                                                    API Key {provider === 'ollama' && <span className="text-white/50 font-normal">(Optional for local)</span>}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        id="providerApiKey"
                                                        type={showProviderKey ? 'text' : 'password'}
                                                        value={providerApiKey}
                                                        onChange={(e) => {
                                                            setProviderApiKey(e.target.value)
                                                            setProviderError('')
                                                        }}
                                                        placeholder={
                                                            provider === 'ollama' 
                                                                ? "Leave empty for local Ollama" 
                                                                : hasExistingProviderKey 
                                                                    ? "Enter new key to update" 
                                                                    : "sk-..."
                                                        }
                                                        className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30"
                                                        aria-describedby="providerApiKeyHelp"
                                                        disabled={provider === 'ollama'}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowProviderKey(!showProviderKey)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 rounded"
                                                        aria-label={showProviderKey ? 'Hide API key' : 'Show API key'}
                                                        disabled={provider === 'ollama'}
                                                    >
                                                        {showProviderKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <p id="providerApiKeyHelp" className="text-xs text-white/50 mt-1">
                                                    {provider === 'ollama' 
                                                        ? 'API key not required for local Ollama installations'
                                                        : 'Your API key is encrypted and stored securely'}
                                                </p>
                                            </div>
                                        )}

                                        {/* Error message - fixed height to prevent layout shift */}
                                        {provider && (
                                            <div className="min-h-[52px]" role="status" aria-live="polite">
                                                {providerError && (
                                                    <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-lg border border-red-400/20">
                                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                                                        <span>{providerError}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Save button - Show when provider is set and either has API key OR is Ollama */}
                                        {provider && (providerApiKey || provider === 'ollama') && (
                                            <button
                                                onClick={handleSaveProvider}
                                                disabled={savingSettings}
                                                className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
                                                aria-label="Save provider settings"
                                            >
                                                {savingSettings && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                                {savingSettings ? 'Saving...' : 'Save Provider Settings'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

            {/* Embeddings Tab */}
                            {activeTab === 'embeddings' && (
                                <div className="space-y-6 max-w-2xl">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white mb-2">Embeddings Configuration</h2>
                                        <p className="text-sm text-white/60">
                                            Required for document search functionality. Uses OpenAI embeddings.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="embeddingApiKey" className="block text-sm font-medium text-white/80 mb-2">
                                                OpenAI API Key
                                            </label>
                                            <div className="relative">
                                                <input
                                                    id="embeddingApiKey"
                                                    type={showEmbeddingKey ? 'text' : 'password'}
                                                    value={embeddingApiKey}
                                                    onChange={(e) => {
                                                        setEmbeddingApiKey(e.target.value)
                                                        setEmbeddingError('')
                                                    }}
                                                    placeholder={hasExistingEmbeddingKey ? "Enter new key to update" : "sk-..."}
                                                    className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30"
                                                    aria-describedby="embeddingApiKeyHelp"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEmbeddingKey(!showEmbeddingKey)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 rounded"
                                                    aria-label={showEmbeddingKey ? 'Hide API key' : 'Show API key'}
                                                >
                                                    {showEmbeddingKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <p id="embeddingApiKeyHelp" className="text-xs text-white/50 mt-1">
                                                Your API key is encrypted and stored securely
                                            </p>
                                        </div>

                                        <div>
                                            <label htmlFor="embeddingModel" className="block text-sm font-medium text-white/80 mb-2">
                                                Embedding Model
                                            </label>
                                            <select
                                                id="embeddingModel"
                                                value={embeddingModel}
                                                onChange={(e) => setEmbeddingModel(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30"
                                                aria-describedby="embeddingModelHelp"
                                            >
                                                {EMBEDDING_MODELS.map((model) => (
                                                    <option key={model.id} value={model.id} className="bg-[#1a1a1a]">
                                                        {model.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <p id="embeddingModelHelp" className="text-xs text-white/50 mt-1">
                                                {EMBEDDING_MODELS.find(m => m.id === embeddingModel)?.description}
                                            </p>
                                        </div>

                                        {/* Error message - fixed height to prevent layout shift */}
                                        <div className="min-h-[52px]" role="status" aria-live="polite">
                                            {embeddingError && (
                                                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-lg border border-red-400/20">
                                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                                                    <span>{embeddingError}</span>
                                                </div>
                                            )}
                                        </div>

                                        {embeddingApiKey && (
                                            <button
                                                onClick={handleSaveEmbedding}
                                                disabled={savingSettings}
                                                className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
                                                aria-label="Save embedding settings"
                                            >
                                                {savingSettings && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                                {savingSettings ? 'Saving...' : 'Save Embedding Settings'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Model Selection Tab */}
                            {activeTab === 'models' && (
                                <div className="space-y-6 max-w-2xl">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white mb-2">Model Selection</h2>
                                        <p className="text-sm text-white/60">
                                            Choose which AI model to use for conversations. Configure your provider first in the "AI Provider" tab.
                                        </p>
                                    </div>

                                    {!provider ? (
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
                                            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-white/40" />
                                            <h3 className="text-lg font-medium text-white mb-2">No Provider Configured</h3>
                                            <p className="text-white/60 mb-4">
                                                Please configure an AI provider first to see available models.
                                            </p>
                                            <button
                                                onClick={() => setActiveTab('provider')}
                                                className="px-6 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
                                                aria-label="Go to AI Provider Settings"
                                            >
                                                Go to AI Provider Settings
                                            </button>
                                        </div>
                                    ) : loadingModels ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-8 h-8 animate-spin text-white/60" />
                                            <span className="ml-3 text-white/60">Loading available models...</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* Provider Info */}
                                            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm text-white/60">Current Provider</p>
                                                        <p className="text-lg font-medium text-white capitalize">{provider}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setActiveTab('provider')
                                                        }}
                                                        className="text-sm text-white/60 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 rounded px-2 py-1"
                                                        aria-label="Change provider"
                                                    >
                                                        Change Provider →
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Model Selection */}
                                            {!showCustomModelInput ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label htmlFor="selectedModel" className="block text-sm font-medium text-white/80 mb-2">
                                                            Available Models
                                                        </label>
                                                        <select
                                                            id="selectedModel"
                                                            value={selectedModelId}
                                                            onChange={(e) => setSelectedModelId(e.target.value)}
                                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30"
                                                            disabled={availableModels.length === 0}
                                                            aria-describedby="selectedModelHelp"
                                                        >
                                                            <option value="" className="bg-[#1a1a1a]">
                                                                {availableModels.length === 0 ? 'No models available' : 'Select a model'}
                                                            </option>
                                                            {availableModels.map((model) => (
                                                                <option key={model.id} value={model.id} className="bg-[#1a1a1a]">
                                                                    {model.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p id="selectedModelHelp" className="text-xs text-white/50 mt-1">
                                                            {availableModels.length === 0 
                                                                ? 'No models found. You can enter a custom model name below.' 
                                                                : `${availableModels.length} model(s) available from ${provider}`}
                                                        </p>
                                                    </div>

                                                    <button
                                                        onClick={() => setShowCustomModelInput(true)}
                                                        className="text-sm text-white/60 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 rounded px-2 py-1"
                                                        aria-label="Enter custom model name"
                                                    >
                                                        Or enter a custom model name →
                                                    </button>

                                                    <button
                                                        onClick={handleSaveModel}
                                                        disabled={!selectedModelId || modelSaving}
                                                        className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
                                                        aria-label="Save selected model"
                                                    >
                                                        {modelSaving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                                        {modelSaving ? 'Saving...' : 'Save Model'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label htmlFor="customModel" className="block text-sm font-medium text-white/80 mb-2">
                                                            Custom Model Name
                                                        </label>
                                                        <input
                                                            id="customModel"
                                                            type="text"
                                                            value={customModelInput}
                                                            onChange={(e) => setCustomModelInput(e.target.value)}
                                                            placeholder="e.g., llama2, gpt-4, openai/gpt-4o-mini"
                                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30"
                                                            aria-describedby="customModelHelp"
                                                        />
                                                        <p id="customModelHelp" className="text-xs text-white/50 mt-1">
                                                            Enter the exact model name/ID from your provider
                                                        </p>
                                                    </div>

                                                    <button
                                                        onClick={() => {
                                                            setShowCustomModelInput(false)
                                                            setCustomModelInput('')
                                                        }}
                                                        className="text-sm text-white/60 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 rounded px-2 py-1"
                                                        aria-label="Back to model list"
                                                    >
                                                        ← Back to model list
                                                    </button>

                                                    <button
                                                        onClick={handleSaveModel}
                                                        disabled={!customModelInput || modelSaving}
                                                        className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
                                                        aria-label="Save custom model"
                                                    >
                                                        {modelSaving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                                        {modelSaving ? 'Saving...' : 'Save Custom Model'}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Currently Selected Model Info */}
                                            {selectedModelId && (
                                                <div className="bg-green-400/10 border border-green-400/20 rounded-lg p-4">
                                                    <div className="flex items-start gap-2">
                                                        <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-medium text-green-400">Currently Selected Model</p>
                                                            <p className="text-sm text-white/80 mt-1">{selectedModelId}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Document Library Tab */}
                            {activeTab === 'documents' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white mb-2">Document Library</h2>
                                        <p className="text-sm text-white/60">
                                            Upload and manage documents for AI-powered search
                                        </p>
                                    </div>

                                    {/* Storage Usage */}
                                    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-white/80">Storage Used</span>
                                            <span className="text-sm font-medium text-white">
                                                {formatFileSize(storageUsed)} / {formatFileSize(MAX_STORAGE)}
                                            </span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-white/60 h-full transition-all duration-300"
                                                style={{ width: `${(storageUsed / MAX_STORAGE) * 100}%` }}
                                                role="progressbar"
                                                aria-valuenow={(storageUsed / MAX_STORAGE) * 100}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-label="Storage usage"
                                            />
                                        </div>
                                    </div>

                                    {/* Upload Area */}
                                    <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-white/30 transition-colors">
                                        <Upload className="w-12 h-12 mx-auto mb-4 text-white/60" aria-hidden="true" />
                                        <p className="text-white/80 mb-2">Drop files here or click to upload</p>
                                        <p className="text-sm text-white/50 mb-4">
                                            PDF, DOC, DOCX, XLS, XLSX (max {formatFileSize(MAX_FILE_SIZE)})
                                        </p>
                                        <label className="inline-block">
                                            <input
                                                type="file"
                                                multiple
                                                accept=".pdf,.doc,.docx,.xls,.xlsx"
                                                onChange={handleFileSelect}
                                                className="sr-only"
                                                aria-label="Upload documents"
                                            />
                                            <span className="px-6 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors cursor-pointer inline-block focus-within:ring-2 focus-within:ring-white/30">
                                                Select Files
                                            </span>
                                        </label>
                                    </div>

                                    {/* Uploading Files */}
                                    {uploadingFiles.length > 0 && (
                                        <div className="space-y-2">
                                            {uploadingFiles.map((file, index) => (
                                                <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm text-white truncate flex-1">{file.file.name}</span>
                                                        <span className="text-xs text-white/60 ml-2">{Math.round(file.progress)}%</span>
                                                    </div>
                                                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className="bg-white/60 h-full transition-all duration-300"
                                                            style={{ width: `${file.progress}%` }}
                                                            role="progressbar"
                                                            aria-valuenow={file.progress}
                                                            aria-valuemin={0}
                                                            aria-valuemax={100}
                                                            aria-label={`Upload progress for ${file.file.name}`}
                                                        />
                                                    </div>
                                                    {file.error && (
                                                        <p className="text-xs text-red-400 mt-2">{file.error}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Document List */}
                                    {documents.length > 0 ? (
                                        <div className="space-y-2">
                                            {documents.map((doc) => (
                                                <div key={doc.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between hover:bg-white/8 transition-colors">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <span className="text-2xl flex-shrink-0">{getFileIcon(doc.mime_type)}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-white truncate">{doc.filename}</p>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-xs text-white/50">{formatFileSize(doc.size_bytes)}</span>
                                                                <span className={`text-xs flex items-center gap-1 ${getStatusColor(doc.status)}`}>
                                                                    {getStatusIcon(doc.status)}
                                                                    {doc.status}
                                                                </span>
                                                            </div>
                                                            {doc.error_message && (
                                                                <p className="text-xs text-red-400 mt-1">{doc.error_message}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                        className="p-2 text-white/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-red-400/30"
                                                        aria-label={`Delete ${doc.filename}`}
                                                    >
                                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-white/50">
                                            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>No documents uploaded yet</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Display Tab */}
                            {activeTab === 'display' && (
                                <div className="space-y-6 max-w-2xl">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white mb-2">Display Settings</h2>
                                        <p className="text-sm text-white/60">Customise how content is displayed</p>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Font Size */}
                                        <div>
                                            <label htmlFor="fontSize" className="block text-sm font-medium text-white/80 mb-2">
                                                Font Size
                                            </label>
                                            <select
                                                id="fontSize"
                                                value={fontSize}
                                                onChange={(e) => setFontSize(e.target.value as any)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30 transition-colors"
                                                aria-describedby="fontSizeHelp"
                                            >
                                                <option value="small" className="bg-[#1a1a1a]">Small (14px)</option>
                                                <option value="medium" className="bg-[#1a1a1a]">Medium (16px) - Default</option>
                                                <option value="large" className="bg-[#1a1a1a]">Large (18px)</option>
                                                <option value="extra-large" className="bg-[#1a1a1a]">Extra Large (20px)</option>
                                            </select>
                                            <p id="fontSizeHelp" className="text-xs text-white/50 mt-2">
                                                Adjust the font size for AI-generated messages
                                            </p>
                                        </div>

                                        {/* Font Family */}
                                        <div>
                                            <label htmlFor="fontFamily" className="block text-sm font-medium text-white/80 mb-2">
                                                Font Family
                                            </label>
                                            <select
                                                id="fontFamily"
                                                value={fontFamily}
                                                onChange={(e) => setFontFamily(e.target.value as any)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/30 transition-colors"
                                                aria-describedby="fontFamilyHelp"
                                            >
                                                <option value="inter" className="bg-[#1a1a1a]">Inter - Modern & Clean (Default)</option>
                                                <option value="atkinson" className="bg-[#1a1a1a]">Atkinson Hyperlegible - Maximum Clarity</option>
                                                <option value="opendyslexic" className="bg-[#1a1a1a]">OpenDyslexic - For Dyslexic Readers</option>
                                                <option value="literata" className="bg-[#1a1a1a]">Literata - Long-Form Reading</option>
                                                <option value="system" className="bg-[#1a1a1a]">System Font - Device Default</option>
                                            </select>
                                            <p id="fontFamilyHelp" className="text-xs text-white/50 mt-2">
                                                Choose a font optimised for readability and comfort
                                            </p>
                                        </div>

                                        {/* Preview */}
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                                            <p className="text-xs font-medium text-white/60 mb-3">Preview</p>
                                            <div 
                                                className="text-white/90 leading-relaxed"
                                                style={{
                                                    fontSize: fontSize === 'small' ? '0.875rem' 
                                                        : fontSize === 'medium' ? '1rem'
                                                        : fontSize === 'large' ? '1.125rem'
                                                        : '1.25rem',
                                                    fontFamily: fontFamily === 'inter' ? 'Inter, sans-serif'
                                                        : fontFamily === 'atkinson' ? '"Atkinson Hyperlegible", sans-serif'
                                                        : fontFamily === 'opendyslexic' ? 'OpenDyslexic, sans-serif'
                                                        : fontFamily === 'literata' ? 'Literata, serif'
                                                        : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                                                }}
                                            >
                                                <p className="mb-2">The quick brown fox jumps over the lazy dog.</p>
                                                <p className="text-sm opacity-75">0123456789 - How does this look to you?</p>
                                            </div>
                                        </div>

                                        {/* Save Button */}
                                        <div className="flex items-center gap-3 pt-4">
                                            <button
                                                onClick={handleSaveDisplay}
                                                disabled={savingSettings}
                                                className="px-6 py-2.5 bg-white/10 hover:bg-white/15 disabled:bg-white/5 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/30"
                                            >
                                                {savingSettings ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                                        <span>Saving...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="w-4 h-4" aria-hidden="true" />
                                                        <span>Save Display Settings</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Status message area (fixed height to prevent layout shift) */}
                                        <div className="min-h-[52px]" aria-live="polite" aria-atomic="true">
                                            {/* Toast notifications appear here */}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}

