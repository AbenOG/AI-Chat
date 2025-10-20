import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowUp, Square, ChevronUp, X, Quote, Globe, Paperclip, FileText, EyeOff, Globe2, Upload, Search, ChevronRight, GraduationCap } from 'lucide-react'
import type { ChatMode, QuotedText, Attachment } from '@/types'
import { api } from '@/services/api'

interface ChatInputProps {
    onSendMessage: (message: string, attachments?: Attachment[]) => void
    onStopGeneration: () => void
    isGenerating: boolean
    currentMode: ChatMode
    onModeChange: (mode: ChatMode) => void
    quotedText?: QuotedText | null
    onClearQuote?: () => void
    useWebSearch?: boolean
    onToggleWebSearch?: (enabled: boolean) => void
    sessionTokens?: { input: number; output: number }
    sessionCost?: number
    activeModel?: string
    isIncognito?: boolean
    onToggleIncognito?: () => void
}

const modes = [
    { id: 'chat', label: 'Chat', description: 'Standard conversation' },
    { id: 'study', label: 'Study', description: 'Learn with AI guidance' },
    { id: 'research', label: 'Research', description: 'In-depth analysis' }
] as const

export function ChatInput({
    onSendMessage,
    onStopGeneration,
    isGenerating,
    currentMode,
    onModeChange,
    quotedText,
    onClearQuote,
    useWebSearch = false,
    onToggleWebSearch,
    sessionTokens,
    sessionCost,
    activeModel,
    isIncognito = false,
    onToggleIncognito
}: ChatInputProps) {
    const [message, setMessage] = useState('')
    const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false)
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [isProcessingFile, setIsProcessingFile] = useState(false)
    const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false)
    const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false)
    const [userDocuments, setUserDocuments] = useState<any[]>([])
    const [filteredDocuments, setFilteredDocuments] = useState<any[]>([])
    const [loadingDocs, setLoadingDocs] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const attachMenuRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const handleSend = () => {
        if ((message.trim() || attachments.length > 0) && !isGenerating) {
            onSendMessage(message.trim(), attachments.length > 0 ? attachments : undefined)
            setMessage('')
            setAttachments([])
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleStop = () => {
        onStopGeneration()
    }

    const extractTextFromPDF = async (file: File): Promise<string> => {
        try {
            const arrayBuffer = await file.arrayBuffer()
            const pdfjs = await import('pdfjs-dist')

            // Set worker path for Vite - use unpkg CDN with the correct version
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
            let fullText = ''

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i)
                const textContent = await page.getTextContent()
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ')
                fullText += pageText + '\n\n'
            }

            return fullText.trim()
        } catch (error) {
            console.error('PDF extraction error:', error)
            return `[Unable to extract text from PDF: ${file.name}]`
        }
    }

    // Upload DOCX/XLS/XLSX to server for extraction and return extracted text
    const extractViaServer = async (file: File): Promise<string> => {
        try {
            const { documentId } = await api.uploadDocument(file)
            // Poll until processing completes (up to ~20s)
            const start = Date.now()
            const timeoutMs = 20000
            const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
            while (Date.now() - start < timeoutMs) {
                const doc = await api.getDocument(documentId)
                if (doc.status === 'completed') {
                    const { content } = await api.getDocumentContent(documentId)
                    return content || ''
                }
                if (doc.status === 'failed') {
                    return `[Extraction failed for ${file.name}]`
                }
                await sleep(1000)
            }
            return `[Extraction timed out for ${file.name}]`
        } catch (err) {
            console.error('Server extraction error:', err)
            return `[Unable to extract text from ${file.name}]`
        }
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsProcessingFile(true)
        const newAttachments: Attachment[] = []

        try {
            for (const file of Array.from(files)) {
                // Check file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    console.warn(`File too large: ${file.name}`)
                    continue
                }

                const isImage = file.type.startsWith('image/')
                const isPDF = file.type === 'application/pdf'
                const isText = file.type.startsWith('text/')
                const lowerName = file.name.toLowerCase()
                const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerName.endsWith('.docx')
                const isXlsx = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || lowerName.endsWith('.xlsx')
                const isXls = file.type === 'application/vnd.ms-excel' || lowerName.endsWith('.xls')

                let extractedText: string | undefined

                // Extract text from PDFs, text files, and Office docs (via server)
                if (isPDF) {
                    extractedText = await extractTextFromPDF(file)
                } else if (isText) {
                    extractedText = await file.text()
                } else if (isDocx || isXlsx || isXls) {
                    extractedText = await extractViaServer(file)
                }

                // Read file as data URL for storage
                const dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onload = (event) => {
                        resolve(event.target?.result as string)
                    }
                    reader.readAsDataURL(file)
                })

                newAttachments.push({
                    id: `${Date.now()}-${Math.random()}`,
                    type: isImage ? 'image' : 'file',
                    name: file.name,
                    url: dataUrl,
                    mimeType: file.type,
                    size: file.size,
                    extractedText
                })
            }

            setAttachments(prev => [...prev, ...newAttachments])
        } finally {
            setIsProcessingFile(false)
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id))
    }

    const loadUserDocuments = async () => {
        try {
            setLoadingDocs(true)
            const data = await api.getDocuments()
            const completedDocs = data.documents.filter((d: any) => d.status === 'completed')
            setUserDocuments(completedDocs)
            setFilteredDocuments(completedDocs)
        } catch (error) {
            console.error('Failed to load documents:', error)
        } finally {
            setLoadingDocs(false)
        }
    }

    const handleAttachMenuToggle = () => {
        setIsAttachMenuOpen(!isAttachMenuOpen)
        setIsDocumentsModalOpen(false)
        setSearchQuery('')
    }

    const handleMyFilesClick = () => {
        if (!loadingDocs && userDocuments.length === 0) {
            loadUserDocuments()
        }
        setIsAttachMenuOpen(false)
        setIsDocumentsModalOpen(true)
    }

    const handleSelectDocument = (doc: any) => {
        // Add document as a reference attachment
        setAttachments(prev => [...prev, {
            id: `doc-${doc.id}`,
            type: 'document_reference',
            name: doc.filename,
            documentId: doc.id,
            size: doc.size_bytes,
            mimeType: doc.mime_type
        }])
        setIsAttachMenuOpen(false)
        setIsDocumentsModalOpen(false)
        setSearchQuery('')
    }

    // Debounced search
    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value)
        
        if (!value.trim()) {
            setFilteredDocuments(userDocuments)
        } else {
            const query = value.toLowerCase()
            const filtered = userDocuments.filter(doc =>
                doc.filename.toLowerCase().includes(query)
            )
            setFilteredDocuments(filtered)
        }
    }, [userDocuments])

    // Auto-focus search input when modal opens
    useEffect(() => {
        if (isDocumentsModalOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100)
        }
    }, [isDocumentsModalOpen])

    // Close modal on ESC key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDocumentsModalOpen) {
                setIsDocumentsModalOpen(false)
                setSearchQuery('')
            }
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isDocumentsModalOpen])

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current
        if (textarea) {
            textarea.style.height = 'auto'
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
        }
    }, [message])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsModeDropdownOpen(false)
            }
            if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
                setIsAttachMenuOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const selectedMode = modes.find(mode => mode.id === currentMode)

    return (
        <div className="relative px-4 pb-6 pt-0">
            {/* Extended gradient fade to eliminate black bar */}
            <div className="absolute inset-x-0 -top-24 h-32 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10">
                <div className="relative">
                    {/* Quoted Text Preview */}
                    {quotedText && (
                        <div className="
                            mb-3 p-3 rounded-xl
                            bg-gradient-to-br from-white/[0.12] to-white/[0.06]
                            backdrop-blur-xl backdrop-saturate-150
                            border border-white/20
                            shadow-[0_4px_16px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.3)_inset]
                            animate-fade-in
                        ">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Quote className="w-3.5 h-3.5 text-foreground/70 flex-shrink-0" />
                                        <span className="text-xs font-medium text-foreground/80">Asking about:</span>
                                    </div>
                                    <div className="text-sm text-foreground/70 italic line-clamp-2">
                                        {quotedText.text}
                                    </div>
                                </div>
                                <button
                                    onClick={onClearQuote}
                                    className="
                                        flex-shrink-0 p-1.5 rounded-lg
                                        text-foreground/60 hover:text-foreground
                                        hover:bg-white/10
                                        transition-all duration-200
                                    "
                                    aria-label="Clear quote"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Attachments Preview */}
                    {attachments.length > 0 && (
                        <div className="
                            mb-3 p-2 rounded-xl
                            bg-gradient-to-br from-white/[0.12] to-white/[0.06]
                            backdrop-blur-xl backdrop-saturate-150
                            border border-white/20
                            shadow-[0_4px_16px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.3)_inset]
                            animate-fade-in
                        ">
                            <div className="flex flex-wrap gap-2">
                                {attachments.map((attachment, index) => (
                                    <div
                                        key={attachment.id}
                                        className="
                                            relative group rounded-lg overflow-hidden
                                            bg-gradient-to-br from-white/[0.10] to-white/[0.05]
                                            border border-white/20
                                            transition-all duration-300
                                            animate-fade-in
                                            flex items-center gap-2 pr-2
                                        "
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        {attachment.type === 'image' ? (
                                            <>
                                                <img
                                                    src={attachment.url}
                                                    alt={attachment.name}
                                                    className="w-12 h-12 object-cover flex-shrink-0"
                                                />
                                                <span className="text-xs text-foreground/80 truncate max-w-[120px] pr-4">
                                                    {attachment.name}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="
                                                    w-12 h-12 flex items-center justify-center flex-shrink-0
                                                    text-foreground/70
                                                ">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <span className="text-xs text-foreground/80 truncate max-w-[120px] pr-4">
                                                    {attachment.name}
                                                </span>
                                            </>
                                        )}
                                        <button
                                            onClick={() => removeAttachment(attachment.id)}
                                            className="
                                                absolute top-1 right-1
                                                p-1 rounded-md
                                                bg-black/60 backdrop-blur-sm
                                                text-white
                                                opacity-0 group-hover:opacity-100
                                                hover:bg-black/80
                                                transition-all duration-200
                                            "
                                            aria-label="Remove attachment"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Container - True Frosted Glass */}
                    <div className={`
                        relative flex items-end gap-2 min-h-[56px]
                        bg-gradient-to-br from-white/[0.15] to-white/[0.05]
                        backdrop-blur-3xl backdrop-saturate-150
                        border rounded-3xl
                        shadow-[0_8px_32px_rgba(31,38,135,0.15),0_0_1px_rgba(255,255,255,0.4)_inset]
                        transition-all duration-300 ease-out
                        ${currentMode === 'research'
                            ? 'border-cyan-500/30 focus-within:border-cyan-400/60 focus-within:from-cyan-500/[0.08] focus-within:to-white/[0.08] focus-within:shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_40px_rgba(34,211,238,0.15),0_8px_32px_rgba(34,211,238,0.25),0_0_2px_rgba(34,211,238,0.6)_inset]'
                            : currentMode === 'study'
                            ? 'border-green-500/30 focus-within:border-green-400/60 focus-within:from-green-500/[0.08] focus-within:to-white/[0.08] focus-within:shadow-[0_0_0_1px_rgba(34,197,94,0.3),0_0_40px_rgba(34,197,94,0.15),0_8px_32px_rgba(34,197,94,0.25),0_0_2px_rgba(34,197,94,0.6)_inset]'
                            : 'border-white/30 focus-within:border-white/60 focus-within:from-white/[0.18] focus-within:to-white/[0.08] focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_0_40px_rgba(255,255,255,0.15),0_8px_32px_rgba(31,38,135,0.25),0_0_2px_rgba(255,255,255,0.6)_inset]'
                        }
                    `}>
                        {/* Animated gradient border glow */}
                        <div className={`
                            absolute inset-0 rounded-3xl opacity-0 focus-within:opacity-100
                            blur-xl -z-10
                            animate-border-glow
                            pointer-events-none
                            transition-opacity duration-300
                            ${currentMode === 'research'
                                ? 'bg-gradient-to-r from-cyan-500/20 via-cyan-400/40 to-cyan-500/20'
                                : currentMode === 'study'
                                ? 'bg-gradient-to-r from-green-500/20 via-green-400/40 to-green-500/20'
                                : 'bg-gradient-to-r from-white/20 via-white/40 to-white/20'
                            }
                        `} />

                        {/* Left: Mode selector - vertically centered */}
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20">
                            <div ref={dropdownRef} className="relative">
                                <button
                                    onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                                    className="
                                        h-9 px-3 rounded-lg inline-flex items-center gap-2
                                        bg-gradient-to-br from-white/[0.12] to-white/[0.06]
                                        backdrop-blur-xl backdrop-saturate-150
                                        border border-white/20
                                        text-foreground/90 hover:text-foreground
                                        hover:from-white/[0.18] hover:to-white/[0.10] hover:border-white/30
                                        shadow-[0_2px_8px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.3)_inset]
                                        transition-all duration-200
                                        focus:outline-none focus:ring-1 focus:ring-white/30
                                        text-xs font-medium
                                        relative z-20
                                    "
                                >
                                    {currentMode === 'research' && (
                                        <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                                    )}
                                    {currentMode === 'study' && (
                                        <GraduationCap className="w-3.5 h-3.5 text-green-400" />
                                    )}
                                    <span>{selectedMode?.label}</span>
                                    <ChevronUp
                                        className={`
                                            w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0
                                            ${isModeDropdownOpen ? 'rotate-180' : ''}
                                        `}
                                    />
                                </button>

                                {isModeDropdownOpen && (
                                    <div className="
                                        absolute bottom-full left-0 mb-4 w-64
                                        bg-[#1a1a1a] border border-white/20 rounded-xl
                                        shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_1px_rgba(255,255,255,0.1)_inset]
                                        z-50 overflow-hidden
                                        animate-fade-in
                                        p-2
                                    ">
                                        {modes.map((mode, index) => (
                                            <button
                                                key={mode.id}
                                                onClick={() => {
                                                    onModeChange(mode.id)
                                                    setIsModeDropdownOpen(false)
                                                }}
                                                className={`
                                                    w-full text-left px-4 py-3 rounded-lg
                                                    text-foreground
                                                    transition-all duration-150
                                                    ${currentMode === mode.id
                                                        ? 'bg-white/15 shadow-sm'
                                                        : 'hover:bg-white/8'
                                                    }
                                                    ${index !== modes.length - 1 ? 'mb-1.5' : ''}
                                                `}
                                            >
                                                <div className="font-medium text-sm mb-1">{mode.label}</div>
                                                <div className="text-xs text-muted-foreground/80 leading-relaxed">
                                                    {mode.description}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <textarea
                            ref={textareaRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message..."
                            className="
                                flex-1 px-5 py-4 pl-[140px] pr-[120px]
                                bg-transparent border-none outline-none
                                resize-none overflow-y-auto
                                text-[15px] leading-relaxed
                                placeholder:text-muted-foreground/60
                                max-h-48
                                custom-scrollbar
                            "
                            rows={1}
                            disabled={isGenerating}
                        />

                        {/* Send/Stop Button */}
                        <button
                            onClick={isGenerating ? handleStop : handleSend}
                            disabled={!message.trim() && !isGenerating && attachments.length === 0}
                            className={`
                                absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl
                                flex items-center justify-center
                                transition-all duration-200
                                ${isGenerating
                                    ? 'bg-gradient-to-br from-white/95 to-white/85 hover:from-white hover:to-white/95 text-background shadow-[0_4px_16px_rgba(255,255,255,0.3)] border border-white/40'
                                    : (message.trim() || attachments.length > 0)
                                        ? 'bg-gradient-to-br from-white/95 to-white/85 hover:from-white hover:to-white/95 text-background shadow-[0_4px_20px_rgba(255,255,255,0.4)] border border-white/50'
                                        : 'bg-gradient-to-br from-white/[0.15] to-white/[0.08] text-white/40 cursor-not-allowed border border-white/20'
                                }
                                backdrop-blur-xl
                                focus:outline-none focus:ring-2 focus:ring-white/40
                            `}
                            aria-label={isGenerating ? 'Stop generation' : 'Send message'}
                        >
                            {isGenerating ? (
                                <Square className="w-4 h-4 fill-current" />
                            ) : (
                                <ArrowUp className="w-[18px] h-[18px] stroke-[3]" />
                            )}
                        </button>

                        {/* Attachment Button - To the left of web search */}
                        <div className="absolute right-24 top-1/2 -translate-y-1/2" ref={attachMenuRef}>
                            <button
                                onClick={handleAttachMenuToggle}
                                disabled={isGenerating || isProcessingFile}
                                className={`
                                    w-8 h-8 rounded-lg
                                    flex items-center justify-center
                                    transition-all duration-200
                                    ${(isGenerating || isProcessingFile)
                                        ? 'text-foreground/20 cursor-not-allowed'
                                        : 'text-foreground/40 hover:text-foreground/70 hover:bg-white/10'
                                    }
                                `}
                                title="Attach file or reference document"
                                aria-label="Attach"
                            >
                                {isProcessingFile ? (
                                    <div className="w-4 h-4 border-2 border-foreground/40 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Paperclip className="w-4 h-4" />
                                )}
                            </button>

                            {/* Attachment menu dropdown */}
                            {isAttachMenuOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-50">
                                    {/* Upload File Option */}
                                    <button
                                        onClick={() => {
                                            fileInputRef.current?.click()
                                            setIsAttachMenuOpen(false)
                                        }}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left group"
                                    >
                                        <Upload className="w-4 h-4 text-foreground/60 group-hover:text-foreground flex-shrink-0" />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-foreground">Upload File</div>
                                            <div className="text-xs text-muted-foreground">Images, PDFs, documents</div>
                                        </div>
                                    </button>

                                    <div className="border-t border-white/5" />

                                    {/* My Files Option */}
                                    <button
                                        onClick={handleMyFilesClick}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left group"
                                    >
                                        <FileText className="w-4 h-4 text-foreground/60 group-hover:text-foreground flex-shrink-0" />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-foreground">My Files</div>
                                            <div className="text-xs text-muted-foreground">Reference your documents</div>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.json,.csv"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {/* Web Search Toggle - Subtle icon to the left of send */}
                        {onToggleWebSearch && (
                            <button
                                onClick={() => onToggleWebSearch(!useWebSearch)}
                                className={`
                                    absolute right-16 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg
                                    flex items-center justify-center
                                    transition-all duration-200
                                    ${useWebSearch
                                        ? 'bg-white/20 text-foreground'
                                        : 'text-foreground/40 hover:text-foreground/70 hover:bg-white/10'
                                    }
                                `}
                                title={useWebSearch ? 'Web Search: On' : 'Web Search: Off'}
                                aria-label="Toggle web search"
                            >
                                <Globe className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Minimal Info Bar - Below input - Always present for stable layout */}
                    <div className="flex items-center justify-center gap-3 pt-2 h-[24px] text-[10px] text-foreground/40">
                        {isIncognito && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                <EyeOff className="w-3 h-3" />
                                <span className="font-medium">Incognito</span>
                            </span>
                        )}
                        {activeModel && (
                            <span className="flex items-center h-full font-medium">{activeModel.split('/').pop()}</span>
                        )}
                        {sessionTokens && sessionTokens.input + sessionTokens.output > 0 && (
                            <>
                                <span className="flex items-center h-full">•</span>
                                <span className="flex items-center h-full font-mono">
                                    {sessionTokens.input.toLocaleString()}→{sessionTokens.output.toLocaleString()} tokens
                                </span>
                            </>
                        )}
                        {sessionCost && sessionCost > 0 && (
                            <>
                                <span className="flex items-center h-full">•</span>
                                <span className="flex items-center h-full font-mono">
                                    ${sessionCost.toFixed(4)}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Documents Modal */}
            {isDocumentsModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-scale-in">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">My Documents</h2>
                                <p className="text-sm text-muted-foreground">Select a document to reference in your message</p>
                            </div>
                            <button
                                onClick={() => setIsDocumentsModalOpen(false)}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="px-6 py-4 border-b border-white/5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    placeholder="Search documents..."
                                    className="
                                        w-full pl-11 pr-4 py-3
                                        bg-white/5 border border-white/10 rounded-xl
                                        text-base text-foreground placeholder:text-muted-foreground/60
                                        focus:outline-none focus:border-white/20 focus:bg-white/8
                                        transition-colors
                                    "
                                />
                            </div>
                        </div>

                        {/* Documents List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {loadingDocs ? (
                                <div className="px-6 py-16 text-center text-muted-foreground">
                                    <div className="inline-block w-8 h-8 border-2 border-foreground/40 border-t-transparent rounded-full animate-spin mb-4" />
                                    <div className="text-base">Loading your documents...</div>
                                </div>
                            ) : filteredDocuments.length === 0 ? (
                                <div className="px-6 py-16 text-center text-muted-foreground">
                                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                                    <div className="text-base font-medium mb-2">
                                        {searchQuery ? 'No matching documents' : 'No documents uploaded yet'}
                                    </div>
                                    {!searchQuery && (
                                        <div className="text-sm">
                                            Upload documents from the attachment menu to reference them in your chats
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 grid gap-2">
                                    {filteredDocuments.map((doc) => {
                                        const isAttached = attachments.some(a => a.documentId === doc.id)
                                        return (
                                            <button
                                                key={doc.id}
                                                onClick={() => handleSelectDocument(doc)}
                                                disabled={isAttached}
                                                className={`
                                                    w-full px-5 py-4 rounded-xl
                                                    flex items-center gap-4 transition-all
                                                    border border-white/10
                                                    ${isAttached 
                                                        ? 'opacity-50 cursor-not-allowed bg-white/5 border-white/5' 
                                                        : 'hover:bg-white/5 hover:border-white/20 active:scale-[0.99]'
                                                    }
                                                `}
                                            >
                                                <div className="p-3 rounded-lg bg-white/5 flex-shrink-0">
                                                    <FileText className="w-6 h-6 text-foreground/60" />
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="text-base font-medium text-foreground truncate mb-1">{doc.filename}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {(doc.size_bytes / 1024).toFixed(0)} KB • {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                </div>
                                                {isAttached && (
                                                    <div className="flex-shrink-0 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-foreground/60">
                                                        Attached
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {filteredDocuments.length > 0 && (
                            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between text-sm text-muted-foreground">
                                <span>{filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}</span>
                                <span>Press ESC to close</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}