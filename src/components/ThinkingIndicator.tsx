import { useState, useEffect } from 'react'
import { ShimmerText } from './ShimmerText'

interface ThinkingIndicatorProps {
    isThinking?: boolean
    duration?: number
}

const reassuranceMessages = [
    "Thinking deeply...",
    "Analyzing your question...",
    "Processing information...",
    "Just a bit longer...",
    "Almost there...",
    "Crafting the perfect response...",
    "This is taking a moment...",
    "Working on it..."
]

export function ThinkingIndicator({ isThinking = false }: ThinkingIndicatorProps) {
    const [messageIndex, setMessageIndex] = useState(0)
    const [showReassurance, setShowReassurance] = useState(false)

    useEffect(() => {
        // Start showing reassurance after 3 seconds
        const reassuranceTimer = setTimeout(() => {
            setShowReassurance(true)
        }, 3000)

        return () => clearTimeout(reassuranceTimer)
    }, [])

    useEffect(() => {
        if (!showReassurance) return

        // Cycle through messages every 4 seconds
        const interval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % reassuranceMessages.length)
        }, 4000)

        return () => clearInterval(interval)
    }, [showReassurance])

    const currentMessage = showReassurance
        ? reassuranceMessages[messageIndex]
        : isThinking
            ? "Thinking..."
            : "Generating response..."

    return (
        <div className="group relative py-6 bg-transparent animate-fade-in">
            <div className="max-w-3xl mx-auto px-6">
                {/* Shimmer Animation */}
                <div>
                    <div className="text-[15px] leading-7 text-muted-foreground/70">
                        <ShimmerText text={currentMessage} />
                    </div>

                    {/* Reassurance hint */}
                    {showReassurance && (
                        <div className="text-xs text-muted-foreground/50 mt-2 animate-fade-in">
                            This might take a moment for complex queries...
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

