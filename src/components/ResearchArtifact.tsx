import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileCode2, Download, Eye, X, Loader2 } from 'lucide-react'

interface ResearchArtifactProps {
    artifactHtml: string
    title?: string
    onOpenSplit?: (html: string, title?: string) => void
}

export function ResearchArtifact({ artifactHtml, title = 'Research Report', onOpenSplit }: ResearchArtifactProps) {
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)

    // Prevent body scroll when side panel is open
    useEffect(() => {
        if (isSidePanelOpen) {
            document.body.style.overflow = 'hidden'
            document.body.style.height = '100vh'
        } else {
            document.body.style.overflow = ''
            document.body.style.height = ''
        }

        return () => {
            document.body.style.overflow = ''
            document.body.style.height = ''
        }
    }, [isSidePanelOpen])

    // Close on Escape key
    useEffect(() => {
        if (!isSidePanelOpen) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsSidePanelOpen(false)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [isSidePanelOpen])

    const sanitizeFilename = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50)
    }

    const handleDownload = () => {
        setIsDownloading(true)
        try {
            const blob = new Blob([artifactHtml], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `research-${sanitizeFilename(title)}-${Date.now()}.html`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Download failed:', error)
        } finally {
            setTimeout(() => setIsDownloading(false), 1000)
        }
    }

    const estimatedSize = Math.round(new Blob([artifactHtml]).size / 1024)

    return (
        <>
            {/* Artifact Card */}
            <div className="
                p-4 rounded-xl
                bg-gradient-to-br from-cyan-500/[0.08] to-white/[0.03]
                backdrop-blur-xl backdrop-saturate-150
                border border-cyan-500/20
                shadow-[0_4px_16px_rgba(34,211,238,0.1)]
                animate-fade-in
            ">
                <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="
                        w-12 h-12 rounded-lg flex-shrink-0
                        bg-gradient-to-br from-cyan-500/20 to-cyan-500/10
                        border border-cyan-500/30
                        flex items-center justify-center
                    ">
                        <FileCode2 className="w-6 h-6 text-cyan-400" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground mb-1">
                            Interactive Visualization <span className="text-xs text-muted-foreground/60">(Beta)</span>
                        </h4>
                        <p className="text-xs text-muted-foreground/70 mb-3">
                            Complete HTML document with embedded styles and interactivity • {estimatedSize} KB
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (onOpenSplit) {
                                        onOpenSplit(artifactHtml, title)
                                    } else {
                                        setIsSidePanelOpen(true)
                                    }
                                }}
                                className="
                                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                                    bg-cyan-500/15 border border-cyan-500/30 text-cyan-400
                                    hover:bg-cyan-500/25 hover:border-cyan-500/40
                                    transition-all duration-200
                                "
                            >
                                <Eye className="w-3.5 h-3.5" />
                                View Artifact
                            </button>
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="
                                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                                    bg-white/5 border border-white/10 text-foreground/80
                                    hover:bg-white/10 hover:border-white/20
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-all duration-200
                                "
                            >
                                {isDownloading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Download className="w-3.5 h-3.5" />
                                )}
                                {isDownloading ? 'Downloading...' : 'Download HTML'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Backdrop + Side Panel Portal */}
            {isSidePanelOpen && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'row'
                    }}
                >
                    {/* Left Backdrop - 50% */}
                    <div
                        onClick={() => setIsSidePanelOpen(false)}
                        style={{
                            width: '50vw',
                            height: '100vh',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(4px)',
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                    />

                    {/* Right Panel - 50% */}
                    <div
                        style={{
                            width: '50vw',
                            height: '100vh',
                            backgroundColor: '#0a0a0a',
                            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            flexShrink: 0
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            style={{
                                height: '56px',
                                padding: '0 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.05), transparent)',
                                flexShrink: 0
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileCode2 className="w-4 h-4 text-cyan-400" />
                                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e5e5e5' }}>
                                    {title}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#a3a3a3',
                                        cursor: isDownloading ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Download HTML"
                                    onMouseEnter={(e) => {
                                        if (!isDownloading) {
                                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                                            e.currentTarget.style.color = '#e5e5e5'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent'
                                        e.currentTarget.style.color = '#a3a3a3'
                                    }}
                                >
                                    {isDownloading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsSidePanelOpen(false)}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#a3a3a3',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                                        e.currentTarget.style.color = '#e5e5e5'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent'
                                        e.currentTarget.style.color = '#a3a3a3'
                                    }}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Iframe Container */}
                        <div
                            style={{
                                flex: 1,
                                overflow: 'hidden',
                                position: 'relative',
                                isolation: 'isolate'
                            }}
                        >
                            <iframe
                                srcDoc={artifactHtml}
                                sandbox="allow-scripts"
                                title="Research Artifact"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                    display: 'block',
                                    margin: 0,
                                    padding: 0,
                                    backgroundColor: '#0a0a0a'
                                }}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}

