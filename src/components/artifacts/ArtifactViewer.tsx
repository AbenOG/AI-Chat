import { useEffect, useMemo, useRef, useState } from 'react'
import type { Artifact, ArtifactPayload } from '@/types'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

function buildHtmlDocument(payload: ArtifactPayload): string {
    if (payload.htmlDoc) return payload.htmlDoc
    const html = payload.html || ''
    const css = payload.css ? `<style>${payload.css}</style>` : ''
    const js = payload.js ? `<script>(function(){${payload.js}\n})();</script>` : ''
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${css}</head><body>${html}${js}</body></html>`
}

function HTMLViewer({ payload }: { payload: ArtifactPayload }) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const srcDoc = useMemo(() => buildHtmlDocument(payload), [payload])
    return (
        <iframe
            ref={iframeRef}
            title="HTML Artifact"
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block', backgroundColor: 'transparent' }}
            srcDoc={srcDoc}
        />
    )
}

// Lazy loader utility for external scripts/styles
function loadScriptOnce(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve()
        const s = document.createElement('script')
        s.src = src
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
    })
}

function loadCssOnce(href: string): void {
    if (document.querySelector(`link[href="${href}"]`)) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = href
    document.head.appendChild(l)
}

function KaTeXViewer({ payload }: { payload: ArtifactPayload }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function run() {
            try {
                loadCssOnce('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css')
                await loadScriptOnce('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js')
                
                // Wait for katex to be available
                let attempts = 0
                while (!(window as any).katex && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100))
                    attempts++
                }
                
                
                const katex = (window as any).katex
                if (!katex) throw new Error('KaTeX not available')
                if (cancelled) return
                if (containerRef.current) {
                    containerRef.current.innerHTML = ''
                    const latex = payload.katexCode || payload.text || payload.code || ''
                    katex.render(latex, containerRef.current, {
                        throwOnError: false,
                        strict: 'warn',
                        displayMode: true // Render as block/display math
                    })
                }
            } catch (e: any) {
                setError(e?.message || 'KaTeX render error')
            }
        }
        run()
        return () => { cancelled = true }
    }, [payload])

    return (
        <div className="flex items-center justify-center min-h-full p-8 bg-gradient-to-br from-white/5 to-transparent overflow-hidden">
            {error && (
                <div className="text-red-400 text-sm mb-4 p-4 bg-red-900/20 rounded-lg border border-red-500/30">
                    <strong>Error:</strong> {error}
                </div>
            )}
            <div 
                ref={containerRef} 
                className="text-foreground text-center w-full"
                style={{ fontSize: '1.2em' }}
            />
        </div>
    )
}

function MermaidViewer({ payload }: { payload: ArtifactPayload }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function run() {
            try {
                await loadScriptOnce('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js')
                
                // Wait for mermaid to be available
                let attempts = 0
                while (!(window as any).mermaid && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100))
                    attempts++
                }
                
                
                const mermaid = (window as any).mermaid
                if (!mermaid) throw new Error('Mermaid not available')
                mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' })
                if (cancelled) return
                const def = payload.mermaidCode || payload.text || payload.code || ''
                const id = 'mmd-' + Math.random().toString(36).slice(2)
                const res = await mermaid.render(id, def)
                if (containerRef.current) containerRef.current.innerHTML = res.svg
            } catch (e: any) {
                setError(e?.message || 'Mermaid render error')
            }
        }
        run()
        return () => { cancelled = true }
    }, [payload])

    return (
        <div className="flex items-center justify-center min-h-full p-8 bg-gradient-to-br from-white/5 to-transparent">
            {error && (
                <div className="text-red-400 text-sm mb-4 p-4 bg-red-900/20 rounded-lg border border-red-500/30">
                    <strong>Error:</strong> {error}
                </div>
            )}
            <div ref={containerRef} className="max-w-full overflow-auto" />
        </div>
    )
}

function PythonViewer({ payload }: { payload: ArtifactPayload }) {
    const [stdout, setStdout] = useState<string>('')
    const [stderr, setStderr] = useState<string>('')
    const [running, setRunning] = useState(false)
    const [loadingRuntime, setLoadingRuntime] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const killedRef = useRef(false)

    const loadRuntime = async () => {
        setLoadingRuntime(true)
        try {
            await loadScriptOnce('https://cdn.jsdelivr.net/pyodide/v0.26.3/full/pyodide.js')
            
            // Wait for loadPyodide to be available
            let attempts = 0
            while (!(window as any).loadPyodide && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100))
                attempts++
            }
            
            
            const loadPyodide = (window as any).loadPyodide as (opts?: any) => Promise<any>
            if (!loadPyodide) throw new Error('Pyodide loader not available')
            
            if (!(window as any).__pyodideInstance) {
                
                ;(window as any).__pyodideInstance = await loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.3/full/',
                    stdout: (msg: string) => { if (!killedRef.current) setStdout(prev => prev + msg + '\n') },
                    stderr: (msg: string) => { if (!killedRef.current) setStderr(prev => prev + msg + '\n') }
                })
            }
        } finally {
            setLoadingRuntime(false)
        }
    }

    const runCode = async () => {
        setError(null)
        setStdout('')
        setStderr('')
        killedRef.current = false
        setRunning(true)
        try {
            await loadRuntime()
            
            const pyodide = (window as any).__pyodideInstance
            const code = payload.pythonCode || payload.code || payload.text || ''
            if (!code) {
                setError('No Python code provided')
                return
            }
            if (payload.deps && payload.deps.length > 0) {
                await pyodide.loadPackage('micropip')
                const micropip = pyodide.pyimport('micropip')
                for (const dep of payload.deps) {
                    if (killedRef.current) return
                    try { await micropip.install(dep) } catch { setStderr(prev => prev + `micropip: failed ${dep}\n`) }
                }
            }
            const timeoutMs = 5000
            let timedOut = false
            const to = setTimeout(() => { if (!killedRef.current) { timedOut = true; setStderr(prev => prev + 'Execution timed out\n') } }, timeoutMs)
            try {
                await pyodide.runPythonAsync(code)
            } finally {
                clearTimeout(to)
            }
            if (timedOut) setError('Timed out')
        } catch (e: any) {
            if (!killedRef.current) {
                const errorMsg = e?.message || 'Pyodide error'
                // Check for common input() error
                if (errorMsg.includes('I/O error') || errorMsg.includes('input')) {
                    setError('Code uses input() which is not supported in browser Python. Use print() for output only.')
                } else {
                    setError(errorMsg)
                }
            }
        } finally {
            setRunning(false)
        }
    }

    const stopRun = () => {
        killedRef.current = true
        setError('Stopped')
        setRunning(false)
    }

    const resetRuntime = () => {
        // Drop the singleton so next run reloads a fresh interpreter
        
        ;(window as any).__pyodideInstance = null
        setStdout('')
        setStderr('')
        setError(null)
    }

    useEffect(() => {
        runCode()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payload.pythonCode])

    const code = payload.pythonCode || payload.code || payload.text || ''

    // Syntax highlighting
    const highlightedCode = useMemo(() => {
        if (!code) return ''
        try {
            return hljs.highlight(code, { language: 'python', ignoreIllegals: true }).value
        } catch {
            return code
        }
    }, [code])

    return (
        <div className="flex flex-col h-full">
            {/* Controls */}
            <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-white/5">
                <button
                    disabled={running || loadingRuntime}
                    onClick={runCode}
                    className="px-3 py-1.5 rounded-md text-xs bg-cyan-500/90 text-white border border-cyan-500/40 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >{loadingRuntime ? 'Loading Pyodide…' : 'Run'}</button>
                <button
                    disabled={!running}
                    onClick={stopRun}
                    className="px-3 py-1.5 rounded-md text-xs bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >Stop</button>
                <button
                    disabled={running}
                    onClick={resetRuntime}
                    className="px-3 py-1.5 rounded-md text-xs bg-white/10 text-foreground border border-white/20 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >Reset</button>
                {running && <span className="text-xs text-yellow-400 animate-pulse">● Running…</span>}
                {loadingRuntime && <span className="text-xs text-cyan-400 animate-pulse">Loading runtime…</span>}
            </div>

            {/* Error banner */}
            {error && (
                <div className="px-3 py-2 bg-red-900/30 border-b border-red-500/30 text-red-300 text-xs">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-3 space-y-3">
                {/* Code display with syntax highlighting */}
                <div className="rounded-md border border-white/10 bg-black/40 overflow-hidden">
                    <div className="px-3 py-1.5 text-xs font-medium text-cyan-400 border-b border-white/10 bg-white/5">
                        Python Code
                    </div>
                    <pre className="p-3 text-sm overflow-x-auto">
                        <code 
                            className="hljs language-python text-foreground/90 font-mono"
                            dangerouslySetInnerHTML={{ __html: highlightedCode }}
                        />
                    </pre>
                </div>

                {/* Output panels */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-md border border-white/10 bg-black/40">
                        <div className="px-3 py-1.5 text-xs font-medium text-green-400 border-b border-white/10 bg-white/5">
                            stdout
                        </div>
                        <pre className="p-3 text-sm whitespace-pre-wrap break-words text-green-300/90 font-mono min-h-[100px]">
                            {stdout || '(no output)'}
                        </pre>
                    </div>
                    <div className="rounded-md border border-white/10 bg-black/40">
                        <div className="px-3 py-1.5 text-xs font-medium text-red-400 border-b border-white/10 bg-white/5">
                            stderr
                        </div>
                        <pre className="p-3 text-sm whitespace-pre-wrap break-words text-red-300/90 font-mono min-h-[100px]">
                            {stderr || '(no errors)'}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function ArtifactViewer({ artifact }: { artifact: Artifact }) {
    if (artifact.kind === 'html') return <HTMLViewer payload={artifact.payload} />
    if (artifact.kind === 'python') return <PythonViewer payload={artifact.payload} />
    if (artifact.kind === 'mermaid') return <MermaidViewer payload={artifact.payload} />
    if (artifact.kind === 'katex') return <KaTeXViewer payload={artifact.payload} />
    return <div className="p-4 text-sm text-muted-foreground">Unsupported artifact type.</div>
}


