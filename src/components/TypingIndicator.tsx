import { ShimmerText } from './ShimmerText'

interface TypingIndicatorProps {
    isThinking?: boolean
}

export function TypingIndicator({ isThinking = false }: TypingIndicatorProps) {
    return (
        <div className="group relative py-6 bg-transparent animate-fade-in">
            <div className="max-w-3xl mx-auto px-6">
                {/* Role Label */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-foreground border border-white/10">
                        <span className="text-xs font-medium">AI</span>
                    </div>
                    <span className="text-sm font-medium">Assistant</span>
                </div>

                {/* Shimmer Animation */}
                <div className="pl-9">
                    <div className="text-[15px] leading-7 text-muted-foreground/70">
                        <ShimmerText text={isThinking ? 'Thinking...' : 'Generating response...'} />
                    </div>
                </div>
            </div>
        </div>
    )
}