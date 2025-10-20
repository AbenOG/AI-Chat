import { useState } from 'react'
import { FileCode2, Maximize2, Download } from 'lucide-react'
import type { Artifact } from '@/types'

interface ArtifactCardProps {
    artifact: Artifact
    onOpenSplit?: (artifact: Artifact) => void
}

export function ArtifactCard({ artifact, onOpenSplit }: ArtifactCardProps) {
    const [downloading, setDownloading] = useState(false)

    const canDownloadHtml = artifact.kind === 'html' && (!!artifact.payload.htmlDoc || !!artifact.payload.html)

    const handleDownload = () => {
        if (!canDownloadHtml) return
        setDownloading(true)
        try {
            const htmlDoc = artifact.payload.htmlDoc || `<!doctype html><html><head><meta charset="utf-8"/>${artifact.payload.css ? `<style>${artifact.payload.css}</style>` : ''}</head><body>${artifact.payload.html || ''}${artifact.payload.js ? `<script>${artifact.payload.js}</script>` : ''}</body></html>`
            const blob = new Blob([htmlDoc], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${artifact.title || 'artifact'}.html`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } finally {
            setTimeout(() => setDownloading(false), 500)
        }
    }

    return (
        <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.12] to-white/[0.06] backdrop-blur-xl border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.1)] animate-fade-in">
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-gradient-to-br from-white/20 to-white/10 border border-white/30 flex items-center justify-center">
                    <FileCode2 className="w-6 h-6 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground mb-1">
                        {artifact.title || (artifact.kind === 'html' ? 'HTML Artifact' : artifact.kind.toUpperCase())}
                    </h4>
                    <p className="text-xs text-muted-foreground/70 mb-3">
                        {artifact.kind === 'python' && 'Python (Pyodide)'}
                        {artifact.kind === 'mermaid' && 'Mermaid diagram'}
                        {artifact.kind === 'katex' && 'LaTeX (KaTeX)'}
                        {artifact.kind === 'html' && 'HTML / CSS / JS'}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => onOpenSplit?.(artifact)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/15 border border-white/30 text-foreground hover:bg-white/25 transition-all duration-200"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Open
                        </button>
                        {canDownloadHtml && (
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={downloading}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-foreground/80 hover:bg-white/10 hover:border-white/20 disabled:opacity-50 transition-all duration-200"
                            >
                                <Download className="w-3.5 h-3.5" />
                                {downloading ? 'Downloading…' : 'Download HTML'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}


