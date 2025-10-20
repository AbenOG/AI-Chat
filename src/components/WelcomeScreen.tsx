import { useState, useEffect } from 'react'
import { Sparkles, Code, Lightbulb, MessageSquare, EyeOff } from 'lucide-react'
import LiquidEther from '@/components/LiquidEther'

interface WelcomeScreenProps {
    onSuggestionClick: (suggestion: string) => void
    isIncognito?: boolean
    onToggleIncognito?: () => void
}

const suggestions = [
    {
        icon: Code,
        title: 'Write code',
        description: 'Create a React component',
        prompt: 'Create a modern React component with TypeScript'
    },
    {
        icon: Lightbulb,
        title: 'Get ideas',
        description: 'Brainstorm new features',
        prompt: 'Help me brainstorm features for my app'
    },
    {
        icon: MessageSquare,
        title: 'Explain',
        description: 'Understand concepts',
        prompt: 'Explain how React hooks work'
    },
    {
        icon: Sparkles,
        title: 'Create',
        description: 'Generate content',
        prompt: 'Help me write a blog post introduction'
    }
]

export function WelcomeScreen({ onSuggestionClick, isIncognito = false, onToggleIncognito }: WelcomeScreenProps) {
    const [displayedText, setDisplayedText] = useState('')
    const [showSubtitle, setShowSubtitle] = useState(false)
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
    const fullText = 'How can I help you today?'

    useEffect(() => {
        let currentIndex = 0
        const typingSpeed = 50 // ms per character

        const typeWriter = setInterval(() => {
            if (currentIndex <= fullText.length) {
                setDisplayedText(fullText.slice(0, currentIndex))
                currentIndex++
            } else {
                clearInterval(typeWriter)
                setShowSubtitle(true)
            }
        }, typingSpeed)

        return () => clearInterval(typeWriter)
    }, [])

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        setMousePosition({ x, y })
    }

    return (
        <div className="relative flex items-center justify-center h-full w-full px-6 py-16">

            <div className="relative z-10 w-full max-w-2xl mx-auto">
                {/* Hero Section */}
                <div className="text-center mb-16 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-foreground typewriter-text">
                        {displayedText}
                        <span className="typewriter-cursor">|</span>
                    </h1>

                    <p className={`
                        text-base text-muted-foreground/70 max-w-md mx-auto
                        transition-all duration-700
                        ${showSubtitle ? 'opacity-100 blur-0' : 'opacity-0 blur-md'}
                    `}>
                        Ask me anything, from writing code to brainstorming ideas
                    </p>

                    {/* Incognito Toggle */}
                    {onToggleIncognito && (
                        <div className={`
                            flex justify-center mt-6
                            transition-all duration-1000 delay-500
                            ${showSubtitle ? 'opacity-100 blur-0 translate-y-0' : 'opacity-0 blur-sm translate-y-4'}
                        `}>
                            <button
                                onClick={onToggleIncognito}
                                className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-xl
                                    backdrop-blur-xl backdrop-saturate-150
                                    border
                                    font-medium text-sm
                                    shadow-[0_4px_16px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.3)_inset]
                                    transition-all duration-300
                                    ${isIncognito
                                        ? 'bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-purple-500/30 text-purple-400 shadow-[0_4px_16px_rgba(168,85,247,0.2)]'
                                        : 'bg-gradient-to-br from-white/[0.12] to-white/[0.06] border-white/20 text-foreground/80 hover:from-white/[0.18] hover:to-white/[0.10] hover:border-white/30'
                                    }
                                `}
                                title={isIncognito ? "Incognito mode enabled - messages won't be saved" : "Enable incognito mode"}
                            >
                                <EyeOff className="w-4 h-4" />
                                <span>{isIncognito ? 'Incognito Mode' : 'Enable Incognito'}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Suggestion Cards */}
                <div className={`
                    grid grid-cols-1 md:grid-cols-2 gap-3 mb-12
                    transition-all duration-1000 delay-300
                    ${showSubtitle ? 'opacity-100 blur-0 translate-y-0' : 'opacity-0 blur-sm translate-y-4'}
                `}>
                    {suggestions.map((suggestion, index) => {
                        const Icon = suggestion.icon
                        return (
                            <button
                                key={index}
                                onClick={() => onSuggestionClick(suggestion.prompt)}
                                onMouseMove={handleMouseMove}
                                className="
                                    group relative p-4 rounded-2xl overflow-hidden
                                    bg-gradient-to-br from-white/[0.12] to-white/[0.06]
                                    backdrop-blur-xl backdrop-saturate-150
                                    border border-white/20
                                    hover:from-white/[0.18] hover:to-white/[0.10] hover:border-white/30
                                    shadow-[0_4px_16px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.3)_inset]
                                    hover:shadow-[0_8px_24px_rgba(0,0,0,0.15),0_0_2px_rgba(255,255,255,0.4)_inset]
                                    transition-all duration-200
                                    text-left
                                    focus:outline-none focus:ring-2 focus:ring-white/40
                                "
                                style={{
                                    transitionDelay: `${(index + 1) * 100}ms`,
                                    animationDelay: `${(index + 1) * 100}ms`
                                }}
                            >
                                {/* Shiny gradient overlay */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                    style={{
                                        background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.15), transparent 40%)`
                                    }}
                                />

                                {/* Subtle shine gradient */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent opacity-60 pointer-events-none" />

                                <div className="flex items-start gap-3 relative z-10">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-white/[0.15] to-white/[0.08] backdrop-blur-xl border border-white/20 flex items-center justify-center group-hover:from-white/[0.25] group-hover:to-white/[0.15] group-hover:border-white/30 transition-all">
                                        <Icon className="w-5 h-5 text-foreground" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-foreground text-sm mb-1">
                                            {suggestion.title}
                                        </h3>
                                        <p className="text-xs text-muted-foreground line-clamp-1">
                                            {suggestion.description}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Footer Note */}
                <p className="text-center text-xs text-muted-foreground/60">
                    AI can make mistakes. Please verify important information.
                </p>
            </div>
        </div>
    )
}

