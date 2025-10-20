import { useState, useEffect, useRef, useMemo } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { FileCode2, Download, X } from 'lucide-react'
import { MessagesContainer } from '@/components/MessagesContainer'
import LiquidEther from '@/components/LiquidEther'
import { ChatInput } from '@/components/ChatInput'
import { SettingsPage } from '@/pages/SettingsPage'
import { AuthPage } from '@/components/AuthPage'
import { OnboardingWizard } from '@/pages/OnboardingWizard'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'
import type { Message, QuotedText, Attachment, ResearchProgress, ClarifyingQuestion, ResearchPhase, ArtifactKind, ArtifactPayload } from '@/types'
import { ArtifactViewer } from '@/components/artifacts/ArtifactViewer'

function App() {
    const { user, loading: authLoading } = useAuth()
    const [messages, setMessages] = useState<Message[]>([])
    const [hasMoreMessages, setHasMoreMessages] = useState(false)
    const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false)
    const [totalMessageCount, setTotalMessageCount] = useState(0)
    const [currentChatId, setCurrentChatId] = useState<number | null>(null)
    const [chats, setChats] = useState<Array<{ id: number; title: string; created_at: string; updated_at: string }>>([])
    const [isIncognito, setIsIncognito] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [currentMode, setCurrentMode] = useState<'chat' | 'study' | 'research'>('chat')
    const [selectedModel, setSelectedModel] = useState(() => {
        try {
            const local = typeof window !== 'undefined' ? localStorage.getItem('selectedModel') : null
            return local || 'openai/gpt-4o-mini'
        } catch {
            return 'openai/gpt-4o-mini'
        }
    })
    const [selectedProvider, setSelectedProvider] = useState<string>('openrouter')
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [quotedText, setQuotedText] = useState<QuotedText | null>(null)
    const [useWebSearch, setUseWebSearch] = useState(false)
    const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 })
    const [sessionCost, setSessionCost] = useState(0)
    // Research state
    const [researchPhase, setResearchPhase] = useState<ResearchPhase | null>(null)
    const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null)
    const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQuestion[]>([])
    const [pendingResearchQuery, setPendingResearchQuery] = useState<string>('')
    const [researchStartTime, setResearchStartTime] = useState<number>(Date.now())
    // Smooth streaming refs
    const smoothTargetRef = useRef('')
    const smoothCurrentRef = useRef('')
    const rafIdRef = useRef<number | null>(null)
    // Abort controller for cancelling requests
    const abortControllerRef = useRef<AbortController | null>(null)
    const isLoadingChatRef = useRef(false)
    // Artifact split-pane state
    const [artifactSplit, setArtifactSplit] = useState<
        | { kind: ArtifactKind; title?: string; payload: ArtifactPayload }
        | null
    >(null)

    // Memoize LiquidEther colors to prevent re-initialization on every render
    const liquidEtherColors = useMemo(() => ['#5227FF', '#FF9FFC', '#B19EEF'], [])

    useEffect(() => {
        // Apply dark theme by default
        document.documentElement.classList.add('dark')
    }, [])

    const handleStopGeneration = () => {
        // Abort any ongoing requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }

        // Stop smooth streaming animation
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
        }

        // Reset all generation states
        setIsGenerating(false)
        setStreamingContent('')
        setResearchPhase(null)
        setResearchProgress(null)
        smoothTargetRef.current = ''
        smoothCurrentRef.current = ''
    }

    const openArtifactSplit = (html: string, title?: string) => {
        setArtifactSplit({ kind: 'html', payload: { htmlDoc: html }, title })
    }

    const closeArtifactSplit = () => setArtifactSplit(null)

    const sanitizeFilename = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50)
    }

    // Generate smart chat title using AI
    const generateChatTitle = async (chatId: number, conversationMessages: Message[]) => {
        try {
            // Get first user message and assistant response for context
            const userMsg = conversationMessages.find(m => m.role === 'user')
            const assistantMsg = conversationMessages.find(m => m.role === 'assistant')

            if (!userMsg || !assistantMsg) return

            // Try with selectedModel; if provider-specific ID fails, retry with bare model id
            const requestTitle = async (modelId: string) => api.chat({
                model: modelId,
                messages: [
                    { role: 'system', content: 'You are a title generator. Based on the conversation, generate a concise, descriptive title (max 6 words). Output ONLY the title, no quotes, no punctuation at the end, no explanation.' },
                    { role: 'user', content: `User: ${userMsg.content}\n\nAssistant: ${assistantMsg.content.slice(0, 200)}` }
                ],
                max_tokens: 20,
                temperature: 0.3,
                stream: false
            })

            let data: any
            try {
                const resp = await requestTitle(selectedModel || 'openai/gpt-4o-mini')
                data = await resp.json()
            } catch (e) {
                if ((selectedModel || '').includes('/')) {
                    const bare = (selectedModel || '').split('/').pop() || selectedModel
                    const resp2 = await requestTitle(bare)
                    data = await resp2.json()
                } else {
                    throw e
                }
            }
            const generatedTitle = data.choices?.[0]?.message?.content?.trim()

            if (generatedTitle && generatedTitle.length > 0) {
                // Clean up the title - remove quotes if present
                const cleanTitle = generatedTitle.replace(/^["']|["']$/g, '').slice(0, 60)
                
                // Update the chat title in the database
                await api.updateChat(chatId, { title: cleanTitle })
                
                // Update the local state to reflect the new title
                setChats(prev => prev.map(chat => 
                    chat.id === chatId ? { ...chat, title: cleanTitle } : chat
                ))
            }
        } catch (error) {
            console.error('Error generating chat title:', error)
            // Fail silently - the chat will keep its default title
        }
    }

    const handleDownloadArtifact = () => {
        if (!artifactSplit) return
        try {
            const timestamp = Date.now()
            const baseName = sanitizeFilename(artifactSplit.title || 'artifact')
            
            if (artifactSplit.kind === 'html' && artifactSplit.payload.htmlDoc) {
                const blob = new Blob([artifactSplit.payload.htmlDoc], { type: 'text/html' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${baseName}-${timestamp}.html`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            } else if (artifactSplit.kind === 'python') {
                const code = artifactSplit.payload.pythonCode || artifactSplit.payload.code || artifactSplit.payload.text || ''
                const blob = new Blob([code], { type: 'text/x-python' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${baseName}-${timestamp}.py`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            } else if (artifactSplit.kind === 'mermaid') {
                const code = artifactSplit.payload.mermaidCode || artifactSplit.payload.text || artifactSplit.payload.code || ''
                // Download as .mmd file
                const blob = new Blob([code], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${baseName}-${timestamp}.mmd`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            } else if (artifactSplit.kind === 'katex') {
                const code = artifactSplit.payload.katexCode || artifactSplit.payload.text || artifactSplit.payload.code || ''
                // Download as .tex file
                const blob = new Blob([code], { type: 'text/x-tex' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${baseName}-${timestamp}.tex`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }
        } catch (error) {
            console.error('Download failed:', error)
        }
    }

    // Listen for artifact split open events from child components
    useEffect(() => {
        const handler = (e: Event) => {
            const custom = e as CustomEvent<{ html: string; title?: string }>
            if (custom.detail) {
                openArtifactSplit(custom.detail.html, custom.detail.title)
            }
        }
        window.addEventListener('open-artifact-split', handler as EventListener)
        return () => window.removeEventListener('open-artifact-split', handler as EventListener)
    }, [])

    // Generic artifact split for universal artifacts
    useEffect(() => {
        const handler = (e: Event) => {
            const custom = e as CustomEvent<any>
            const artifact = custom.detail?.artifact || custom.detail
            if (artifact && artifact.kind) {
                setArtifactSplit({ kind: artifact.kind, title: artifact.title, payload: artifact.payload })
            }
        }
        window.addEventListener('open-artifact-split-any', handler as EventListener)
        return () => window.removeEventListener('open-artifact-split-any', handler as EventListener)
    }, [])

    // Attach artifact to latest assistant message (client-only for now)
    useEffect(() => {
        const handler = (e: Event) => {
            const custom = e as CustomEvent<{ artifact: any }>
            if (!custom.detail?.artifact) return
            setMessages(prev => {
                if (prev.length === 0) return prev
                const lastIdx = prev.length - 1
                const last = prev[lastIdx]
                const updated = { ...last, artifacts: [...(last.artifacts || []), custom.detail.artifact] }
                const next = prev.slice(0, lastIdx).concat(updated)
                return next
            })
        }
        window.addEventListener('attach-artifact-to-latest-message', handler as EventListener)
        return () => window.removeEventListener('attach-artifact-to-latest-message', handler as EventListener)
    }, [])

    // Attach artifact to a specific message
    useEffect(() => {
        const handler = (e: Event) => {
            const custom = e as CustomEvent<{ artifact: any; messageId: string }>
            if (!custom.detail?.artifact || !custom.detail?.messageId) return
            setMessages(prev => prev.map(m => m.id === custom.detail.messageId ? ({ ...m, artifacts: [...(m.artifacts || []), custom.detail.artifact] }) : m))
        }
        window.addEventListener('attach-artifact-to-message', handler as EventListener)
        return () => window.removeEventListener('attach-artifact-to-message', handler as EventListener)
    }, [])

    const handleSendMessage = async (content: string, attachments?: Attachment[]) => {
        if ((!content.trim() && !attachments?.length) || isGenerating) return

        console.log('[handleSendMessage] Starting - useWebSearch:', useWebSearch, 'selectedProvider:', selectedProvider, 'selectedModel:', selectedModel)

        // Route to research mode if selected
        if (currentMode === 'research') {
            return handleResearchMode(content, attachments)
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date(),
            quotedText: quotedText || undefined,
            attachments: attachments || undefined
        }

        setMessages(prev => [...prev, userMessage])
        setIsGenerating(true)
        setStreamingContent('')
        // Reset smooth streaming state
        smoothTargetRef.current = ''
        smoothCurrentRef.current = ''
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
        }

        // Clear quoted text after sending
        const currentQuote = quotedText
        setQuotedText(null)

        try {
            // Build the user message content
            let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = content

            // Handle attachments with vision API format
            if (attachments && attachments.length > 0) {
                const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

                // Add text if present
                let textContent = content
                if (currentQuote) {
                    textContent = `Context from previous response:\n> ${currentQuote.text}\n\nQuestion: ${content}`
                }
                if (textContent.trim()) {
                    contentParts.push({ type: 'text', text: textContent })
                }

                // Add images and files
                for (const attachment of attachments) {
                    if (attachment.type === 'image' && attachment.url) {
                        contentParts.push({
                            type: 'image_url',
                            image_url: { url: attachment.url }
                        })
                    } else if (attachment.type === 'document_reference' && attachment.documentId) {
                        // Fetch document content from backend
                        try {
                            const { content: docContent } = await api.getDocumentContent(attachment.documentId)
                            contentParts.push({
                                type: 'text',
                                text: `[Content from document: ${attachment.name}]\n\n${docContent}`
                            })
                        } catch (error) {
                            console.error('Failed to fetch document content:', error)
                            contentParts.push({
                                type: 'text',
                                text: `[Referenced document: ${attachment.name} - unable to load content]`
                            })
                        }
                    } else if (attachment.extractedText) {
                        // For files with extracted text (PDFs, text files)
                        contentParts.push({
                            type: 'text',
                            text: `[Content from ${attachment.name}]:\n\n${attachment.extractedText}`
                        })
                    } else {
                        // Fallback for unsupported file types
                        contentParts.push({
                            type: 'text',
                            text: `[Attached file: ${attachment.name} - unable to extract content]`
                        })
                    }
                }

                userContent = contentParts
            } else if (currentQuote) {
                userContent = `Context from previous response:\n> ${currentQuote.text}\n\nQuestion: ${content}`
            }

            // Create abort controller for this request
            abortControllerRef.current = new AbortController()

            // Prepare previous messages with attachment conversion
            const baseConvertedMessages = messages.map(m => {
                if ((m as any).attachments && (m as any).attachments.length > 0) {
                                const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = []
                                if (m.content) {
                                    parts.push({ type: 'text', text: m.content })
                                }
                    for (const att of (m as any).attachments) {
                                    if (att.type === 'image' && att.url) {
                                        parts.push({ type: 'image_url', image_url: { url: att.url } })
                                    } else if (att.type === 'document_reference') {
                            parts.push({ type: 'text', text: `[Referenced document: ${att.name}]` })
                                    } else if (att.extractedText) {
                            parts.push({ type: 'text', text: `[Content from ${att.name}]:\n\n${att.extractedText}` })
                                    }
                                }
                                return { role: m.role, content: parts }
                            }
                            return { role: m.role, content: m.content }
            })

            // If provider is OpenRouter, ":online" works. For others, we fetch web results and prepend context.
            let chatHistoryWithWeb = baseConvertedMessages
            let webSearchSources: Array<{ title: string; url: string }> = []
            if (useWebSearch && selectedProvider !== 'openrouter') {
                console.log('[Web Search] Triggering web search for provider:', selectedProvider)
                try {
                    // Use the current message content for search
                    const searchQuery = typeof content === 'string' ? content : String(content)
                    console.log('[Web Search] Searching for:', searchQuery)
                    const web = await api.searchWeb(searchQuery, 5)
                    console.log('[Web Search] Got results:', web.results.length)
                    webSearchSources = web.results.map(r => ({ title: r.title, url: r.url }))
                    const summary = web.results.map((r, i) => `(${i+1}) ${r.title} - ${r.url}\n${r.snippet}`).join('\n\n')
                    chatHistoryWithWeb = [
                        { role: 'system', content: 'The following web findings were retrieved to assist your answer. Use them cautiously and cite inline as [1], [2], etc.' },
                        { role: 'system', content: summary },
                        ...baseConvertedMessages
                    ]
                } catch (e) {
                    console.warn('Web search failed, continuing without it', e)
                }
            } else {
                console.log('[Web Search] Skipped - useWebSearch:', useWebSearch, 'provider:', selectedProvider)
            }

            // Add study mode system prompt if in study mode
            if (currentMode === 'study') {
                const studySystemPrompt = {
                    role: 'system' as const,
                    content: `You are an expert teacher and mentor. Your role is to help students learn and understand concepts deeply, not just provide answers.

TEACHING PRINCIPLES:
1. **Never give direct answers** - Guide students to discover solutions themselves
2. **Ask probing questions** - Help them think critically about the problem
3. **Break down complex topics** - Explain step-by-step in simple terms
4. **Check understanding** - Ask follow-up questions to ensure comprehension
5. **Encourage thinking** - Use the Socratic method to develop reasoning skills
6. **Be patient and supportive** - Create a safe learning environment
7. **Provide hints, not solutions** - Offer guidance without revealing the answer
8. **Relate to real-world examples** - Make concepts tangible and relevant

APPROACH:
- Start by understanding what the student already knows
- Identify gaps in their knowledge
- Guide them through the learning process with questions
- Celebrate their progress and correct thinking
- If they're stuck, provide a small hint or ask a leading question
- Only provide direct explanations for foundational concepts they need to understand first
- For homework/assignments, help them understand the concepts but never do the work for them

FORMATTING - Use these special callout boxes (markdown blockquotes with prefixes):
- **💡 Hints/Tips**: > 💡 [your hint here] - For subtle guidance
- **❓ Questions**: > ❓ [your question here] - For thought-provoking questions
- **📝 Key Concepts**: > 📝 [concept here] - For important information
- **⚠️ Common Mistakes**: > ⚠️ [warning here] - For pitfalls to avoid
- **✅ Good Thinking**: > ✅ [encouragement here] - For correct approaches
- **🎯 Examples**: > 🎯 [example here] - For real-world applications

INTERACTIVE COMPONENTS - Use these to make learning fun and engaging:

1. **Collapsible Hints** (use when students might need help):
\`\`\`hint
level: 1-3 (1=small, 2=bigger, 3=major)
content: Your hint text here
\`\`\`

2. **Interactive Quizzes** (check understanding with quick questions):
\`\`\`quiz
question: What is the capital of France?
options:
  - text: London
    correct: false
    explanation: London is the capital of the UK
  - text: Paris
    correct: true
    explanation: Correct! Paris has been France's capital since the 12th century
  - text: Berlin
    correct: false
multiselect: false
\`\`\`

3. **Progress Tracker** (for multi-step problems):
\`\`\`progress
steps:
  - label: Understand the problem
    completed: true
  - label: Identify key concepts
    completed: true
  - label: Apply the formula
    completed: false
  - label: Check your answer
    completed: false
current: 2
\`\`\`

Use numbered lists for step-by-step guidance. Use these callouts and interactive components frequently to make learning engaging, visual, and fun!

Remember: Your goal is to develop their ability to think and learn independently, not to be a solution provider.`
                }
                
                // Check if there's already a system message
                const hasSystemMessage = chatHistoryWithWeb.some((m: any) => m.role === 'system')
                if (hasSystemMessage) {
                    // Prepend to existing system messages
                    chatHistoryWithWeb = [studySystemPrompt, ...chatHistoryWithWeb]
                } else {
                    // Add as first message
                    chatHistoryWithWeb = [studySystemPrompt, ...chatHistoryWithWeb]
                }
            }

            const response = await api.chat({
                model: useWebSearch && selectedProvider === 'openrouter' ? `${selectedModel}:online` : selectedModel,
                messages: [
                    ...chatHistoryWithWeb,
                        { role: 'user', content: userContent }
                    ],
                    stream: true
            })

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let fullContent = ''
            let thinking: string | undefined
            let usageData: any = null

            // Smooth streaming: gradually reveal characters with easing
            let lastFrameTime = Date.now()
            const queueSmoothUpdate = (content: string) => {
                smoothTargetRef.current = content
                if (rafIdRef.current) return

                const step = () => {
                    const now = Date.now()
                    const deltaTime = now - lastFrameTime
                    lastFrameTime = now

                    const target = smoothTargetRef.current
                    const current = smoothCurrentRef.current
                    if (current.length >= target.length) {
                        rafIdRef.current = null
                        return
                    }

                    // Adaptive chunk size with smoother progression
                    const remaining = target.length - current.length
                    const progress = current.length / target.length

                    // Ease-in-out: faster in middle, slower at start/end
                    let baseChunk: number
                    if (progress < 0.2) {
                        // Start slow
                        baseChunk = 3
                    } else if (progress > 0.8) {
                        // End slow
                        baseChunk = 4
                    } else {
                        // Middle fast
                        baseChunk = remaining > 300 ? 18 : remaining > 100 ? 12 : 8
                    }

                    // Adjust for frame rate (60fps target = 16.67ms)
                    const frameMultiplier = Math.min(deltaTime / 16.67, 2)
                    const chunk = Math.ceil(baseChunk * frameMultiplier)

                    const nextLen = Math.min(current.length + chunk, target.length)
                    const next = target.slice(0, nextLen)
                    smoothCurrentRef.current = next
                    setStreamingContent(next)
                    rafIdRef.current = requestAnimationFrame(step)
                }

                rafIdRef.current = requestAnimationFrame(step)
            }

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value)
                    const lines = chunk.split('\n')

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6)
                            if (data === '[DONE]') continue

                            try {
                                const parsed = JSON.parse(data)
                                const content = parsed.choices?.[0]?.delta?.content
                                if (content) {
                                    fullContent += content
                                    queueSmoothUpdate(fullContent)
                                }
                                // Capture usage data from the final chunk
                                if (parsed.usage) {
                                    usageData = parsed.usage
                                }
                            } catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                }

                // Final update with complete content
                if (rafIdRef.current) {
                    cancelAnimationFrame(rafIdRef.current)
                    rafIdRef.current = null
                }
                smoothCurrentRef.current = fullContent
                smoothTargetRef.current = fullContent
                setStreamingContent(fullContent)
            }

            // Extract thinking if present
            let mainContent = fullContent
            const thinkMatch = fullContent.match(/<think>([\s\S]*?)<\/think>/i)
            if (thinkMatch) {
                thinking = thinkMatch[1].trim()
                mainContent = fullContent.replace(/<think>[\s\S]*?<\/think>/i, '').trim()
            }

            // Calculate cost from usage data
            const calculateCost = (usage: any): number => {
                const pricing: Record<string, { input: number; output: number }> = {
                    'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
                    'openai/gpt-5': { input: 1.25, output: 10 },
                    'openai/gpt-5-mini': { input: 0.25, output: 2 },
                    'google/gemini-2.5-flash-preview-09-2025': { input: 0.30, output: 2.50 },
                    'google/gemini-2.5-flash-lite-preview-09-2025': { input: 0.10, output: 0.40 },
                    'x-ai/grok-4-fast': { input: 0.20, output: 0.50 },
                    'qwen/qwen3-coder-plus': { input: 1, output: 5 },
                    'qwen/qwen3-235b-a22b-thinking-2507': { input: 0.11, output: 0.60 },
                    'z-ai/glm-4.6': { input: 0.50, output: 1.75 },
                    'z-ai/glm-4.5-air': { input: 0.14, output: 0.86 },
                    'deepseek/deepseek-v3.2-exp': { input: 0.27, output: 0.40 },
                    'deepseek/deepseek-r1-0528': { input: 0.40, output: 1.75 }
                }
                const modelPricing = pricing[selectedModel] || { input: 1, output: 1 }
                const inputCost = (usage.prompt_tokens / 1000000) * modelPricing.input
                const outputCost = (usage.completion_tokens / 1000000) * modelPricing.output
                return inputCost + outputCost
            }

            // Append web search sources if available
            let finalContent = mainContent
            if (useWebSearch && webSearchSources.length > 0) {
                const sourcesSection = '\n\n---\n\n**🔍 Web Search Sources:**\n\n' + 
                    webSearchSources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join('\n')
                finalContent = mainContent + sourcesSection
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: finalContent,
                thinking,
                timestamp: new Date(),
                model: selectedModel,
                tokens: usageData ? {
                    input: usageData.prompt_tokens || 0,
                    output: usageData.completion_tokens || 0,
                    thinking: usageData.completion_tokens_details?.reasoning_tokens || 0
                } : undefined,
                cost: usageData ? calculateCost(usageData) : undefined
            }

            // Update session tokens and cost
            if (usageData) {
                const messageCost = calculateCost(usageData)
                setSessionTokens(prev => ({
                    input: prev.input + (usageData.prompt_tokens || 0),
                    output: prev.output + (usageData.completion_tokens || 0)
                }))
                setSessionCost(prev => prev + messageCost)
            }

            // Add message first, then clear streaming (prevents blink)
            setMessages(prev => [...prev, assistantMessage])

            // Small delay to ensure message is rendered before clearing stream
            await new Promise(resolve => setTimeout(resolve, 50))
            setStreamingContent('')
        } catch (error) {
            // Check if this was an abort
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Request aborted by user')
                return // Don't show error message for user-initiated stops
            }

            console.error('Error generating response:', error)

            // Show error message to user
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response. Please try again.'}`,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSuggestionClick = (suggestion: string) => {
        handleSendMessage(suggestion)
    }

    // Research Mode Orchestration
    const handleResearchMode = async (content: string, attachments?: Attachment[]) => {
        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date(),
            attachments,
            isResearch: true
        }
        setMessages(prev => [...prev, userMessage])
        setIsGenerating(true)
        setPendingResearchQuery(content)
        setResearchStartTime(Date.now())

        try {
            // Phase 1: Check if clarifying questions are needed
            setResearchPhase('clarification')
            setResearchProgress({
                phase: 'clarification',
                status: 'Analyzing your query...',
                findings: [],
                progress: 10
            })

            const clarificationResponse = await api.chat({
                    model: selectedModel,
                    messages: [{
                        role: 'system',
                        content: 'You are a research assistant. Analyze the user\'s query and determine if you need clarifying questions. If the query is clear and specific, respond with "NO_QUESTIONS". If you need clarification, respond with 1-3 questions in JSON format: {"questions": [{"id": "1", "question": "...", "type": "text"}]}. Keep questions concise and relevant.'
                    }, {
                        role: 'user',
                        content: content
                    }],
                    stream: false
            })

            const clarificationData = await clarificationResponse.json()
            const clarificationContent = clarificationData.choices?.[0]?.message?.content || ''

            // Check if we need clarifying questions
            if (!clarificationContent.includes('NO_QUESTIONS') && clarificationContent.includes('questions')) {
                try {
                    const parsed = JSON.parse(clarificationContent)
                    if (parsed.questions && Array.isArray(parsed.questions)) {
                        setClarifyingQuestions(parsed.questions)
                        setResearchProgress(null)
                        setIsGenerating(false)
                        return // Wait for user to answer
                    }
                } catch (e) {
                    // If parsing fails, proceed without questions
                }
            }

            // Phase 2-5: Continue with research
            await executeResearch(content)

        } catch (error) {
            // Check if this was an abort
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Research aborted by user')
                return // Don't show error message for user-initiated stops
            }

            console.error('Research error:', error)
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Error during research: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
            setIsGenerating(false)
            setResearchPhase(null)
            setResearchProgress(null)
        }
    }

    const executeResearch = async (query: string, answeredQuestions?: ClarifyingQuestion[]) => {
        const researchStartTime = Date.now()

        // Create abort controller for research requests
        abortControllerRef.current = new AbortController()

        // Build enhanced query with answers
        let enhancedQuery = query
        if (answeredQuestions && answeredQuestions.length > 0) {
            const answers = answeredQuestions.map(q => `${q.question}: ${q.answer}`).join('\n')
            enhancedQuery = `${query}\n\nAdditional context:\n${answers}`
        }

        const allSearchResults: string[] = []
        const collectedSources: Array<{ title: string; url: string }> = []

        // Phase 2: Planning - Generate search queries
        setResearchPhase('planning')
        setResearchProgress({
            phase: 'planning',
            status: 'Creating research plan and search queries...',
            findings: ['Analyzing topic complexity', 'Planning search strategy'],
            progress: 15
        })

        const planningResponse = await api.chat({
                model: selectedModel,
                messages: [{
                    role: 'system',
                    content: 'You are a research planning assistant. Given a research topic, generate 3-5 specific search queries that will comprehensively cover the topic. Return ONLY a JSON array of search query strings, nothing else. Example: ["query 1", "query 2", "query 3"]'
                }, {
                    role: 'user',
                    content: `Research topic: ${enhancedQuery}\n\nGenerate 3-5 specific search queries to thoroughly research this topic.`
                }],
                stream: false
        })

        const planningData = await planningResponse.json()
        let searchQueries: string[] = []

        try {
            const planContent = planningData.choices?.[0]?.message?.content || '[]'
            // Extract JSON array even if wrapped in markdown code blocks
            const jsonMatch = planContent.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
                searchQueries = JSON.parse(jsonMatch[0])
            }
        } catch (e) {
            console.error('Error parsing search queries:', e)
            // Fallback to original query
            searchQueries = [enhancedQuery]
        }

        setResearchProgress(prev => prev ? {
            ...prev,
            findings: [`Generated ${searchQueries.length} search queries`, 'Ready to search'],
            progress: 25
        } : null)

        await new Promise(resolve => setTimeout(resolve, 800))

        // Phase 3: Searching - Execute each search query
        setResearchPhase('searching')

        for (let i = 0; i < searchQueries.length; i++) {
            const searchQuery = searchQueries[i]
            setResearchProgress({
                phase: 'searching',
                status: `Searching: "${searchQuery.substring(0, 50)}..."`,
                findings: [
                    `Completed ${i} of ${searchQueries.length} searches`,
                    `Current: ${searchQuery}`,
                    ...allSearchResults.slice(-2).map(r => `Found: ${r.substring(0, 60)}...`)
                ],
                progress: 25 + ((i / searchQueries.length) * 35)
            })

            try {
                if (selectedProvider === 'openrouter') {
                    const searchResponse = await api.chat({
                        model: `${selectedModel}:online`,
                        messages: [{ role: 'user', content: searchQuery }],
                        stream: false,
                        max_tokens: 100000
                    })
                const searchData = await searchResponse.json()
                const searchResult = searchData.choices?.[0]?.message?.content || ''
                    if (searchResult) allSearchResults.push(searchResult)
                } else {
                    const web = await api.searchWeb(searchQuery, 5)
                    const summary = web.results.map((r, idx) => `(${idx+1}) ${r.title} - ${r.url}\n${r.snippet}`).join('\n\n')
                    if (summary) allSearchResults.push(summary)
                }
                await new Promise(resolve => setTimeout(resolve, 500))
            } catch (error) {
                console.error(`Search ${i + 1} failed:`, error)
            }
        }

        setResearchProgress(prev => prev ? {
            ...prev,
            findings: [`Completed all ${searchQueries.length} searches`, 'Gathering sources and citations'],
            progress: 60
        } : null)

        await new Promise(resolve => setTimeout(resolve, 500))

        // Phase 4: Analysis - Actually verify information quality and gaps
        setResearchPhase('analysis')
        setResearchProgress({
            phase: 'analysis',
            status: 'Analyzing information quality and identifying gaps...',
            findings: [
                `Processing ${allSearchResults.length} search results`,
                'Evaluating information completeness',
                'Checking for contradictions'
            ],
            progress: 60
        })

        // Make an analysis API call to verify information quality
        const analysisResponse = await api.chat({
                model: selectedModel,
                messages: [{
                    role: 'system',
                    content: 'You are a research quality analyst. Analyze the provided search results and determine: 1) Are there critical information gaps? 2) Are there contradictions that need resolution? 3) What additional searches would improve the research? Respond with JSON: {"gaps": ["gap1", "gap2"], "needsMore": true/false, "additionalQueries": ["query1"]}'
                }, {
                    role: 'user',
                    content: `Research Query: ${enhancedQuery}\n\nSearch Results:\n${allSearchResults.map((r, i) => `Result ${i + 1}:\n${r.substring(0, 500)}`).join('\n\n')}`
                }],
                stream: false,
                max_tokens: 10000
        })

        const analysisData = await analysisResponse.json()
        const analysisContent = analysisData.choices?.[0]?.message?.content || '{}'

        setResearchProgress(prev => prev ? {
            ...prev,
            findings: [...prev.findings, 'Quality analysis complete', 'Checking for information gaps'],
            progress: 65
        } : null)

        // Check if we need additional searches
        let additionalSearches: string[] = []
        try {
            const jsonMatch = analysisContent.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0])
                if (analysis.needsMore && analysis.additionalQueries && analysis.additionalQueries.length > 0) {
                    additionalSearches = analysis.additionalQueries.slice(0, 2) // Max 2 additional searches

                    setResearchProgress(prev => prev ? {
                        ...prev,
                        findings: [...prev.findings, `Identified ${additionalSearches.length} information gaps`, 'Conducting additional searches'],
                        progress: 67
                    } : null)

                    // Conduct additional searches
                    for (let i = 0; i < additionalSearches.length; i++) {
                        const additionalQuery = additionalSearches[i]

                        setResearchProgress(prev => prev ? {
                            ...prev,
                            status: `Additional search: "${additionalQuery.substring(0, 50)}..."`,
                            progress: 67 + ((i / additionalSearches.length) * 8)
                        } : null)

                        try {
                            if (selectedProvider === 'openrouter') {
                                const additionalResponse = await api.chat({
                                    model: `${selectedModel}:online`,
                                    messages: [{ role: 'user', content: additionalQuery }],
                                    stream: false,
                                    max_tokens: 25000
                                })
                            const additionalData = await additionalResponse.json()
                            const additionalResult = additionalData.choices?.[0]?.message?.content || ''
                                if (additionalResult) allSearchResults.push(additionalResult)
                            } else {
                                const web = await api.searchWeb(additionalQuery, 5)
                                const summary = web.results.map((r, idx) => `(${idx+1}) ${r.title} - ${r.url}\n${r.snippet}`).join('\n\n')
                                if (summary) allSearchResults.push(summary)
                            }
                            await new Promise(resolve => setTimeout(resolve, 500))
                        } catch (error) {
                            console.error(`Additional search ${i + 1} failed:`, error)
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing analysis:', e)
        }

        setResearchProgress(prev => prev ? {
            ...prev,
            status: 'Cross-referencing and validating findings...',
            findings: [`Analyzed ${allSearchResults.length} total sources`, 'Verifying accuracy', 'Identifying key insights'],
            progress: 75
        } : null)

        await new Promise(resolve => setTimeout(resolve, 1500))

        // Phase 5: Compilation - Generate comprehensive report
        setResearchPhase('compilation')
        setResearchProgress({
            phase: 'compilation',
            status: 'Compiling comprehensive research report...',
            findings: [`Compiling ${allSearchResults.length} search results`, 'Structuring findings', 'Formatting document', 'Adding references'],
            progress: 75
        })

        setStreamingContent('')
        smoothTargetRef.current = ''
        smoothCurrentRef.current = ''

        // Create comprehensive context from all searches
        const researchContext = allSearchResults.map((result, i) =>
            `Search ${i + 1} Results:\n${result}`
        ).join('\n\n---\n\n')

        const finalResponse = await api.chat({
                model: selectedModel,
                messages: [{
                    role: 'system',
                    content: `You are a professional research analyst. Synthesize the provided research findings into a comprehensive, well-structured report. 

REQUIRED STRUCTURE:
# [Descriptive Title]

## Executive Summary
Provide a concise overview (2-3 paragraphs) of the key findings and their significance.

## Methodology
Explain how the research was conducted (web-based research via multiple search queries, qualitative synthesis, quality verification).

## Key Findings
Present detailed findings with clear headings and subheadings. Include specific facts, statistics, and insights. Organize logically with bullet points where appropriate. When referencing information, cite sources inline using [Source Name](URL) format.

DO NOT include a separate "Sources & References" section - sources will be automatically extracted and displayed separately.

Use markdown formatting throughout. Be thorough, detailed, and cite specific information from the search results with inline citations.`
                }, {
                    role: 'user',
                    content: `Original Research Query: ${enhancedQuery}

Search Results Gathered:
${researchContext}

Please synthesize all this information into a comprehensive research report following the required structure.`
                }],
                stream: true,
                max_tokens: 100000
        })

        const reader = finalResponse.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''
        let accumulatedContent = ''
        let usageData: any = null

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6)
                    if (data === '[DONE]') continue

                    try {
                        const parsed = JSON.parse(data)
                        const content = parsed.choices?.[0]?.delta?.content
                        if (content) {
                            accumulatedContent += content
                            setStreamingContent(accumulatedContent)

                            // Update progress
                            const currentProgress = Math.min(75 + (accumulatedContent.length / 100), 99)
                            setResearchProgress(prev => prev ? { ...prev, progress: currentProgress } : null)
                        }
                        if (parsed.usage) {
                            usageData = parsed.usage
                        }
                    } catch (e) {
                        console.error('Error parsing SSE:', e)
                    }
                }
            }
        }

        // Extract sources from the final content
        const sourceMatches = accumulatedContent.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g)
        const uniqueSources = new Map<string, { title: string; url: string }>()
        for (const match of sourceMatches) {
            // Avoid duplicates by URL
            if (!uniqueSources.has(match[2])) {
                uniqueSources.set(match[2], { title: match[1], url: match[2] })
            }
        }
        collectedSources.push(...Array.from(uniqueSources.values()))

        // Validate research quality
        const contentLength = accumulatedContent.trim().length
        const hasSections = accumulatedContent.includes('##')
        const hasExecutiveSummary = accumulatedContent.toLowerCase().includes('executive summary')
        const hasFindings = accumulatedContent.toLowerCase().includes('findings') || accumulatedContent.toLowerCase().includes('results')

        // Check if research is insufficient
        if (contentLength < 500 || !hasSections || (!hasExecutiveSummary && !hasFindings) || collectedSources.length === 0) {
            console.warn('Research quality check failed:', {
                contentLength,
                hasSections,
                hasExecutiveSummary,
                hasFindings,
                sourcesCount: collectedSources.length
            })

            // Retry compilation with stronger instructions
            setResearchProgress(prev => prev ? {
                ...prev,
                status: 'Quality check failed, regenerating report...',
                findings: ['Detected insufficient content', 'Retrying with enhanced instructions'],
                progress: 80
            } : null)

            await new Promise(resolve => setTimeout(resolve, 1000))

            const retryResponse = await api.chat({
                    model: selectedModel,
                    messages: [{
                        role: 'system',
                        content: `You are a professional research analyst. You MUST synthesize the provided research findings into a comprehensive, well-structured report. 

CRITICAL REQUIREMENTS - YOU MUST INCLUDE ALL OF THESE:
1. A descriptive title
2. Executive Summary section with 2-3 detailed paragraphs
3. Methodology section explaining the research process
4. Key Findings section with multiple detailed subsections, facts, and statistics
5. Inline citations using [Source Name](URL) format throughout the findings
6. Minimum 2000 words of content
7. At least 5 cited sources

REQUIRED STRUCTURE:
# [Descriptive Title]

## Executive Summary
[2-3 substantial paragraphs with key insights]

## Methodology
[Detailed explanation of research approach]

## Key Findings
[Multiple subsections with ###, detailed information, bullet points, and inline citations like [Source](URL)]

Example citation format: According to [OpenAI Research](https://openai.com/research), large language models have shown...

DO NOT include a separate "Sources & References" section.
Use markdown formatting throughout. Be EXTREMELY thorough and detailed.`
                    }, {
                        role: 'user',
                        content: `Original Research Query: ${enhancedQuery}

Search Results Gathered (${allSearchResults.length} searches):
${researchContext}

IMPORTANT: The previous attempt was insufficient. Please provide a COMPREHENSIVE, DETAILED research report with:
- Minimum 2000 words
- Multiple subsections in Key Findings
- At least 5 inline source citations with URLs
- Specific facts, statistics, and detailed analysis

Please synthesize all this information into a comprehensive research report following the required structure.`
                    }],
                    stream: true,
                    max_tokens: 150000
            })

            const retryReader = retryResponse.body?.getReader()
            if (!retryReader) throw new Error('No retry response body')

            const retryDecoder = new TextDecoder()
            let retryBuffer = ''
            accumulatedContent = '' // Reset

            setStreamingContent('')

            while (true) {
                const { done, value } = await retryReader.read()
                if (done) break

                retryBuffer += retryDecoder.decode(value, { stream: true })
                const lines = retryBuffer.split('\n')
                retryBuffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const parsed = JSON.parse(data)
                            const content = parsed.choices?.[0]?.delta?.content
                            if (content) {
                                accumulatedContent += content
                                setStreamingContent(accumulatedContent)

                                const currentProgress = Math.min(80 + (accumulatedContent.length / 100), 99)
                                setResearchProgress(prev => prev ? { ...prev, progress: currentProgress } : null)
                            }
                            if (parsed.usage) {
                                usageData = parsed.usage
                            }
                        } catch (e) {
                            console.error('Error parsing retry SSE:', e)
                        }
                    }
                }
            }

            // Re-extract sources from retry
            collectedSources.length = 0
            const retrySourceMatches = accumulatedContent.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g)
            const retryUniqueSources = new Map<string, { title: string; url: string }>()
            for (const match of retrySourceMatches) {
                if (!retryUniqueSources.has(match[2])) {
                    retryUniqueSources.set(match[2], { title: match[1], url: match[2] })
                }
            }
            collectedSources.push(...Array.from(retryUniqueSources.values()))
        }

        // Final validation
        if (accumulatedContent.trim().length < 300) {
            throw new Error('Research compilation failed: Insufficient content generated even after retry')
        }

        // Calculate research duration
        const researchDuration = Math.round((Date.now() - researchStartTime) / 1000) // in seconds

        // Calculate cost
        const calculateCost = (usage: any) => {
            const pricing: { [key: string]: { input: number; output: number } } = {
                'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
                'openai/gpt-4o': { input: 2.50, output: 10.00 },
                'anthropic/claude-3.5-sonnet-20250115': { input: 3.00, output: 15.00 }
            }
            const modelPricing = pricing[selectedModel] || { input: 1, output: 1 }
            const inputCost = (usage.prompt_tokens / 1000000) * modelPricing.input
            const outputCost = (usage.completion_tokens / 1000000) * modelPricing.output
            return inputCost + outputCost
        }

        if (usageData) {
            setSessionTokens(prev => ({
                input: prev.input + (usageData.prompt_tokens || 0),
                output: prev.output + (usageData.completion_tokens || 0)
            }))
            setSessionCost(prev => prev + calculateCost(usageData))
        }

        // Clear streaming before artifact generation
        setStreamingContent('')

        // Generate HTML artifact BEFORE displaying the message
        let artifactHtml: string | undefined = undefined
        try {
            setResearchProgress({
                phase: 'compilation',
                status: 'Generating interactive HTML artifact...',
                findings: ['Creating visualization', 'Adding interactivity', 'Embedding charts and data'],
                progress: 90
            })

            // Extract title from content
            const titleMatch = accumulatedContent.match(/^#\s+(.+)$/m)
            const researchTitle = titleMatch ? titleMatch[1] : enhancedQuery

            const artifactResponse = await api.chat({
                    model: selectedModel,
                    messages: [{
                        role: 'system',
                    content: `You are a research data formatter. Your ONLY job is to fill in the template below with the research data provided.

CRITICAL INSTRUCTIONS:
1. Copy the ENTIRE template below EXACTLY as-is
2. Replace ONLY the placeholder values marked with [BRACKETS] or "..." with actual research data
3. For charts, replace the example data arrays with real numbers from the research
4. DO NOT modify the HTML structure, CSS, or JavaScript logic
5. DO NOT add or remove any tags
6. Output the COMPLETE HTML starting with <!DOCTYPE html> and ending with </html>

TEMPLATE TO FILL IN:

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[FILL: Research Title]</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-python.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-typescript.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-java.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-cpp.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        h1 { font-size: 2.5rem; color: #fff; margin-bottom: 0.5rem; }
        h2 { font-size: 2rem; color: #d4d4d4; margin: 2rem 0 1rem; border-bottom: 2px solid #404040; padding-bottom: 0.5rem; }
        h3 { font-size: 1.5rem; color: #fff; margin: 1.5rem 0 0.75rem; }
        a { color: #a3a3a3; text-decoration: none; }
        a:hover { color: #e5e5e5; text-decoration: underline; }
        p { margin: 1rem 0; }
        ul { margin: 1rem 0; padding-left: 2rem; }
        li { margin: 0.5rem 0; }
        strong { color: #fff; font-weight: 600; }
        code { background: #1a1a1a; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; font-family: 'Courier New', monospace; }
        pre { background: #1a1a1a; border: 1px solid #262626; border-radius: 8px; padding: 1rem; margin: 1rem 0; overflow-x: auto; }
        pre code { background: none; padding: 0; }
        .katex { font-size: 1.1em; }
        .katex-display { margin: 1.5rem 0; overflow-x: auto; overflow-y: hidden; }
        .card { background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 2rem; margin: 2rem 0; }
        .chart-container { width: 100%; height: 400px; margin: 2rem 0; padding: 1rem; background: #0a0a0a; border-radius: 8px; }
        details { background: #141414; border: 1px solid #262626; border-radius: 8px; margin: 1.5rem 0; padding: 1rem; }
        summary { cursor: pointer; font-weight: 600; color: #d4d4d4; font-size: 1.2rem; padding: 0.5rem; }
        summary:hover { color: #fff; }
        .source-list { list-style: none; padding: 0; }
        .source-list li { margin: 0.5rem 0; padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>[FILL: Research Title] <span style="font-size: 0.6em; color: #737373; font-weight: 400;">(Beta)</span></h1>
            <p style="color: #a3a3a3; font-size: 1.1rem;">[FILL: Brief subtitle or tagline]</p>
        </header>
        
        <section id="summary" class="card">
            <h2>Executive Summary</h2>
            <p>[FILL: 2-3 paragraphs summarizing key findings]</p>
        </section>
        
        <section id="methodology" class="card">
            <h2>Methodology</h2>
            <p>[FILL: Explain research approach and data sources]</p>
        </section>
        
        <section id="findings">
            <h2>Key Findings</h2>
            
            <details open>
                <summary>[FILL: Finding 1 Title]</summary>
                <p>[FILL: Detailed explanation of finding 1]</p>
                <div class="chart-container"><canvas id="chart1"></canvas></div>
            </details>
            
            <details>
                <summary>[FILL: Finding 2 Title]</summary>
                <p>[FILL: Detailed explanation of finding 2]</p>
                <div class="chart-container"><canvas id="chart2"></canvas></div>
            </details>
            
            <details>
                <summary>[FILL: Finding 3 Title]</summary>
                <p>[FILL: Detailed explanation of finding 3]</p>
            </details>
        </section>
        
        <section id="sources" class="card">
            <h2>Sources & References</h2>
            <ul class="source-list">
                <li><a href="[URL1]" target="_blank">[Source 1 Title]</a></li>
                <li><a href="[URL2]" target="_blank">[Source 2 Title]</a></li>
                <li><a href="[URL3]" target="_blank">[Source 3 Title]</a></li>
            </ul>
        </section>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize KaTeX for LaTeX math rendering
            if (typeof renderMathInElement !== 'undefined') {
                renderMathInElement(document.body, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\\\(', right: '\\\\)', display: false},
                        {left: '\\\\[', right: '\\\\]', display: true}
                    ],
                    throwOnError: false
                });
            }
            
            // Initialize Prism for code syntax highlighting
            if (typeof Prism !== 'undefined') {
                Prism.highlightAll();
            }
            
            // Chart 1
            const ctx1 = document.getElementById('chart1');
            if (ctx1 && typeof Chart !== 'undefined') {
                new Chart(ctx1, {
                    type: 'bar',
                    data: {
                        labels: ['[LABEL1]', '[LABEL2]', '[LABEL3]'],
                        datasets: [{
                            label: '[CHART1 TITLE]',
                            data: [VALUE1, VALUE2, VALUE3],
                            backgroundColor: 'rgba(163, 163, 163, 0.8)',
                            borderColor: '#a3a3a3',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { labels: { color: '#e5e5e5' } },
                            title: { display: true, text: '[CHART1 TITLE]', color: '#e5e5e5' }
                        },
                        scales: {
                            y: { ticks: { color: '#a3a3a3' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                            x: { ticks: { color: '#e5e5e5' }, grid: { display: false } }
                        }
                    }
                });
            }
            
            // Chart 2
            const ctx2 = document.getElementById('chart2');
            if (ctx2 && typeof Chart !== 'undefined') {
                new Chart(ctx2, {
                    type: 'line',
                    data: {
                        labels: ['[LABEL1]', '[LABEL2]', '[LABEL3]', '[LABEL4]'],
                        datasets: [{
                            label: '[CHART2 TITLE]',
                            data: [VALUE1, VALUE2, VALUE3, VALUE4],
                            backgroundColor: 'rgba(163, 163, 163, 0.2)',
                            borderColor: '#a3a3a3',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { labels: { color: '#e5e5e5' } },
                            title: { display: true, text: '[CHART2 TITLE]', color: '#e5e5e5' }
                        },
                        scales: {
                            y: { ticks: { color: '#a3a3a3' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                            x: { ticks: { color: '#e5e5e5' }, grid: { display: false } }
                        }
                    }
                });
            }
        });
    </script>
</body>
</html>

PLACEHOLDERS TO REPLACE:
- [FILL: ...] = Replace with actual content
- [LABEL1], [LABEL2], etc = Replace with chart labels (strings in quotes)
- VALUE1, VALUE2, etc = Replace with actual numbers (no quotes)
- [URL1], [URL2], etc = Replace with actual URLs
- [CHART1 TITLE], [CHART2 TITLE] = Replace with descriptive chart titles

EXAMPLE:
Instead of: labels: ['[LABEL1]', '[LABEL2]']
Write: labels: ['2022', '2023', '2024']

Instead of: data: [VALUE1, VALUE2]
Write: data: [45, 67, 82]`
                    }, {
                        role: 'user',
                    content: `Fill in the template above with the following research data:

RESEARCH TITLE: ${researchTitle}

RESEARCH CONTENT:
${accumulatedContent}

SOURCES:
${collectedSources.map((s, i) => `${i + 1}. ${s.title} - ${s.url}`).join('\n')}

INSTRUCTIONS:
1. Copy the ENTIRE template from the system message
2. Replace [FILL: Research Title] with: ${researchTitle}
3. Replace [FILL: Brief subtitle] with a one-sentence summary
4. Fill in Executive Summary with 2-3 paragraphs from the research
5. Fill in Methodology section
6. Create 2-3 findings with <details> sections
7. For Chart 1 and Chart 2: Extract numerical data from the research and replace:
   - ['[LABEL1]', '[LABEL2]', '[LABEL3]'] with actual labels like ['2022', '2023', '2024']
   - [VALUE1, VALUE2, VALUE3] with actual numbers like [45, 67, 82]
   - '[CHART1 TITLE]' with a descriptive title
8. Fill in all source URLs and titles from the sources list above
9. **CRITICAL MARKDOWN FORMATTING**:
   - Convert **bold text** to <strong>bold text</strong>
   - Convert [link text](url) to <a href="url" target="_blank">link text</a>
   - Convert inline code to proper HTML links when they are URLs
   - Example: [arxiv.org/html/2507.11181v1] becomes <a href="https://arxiv.org/html/2507.11181v1" target="_blank">arxiv.org/html/2507.11181v1</a>
   - Example: **quantization** becomes <strong>quantization</strong>
10. **LATEX MATH FORMATTING** (for engineering/scientific research):
   - Inline math: Use $ symbols, e.g., $E = mc^2$ or $\\alpha + \\beta$
   - Display math: Use $$ symbols, e.g., $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$
   - Common symbols: \\alpha, \\beta, \\gamma, \\sum, \\int, \\frac{}{}, \\sqrt{}, \\leq, \\geq
   - Example: "The loss function $L(\\theta)$ is minimized" or "$$\\nabla f(x) = 0$$"
11. **CODE SYNTAX HIGHLIGHTING** (for technical/coding research):
   - Wrap code blocks in <pre><code class="language-python"> or language-javascript, language-typescript, language-java, language-cpp, language-bash
   - Example: <pre><code class="language-python">def train_model(data):\\n    return model.fit(data)</code></pre>
   - Inline code: Use <code>variable_name</code> for short snippets
12. Output ONLY the complete HTML, nothing else`
                    }],
                    stream: false,
                    max_tokens: 250000
            })

                const artifactData = await artifactResponse.json()
                let generatedHtml = artifactData.choices?.[0]?.message?.content || ''

                // Clean up markdown code blocks if present
                generatedHtml = generatedHtml.replace(/```html\n?/g, '').replace(/```\n?$/g, '').trim()

                // Validate it's actual HTML
                if (generatedHtml.includes('<!DOCTYPE html>') || generatedHtml.includes('<html')) {
                    // Ensure it ends with </html>
                    if (!generatedHtml.trim().endsWith('</html>')) {
                        // Try to close unclosed tags
                        if (!generatedHtml.includes('</body>')) {
                            generatedHtml += '\n</body>'
                        }
                        if (!generatedHtml.includes('</html>')) {
                            generatedHtml += '\n</html>'
                        }
                    }

                    // Final validation
                    if (generatedHtml.includes('</html>')) {
                        artifactHtml = generatedHtml
                }
            }
        } catch (artifactError) {
            console.error('Artifact generation failed:', artifactError)
            // Continue without artifact - don't block research
        }

        // Now create and display the message with all data (including artifact if generated)
        setResearchPhase('complete')
        setResearchProgress({
            phase: 'complete',
            status: `Research complete in ${researchDuration}s!`,
            findings: ['Comprehensive report generated', `${collectedSources.length} sources compiled`, artifactHtml ? 'Interactive artifact created' : 'Research compiled'],
            progress: 100
        })

        const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: accumulatedContent,
            timestamp: new Date(),
            model: selectedModel,
            isResearch: true,
            researchMetadata: {
                phase: 'complete',
                progress: {
                    phase: 'complete',
                    status: 'Research complete',
                    findings: [],
                    progress: 100
                },
                searchQueries,
                sources: collectedSources,
                durationSeconds: researchDuration,
                artifactHtml,
                artifactGeneratedAt: artifactHtml ? new Date() : undefined
            },
            tokens: usageData ? {
                input: usageData.prompt_tokens || 0,
                output: usageData.completion_tokens || 0
            } : undefined,
            cost: usageData ? calculateCost(usageData) : undefined
        }

        // Add the complete message with artifact
        setMessages(prev => [...prev, assistantMessage])

        await new Promise(resolve => setTimeout(resolve, 500))

        setIsGenerating(false)
        setResearchPhase(null)
        setResearchProgress(null)
        setClarifyingQuestions([])
        
        // Generate smart title after research completes (if there are user + assistant messages)
        const allMessages = [...messages, assistantMessage]
        if (allMessages.length >= 2 && currentChatId) {
            generateChatTitle(currentChatId, allMessages)
        }
    }

    const handleClarifyingAnswers = (answeredQuestions: ClarifyingQuestion[]) => {
        setClarifyingQuestions([])
        setIsGenerating(true)
        executeResearch(pendingResearchQuery, answeredQuestions)
    }

    const handleSkipClarifying = () => {
        setClarifyingQuestions([])
        setIsGenerating(true)
        executeResearch(pendingResearchQuery)
    }

    const handleEdit = async (messageId: string, newContent: string) => {
        // Find the message and all messages after it
        const messageIndex = messages.findIndex(m => m.id === messageId)
        if (messageIndex === -1) return

        const originalMessage = messages[messageIndex]

        // Update the message content
        const updatedMessage = { ...originalMessage, content: newContent }

        // Remove all messages after this one (including the old response)
        const newMessages = messages.slice(0, messageIndex)
        setMessages([...newMessages, updatedMessage])

        // Manually trigger generation without creating a new user message
        setIsGenerating(true)
        setStreamingContent('')
        smoothTargetRef.current = ''
        smoothCurrentRef.current = ''
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
        }

        const currentQuote = quotedText
        setQuotedText(null)

        try {
            // Build user content with attachments
            let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = newContent

            if (originalMessage.attachments && originalMessage.attachments.length > 0) {
                const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

                let textContent = newContent
                if (currentQuote) {
                    textContent = `Context from previous response:\n> ${currentQuote.text}\n\nQuestion: ${newContent}`
                }
                if (textContent.trim()) {
                    contentParts.push({ type: 'text', text: textContent })
                }

                for (const attachment of originalMessage.attachments) {
                    if (attachment.type === 'image' && attachment.url) {
                        contentParts.push({
                            type: 'image_url',
                            image_url: { url: attachment.url }
                        })
                    } else if (attachment.type === 'document_reference' && attachment.documentId) {
                        // Fetch document content from backend
                        try {
                            const { content: docContent } = await api.getDocumentContent(attachment.documentId)
                            contentParts.push({
                                type: 'text',
                                text: `[Content from document: ${attachment.name}]\n\n${docContent}`
                            })
                        } catch (error) {
                            console.error('Failed to fetch document content:', error)
                            contentParts.push({
                                type: 'text',
                                text: `[Referenced document: ${attachment.name} - unable to load content]`
                            })
                        }
                    } else if (attachment.extractedText) {
                        contentParts.push({
                            type: 'text',
                            text: `[Content from ${attachment.name}]:\n\n${attachment.extractedText}`
                        })
                    }
                }

                userContent = contentParts
            } else if (currentQuote) {
                userContent = `Context from previous response:\n> ${currentQuote.text}\n\nQuestion: ${newContent}`
            }

            // Create abort controller for this request
            abortControllerRef.current = new AbortController()

            // Prepare messages with study mode system prompt if needed
            let editMessages = newMessages.map(m => {
                if (m.attachments && m.attachments.length > 0) {
                    const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = []
                    if (m.content) {
                        parts.push({ type: 'text', text: m.content })
                    }
                    for (const att of m.attachments) {
                        if (att.type === 'image' && att.url) {
                            parts.push({ type: 'image_url', image_url: { url: att.url } })
                        } else if (att.type === 'document_reference') {
                            parts.push({
                                type: 'text',
                                text: `[Referenced document: ${att.name}]`
                            })
                        } else if (att.extractedText) {
                            parts.push({
                                type: 'text',
                                text: `[Content from ${att.name}]:\n\n${att.extractedText}`
                            })
                        }
                    }
                    return { role: m.role, content: parts }
                }
                return { role: m.role, content: m.content }
            })

            // Add study mode system prompt if in study mode
            if (currentMode === 'study') {
                const studySystemPrompt = {
                    role: 'system' as const,
                    content: `You are an expert teacher and mentor. Your role is to help students learn and understand concepts deeply, not just provide answers.

TEACHING PRINCIPLES:
1. **Never give direct answers** - Guide students to discover solutions themselves
2. **Ask probing questions** - Help them think critically about the problem
3. **Break down complex topics** - Explain step-by-step in simple terms
4. **Check understanding** - Ask follow-up questions to ensure comprehension
5. **Encourage thinking** - Use the Socratic method to develop reasoning skills
6. **Be patient and supportive** - Create a safe learning environment
7. **Provide hints, not solutions** - Offer guidance without revealing the answer
8. **Relate to real-world examples** - Make concepts tangible and relevant

APPROACH:
- Start by understanding what the student already knows
- Identify gaps in their knowledge
- Guide them through the learning process with questions
- Celebrate their progress and correct thinking
- If they're stuck, provide a small hint or ask a leading question
- Only provide direct explanations for foundational concepts they need to understand first
- For homework/assignments, help them understand the concepts but never do the work for them

FORMATTING - Use these special callout boxes (markdown blockquotes with prefixes):
- **💡 Hints/Tips**: > 💡 [your hint here] - For subtle guidance
- **❓ Questions**: > ❓ [your question here] - For thought-provoking questions
- **📝 Key Concepts**: > 📝 [concept here] - For important information
- **⚠️ Common Mistakes**: > ⚠️ [warning here] - For pitfalls to avoid
- **✅ Good Thinking**: > ✅ [encouragement here] - For correct approaches
- **🎯 Examples**: > 🎯 [example here] - For real-world applications

INTERACTIVE COMPONENTS - Use these to make learning fun and engaging:

1. **Collapsible Hints** (use when students might need help):
\`\`\`hint
level: 1-3 (1=small, 2=bigger, 3=major)
content: Your hint text here
\`\`\`

2. **Interactive Quizzes** (check understanding with quick questions):
\`\`\`quiz
question: What is the capital of France?
options:
  - text: London
    correct: false
    explanation: London is the capital of the UK
  - text: Paris
    correct: true
    explanation: Correct! Paris has been France's capital since the 12th century
  - text: Berlin
    correct: false
multiselect: false
\`\`\`

3. **Progress Tracker** (for multi-step problems):
\`\`\`progress
steps:
  - label: Understand the problem
    completed: true
  - label: Identify key concepts
    completed: true
  - label: Apply the formula
    completed: false
  - label: Check your answer
    completed: false
current: 2
\`\`\`

Use numbered lists for step-by-step guidance. Use these callouts and interactive components frequently to make learning engaging, visual, and fun!

Remember: Your goal is to develop their ability to think and learn independently, not to be a solution provider.`
                }
                
                // Check if there's already a system message
                const hasSystemMessage = editMessages.some((m: any) => m.role === 'system')
                if (hasSystemMessage) {
                    // Prepend to existing system messages
                    editMessages = [studySystemPrompt, ...editMessages]
                } else {
                    // Add as first message
                    editMessages = [studySystemPrompt, ...editMessages]
                }
            }

            // Make request to backend chat proxy
            const response = await api.chat({
                    model: useWebSearch ? `${selectedModel}:online` : selectedModel,
                    messages: [
                        ...editMessages,
                        { role: 'user', content: userContent }
                    ],
                    stream: true
            })

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let buffer = ''
            let usageData: any = null
            let accumulatedContent = '' // Track content directly

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const parsed = JSON.parse(data)
                            const content = parsed.choices?.[0]?.delta?.content
                            if (content) {
                                accumulatedContent += content
                                setStreamingContent(accumulatedContent)
                            }
                            if (parsed.usage) {
                                usageData = parsed.usage
                            }
                        } catch (e) {
                            console.error('Error parsing SSE:', e)
                        }
                    }
                }
            }

            // Extract thinking if present
            let mainContent = accumulatedContent
            let thinking: string | undefined
            const thinkMatch = accumulatedContent.match(/<think>([\s\S]*?)<\/think>/i)
            if (thinkMatch) {
                thinking = thinkMatch[1].trim()
                mainContent = accumulatedContent.replace(/<think>[\s\S]*?<\/think>/i, '').trim()
            }

            const calculateCost = (usage: any) => {
                const pricing: { [key: string]: { input: number; output: number } } = {
                    'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
                    'openai/gpt-4o': { input: 2.50, output: 10.00 },
                    'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
                    'anthropic/claude-3.5-sonnet-20250115': { input: 3.00, output: 15.00 },
                    'openai/gpt-5': { input: 2.50, output: 10.00 },
                    'openai/gpt-5-mini': { input: 0.15, output: 0.60 },
                    'google/gemini-2.5-flash-preview-09-2025': { input: 0.03, output: 0.08 },
                    'google/gemini-2.5-flash-lite-preview-09-2025': { input: 0.05, output: 0.15 },
                    'x-ai/grok-4-fast': { input: 0.05, output: 0.10 },
                    'qwen/qwen3-coder-plus': { input: 0.28, output: 1.10 },
                    'qwen/qwen3-235b-a22b-thinking-2507': { input: 0.28, output: 1.10 },
                    'z-ai/glm-4.6': { input: 0.05, output: 0.15 },
                    'z-ai/glm-4.5-air': { input: 0.05, output: 0.15 },
                    'deepseek/deepseek-v3.2-exp': { input: 0.05, output: 0.15 },
                    'deepseek/deepseek-r1-0528': { input: 0.40, output: 1.75 }
                }
                const modelPricing = pricing[selectedModel] || { input: 1, output: 1 }
                const inputCost = (usage.prompt_tokens / 1000000) * modelPricing.input
                const outputCost = (usage.completion_tokens / 1000000) * modelPricing.output
                return inputCost + outputCost
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: mainContent,
                thinking,
                timestamp: new Date(),
                model: selectedModel,
                tokens: usageData ? {
                    input: usageData.prompt_tokens || 0,
                    output: usageData.completion_tokens || 0,
                    thinking: usageData.completion_tokens_details?.reasoning_tokens || 0
                } : undefined,
                cost: usageData ? calculateCost(usageData) : undefined
            }

            if (usageData) {
                const messageCost = calculateCost(usageData)
                setSessionTokens(prev => ({
                    input: prev.input + (usageData.prompt_tokens || 0),
                    output: prev.output + (usageData.completion_tokens || 0)
                }))
                setSessionCost(prev => prev + messageCost)
            }

            setMessages(prev => [...prev, assistantMessage])

            await new Promise(resolve => setTimeout(resolve, 50))
            setStreamingContent('')
            
            // Generate smart title after debate response (if there are user + assistant messages)
            const allMessages = [...messages, assistantMessage]
            if (allMessages.length >= 2 && currentChatId) {
                generateChatTitle(currentChatId, allMessages)
            }
        } catch (error) {
            // Check if this was an abort
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Edit request aborted by user')
                return // Don't show error message for user-initiated stops
            }

            console.error('Error generating response:', error)
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response.'}`,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsGenerating(false)
        }
    }

    const handleRetry = (messageId: string) => {
        // Find the assistant message
        const messageIndex = messages.findIndex(m => m.id === messageId)
        if (messageIndex === -1 || messages[messageIndex].role !== 'assistant') return

        // Find the user message before it
        const userMessageIndex = messageIndex - 1
        if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') return

        // Remove the assistant message and re-generate
        const newMessages = messages.slice(0, messageIndex)
        setMessages(newMessages)

        // Re-send the user message
        const userMessage = messages[userMessageIndex]
        handleSendMessage(userMessage.content, userMessage.attachments)
    }

    // Load user's selected model and chats when authenticated
    useEffect(() => {
        if (user) {
            // Load selected model from user settings
            api.getUserSettings().then(settings => {
                if (settings.selected_model && settings.selected_model !== selectedModel) {
                    setSelectedModel(settings.selected_model)
                    try { localStorage.setItem('selectedModel', settings.selected_model) } catch {}
                }
                if (settings.provider) {
                    setSelectedProvider(settings.provider)
                }
                // Apply display settings
                if (settings.font_size) {
                    document.documentElement.setAttribute('data-font-size', settings.font_size)
                }
                if (settings.font_family) {
                    document.documentElement.setAttribute('data-font-family', settings.font_family)
                }
            }).catch(console.error)
            
            loadChats()
        }
    }, [user])

    // Save chat mode when it changes (for existing chats)
    useEffect(() => {
        if (!user || !currentChatId || isLoadingChatRef.current || isIncognito) return
        
        const saveMode = async () => {
            try {
                await api.updateChat(currentChatId, { mode: currentMode })
            } catch (error) {
                console.error('Failed to save chat mode:', error)
            }
        }
        
        saveMode()
    }, [currentMode, currentChatId, user, isIncognito])

    // Load all chats
    const loadChats = async () => {
        try {
            const { chats: loadedChats } = await api.getChats()
            setChats(loadedChats)
        } catch (error) {
            console.error('Failed to load chats:', error)
        }
    }

    // Load a specific chat
    const loadChat = async (chatId: number, limit: number = 50) => {
        try {
            isLoadingChatRef.current = true
            const { chat } = await api.getChat(chatId, { limit })
            setMessages(chat.messages || [])
            setCurrentChatId(chatId)
            setIsIncognito(false) // Loading a saved chat means it's not incognito
            setHasMoreMessages(chat.hasMore || false)
            setTotalMessageCount(chat.totalMessages || 0)
            // Restore the chat mode
            const chatMode = (chat as any).mode
            if (chatMode) {
                setCurrentMode(chatMode as 'chat' | 'study' | 'research')
            }
            // Reset flag after a brief delay to allow useEffect to skip
            setTimeout(() => {
                isLoadingChatRef.current = false
            }, 100)
        } catch (error) {
            console.error('Failed to load chat:', error)
            isLoadingChatRef.current = false
        }
    }

    // Load more messages (for infinite scroll)
    const loadMoreMessages = async () => {
        if (!currentChatId || isLoadingMoreMessages || !hasMoreMessages) return
        
        try {
            setIsLoadingMoreMessages(true)
            const oldestMessageId = messages[0]?.id ? parseInt(messages[0].id) : undefined
            
            if (!oldestMessageId) return
            
            const { chat } = await api.getChat(currentChatId, { limit: 30, before: oldestMessageId })
            
            if (chat.messages && chat.messages.length > 0) {
                setMessages(prev => [...(chat.messages || []), ...prev])
                setHasMoreMessages(chat.hasMore || false)
            }
        } catch (error) {
            console.error('Failed to load more messages:', error)
        } finally {
            setIsLoadingMoreMessages(false)
        }
    }

    // Start a new chat
    const handleNewChat = (incognito = false) => {
        setMessages([])
        setCurrentChatId(null)
        setIsIncognito(incognito)
        setSessionTokens({ input: 0, output: 0 })
        setSessionCost(0)
        setHasMoreMessages(false)
        setTotalMessageCount(0)
        setCurrentMode('chat') // Reset to default mode for new chats
    }

    // Toggle incognito mode
    const toggleIncognito = () => {
        if (messages.length === 0) {
            setIsIncognito(!isIncognito)
        }
    }

    // Auto-save messages when they change (after generation completes)
    useEffect(() => {
        if (!user || messages.length === 0 || isIncognito || isLoadingChatRef.current) return

        const saveChat = async () => {
            try {
                if (!currentChatId) {
                    // Create new chat with temporary title
                    const title = 'New Chat'
                    const { chatId } = await api.createChat(title, messages, currentMode)
                    setCurrentChatId(chatId)
                    // Optimistically insert new chat into sidebar without full reload
                    const nowIso = new Date().toISOString()
                    setChats(prev => [
                        { id: chatId, title, created_at: nowIso, updated_at: nowIso },
                        ...prev
                    ])
                    
                    // Generate smart title after first exchange (user + assistant messages)
                    if (messages.length >= 2 && messages[messages.length - 1].role === 'assistant') {
                        generateChatTitle(chatId, messages)
                    }
                } else {
                    // Update existing chat with last message
                    const lastMessage = messages[messages.length - 1]
                    await api.updateChat(currentChatId, { message: lastMessage })
                    // Optimistically bump chat to top with refreshed updated_at
                    const nowIso = new Date().toISOString()
                    setChats(prev => {
                        const idx = prev.findIndex(c => c.id === currentChatId)
                        if (idx === -1) return prev
                        const updated = { ...prev[idx], updated_at: nowIso }
                        return [updated, ...prev.filter((_, i) => i !== idx)]
                    })
                }
            } catch (error) {
                console.error('Failed to save chat:', error)
            }
        }

        // Only save when not generating and messages have changed
        if (!isGenerating) {
            saveChat()
        }
    }, [messages, isGenerating, currentChatId, user, isIncognito])

    // Save selected model preference (server + localStorage)
    useEffect(() => {
        try { localStorage.setItem('selectedModel', selectedModel) } catch {}
        if (user && selectedModel) {
            api.updateUserSettings({ selected_model: selectedModel }).catch(console.error)
        }
    }, [selectedModel, user])

    // Show loading while checking auth
    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-foreground/60">Loading...</div>
            </div>
        )
    }

    // Show auth page if not logged in
    if (!user) {
        return <AuthPage />
    }

    // Show onboarding if not completed (route guard)
    if (user.onboardingComplete === false) {
        return <OnboardingWizard />
    }

    // Show settings page if open
    if (isSettingsOpen) {
        return (
            <SettingsPage
                onClose={() => setIsSettingsOpen(false)}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
            />
        )
    }

    return (
        <div className="relative h-screen flex bg-background text-foreground overflow-hidden">
            {/* Always render LiquidEther to preserve animation state, control visibility with CSS */}
            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${messages.length === 0 ? 'opacity-70' : 'opacity-0'}`}>
                <LiquidEther
                    colors={liquidEtherColors}
                    mouseForce={20}
                    cursorSize={100}
                    isViscous={false}
                    viscous={30}
                    iterationsViscous={32}
                    iterationsPoisson={32}
                    dt={0.014}
                    BFECC={true}
                    resolution={0.8}
                    isBounce={false}
                    autoDemo={true}
                    autoSpeed={0.7}
                    autoIntensity={3}
                    takeoverDuration={0.25}
                    autoResumeDelay={0}
                    autoRampDuration={0}
                />
            </div>
            {/* Sidebar */}
            <Sidebar
                chats={chats.map(c => ({
                    id: c.id.toString(),
                    title: c.title,
                    messages: [],
                    model: selectedModel,
                    createdAt: new Date(c.created_at),
                    updatedAt: new Date(c.updated_at)
                }))}
                activeChatId={currentChatId?.toString() || ''}
                onSelectChat={(id) => loadChat(Number(id))}
                onNewChat={handleNewChat}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onRenameChat={async (id, title) => {
                    try {
                        await api.updateChat(Number(id), { title })
                        await loadChats()
                    } catch (error) {
                        console.error('Failed to rename chat:', error)
                    }
                }}
                onDeleteChat={async (id) => {
                    try {
                        await api.deleteChat(Number(id))
                        if (currentChatId === Number(id)) {
                            handleNewChat()
                        }
                        await loadChats()
                    } catch (error) {
                        console.error('Failed to delete chat:', error)
                    }
                }}
            />

            {/* Main content */}
            <main className={`flex flex-col ${artifactSplit ? 'w-[50vw]' : 'w-full'} transition-[width] duration-200`}>

                {/* Messages */}
                <MessagesContainer
                    messages={messages}
                    isGenerating={isGenerating}
                    streamingContent={streamingContent}
                    onSuggestionClick={handleSuggestionClick}
                    onQuote={setQuotedText}
                    onEdit={handleEdit}
                    onRetry={handleRetry}
                    isIncognito={isIncognito}
                    onToggleIncognito={toggleIncognito}
                    researchProgress={researchProgress}
                    hasMoreMessages={hasMoreMessages}
                    isLoadingMoreMessages={isLoadingMoreMessages}
                    totalMessageCount={totalMessageCount}
                    onLoadMore={loadMoreMessages}
                    clarifyingQuestions={clarifyingQuestions}
                    onClarifyingAnswers={handleClarifyingAnswers}
                    onSkipClarifying={handleSkipClarifying}
                    researchStartTime={researchStartTime}
                    isStudyMode={currentMode === 'study'}
                // Provide open split-pane handler to child bubbles
                />

                {/* Input */}
                <ChatInput
                    onSendMessage={handleSendMessage}
                    onStopGeneration={handleStopGeneration}
                    isGenerating={isGenerating}
                    currentMode={currentMode}
                    onModeChange={setCurrentMode}
                    quotedText={quotedText}
                    onClearQuote={() => setQuotedText(null)}
                    useWebSearch={useWebSearch}
                    onToggleWebSearch={setUseWebSearch}
                    sessionTokens={sessionTokens}
                    sessionCost={sessionCost}
                    activeModel={selectedModel}
                    isIncognito={isIncognito}
                    onToggleIncognito={toggleIncognito}
                />
            </main>

            {/* Right-side Artifact Split Pane */}
            {artifactSplit && (
                <aside
                    className="h-full border-l border-white/10 bg-[#0a0a0a] flex flex-col"
                    style={{ width: '50vw' }}
                >
                    <div
                        className="px-4 flex items-center justify-between"
                        style={{ height: '56px', flexShrink: 0, background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)' }}
                    >
                        <div className="flex items-center gap-2">
                            <FileCode2 className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-medium text-foreground">
                                {artifactSplit.title || 'Research Artifact'}
                            </span>
                            <span className="text-xs text-muted-foreground/60">
                                (Beta)
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleDownloadArtifact}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                                title={
                                    artifactSplit.kind === 'html' ? 'Download HTML' :
                                    artifactSplit.kind === 'python' ? 'Download Python (.py)' :
                                    artifactSplit.kind === 'mermaid' ? 'Download Mermaid (.mmd)' :
                                    artifactSplit.kind === 'katex' ? 'Download LaTeX (.tex)' :
                                    'Download'
                                }
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={closeArtifactSplit}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', inset: 0 }}>
                                <ArtifactViewer artifact={{ id: 'split-pane', kind: artifactSplit.kind, title: artifactSplit.title, payload: artifactSplit.payload, createdAt: new Date() }} />
                            </div>
                        </div>
                </aside>
            )}
        </div>
    )
}

export default App