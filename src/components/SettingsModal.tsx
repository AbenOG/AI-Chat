import { useState } from 'react'
import { X, Check, Search } from 'lucide-react'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
    selectedModel: string
    onModelChange: (model: string) => void
}

interface Model {
    id: string
    name: string
    provider: string
    context: string
    inputPrice: string
    outputPrice: string
    imagePrice?: string
    researchCapable?: boolean
}

const models: Model[] = [
    {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        context: '128K',
        inputPrice: '$0.15/M',
        outputPrice: '$0.60/M',
        imagePrice: '$0.217/K'
    },
    {
        id: 'openai/gpt-5',
        name: 'GPT-5',
        provider: 'OpenAI',
        context: '400K',
        inputPrice: '$1.25/M',
        outputPrice: '$10/M'
    },
    {
        id: 'openai/gpt-5-mini',
        name: 'GPT-5 Mini',
        provider: 'OpenAI',
        context: '400K',
        inputPrice: '$0.25/M',
        outputPrice: '$2/M'
    },
    {
        id: 'google/gemini-2.5-flash-preview-09-2025',
        name: 'Gemini 2.5 Flash',
        provider: 'Google',
        context: '1.05M',
        inputPrice: '$0.30/M',
        outputPrice: '$2.50/M',
        imagePrice: '$1.238/K',
        researchCapable: true
    },
    {
        id: 'google/gemini-2.5-flash-lite-preview-09-2025',
        name: 'Gemini 2.5 Flash Lite',
        provider: 'Google',
        context: '1.05M',
        inputPrice: '$0.10/M',
        outputPrice: '$0.40/M'
    },
    {
        id: 'x-ai/grok-4-fast',
        name: 'Grok 4 Fast',
        provider: 'X.AI',
        context: '2M',
        inputPrice: '$0.20/M',
        outputPrice: '$0.50/M'
    },
    {
        id: 'qwen/qwen3-coder-plus',
        name: 'Qwen3 Coder Plus',
        provider: 'Alibaba',
        context: '128K',
        inputPrice: '$1/M',
        outputPrice: '$5/M'
    },
    {
        id: 'qwen/qwen3-235b-a22b-thinking-2507',
        name: 'Qwen3 235B A22B Thinking',
        provider: 'Qwen',
        context: '262K',
        inputPrice: '$0.11/M',
        outputPrice: '$0.60/M'
    },
    {
        id: 'z-ai/glm-4.6',
        name: 'GLM 4.6',
        provider: 'Z.AI',
        context: '203K',
        inputPrice: '$0.50/M',
        outputPrice: '$1.75/M'
    },
    {
        id: 'z-ai/glm-4.5-air',
        name: 'GLM 4.5 Air',
        provider: 'Z.AI',
        context: '131K',
        inputPrice: '$0.14/M',
        outputPrice: '$0.86/M'
    },
    {
        id: 'deepseek/deepseek-v3.2-exp',
        name: 'DeepSeek V3.2',
        provider: 'DeepSeek',
        context: '164K',
        inputPrice: '$0.27/M',
        outputPrice: '$0.40/M'
    },
    {
        id: 'deepseek/deepseek-r1-0528',
        name: 'DeepSeek R1',
        provider: 'DeepSeek',
        context: '164K',
        inputPrice: '$0.40/M',
        outputPrice: '$1.75/M'
    }
]

export function SettingsModal({ isOpen, onClose, selectedModel, onModelChange }: SettingsModalProps) {
    const [filterResearch, setFilterResearch] = useState(false)

    if (!isOpen) return null

    const filteredModels = filterResearch
        ? models.filter(m => m.researchCapable)
        : models

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="
                        w-full max-w-lg bg-card/98 backdrop-blur-xl
                        border border-white/10 rounded-2xl
                        shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                        animate-fade-in
                        pointer-events-auto
                        max-h-[80vh]
                        flex flex-col
                    "
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">AI Models</h2>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">Select your preferred model</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="
                                p-1.5 rounded-lg hover:bg-white/10
                                transition-colors
                                focus:outline-none focus:ring-2 focus:ring-white/20
                            "
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Filter */}
                    <div className="px-5 py-3 border-b border-white/5 flex-shrink-0">
                        <button
                            onClick={() => setFilterResearch(!filterResearch)}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                                transition-all duration-200
                                ${filterResearch
                                    ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400'
                                    : 'bg-white/5 border border-white/10 text-foreground/60 hover:bg-white/10'
                                }
                            `}
                        >
                            <Search className="w-3.5 h-3.5" />
                            <span>Research-capable models</span>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="overflow-y-auto custom-scrollbar p-4 flex-1">
                        <div className="space-y-2">
                            {filteredModels.map((model) => {
                                const isSelected = selectedModel === model.id
                                return (
                                    <button
                                        key={model.id}
                                        onClick={() => {
                                            onModelChange(model.id)
                                            setTimeout(() => onClose(), 200)
                                        }}
                                        className={`
                                            w-full flex items-start gap-3 px-4 py-3 rounded-lg
                                            transition-all duration-200
                                            ${isSelected
                                                ? 'bg-white/10 border border-white/20 ring-1 ring-white/10'
                                                : 'hover:bg-white/5 border border-white/5'
                                            }
                                        `}
                                    >
                                        <div className="flex-1 text-left space-y-1.5">
                                            {/* Model Name & Provider */}
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-semibold ${isSelected ? 'text-foreground' : 'text-foreground/90'}`}>
                                                    {model.name}
                                                </span>
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground/80">
                                                    {model.provider}
                                                </span>
                                            </div>

                                            {/* Details */}
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                                                <span className="flex items-center gap-1">
                                                    <span className="text-muted-foreground/50">Context:</span>
                                                    <span className="font-medium">{model.context}</span>
                                                </span>
                                                <span className="text-white/20">•</span>
                                                <span className="flex items-center gap-1">
                                                    <span className="text-muted-foreground/50">In:</span>
                                                    <span className="font-medium">{model.inputPrice}</span>
                                                </span>
                                                <span className="text-white/20">•</span>
                                                <span className="flex items-center gap-1">
                                                    <span className="text-muted-foreground/50">Out:</span>
                                                    <span className="font-medium">{model.outputPrice}</span>
                                                </span>
                                            </div>

                                            {/* Image Price (if available) */}
                                            {model.imagePrice && (
                                                <div className="text-xs text-muted-foreground/60">
                                                    <span className="text-muted-foreground/50">Images: </span>
                                                    <span className="font-medium">{model.imagePrice}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Check indicator */}
                                        {isSelected && (
                                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/90 flex-shrink-0">
                                                <Check className="w-3 h-3 text-background stroke-[3]" />
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
