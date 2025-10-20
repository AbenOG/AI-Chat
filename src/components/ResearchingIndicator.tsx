import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { ShimmerText } from './ShimmerText'
import type { ResearchProgress } from '@/types'

interface ResearchingIndicatorProps {
    progress: ResearchProgress
    startTime?: number
}

export function ResearchingIndicator({ progress, startTime = Date.now() }: ResearchingIndicatorProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [fadeKey, setFadeKey] = useState(0)

    // Update elapsed time every second
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)

        return () => clearInterval(interval)
    }, [startTime])

    // Trigger fade animation when progress updates
    useEffect(() => {
        setFadeKey(prev => prev + 1)
    }, [progress.status, progress.findings])

    // Format elapsed time as MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="space-y-2">
                {/* Main shimmer status with loading indicator and timer */}
                <div
                    key={fadeKey}
                    className="flex items-center gap-3 animate-fade-in"
                    style={{ animation: 'fadeInBlur 0.4s ease-out' }}
                >
                    <ShimmerText text={progress.status} />

                    {/* Timer */}
                    <span className="text-xs text-muted-foreground/60 font-mono ml-auto">
                        {formatTime(elapsedTime)}
                    </span>

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="
                            p-1 rounded-md
                            text-muted-foreground/60 hover:text-foreground/80
                            hover:bg-white/5
                            transition-all duration-200
                            flex-shrink-0
                        "
                        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                        {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                    </button>
                </div>

                {/* Expandable details */}
                {isExpanded && (
                    <div className="
                        pl-4 space-y-1 text-sm text-muted-foreground/70
                        animate-fade-in
                        border-l-2 border-white/10
                    ">
                        {progress.findings.map((finding, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-2 animate-fade-in"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <span className="text-muted-foreground/40 mt-1">•</span>
                                <span>{finding}</span>
                            </div>
                        ))}
                        <div className="pt-2 text-xs text-muted-foreground/50 flex items-center gap-2">
                            <span>Progress: {progress.progress}%</span>
                            <Loader2 className="w-3 h-3 text-muted-foreground/50 animate-spin" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

