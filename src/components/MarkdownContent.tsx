import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import { Check, Copy, Play } from 'lucide-react'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import { StudyHint } from './study/StudyHint'
import { StudyQuiz } from './study/StudyQuiz'
import { StudyProgress } from './study/StudyProgress'

interface MarkdownContentProps {
    content: string
    deferHighlight?: boolean
    messageId?: string
    isStudyMode?: boolean
}

// Small stable hash for short strings (not cryptographic)
function hashString(input: string): string {
    let h = 0
    for (let i = 0; i < input.length; i++) {
        h = (h << 5) - h + input.charCodeAt(i)
        h |= 0
    }
    return String(h >>> 0)
}

const CodeBlock = memo(function CodeBlock({ children, language, deferHighlight = false, copied, onCopy, aggregated }: { children: string; language: string; deferHighlight?: boolean; copied?: boolean; onCopy?: () => void; aggregated?: { html?: string; css?: string; js?: string } }) {
    const [isAttaching, setIsAttaching] = useState(false)
    const copyTimeoutRef = useRef<number | null>(null)

    // Cleanup timeout on unmount (for internal fallback path only)
    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current)
            }
        }
    }, [])

    // Compute highlighted HTML synchronously when not deferring to avoid post-commit reflow
    const highlightedCode = useMemo(() => {
        if (deferHighlight) return ''
        try {
            if (language && language !== 'text') {
                const result = hljs.highlight(children, { language, ignoreIllegals: true })
                return result.value
            } else {
                const result = hljs.highlightAuto(children)
                return result.value
            }
        } catch (error) {
            console.error('Highlighting error:', error)
            return children
        }
    }, [children, language, deferHighlight])

    const [localCopied, setLocalCopied] = useState(false)
    const effectiveCopied = typeof copied === 'boolean' ? copied : localCopied

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(children)
            if (onCopy) {
                onCopy()
            } else {
                setLocalCopied(true)
                if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
                copyTimeoutRef.current = window.setTimeout(() => {
                    setLocalCopied(false)
                    copyTimeoutRef.current = null
                }, 2000)
            }
        } catch (error) {
            console.error('Failed to copy code:', error)
        }
    }, [children, onCopy])

    const handleRunAsArtifact = () => {
        // Immediately open the split pane with the artifact (no intermediate card)
        if (isAttaching) return
        setIsAttaching(true)
        try {
            const text = children
            let kind: 'html' | 'python' | 'mermaid' | 'katex' | null = null
            const lower = (language || '').toLowerCase()
            if (['html', 'js', 'javascript', 'css'].includes(lower)) kind = 'html'
            if (['py', 'python'].includes(lower)) kind = 'python'
            if (lower === 'mermaid') kind = 'mermaid'
            if (lower === 'latex' || lower === 'tex' || lower === 'katex') kind = 'katex'
            if (!kind) { 
                console.warn('Unknown artifact kind for language:', language)
                setIsAttaching(false)
                return 
            }

            const artifact: any = {
                id: `${Date.now()}-${Math.random()}`,
                kind,
                title: `${kind.toUpperCase()} artifact`,
                payload: {},
                createdAt: new Date()
            }
            if (kind === 'html') {
                // Prefer aggregated across the whole message so HTML/CSS/JS can be combined
                const html = aggregated?.html || (lower === 'html' ? text : '')
                const css = aggregated?.css || (lower === 'css' ? text : '')
                const js = aggregated?.js || ((lower === 'js' || lower === 'javascript') ? text : '')
                
                // Build full HTML document
                let htmlDoc = html
                if (!html.toLowerCase().includes('<!doctype') && !html.toLowerCase().includes('<html')) {
                    htmlDoc = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${artifact.title}</title>
    ${css ? `<style>\n${css}\n</style>` : ''}
</head>
<body>
${html}
${js ? `<script>\n${js}\n</script>` : ''}
</body>
</html>`
                }
                artifact.payload.htmlDoc = htmlDoc
            } else if (kind === 'python') {
                artifact.payload.pythonCode = text
            } else if (kind === 'mermaid') {
                artifact.payload.mermaidCode = text
            } else if (kind === 'katex') {
                artifact.payload.katexCode = text
            }

            // Immediately open split pane
            const event = new CustomEvent('open-artifact-split-any', { detail: artifact })
            window.dispatchEvent(event)
        } finally {
            setTimeout(() => setIsAttaching(false), 300)
        }
    }

    return (
        <div className="relative group my-4">
            {/* Language badge and copy button */}
            <div
                className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10 rounded-t-lg h-9"
                style={{ overflowAnchor: 'none' as any }}
            >
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {language || 'text'}
                </span>
                <div className="flex items-center gap-2">
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopy() }}
                    onMouseDown={(e) => e.preventDefault()}
                    onFocus={(e) => { if (deferHighlight) e.currentTarget.blur() }}
                    type="button"
                    tabIndex={deferHighlight ? -1 : 0}
                    className={`
                        flex items-center gap-1.5 px-2 py-1 rounded-md h-7
                        text-xs font-medium
                        bg-white/5 hover:bg-white/10
                        border border-white/10
                        text-foreground
                        transition-all duration-200
                        w-20 justify-center whitespace-nowrap select-none
                        ${effectiveCopied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                    `}
                >
                    {effectiveCopied ? (
                        <>
                            <Check className="w-3 h-3" />
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                        </>
                    )}
                </button>
                {['html','javascript','js','css','python','py','mermaid','latex','tex','katex'].includes((language||'').toLowerCase()) && (
                    <button
                        onClick={handleRunAsArtifact}
                        onMouseDown={(e) => e.preventDefault()}
                        type="button"
                        tabIndex={deferHighlight ? -1 : 0}
                        className="
                            flex items-center gap-1.5 px-2 py-1 rounded-md h-7
                            text-xs font-medium
                            bg-white/10 hover:bg-white/15
                            border border-white/15
                            text-foreground
                            transition-all duration-200
                            opacity-0 group-hover:opacity-100
                            whitespace-nowrap select-none
                        "
                    >
                        <Play className="w-3 h-3" />
                        <span>Run</span>
                    </button>
                )}
                </div>
            </div>

            {/* Code content */}
            <div className="bg-[#0d1117] rounded-b-lg overflow-hidden">
                <pre className="!p-4 !m-0 !bg-transparent overflow-x-auto">
                    {deferHighlight ? (
                        <code className="hljs whitespace-pre-wrap break-words overflow-wrap-anywhere">
                            {children}
                        </code>
                    ) : (
                        <code
                            className="hljs whitespace-pre-wrap break-words overflow-wrap-anywhere"
                            dangerouslySetInnerHTML={{ __html: highlightedCode }}
                        />
                    )}
                </pre>
            </div>
        </div>
    )
})

export function MarkdownContent({ content, deferHighlight = false, messageId, isStudyMode = false }: MarkdownContentProps) {
    const aggregated = useMemo(() => {
        try {
            const htmlParts: string[] = []
            const cssParts: string[] = []
            const jsParts: string[] = []
            const re = /```(\w+)\n([\s\S]*?)```/g
            let m: RegExpExecArray | null
            while ((m = re.exec(content)) !== null) {
                const lang = (m[1] || '').toLowerCase()
                const code = m[2] || ''
                if (lang === 'html') htmlParts.push(code)
                else if (lang === 'css') cssParts.push(code)
                else if (lang === 'js' || lang === 'javascript') jsParts.push(code)
            }
            return {
                html: htmlParts.length ? htmlParts.join('\n') : undefined,
                css: cssParts.length ? cssParts.join('\n') : undefined,
                js: jsParts.length ? jsParts.join('\n') : undefined
            }
        } catch {
            return {}
        }
    }, [content])

    // Persist copied state per block for 2s even across remounts
    const [copiedByKey, setCopiedByKey] = useState<Record<string, boolean>>({})
    const timeoutByKeyRef = useRef<Record<string, number>>({})

    // Persist quiz state per quiz across remounts
    const [quizStateByKey, setQuizStateByKey] = useState<Record<string, {
        selectedIndices: number[]
        hasSubmitted: boolean
        showExplanation: boolean
    }>>({})

    const markCopied = useCallback((key: string) => {
        setCopiedByKey(prev => ({ ...prev, [key]: true }))
        // clear previous timer
        const existing = timeoutByKeyRef.current[key]
        if (existing) window.clearTimeout(existing)
        timeoutByKeyRef.current[key] = window.setTimeout(() => {
            setCopiedByKey(prev => ({ ...prev, [key]: false }))
            delete timeoutByKeyRef.current[key]
        }, 2000)
    }, [])

    const updateQuizState = useCallback((key: string, state: {
        selectedIndices: number[]
        hasSubmitted: boolean
        showExplanation: boolean
    }) => {
        setQuizStateByKey(prev => ({ ...prev, [key]: state }))
    }, [])

    useEffect(() => {
        return () => {
            // cleanup all timers on unmount
            Object.values(timeoutByKeyRef.current).forEach(id => window.clearTimeout(id))
            timeoutByKeyRef.current = {}
        }
    }, [])

    return (
        <div className="markdown-content">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, rehypeKatex]}
                components={{
                    // Code blocks
                    code({ node, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        const codeContent = String(children).replace(/\n$/, '')
                        const lang = match ? match[1] : ''
                        const keyForBlock = `${messageId || 'm'}:${lang}:${hashString(codeContent)}`

                        if (match) {
                            // Check for interactive study components
                            if (isStudyMode) {
                                // Parse hint component
                                if (lang === 'hint') {
                                    try {
                                        const lines = codeContent.split('\n')
                                        let level: 1 | 2 | 3 = 1
                                        let content = ''
                                        
                                        for (const line of lines) {
                                            const trimmed = line.trim()
                                            if (trimmed.startsWith('level:')) {
                                                const levelNum = parseInt(trimmed.replace('level:', '').trim())
                                                if (levelNum >= 1 && levelNum <= 3) {
                                                    level = levelNum as 1 | 2 | 3
                                                }
                                            } else if (trimmed.startsWith('content:')) {
                                                content = trimmed.replace('content:', '').trim()
                                            } else if (content && trimmed) {
                                                // Multi-line content
                                                content += ' ' + trimmed
                                            }
                                        }
                                        
                                        if (content) {
                                            const hintKey = `hint-${hashString(content)}`
                                            return <StudyHint key={hintKey} level={level} content={content} />
                                        }
                                    } catch (e) {
                                        console.error('Failed to parse hint:', e)
                                    }
                                }
                                
                                // Parse quiz component
                                if (lang === 'quiz') {
                                    try {
                                        const lines = codeContent.split('\n')
                                        let question = ''
                                        let multiselect = false
                                        const options: Array<{ text: string; isCorrect: boolean; explanation?: string }> = []
                                        let currentOption: any = null
                                        
                                        for (const line of lines) {
                                            const trimmed = line.trim()
                                            if (trimmed.startsWith('question:')) {
                                                question = trimmed.replace('question:', '').trim()
                                            } else if (trimmed.startsWith('multiselect:')) {
                                                multiselect = trimmed.replace('multiselect:', '').trim() === 'true'
                                            } else if (trimmed.startsWith('- text:')) {
                                                if (currentOption) {
                                                    options.push(currentOption)
                                                }
                                                currentOption = {
                                                    text: trimmed.replace('- text:', '').trim(),
                                                    isCorrect: false
                                                }
                                            } else if (trimmed.startsWith('correct:') && currentOption) {
                                                currentOption.isCorrect = trimmed.replace('correct:', '').trim() === 'true'
                                            } else if (trimmed.startsWith('explanation:') && currentOption) {
                                                currentOption.explanation = trimmed.replace('explanation:', '').trim()
                                            }
                                        }
                                        
                                        if (currentOption) {
                                            options.push(currentOption)
                                        }
                                        
                                        if (question && options.length > 0) {
                                            // Create a stable key based on the question content
                                            const quizKey = `quiz-${hashString(question)}`
                                            const currentState = quizStateByKey[quizKey] || {
                                                selectedIndices: [],
                                                hasSubmitted: false,
                                                showExplanation: false
                                            }
                                            return (
                                                <StudyQuiz 
                                                    key={quizKey}
                                                    quizKey={quizKey}
                                                    question={question} 
                                                    options={options} 
                                                    multiSelect={multiselect}
                                                    initialState={currentState}
                                                    onStateChange={(state) => updateQuizState(quizKey, state)}
                                                />
                                            )
                                        }
                                    } catch (e) {
                                        console.error('Failed to parse quiz:', e)
                                    }
                                }
                                
                                // Parse progress component
                                if (lang === 'progress') {
                                    try {
                                        const lines = codeContent.split('\n')
                                        const steps: Array<{ label: string; completed: boolean }> = []
                                        let currentStep: number | undefined
                                        let currentStepObj: any = null
                                        
                                        for (const line of lines) {
                                            const trimmed = line.trim()
                                            if (trimmed.startsWith('- label:')) {
                                                if (currentStepObj) {
                                                    steps.push(currentStepObj)
                                                }
                                                currentStepObj = {
                                                    label: trimmed.replace('- label:', '').trim(),
                                                    completed: false
                                                }
                                            } else if (trimmed.startsWith('completed:') && currentStepObj) {
                                                currentStepObj.completed = trimmed.replace('completed:', '').trim() === 'true'
                                            } else if (trimmed.startsWith('current:')) {
                                                currentStep = parseInt(trimmed.replace('current:', '').trim())
                                            }
                                        }
                                        
                                        if (currentStepObj) {
                                            steps.push(currentStepObj)
                                        }
                                        
                                        if (steps.length > 0) {
                                            const progressKey = `progress-${hashString(JSON.stringify(steps))}`
                                            return <StudyProgress key={progressKey} steps={steps} currentStep={currentStep} />
                                        }
                                    } catch (e) {
                                        console.error('Failed to parse progress:', e)
                                    }
                                }
                            }
                            
                            // Block code with language
                            return (
                                <CodeBlock language={lang} deferHighlight={deferHighlight} copied={!!copiedByKey[keyForBlock]} onCopy={() => markCopied(keyForBlock)} aggregated={aggregated}>
                                    {codeContent}
                                </CodeBlock>
                            )
                        } else if (codeContent.includes('\n')) {
                            // Multi-line code without language
                            return (
                                <CodeBlock language="" deferHighlight={deferHighlight} copied={!!copiedByKey[keyForBlock]} onCopy={() => markCopied(keyForBlock)} aggregated={aggregated}>
                                    {codeContent}
                                </CodeBlock>
                            )
                        } else {
                            // Inline code
                            return (
                                <code
                                    className="px-1.5 py-0.5 rounded-md bg-white/10 text-foreground font-mono text-[0.9em] border border-white/10"
                                    {...props}
                                >
                                    {children}
                                </code>
                            )
                        }
                    },

                    // Headings
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground border-b border-white/10 pb-2">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl font-semibold mt-5 mb-3 text-foreground">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">
                            {children}
                        </h3>
                    ),

                    // Paragraphs
                    p: ({ children }) => (
                        <p className="mb-4 leading-7 text-foreground">
                            {children}
                        </p>
                    ),

                    // Lists
                    ul: ({ children }) => (
                        <ul className="mb-4 space-y-2 text-foreground ml-1">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="mb-4 space-y-2 text-foreground ml-1">
                            {children}
                        </ol>
                    ),
                    li: ({ children, ordered }: any) => (
                        <li className="leading-7 pl-1.5 ml-6 relative flex items-start gap-3">
                            <span className="flex-shrink-0 select-none text-foreground/70">
                                {ordered ? '' : '•'}
                            </span>
                            <span className="flex-1">{children}</span>
                        </li>
                    ),

                    // Links
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                        >
                            {children}
                        </a>
                    ),

                    // Blockquotes - Enhanced for study mode
                    blockquote: ({ children }) => {
                        // Extract text content to check for callout types
                        const textContent = typeof children === 'string' ? children : 
                            (Array.isArray(children) && children[0]?.props?.children?.[0]?.props?.children) || ''
                        
                        // Study mode callout detection
                        if (isStudyMode && typeof textContent === 'string') {
                            const text = textContent.toLowerCase()
                            
                            // 💡 Hint/Tip
                            if (text.startsWith('💡') || text.startsWith('hint:') || text.startsWith('tip:')) {
                                return (
                                    <blockquote className="border-l-4 border-yellow-500/50 pl-4 py-3 my-4 bg-yellow-500/10 rounded-r-lg backdrop-blur-sm">
                                        <div className="flex items-start gap-2">
                                            <span className="text-yellow-400 text-lg flex-shrink-0 mt-0.5">💡</span>
                                            <div className="flex-1 text-yellow-100/90">{children}</div>
                                        </div>
                                    </blockquote>
                                )
                            }
                            
                            // ❓ Question/Think About This
                            if (text.startsWith('❓') || text.startsWith('?') || text.startsWith('question:') || text.startsWith('think:')) {
                                return (
                                    <blockquote className="border-l-4 border-purple-500/50 pl-4 py-3 my-4 bg-purple-500/10 rounded-r-lg backdrop-blur-sm">
                                        <div className="flex items-start gap-2">
                                            <span className="text-purple-400 text-lg flex-shrink-0 mt-0.5">❓</span>
                                            <div className="flex-1 text-purple-100/90 font-medium">{children}</div>
                                        </div>
                                    </blockquote>
                                )
                            }
                            
                            // 📝 Key Concept/Note
                            if (text.startsWith('📝') || text.startsWith('note:') || text.startsWith('key:') || text.startsWith('important:')) {
                                return (
                                    <blockquote className="border-l-4 border-blue-500/50 pl-4 py-3 my-4 bg-blue-500/10 rounded-r-lg backdrop-blur-sm">
                                        <div className="flex items-start gap-2">
                                            <span className="text-blue-400 text-lg flex-shrink-0 mt-0.5">📝</span>
                                            <div className="flex-1 text-blue-100/90">{children}</div>
                                        </div>
                                    </blockquote>
                                )
                            }
                            
                            // ⚠️ Warning/Common Mistake
                            if (text.startsWith('⚠️') || text.startsWith('⚠') || text.startsWith('warning:') || text.startsWith('caution:') || text.startsWith('mistake:')) {
                                return (
                                    <blockquote className="border-l-4 border-red-500/50 pl-4 py-3 my-4 bg-red-500/10 rounded-r-lg backdrop-blur-sm">
                                        <div className="flex items-start gap-2">
                                            <span className="text-red-400 text-lg flex-shrink-0 mt-0.5">⚠️</span>
                                            <div className="flex-1 text-red-100/90">{children}</div>
                                        </div>
                                    </blockquote>
                                )
                            }
                            
                            // ✅ Success/Correct Thinking
                            if (text.startsWith('✅') || text.startsWith('✓') || text.startsWith('correct:') || text.startsWith('good:')) {
                                return (
                                    <blockquote className="border-l-4 border-green-500/50 pl-4 py-3 my-4 bg-green-500/10 rounded-r-lg backdrop-blur-sm">
                                        <div className="flex items-start gap-2">
                                            <span className="text-green-400 text-lg flex-shrink-0 mt-0.5">✅</span>
                                            <div className="flex-1 text-green-100/90">{children}</div>
                                        </div>
                                    </blockquote>
                                )
                            }
                            
                            // 🎯 Example
                            if (text.startsWith('🎯') || text.startsWith('example:')) {
                                return (
                                    <blockquote className="border-l-4 border-cyan-500/50 pl-4 py-3 my-4 bg-cyan-500/10 rounded-r-lg backdrop-blur-sm">
                                        <div className="flex items-start gap-2">
                                            <span className="text-cyan-400 text-lg flex-shrink-0 mt-0.5">🎯</span>
                                            <div className="flex-1 text-cyan-100/90">{children}</div>
                                        </div>
                                    </blockquote>
                                )
                            }
                        }
                        
                        // Default blockquote
                        return (
                            <blockquote className="border-l-4 border-white/20 pl-4 py-2 my-4 italic text-muted-foreground bg-white/5 rounded-r-lg">
                                {children}
                            </blockquote>
                        )
                    },

                    // Tables
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                            <table className="min-w-full border border-white/10 rounded-lg overflow-hidden">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-white/5">
                            {children}
                        </thead>
                    ),
                    th: ({ children }) => (
                        <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-white/10">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-4 py-2 text-foreground border-b border-white/10">
                            {children}
                        </td>
                    ),

                    // Horizontal rule
                    hr: () => (
                        <hr className="my-6 border-white/10" />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

