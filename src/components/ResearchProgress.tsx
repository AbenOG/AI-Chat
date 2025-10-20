import { Search, Lightbulb, FileSearch, LineChart, FileCheck, Check } from 'lucide-react'
import type { ResearchProgress as ResearchProgressType } from '@/types'

interface ResearchProgressProps {
    progress: ResearchProgressType
}

const phaseConfig = {
    clarification: {
        icon: Lightbulb,
        title: 'Understanding Request',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20'
    },
    planning: {
        icon: FileSearch,
        title: 'Planning Research',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/20'
    },
    searching: {
        icon: Search,
        title: 'Searching Sources',
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/20'
    },
    analysis: {
        icon: LineChart,
        title: 'Analyzing Information',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20'
    },
    compilation: {
        icon: FileCheck,
        title: 'Compiling Results',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/20'
    },
    complete: {
        icon: Check,
        title: 'Complete',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/20'
    }
}

export function ResearchProgress({ progress }: ResearchProgressProps) {
    const config = phaseConfig[progress.phase]
    const Icon = config.icon

    return (
        <div className="max-w-3xl mx-auto px-6 py-4">
            <div className={`
                p-6 rounded-2xl
                bg-gradient-to-br from-white/[0.08] to-white/[0.03]
                backdrop-blur-xl backdrop-saturate-150
                border ${config.borderColor}
                shadow-[0_8px_32px_rgba(0,0,0,0.12)]
                animate-fade-in
            `}>
                {/* Phase Header */}
                <div className="flex items-center gap-4 mb-4">
                    <div className={`
                        p-3 rounded-xl
                        ${config.bgColor}
                        border ${config.borderColor}
                    `}>
                        <Icon className={`w-6 h-6 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-1">
                            {config.title}
                        </h3>
                        <p className="text-sm text-muted-foreground/80">
                            {progress.status}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground/60 mb-2">
                        <span>Progress</span>
                        <span>{progress.progress}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${config.bgColor} transition-all duration-500 ease-out`}
                            style={{ width: `${progress.progress}%` }}
                        />
                    </div>
                </div>

                {/* Findings */}
                {progress.findings.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Recent Activity
                        </h4>
                        <div className="space-y-1">
                            {progress.findings.slice(-3).map((finding, index) => (
                                <div
                                    key={index}
                                    className="flex items-start gap-2 text-sm text-foreground/80 animate-fade-in"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <span className="text-muted-foreground/40 mt-1">•</span>
                                    <span>{finding}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Spinner */}
                {progress.phase !== 'complete' && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/60">
                        <div className="w-4 h-4 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
                        <span>This may take 1-5 minutes...</span>
                    </div>
                )}
            </div>
        </div>
    )
}

