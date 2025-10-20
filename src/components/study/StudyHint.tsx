import { useState } from 'react'
import { ChevronDown, Lightbulb } from 'lucide-react'

interface StudyHintProps {
    content: string
    level?: 1 | 2 | 3 // Hint difficulty level
}

export function StudyHint({ content, level = 1 }: StudyHintProps) {
    const [isRevealed, setIsRevealed] = useState(false)

    const getLevelInfo = () => {
        switch (level) {
            case 1:
                return { label: 'Small Hint', color: 'yellow' }
            case 2:
                return { label: 'Bigger Hint', color: 'orange' }
            case 3:
                return { label: 'Major Hint', color: 'red' }
        }
    }

    const { label, color } = getLevelInfo()

    return (
        <div className="my-4">
            <button
                onClick={() => setIsRevealed(!isRevealed)}
                className={`
                    w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg
                    border-2 border-dashed transition-all duration-300
                    ${isRevealed 
                        ? `border-${color}-500/50 bg-${color}-500/10` 
                        : 'border-white/20 bg-white/5 hover:bg-white/10'
                    }
                    focus:outline-none focus:ring-2 focus:ring-${color}-400/50
                `}
                aria-expanded={isRevealed}
            >
                <div className="flex items-center gap-2">
                    <Lightbulb className={`w-4 h-4 ${isRevealed ? `text-${color}-400` : 'text-white/60'}`} />
                    <span className={`text-sm font-medium ${isRevealed ? `text-${color}-100` : 'text-white/80'}`}>
                        {isRevealed ? 'Hide Hint' : `💡 Need a ${label}? Click to reveal`}
                    </span>
                </div>
                <ChevronDown 
                    className={`w-4 h-4 transition-transform duration-300 ${isRevealed ? 'rotate-180' : ''} ${isRevealed ? `text-${color}-400` : 'text-white/60'}`}
                />
            </button>
            
            {isRevealed && (
                <div 
                    className={`
                        mt-2 px-4 py-3 rounded-lg
                        border-l-4 border-${color}-500/50 bg-${color}-500/10
                        animate-in slide-in-from-top-2 fade-in duration-300
                    `}
                >
                    <p className={`text-sm text-${color}-100/90 leading-relaxed`}>
                        {content}
                    </p>
                </div>
            )}
        </div>
    )
}

