import { Copy, Edit, Brain, Quote, FileText, RefreshCw } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { ResearchArtifact } from '@/components/ResearchArtifact'
import { ArtifactCard } from '@/components/ArtifactCard'
import type { Message, QuotedText, Artifact } from '@/types'

interface MessageBubbleProps {
    message: Message
    onQuote?: (quote: QuotedText) => void
    onEdit?: (messageId: string, newContent: string) => void
    onRetry?: (messageId: string) => void
    isStudyMode?: boolean
}

export function MessageBubble({ message, onQuote, onEdit, onRetry, isStudyMode = false }: MessageBubbleProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [selectionRects, setSelectionRects] = useState<Array<{ x: number; y: number; w: number; h: number }>>([])
    const [selectedText, setSelectedText] = useState('')
    const [isCopied, setIsCopied] = useState(false)
    const [isSelectionCopied, setIsSelectionCopied] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editedContent, setEditedContent] = useState(message.content)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [showThinking, setShowThinking] = useState(false)
    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (error) {
            console.error('Failed to copy message:', error)
        }
    }

    const handleEdit = () => {
        setIsEditing(true)
        setEditedContent(message.content)
        // Focus textarea after render
        setTimeout(() => textareaRef.current?.focus(), 0)
    }

    const handleSaveEdit = () => {
        if (editedContent.trim() && onEdit) {
            onEdit(message.id, editedContent.trim())
            setIsEditing(false)
        }
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditedContent(message.content)
    }

    // Auto-resize textarea
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
        }
    }, [isEditing, editedContent])

    const handleTextSelection = () => {
        // Small delay to ensure selection is finalized
        setTimeout(() => {
            const selection = window.getSelection()
            if (!selection || selection.isCollapsed) {
                setSelectedText('')
                setSelectionRects([])
                return
            }

            const text = selection.toString().trim()
            if (!text) {
                setSelectedText('')
                return
            }

            const range = selection.getRangeAt(0)
            const rects = range.getClientRects()

            // Choose the bottom-most rect so we anchor near the end of the selection on screen
            let targetRect: DOMRect = range.getBoundingClientRect()
            if (rects.length) {
                targetRect = Array.from(rects).reduce((bottomMost, r) => (r.bottom > bottomMost.bottom ? r : bottomMost))
            }

            const containerRect = containerRef.current?.getBoundingClientRect()
            if (!containerRect) return

            const centerX = targetRect.left + targetRect.width / 2
            const clampedX = Math.min(Math.max(centerX, containerRect.left + 8), containerRect.right - 8)

            setSelectedText(text)
            // Store coordinates relative to the container to avoid transformed ancestor issues
            setCursorPosition({ x: clampedX - containerRect.left, y: targetRect.bottom - containerRect.top })

            // Build highlight rectangles relative to container
            const rectList: Array<{ x: number; y: number; w: number; h: number }> = []
            Array.from(rects).forEach(r => {
                rectList.push({
                    x: Math.max(0, r.left - containerRect.left),
                    y: Math.max(0, r.top - containerRect.top),
                    w: r.width,
                    h: r.height
                })
            })
            // Fallback to range bounding box if no client rects
            if (rectList.length === 0) {
                rectList.push({
                    x: Math.max(0, targetRect.left - containerRect.left),
                    y: Math.max(0, targetRect.top - containerRect.top),
                    w: targetRect.width,
                    h: targetRect.height
                })
            }
            setSelectionRects(rectList)
        }, 30)
    }

    const handleQuote = () => {
        if (selectedText && onQuote) {
            onQuote({
                text: selectedText,
                messageId: message.id
            })
            setSelectedText('')
            setSelectionRects([])
            setIsSelectionCopied(false)
            window.getSelection()?.removeAllRanges()
        }
    }

    const handleCopySelection = async () => {
        if (selectedText) {
            try {
                await navigator.clipboard.writeText(selectedText)
                setIsSelectionCopied(true)
                setTimeout(() => {
                    setIsSelectionCopied(false)
                }, 2000)
            } catch (error) {
                console.error('Failed to copy selection:', error)
            }
        }
    }

    // Clear selection when text selection is removed
    useEffect(() => {
        const handleSelectionChange = () => {
            // Only check if we currently have selected text stored
            if (selectedText) {
                const selection = window.getSelection()
                const currentText = selection?.toString().trim() || ''

                // If selection is gone and we had text selected, clear it
                if (!currentText) {
                    setSelectedText('')
                    setSelectionRects([])
                }
            }
        }

        document.addEventListener('selectionchange', handleSelectionChange)
        return () => document.removeEventListener('selectionchange', handleSelectionChange)
    }, [selectedText])

    const formatTime = (date: Date | string) => {
        const dateObj = typeof date === 'string' ? new Date(date) : date
        return dateObj.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const isUser = message.role === 'user'
    const hasThinking = message.thinking && message.thinking.length > 0

    // Format model name for display
    const getModelDisplayName = (modelId?: string): string => {
        if (!modelId) return 'AI'

        const modelNames: Record<string, string> = {
            'openai/gpt-4o-mini': 'GPT-4o Mini',
            'openai/gpt-5': 'GPT-5',
            'openai/gpt-5-mini': 'GPT-5 Mini',
            'google/gemini-2.5-flash-preview-09-2025': 'Gemini 2.5 Flash',
            'google/gemini-2.5-flash-lite-preview-09-2025': 'Gemini 2.5 Flash Lite',
            'x-ai/grok-4-fast': 'Grok 4 Fast',
            'qwen/qwen3-coder-plus': 'Qwen3 Coder Plus',
            'qwen/qwen3-235b-a22b-thinking-2507': 'Qwen3 235B A22B Thinking',
            'z-ai/glm-4.6': 'GLM 4.6',
            'z-ai/glm-4.5-air': 'GLM 4.5 Air',
            'deepseek/deepseek-v3.2-exp': 'DeepSeek V3.2',
            'deepseek/deepseek-r1-0528': 'DeepSeek R1'
        }

        return modelNames[modelId] || modelId.split('/').pop() || 'AI'
    }

    return (
        <div ref={containerRef} className="group relative z-[95] py-6 animate-fade-in">
            <div className="max-w-3xl mx-auto px-6">
                <div className={isUser ? 'flex flex-col items-end' : ''}>
                    {/* Message Content */}
                    <div className={isUser ? `
                        p-4 rounded-xl
                        bg-white/[0.03]
                        border border-white/[0.06]
                        max-w-[85%] w-fit
                    ` : 'w-full'}>
                        {/* Thinking Section (Collapsible) */}
                        {hasThinking && (
                            <div className="mb-3">
                                <button
                                    onClick={() => setShowThinking(!showThinking)}
                                    className="
                                    flex items-center gap-2 px-3 py-1.5 rounded-lg
                                    text-xs font-medium
                                    bg-white/5 hover:bg-white/10
                                    border border-white/10
                                    text-muted-foreground hover:text-foreground
                                    transition-all duration-200
                                "
                                >
                                    <Brain className="w-3.5 h-3.5" />
                                    <span>{showThinking ? 'Hide' : 'Show'} thinking</span>
                                    {message.tokens?.thinking && (
                                        <span className="text-muted-foreground/60">
                                            ({message.tokens.thinking} tokens)
                                        </span>
                                    )}
                                </button>
                                {showThinking && (
                                    <div className="
                                    mt-2 p-3 rounded-lg
                                    bg-white/5 border border-white/10
                                    text-sm leading-6 text-muted-foreground/80
                                    whitespace-pre-wrap break-words
      animate-fade-in
                                ">
                                        {message.thinking}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quoted Text Reference */}
                        {message.quotedText && (
                            <div className="
                            mb-3 p-3 rounded-lg
                            bg-white/5 border-l-2 border-white/30
                            text-sm text-muted-foreground/80
                        ">
                                <div className="flex items-start gap-2 mb-1">
                                    <Quote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs font-medium text-foreground/60">Quoted context</span>
                                </div>
                                <div className="italic line-clamp-3 text-xs">
                                    {message.quotedText.text}
                                </div>
                            </div>
                        )}

                        {/* Attachments Display */}
                        {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2 animate-fade-in">
                                {message.attachments.map((attachment, index) => (
                                    <div
                                        key={attachment.id}
                                        className="
                                        relative group rounded-lg overflow-hidden
                                        bg-gradient-to-br from-white/[0.10] to-white/[0.05]
                                        border border-white/20
                                        transition-all duration-300
                                        hover:from-white/[0.15] hover:to-white/[0.08]
                                        hover:border-white/30
                                        hover:shadow-lg
                                    "
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        {attachment.type === 'image' ? (
                                            <div className="relative">
                                                <img
                                                    src={attachment.url}
                                                    alt={attachment.name}
                                                    className="max-w-xs max-h-64 object-contain rounded-lg cursor-pointer"
                                                    onClick={() => window.open(attachment.url, '_blank')}
                                                />
                                                <div className="
                                                absolute bottom-0 inset-x-0
                                                bg-gradient-to-t from-black/80 via-black/40 to-transparent
                                                p-2 opacity-0 group-hover:opacity-100
                                                transition-opacity duration-200
                                            ">
                                                    <p className="text-white text-xs font-medium truncate">
                                                        {attachment.name}
                                                    </p>
                                                    <p className="text-white/70 text-[10px]">
                                                        {(attachment.size / 1024).toFixed(1)} KB
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="
                                            p-4 flex items-center gap-3
                                            cursor-pointer
                                        ">
                                                <div className="
                                                w-10 h-10 rounded-lg
                                                bg-gradient-to-br from-white/[0.15] to-white/[0.08]
                                                flex items-center justify-center
                                                text-foreground/70
                                            ">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {attachment.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {(attachment.size / 1024).toFixed(1)} KB • {attachment.mimeType.split('/')[1]?.toUpperCase()}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Main Response */}
                        <div
                            className="text-[15px] leading-7 relative"
                            onMouseUp={handleTextSelection}
                        >
                            {isEditing ? (
                                <div className="space-y-2">
                                    <textarea
                                        ref={textareaRef}
                                        value={editedContent}
                                        onChange={(e) => setEditedContent(e.target.value)}
                                        className="
                                        w-full px-3 py-2 rounded-lg
                                        bg-white/[0.05] border border-white/10
                                        text-foreground text-[15px] leading-7
                                        focus:outline-none focus:border-white/20
                                        resize-none
                                    "
                                        rows={1}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSaveEdit}
                                            className="
                                            px-3 py-1.5 rounded-md text-xs
                                            bg-white/90 hover:bg-white
                                            text-background font-medium
                                            transition-all duration-200
                                        "
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            className="
                                            px-3 py-1.5 rounded-md text-xs
                                            bg-white/[0.03] border border-white/[0.06]
                                            hover:bg-white/[0.06] hover:border-white/10
                                            text-foreground/60 hover:text-foreground/80
                                            transition-all duration-200
                                        "
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : message.role === 'assistant' ? (
                                <>
                                    <MarkdownContent content={message.content} deferHighlight={false} messageId={message.id} isStudyMode={isStudyMode} />

                                    {/* Research Metadata Badge (minimal) */}
                                    {message.isResearch && message.researchMetadata && (
                                        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/60">
                                            {message.researchMetadata.durationSeconds && (
                                                <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10">
                                                    Research completed in {Math.floor(message.researchMetadata.durationSeconds / 60)}m {message.researchMetadata.durationSeconds % 60}s
                                                </span>
                                            )}
                                            {message.researchMetadata.sources && message.researchMetadata.sources.length > 0 && (
                                                <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10">
                                                    {message.researchMetadata.sources.length} sources
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Research legacy artifact (HTML) */}
                                    {message.isResearch && message.researchMetadata?.artifactHtml && (
                                        <div className="mt-4">
                                            <ResearchArtifact
                                                artifactHtml={message.researchMetadata.artifactHtml}
                                                title={message.content.match(/^#\s+(.+)$/m)?.[1] || 'Research Report'}
                                                onOpenSplit={(html, title) => {
                                                    const event = new CustomEvent('open-artifact-split', { detail: { html, title } })
                                                    window.dispatchEvent(event)
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Universal Artifacts */}
                                    {message.artifacts && message.artifacts.length > 0 && (
                                        <div className="mt-4 space-y-3">
                                            {message.artifacts.map((artifact: Artifact) => (
                                                <ArtifactCard
                                                    key={artifact.id}
                                                    artifact={artifact}
                                                    onOpenSplit={(art) => {
                                                        // Dispatch a generic split-pane open for any kind
                                                        const event = new CustomEvent('open-artifact-split-any', { detail: { artifact: art } })
                                                        window.dispatchEvent(event)
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-foreground whitespace-pre-wrap break-words">
                                    {message.content}
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Message Actions - Outside bubble */}
                    <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                            onClick={handleCopy}
                            onMouseDown={(e) => e.preventDefault()}
                            type="button"
                            className="
                                flex items-center gap-1 px-2 py-1 rounded-md
                                text-[11px] text-foreground/60
                                bg-white/[0.03] border border-white/[0.06]
                                hover:bg-white/[0.06] hover:border-white/10 hover:text-foreground/80
                                transition-all duration-200
                                focus:outline-none
              "
                            aria-label={isCopied ? "Copied" : "Copy message"}
                        >
                            <Copy className="w-3 h-3" />
                            <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                        </button>

                        {isUser && !isEditing && (
                            <button
                                onClick={handleEdit}
                                className="
                                    flex items-center gap-1 px-2 py-1 rounded-md
                                    text-[11px] text-foreground/60
                                    bg-white/[0.03] border border-white/[0.06]
                                    hover:bg-white/[0.06] hover:border-white/10 hover:text-foreground/80
                                    transition-all duration-200
                                    focus:outline-none
                "
                                aria-label="Edit message"
                            >
                                <Edit className="w-3 h-3" />
                                <span>Edit</span>
                            </button>
                        )}

                        {message.role === 'assistant' && onRetry && (
                            <button
                                onClick={() => onRetry(message.id)}
                                className="
                                    flex items-center gap-1 px-2 py-1 rounded-md
                                    text-[11px] text-foreground/60
                                    bg-white/[0.03] border border-white/[0.06]
                                    hover:bg-white/[0.06] hover:border-white/10 hover:text-foreground/80
                                    transition-all duration-200
                                    focus:outline-none
                                "
                                aria-label="Retry generation"
                            >
                                <RefreshCw className="w-3 h-3" />
                                <span>Retry</span>
                            </button>
                        )}

                        {/* Token Usage - Show on Hover */}
                        {message.role === 'assistant' && message.tokens && (
                            <div className="flex items-center gap-1.5 ml-2 text-xs text-muted-foreground/70">
                                <span className="font-medium">
                                    {getModelDisplayName(message.model)}
                                </span>
                                <span>
                                    {message.tokens.input}→{message.tokens.output}
                                    {message.tokens.thinking && `+${message.tokens.thinking}`} tokens
                                </span>
                                {message.cost && (
                                    <span>
                                        • ${message.cost.toFixed(4)}
                                    </span>
                                )}
                            </div>
                        )}

                        <span className="text-xs text-muted-foreground/60 ml-auto">
                            {formatTime(message.timestamp)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Dim Overlay + Quote Button */}
            {
                selectedText && message.role === 'assistant' && onQuote && (
                    <>
                        {/* Backdrop overlay - dims everything except this container */}
                        <div
                            className="
                            fixed inset-0 
                            bg-black/40
                            animate-fade-in
                            z-[90]
                        "
                            style={{
                                pointerEvents: 'none',
                                mixBlendMode: 'multiply'
                            }}
                        />

                        {/* Emphasize selected text with local highlights */}
                        {selectionRects.length > 0 && (
                            <div className="absolute inset-0 pointer-events-none z-[96]">
                                {selectionRects.map((r, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            position: 'absolute',
                                            left: r.x,
                                            top: r.y,
                                            width: r.w,
                                            height: r.h,
                                            borderRadius: 6
                                        }}
                                        className="
                                        bg-white/20
                                        ring-1 ring-white/30
                                        shadow-[0_0_0_2px_rgba(255,255,255,0.1),0_8px_24px_rgba(0,0,0,0.25)]
                                        transition-opacity duration-150
                                    "
                                    />
                                ))}
                            </div>
                        )}

                        {/* Quote and Copy Buttons */}
                        <div
                            style={{
                                position: 'absolute',
                                left: `${cursorPosition.x}px`,
                                top: `${cursorPosition.y}px`,
                                transform: 'translate(-50%, calc(-100% - 24px))'
                            }}
                            className="flex items-center gap-1.5 animate-fade-in z-[100]"
                        >
                            <button
                                onClick={handleQuote}
                                className="
                                    flex items-center gap-2 px-3 py-1.5 rounded-lg
                                    bg-gradient-to-br from-white/95 to-white/85
                                    hover:from-white hover:to-white/95
                                    backdrop-blur-xl border border-white/50
                                    text-background font-medium text-xs
                                    shadow-[0_4px_16px_rgba(255,255,255,0.3)]
                                    hover:shadow-[0_6px_20px_rgba(255,255,255,0.4)]
                                    transition-all duration-200
                                "
                            >
                                <Quote className="w-3.5 h-3.5" />
                                <span>Ask about this</span>
                            </button>
                            
                            <button
                                onClick={handleCopySelection}
                                className="
                                    flex items-center justify-center w-8 h-8 rounded-lg
                                    bg-gradient-to-br from-white/95 to-white/85
                                    hover:from-white hover:to-white/95
                                    backdrop-blur-xl border border-white/50
                                    text-background
                                    shadow-[0_4px_16px_rgba(255,255,255,0.3)]
                                    hover:shadow-[0_6px_20px_rgba(255,255,255,0.4)]
                                    transition-all duration-200
                                "
                                title="Copy to clipboard"
                            >
                                {isSelectionCopied ? (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                            </button>
                        </div>
                    </>
                )
            }
        </div >
    )
}