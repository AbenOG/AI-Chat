import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, ExternalLink, Check } from 'lucide-react'
import { MarkdownContent } from './MarkdownContent'
import { ResearchArtifact } from './ResearchArtifact'

interface ResearchSection {
    id: string
    title: string
    content: string
    subsections?: Array<{ id: string; title: string; content: string }>
}

interface ResearchOutputProps {
    content: string
    sources?: Array<{ title: string; url: string }>
    durationSeconds?: number
    artifactHtml?: string
}

export function ResearchOutput({ content, sources = [], durationSeconds, artifactHtml }: ResearchOutputProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']))
    const [copiedSection, setCopiedSection] = useState<string | null>(null)

    // Format duration
    const formatDuration = (seconds?: number) => {
        if (!seconds) return ''
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        if (mins > 0) {
            return `${mins}m ${secs}s`
        }
        return `${secs}s`
    }

    // Extract title from content
    const titleMatch = content.match(/^#\s+(.+)$/m)
    const researchTitle = titleMatch ? titleMatch[1] : 'Research Report'

    // Parse content into sections with improved extraction
    const extractSection = (sectionName: string): string => {
        const regex = new RegExp(`##\\s+${sectionName}([\\s\\S]*?)(?=##\\s+|$)`, 'i')
        const match = content.match(regex)
        return match ? match[1].trim() : ''
    }

    // Extract all sections
    const summaryContent = extractSection('Executive Summary') || content.slice(0, 500)
    const methodologyContent = extractSection('Methodology') || 'Research conducted using web sources and analysis.'
    const findingsContent = extractSection('Key Findings') || extractSection('Findings') || extractSection('Results') || content

    const sections: ResearchSection[] = [
        {
            id: 'summary',
            title: 'Executive Summary',
            content: summaryContent
        },
        {
            id: 'methodology',
            title: 'Methodology',
            content: methodologyContent
        },
        {
            id: 'findings',
            title: 'Key Findings',
            content: findingsContent
        },
        {
            id: 'sources',
            title: 'Sources & References',
            content: '' // Will be rendered separately
        },
        ...(artifactHtml ? [{
            id: 'artifact',
            title: 'Interactive Visualization',
            content: '' // Will be rendered separately
        }] : [])
    ]

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev)
            if (next.has(sectionId)) {
                next.delete(sectionId)
            } else {
                next.add(sectionId)
            }
            return next
        })
    }

    const copySection = async (sectionId: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content)
            setCopiedSection(sectionId)
            setTimeout(() => setCopiedSection(null), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    return (
        <div className="space-y-3">
            {/* Research Duration Badge */}
            {durationSeconds && (
                <div className="flex justify-end mb-2">
                    <span className="text-xs text-muted-foreground/60 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                        Research completed in {formatDuration(durationSeconds)}
                    </span>
                </div>
            )}

            {sections.map((section, index) => {
                const isExpanded = expandedSections.has(section.id)
                const isCopied = copiedSection === section.id

                return (
                    <div
                        key={section.id}
                        className="
                            rounded-xl overflow-hidden
                            bg-gradient-to-br from-white/[0.08] to-white/[0.03]
                            backdrop-blur-xl backdrop-saturate-150
                            border border-white/10
                            shadow-[0_4px_16px_rgba(0,0,0,0.08)]
                            animate-fade-in
                        "
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        {/* Section Header */}
                        <button
                            onClick={() => toggleSection(section.id)}
                            className="
                                w-full flex items-center justify-between
                                px-5 py-4
                                hover:bg-white/[0.05]
                                transition-all duration-200
                            "
                        >
                            <div className="flex items-center gap-3">
                                {isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-foreground/60" />
                                ) : (
                                    <ChevronRight className="w-5 h-5 text-foreground/60" />
                                )}
                                <h3 className="text-base font-semibold text-foreground">
                                    {section.title}
                                </h3>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    copySection(section.id, section.content)
                                }}
                                className="
                                    p-2 rounded-lg
                                    hover:bg-white/10
                                    text-muted-foreground hover:text-foreground
                                    transition-all duration-200
                                "
                                title="Copy section"
                            >
                                {isCopied ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        </button>

                        {/* Section Content */}
                        {isExpanded && (
                            <div className="
                                px-5 pb-5 pt-0
                                border-t border-white/5
                                animate-fade-in
                            ">
                                <div className="prose prose-invert max-w-none">
                                    {section.id === 'sources' && sources.length > 0 ? (
                                        <div className="space-y-3 mt-4">
                                            {sources.map((source, idx) => (
                                                <a
                                                    key={idx}
                                                    href={source.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="
                                                        flex items-start gap-3 p-3 rounded-lg
                                                        bg-white/[0.05] border border-white/10
                                                        hover:bg-white/[0.08] hover:border-white/20
                                                        transition-all duration-200
                                                        group
                                                    "
                                                >
                                                    <span className="text-muted-foreground/60 text-sm mt-0.5">
                                                        {idx + 1}.
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm text-foreground group-hover:text-white transition-colors">
                                                            {source.title}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
                                                            {source.url}
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 mt-0.5" />
                                                </a>
                                            ))}
                                        </div>
                                    ) : section.id === 'artifact' && artifactHtml ? (
                                        <div className="mt-4">
                                            <ResearchArtifact
                                                artifactHtml={artifactHtml}
                                                title={researchTitle}
                                            />
                                        </div>
                                    ) : (
                                        <div className="mt-4">
                                            <MarkdownContent content={section.content} deferHighlight={false} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

