import { useState } from 'react'
import { Check, ChevronRight, ChevronDown, Loader2, Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import Particles from '@/components/Particles'

const EMBEDDING_MODELS = [
    { id: 'text-embedding-3-small', name: 'text-embedding-3-small (Recommended)', description: 'Fast and cost-effective' },
    { id: 'text-embedding-3-large', name: 'text-embedding-3-large', description: 'Higher quality embeddings' },
    { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002', description: 'Legacy model' }
]

const PROVIDERS = [
    { id: 'openrouter', name: 'OpenRouter', description: 'Access multiple AI models with one API key', requiresBaseUrl: false },
    { id: 'openai', name: 'OpenAI', description: 'Direct access to GPT models', requiresBaseUrl: false },
    { id: 'anthropic', name: 'Anthropic', description: 'Claude models', requiresBaseUrl: false },
    { id: 'openai_compatible', name: 'OpenAI Compatible', description: 'Any OpenAI-compatible API', requiresBaseUrl: true },
    { id: 'ollama', name: 'Ollama', description: 'Local models', requiresBaseUrl: true, defaultBaseUrl: 'http://localhost:11434' }
]

const DEFAULT_SYSTEM_PROMPT = `You are a helpful, intelligent, and friendly AI assistant. Your goal is to:
- Provide clear, accurate, and thoughtful responses
- Be concise but thorough when needed
- Ask clarifying questions when appropriate
- Admit when you don't know something
- Use a casual, conversational tone`

// Animation variants for smooth step transitions
const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        x: direction > 0 ? -300 : 300,
        opacity: 0,
    }),
}

const slideTransition = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
}

export function OnboardingWizard() {
    const { refetchUser } = useAuth()
    const [step, setStep] = useState(1)
    const [direction, setDirection] = useState(1) // Track slide direction (1 = forward, -1 = backward)
    const [displayName, setDisplayName] = useState('')
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
    
    // Provider settings
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
    const [providerApiKey, setProviderApiKey] = useState('')
    const [providerBaseUrl, setProviderBaseUrl] = useState('')
    const [showProviderKey, setShowProviderKey] = useState(false)
    const [validatingProvider, setValidatingProvider] = useState(false)
    const [providerValidated, setProviderValidated] = useState(false)
    const [providerError, setProviderError] = useState('')
    const [providerSaved, setProviderSaved] = useState(false)
    
    // Model selection
    const [selectedModel, setSelectedModel] = useState('')
    const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([])
    const [loadingModels, setLoadingModels] = useState(false)
    
    // Embeddings settings
    const [embeddingApiKey, setEmbeddingApiKey] = useState('')
    const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small')
    const [showEmbeddingKey, setShowEmbeddingKey] = useState(false)
    const [validatingEmbedding, setValidatingEmbedding] = useState(false)
    const [embeddingValidated, setEmbeddingValidated] = useState(false)
    const [embeddingError, setEmbeddingError] = useState('')
    const [embeddingSaved, setEmbeddingSaved] = useState(false)
    const [reuseProviderKey, setReuseProviderKey] = useState(false)
    
    const [saving, setSaving] = useState(false)

    const handleNext = () => {
        setDirection(1)
        setStep(step + 1)
    }

    const handleBack = () => {
        setDirection(-1)
        setStep(step - 1)
    }

    const canProceedStep1 = displayName.trim().length >= 2
    const canProceedStep2 = systemPrompt.trim().length > 0
    const canProceedStep3 = providerSaved
    const canProceedStep4 = embeddingSaved

    // Step 1: Save name
    const handleSaveStep1 = async () => {
        try {
            await api.updateUserSettings({ display_name: displayName })
            handleNext()
        } catch (error) {
            console.error('Failed to save name:', error)
        }
    }

    // Step 2: Save system prompt
    const handleSaveStep2 = async () => {
        try {
            await api.updateUserSettings({ system_prompt: systemPrompt })
            handleNext()
        } catch (error) {
            console.error('Failed to save system prompt:', error)
        }
    }

    // Step 3: Validate and save provider
    const handleValidateProvider = async () => {
        if (!selectedProvider) return
        
        // For Ollama without API key, skip validation (local setup)
        if (selectedProvider === 'ollama' && !providerApiKey) {
            setProviderValidated(true)
            setProviderError('')
            return
        }
        
        if (!providerApiKey) return

        setValidatingProvider(true)
        setProviderError('')

        try {
            const provider = PROVIDERS.find(p => p.id === selectedProvider)
            const result = await api.validateProvider({
                provider: selectedProvider,
                apiKey: providerApiKey,
                baseUrl: provider?.requiresBaseUrl ? providerBaseUrl : undefined
            })

            if (result.valid) {
                setProviderValidated(true)
                setProviderError('')
            } else {
                setProviderError(result.error || 'Validation failed')
                setProviderValidated(false)
            }
        } catch (error) {
            setProviderError(error instanceof Error ? error.message : 'Validation failed')
            setProviderValidated(false)
        } finally {
            setValidatingProvider(false)
        }
    }

    const handleSaveProvider = async () => {
        if (!providerValidated) return

        setSaving(true)
        try {
            const provider = PROVIDERS.find(p => p.id === selectedProvider)
            await api.updateUserSettings({
                provider: selectedProvider!,
                provider_api_key: providerApiKey,
                provider_base_url: provider?.requiresBaseUrl ? providerBaseUrl : null,
                selected_model: selectedModel || null
            })
            setProviderSaved(true)
            
            // Fetch available models
            await fetchAvailableModels()
        } catch (error) {
            console.error('Failed to save provider:', error)
        } finally {
            setSaving(false)
        }
    }
    
    const fetchAvailableModels = async () => {
        if (!selectedProvider) return
        
        try {
            setLoadingModels(true)
            
            // For OpenRouter, use predefined models (you can import MODELS if needed)
            if (selectedProvider === 'openrouter') {
                // For simplicity, just set empty array and let users enter custom model
                setAvailableModels([])
                return
            }
            
            const result = await api.getProviderModels({
                provider: selectedProvider,
                apiKey: providerApiKey || undefined,
                baseUrl: providerBaseUrl || undefined
            })
            
            setAvailableModels(result.models)
        } catch (error) {
            console.error('Failed to fetch models:', error)
            setAvailableModels([])
        } finally {
            setLoadingModels(false)
        }
    }

    // Step 4: Validate and save embeddings
    const handleValidateEmbedding = async () => {
        const keyToUse = reuseProviderKey && selectedProvider === 'openai' ? providerApiKey : embeddingApiKey
        
        if (!keyToUse) return

        setValidatingEmbedding(true)
        setEmbeddingError('')

        try {
            const result = await api.validateEmbedding({ apiKey: keyToUse, model: embeddingModel })

            if (result.valid) {
                setEmbeddingValidated(true)
                setEmbeddingError('')
            } else {
                setEmbeddingError(result.error || 'Validation failed')
                setEmbeddingValidated(false)
            }
        } catch (error) {
            setEmbeddingError(error instanceof Error ? error.message : 'Validation failed')
            setEmbeddingValidated(false)
        } finally {
            setValidatingEmbedding(false)
        }
    }

    const handleSaveEmbedding = async () => {
        if (!embeddingValidated) return

        setSaving(true)
        try {
            const keyToUse = reuseProviderKey && selectedProvider === 'openai' ? providerApiKey : embeddingApiKey
            await api.updateUserSettings({
                embedding_api_key: keyToUse,
                embedding_model: embeddingModel
            })
            setEmbeddingSaved(true)
        } catch (error) {
            console.error('Failed to save embeddings:', error)
        } finally {
            setSaving(false)
        }
    }

    // Final step: Complete onboarding
    const handleComplete = async () => {
        setSaving(true)
        try {
            await api.updateUserSettings({ onboarding_complete: true })
            await refetchUser()
            // Redirect will happen automatically via route guard
        } catch (error) {
            console.error('Failed to complete onboarding:', error)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Full-screen particles background - positioned absolutely to avoid layout shift */}
            <div className="absolute inset-0 z-0">
                <Particles
                    particleColors={['#ffffff', '#ffffff']}
                    particleCount={150}
                    particleSpread={10}
                    speed={0.08}
                    particleBaseSize={80}
                    moveParticlesOnHover={true}
                    alphaParticles={false}
                    disableRotation={false}
                />
            </div>

            {/* Content - positioned relatively to stay above particles */}
            <div className="max-w-2xl w-full relative z-10">
                {/* Progress indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <div
                                key={s}
                                className={`flex items-center ${s === 5 ? '' : 'flex-1'}`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                                        s < step
                                            ? 'bg-white text-black'
                                            : s === step
                                            ? 'bg-white text-black'
                                            : 'bg-white/10 text-white/40'
                                    }`}
                                >
                                    {s < step ? <Check className="w-4 h-4" /> : s}
                                </div>
                                {s < 5 && (
                                    <div
                                        className={`h-0.5 flex-1 mx-2 transition-colors ${
                                            s < step ? 'bg-white' : 'bg-white/10'
                                        }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="text-center text-sm text-white/60 mt-4">
                        Step {step} of 5
                    </div>
                </div>

                {/* Card container */}
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden">
                    <AnimatePresence mode="wait" custom={direction}>
                        {/* Step 1: Name */}
                        {step === 1 && (
                            <motion.div
                                key="step-1"
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={slideTransition}
                                className="space-y-6"
                            >
                                <div>
                                    <h2 className="text-2xl font-semibold text-white mb-2">Welcome! What's your name?</h2>
                                    <p className="text-white/60">This helps the AI personalize responses for you.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/80 mb-2">
                                        Your Name
                                    </label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="e.g., Alex"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-colors"
                                        autoFocus
                                    />
                                </div>

                                <button
                                    onClick={handleSaveStep1}
                                    disabled={!canProceedStep1}
                                    className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    Continue
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </motion.div>
                        )}

                    {/* Step 2: System Prompt */}
                    {step === 2 && (
                        <motion.div
                            key="step-2"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={slideTransition}
                            className="space-y-6"
                        >
                            <div>
                                <h2 className="text-2xl font-semibold text-white mb-2">Customize System Prompt</h2>
                                <p className="text-white/60">Define how the AI should behave. You can change this later in settings.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">
                                    System Prompt
                                </label>
                                <textarea
                                    value={systemPrompt}
                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                    rows={8}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-colors resize-none"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleBack}
                                    className="px-6 py-3 bg-white/5 text-white rounded-lg font-medium hover:bg-white/10 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleSaveStep2}
                                    disabled={!canProceedStep2}
                                    className="flex-1 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    Continue
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Provider */}
                    {step === 3 && (
                        <motion.div
                            key="step-3"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={slideTransition}
                            className="space-y-6"
                        >
                            <div>
                                <h2 className="text-2xl font-semibold text-white mb-2">Choose Your AI Provider</h2>
                                <p className="text-white/60">Select which service you'd like to use. You can change this later.</p>
                            </div>

                            <div className="space-y-2">
                                {PROVIDERS.map((provider) => (
                                    <div key={provider.id}>
                                        <button
                                            onClick={() => {
                                                setSelectedProvider(provider.id)
                                                if (provider.defaultBaseUrl) {
                                                    setProviderBaseUrl(provider.defaultBaseUrl)
                                                }
                                                setProviderValidated(false)
                                                setProviderError('')
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                                                selectedProvider === provider.id
                                                    ? 'bg-white/10 border-white/30'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/8'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium text-white">{provider.name}</div>
                                                    <div className="text-sm text-white/60">{provider.description}</div>
                                                </div>
                                                <ChevronDown
                                                    className={`w-4 h-4 text-white/60 transition-transform ${
                                                        selectedProvider === provider.id ? 'rotate-180' : ''
                                                    }`}
                                                />
                                            </div>
                                        </button>

                                        {/* Expanded provider form */}
                                        {selectedProvider === provider.id && (
                                            <div className="mt-3 p-4 bg-white/5 rounded-lg space-y-4 border border-white/10">
                                                {provider.requiresBaseUrl && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-white/80 mb-2">
                                                            Base URL
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={providerBaseUrl}
                                                            onChange={(e) => setProviderBaseUrl(e.target.value)}
                                                            placeholder={provider.defaultBaseUrl || 'https://api.example.com'}
                                                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/30"
                                                        />
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-sm font-medium text-white/80 mb-2">
                                                        API Key {selectedProvider === 'ollama' && <span className="text-white/50 font-normal">(Optional for local)</span>}
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type={showProviderKey ? 'text' : 'password'}
                                                            value={providerApiKey}
                                                            onChange={(e) => {
                                                                setProviderApiKey(e.target.value)
                                                                setProviderValidated(false)
                                                                setProviderError('')
                                                            }}
                                                            placeholder={selectedProvider === 'ollama' ? "Leave empty for local Ollama" : "sk-..."}
                                                            className="w-full px-3 py-2 pr-10 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/30"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowProviderKey(!showProviderKey)}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white"
                                                        >
                                                            {showProviderKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                    {selectedProvider === 'ollama' && (
                                                        <p className="text-xs text-white/50 mt-1">
                                                            API key not required for local Ollama installations
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Status messages - fixed height to prevent layout shift */}
                                                <div className="min-h-[24px]">
                                                    {providerError && (
                                                        <div className="text-sm text-red-400">{providerError}</div>
                                                    )}

                                                    {providerValidated && !providerSaved && !providerError && (
                                                        <div className="text-sm text-green-400 flex items-center gap-2">
                                                            <Check className="w-4 h-4" /> Valid! Ready to save
                                                        </div>
                                                    )}

                                                    {providerSaved && !providerError && (
                                                        <div className="text-sm text-green-400 flex items-center gap-2">
                                                            <Check className="w-4 h-4" /> Saved successfully!
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleValidateProvider}
                                                        disabled={(selectedProvider !== 'ollama' && !providerApiKey) || validatingProvider}
                                                        className="flex-1 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        {validatingProvider && <Loader2 className="w-4 h-4 animate-spin" />}
                                                        {validatingProvider ? 'Validating...' : 'Validate'}
                                                    </button>

                                                    <button
                                                        onClick={handleSaveProvider}
                                                        disabled={!providerValidated || providerSaved || saving}
                                                        className="flex-1 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                                        {providerSaved ? 'Saved' : 'Save'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Model Selection - Show after provider is saved */}
                            {providerSaved && availableModels.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <label className="block text-sm font-medium text-white/80 mb-2">
                                        Select Model (Optional)
                                    </label>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
                                    >
                                        <option value="" className="bg-[#1a1a1a]">Choose a model (or skip)</option>
                                        {availableModels.map((model) => (
                                            <option key={model.id} value={model.id} className="bg-[#1a1a1a]">
                                                {model.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-white/50 mt-1">
                                        You can change this later in settings
                                    </p>
                                </div>
                            )}

                            {/* Custom model input for OpenRouter or if no models available */}
                            {providerSaved && availableModels.length === 0 && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <label className="block text-sm font-medium text-white/80 mb-2">
                                        Model Name (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        placeholder="e.g., llama2, gpt-4, openai/gpt-4o-mini"
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/30"
                                    />
                                    <p className="text-xs text-white/50 mt-1">
                                        Enter a model name or skip to configure later
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={handleBack}
                                    className="px-6 py-3 bg-white/5 text-white rounded-lg font-medium hover:bg-white/10 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleNext}
                                    disabled={!canProceedStep3}
                                    className="flex-1 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    Continue
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 4: Embeddings */}
                    {step === 4 && (
                        <motion.div
                            key="step-4"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={slideTransition}
                            className="space-y-6"
                        >
                            <div>
                                <h2 className="text-2xl font-semibold text-white mb-2">Configure Embeddings</h2>
                                <p className="text-white/60">Required for document search. OpenAI embeddings recommended.</p>
                            </div>

                            {selectedProvider === 'openai' && (
                                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={reuseProviderKey}
                                            onChange={(e) => setReuseProviderKey(e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm text-white/80">Use the same OpenAI key for embeddings</span>
                                    </label>
                                </div>
                            )}

                            {!reuseProviderKey && (
                                <div>
                                    <label className="block text-sm font-medium text-white/80 mb-2">
                                        OpenAI API Key
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showEmbeddingKey ? 'text' : 'password'}
                                            value={embeddingApiKey}
                                            onChange={(e) => {
                                                setEmbeddingApiKey(e.target.value)
                                                setEmbeddingValidated(false)
                                                setEmbeddingError('')
                                            }}
                                            placeholder="sk-..."
                                            className="w-full px-3 py-2 pr-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowEmbeddingKey(!showEmbeddingKey)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white"
                                        >
                                            {showEmbeddingKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">
                                    Embedding Model
                                </label>
                                <select
                                    value={embeddingModel}
                                    onChange={(e) => setEmbeddingModel(e.target.value)}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                                >
                                    {EMBEDDING_MODELS.map((model) => (
                                        <option key={model.id} value={model.id} className="bg-[#1a1a1a]">
                                            {model.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-sm text-white/60 mt-2">
                                    {EMBEDDING_MODELS.find(m => m.id === embeddingModel)?.description}
                                </p>
                            </div>

                            {/* Status messages - fixed height to prevent layout shift */}
                            <div className="min-h-[24px]">
                                {embeddingError && (
                                    <div className="text-sm text-red-400">{embeddingError}</div>
                                )}

                                {embeddingValidated && !embeddingSaved && !embeddingError && (
                                    <div className="text-sm text-green-400 flex items-center gap-2">
                                        <Check className="w-4 h-4" /> Valid! Ready to save
                                    </div>
                                )}

                                {embeddingSaved && !embeddingError && (
                                    <div className="text-sm text-green-400 flex items-center gap-2">
                                        <Check className="w-4 h-4" /> Saved successfully!
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleValidateEmbedding}
                                    disabled={(!embeddingApiKey && !reuseProviderKey) || validatingEmbedding}
                                    className="flex-1 py-3 bg-white/10 text-white rounded-lg font-medium hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {validatingEmbedding && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {validatingEmbedding ? 'Validating...' : 'Validate'}
                                </button>

                                <button
                                    onClick={handleSaveEmbedding}
                                    disabled={!embeddingValidated || embeddingSaved || saving}
                                    className="flex-1 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {embeddingSaved ? 'Saved' : 'Save'}
                                </button>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleBack}
                                    className="px-6 py-3 bg-white/5 text-white rounded-lg font-medium hover:bg-white/10 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleNext}
                                    disabled={!canProceedStep4}
                                    className="flex-1 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    Continue
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 5: Done */}
                    {step === 5 && (
                        <motion.div
                            key="step-5"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={slideTransition}
                            className="space-y-6 text-center"
                        >
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto">
                                <Check className="w-8 h-8 text-black" />
                            </div>

                            <div>
                                <h2 className="text-2xl font-semibold text-white mb-2">All Set, {displayName}!</h2>
                                <p className="text-white/60">You're ready to start chatting. Here's what you can do:</p>
                            </div>

                            <div className="text-left space-y-3">
                                <div className="p-4 bg-white/5 rounded-lg">
                                    <h3 className="font-medium text-white mb-1">💬 Chat with AI</h3>
                                    <p className="text-sm text-white/60">Have natural conversations powered by your chosen AI provider</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-lg">
                                    <h3 className="font-medium text-white mb-1">🔍 Research Mode</h3>
                                    <p className="text-sm text-white/60">Get comprehensive research reports with cited sources</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-lg">
                                    <h3 className="font-medium text-white mb-1">📄 Document Analysis</h3>
                                    <p className="text-sm text-white/60">Upload and chat with PDFs, Word docs, and spreadsheets</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-lg">
                                    <h3 className="font-medium text-white mb-1">⚙️ Customizable</h3>
                                    <p className="text-sm text-white/60">Change all these settings anytime in Settings</p>
                                </div>
                            </div>

                            <button
                                onClick={handleComplete}
                                disabled={saving}
                                className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Setting up...
                                    </>
                                ) : (
                                    <>
                                        Enter App
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

