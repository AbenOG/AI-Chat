import { useState } from 'react'
import { Check, X, HelpCircle } from 'lucide-react'

interface QuizOption {
    text: string
    isCorrect: boolean
    explanation?: string
}

interface StudyQuizProps {
    question: string
    options: QuizOption[]
    multiSelect?: boolean
    quizKey?: string
    initialState?: {
        selectedIndices: number[]
        hasSubmitted: boolean
        showExplanation: boolean
    }
    onStateChange?: (state: {
        selectedIndices: number[]
        hasSubmitted: boolean
        showExplanation: boolean
    }) => void
}

export function StudyQuiz({ question, options, multiSelect = false, initialState, onStateChange }: StudyQuizProps) {
    const [selectedIndices, setSelectedIndices] = useState<number[]>(initialState?.selectedIndices || [])
    const [hasSubmitted, setHasSubmitted] = useState(initialState?.hasSubmitted || false)
    const [showExplanation, setShowExplanation] = useState(initialState?.showExplanation || false)

    const handleOptionClick = (index: number) => {
        if (hasSubmitted) return

        const newIndices = multiSelect
            ? (selectedIndices.includes(index)
                ? selectedIndices.filter(i => i !== index)
                : [...selectedIndices, index])
            : [index]
        
        setSelectedIndices(newIndices)
        onStateChange?.({
            selectedIndices: newIndices,
            hasSubmitted,
            showExplanation
        })
    }

    const handleSubmit = () => {
        if (selectedIndices.length === 0) return
        setHasSubmitted(true)
        setShowExplanation(true)
        onStateChange?.({
            selectedIndices,
            hasSubmitted: true,
            showExplanation: true
        })
    }

    const handleReset = () => {
        setSelectedIndices([])
        setHasSubmitted(false)
        setShowExplanation(false)
        onStateChange?.({
            selectedIndices: [],
            hasSubmitted: false,
            showExplanation: false
        })
    }

    const isCorrect = () => {
        const correctIndices = options
            .map((opt, idx) => (opt.isCorrect ? idx : -1))
            .filter(idx => idx !== -1)
        
        return (
            selectedIndices.length === correctIndices.length &&
            selectedIndices.every(idx => correctIndices.includes(idx))
        )
    }

    const getOptionStatus = (index: number) => {
        if (!hasSubmitted) return 'default'
        if (options[index].isCorrect) return 'correct'
        if (selectedIndices.includes(index) && !options[index].isCorrect) return 'incorrect'
        return 'default'
    }

    return (
        <div className="my-6 p-5 rounded-xl border border-purple-500/30 bg-purple-500/5 backdrop-blur-sm overflow-hidden">
            {/* Question Header */}
            <div className="flex items-start gap-3 mb-4">
                <HelpCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <h4 className="text-base font-semibold text-purple-100 mb-1">
                        Quick Check
                    </h4>
                    <p className="text-sm text-purple-100/90 leading-relaxed break-words">
                        {question}
                    </p>
                    {multiSelect && (
                        <p className="text-xs text-purple-300/70 mt-2 italic">
                            (Select all that apply)
                        </p>
                    )}
                </div>
            </div>

            {/* Options */}
            <div className="space-y-2 mb-4 flex flex-col">
                {options.map((option, index) => {
                    const status = getOptionStatus(index)
                    const isSelected = selectedIndices.includes(index)

                    return (
                        <button
                            key={index}
                            onClick={() => handleOptionClick(index)}
                            disabled={hasSubmitted}
                            className={`
                                w-full block text-left px-4 py-3 rounded-lg
                                border-2 transition-all duration-200
                                focus:outline-none focus:ring-2 focus:ring-purple-400/50
                                overflow-hidden
                                ${status === 'default' && !isSelected && 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30'}
                                ${status === 'default' && isSelected && 'border-purple-400/60 bg-purple-400/15'}
                                ${status === 'correct' && 'border-green-500/60 bg-green-500/15'}
                                ${status === 'incorrect' && 'border-red-500/60 bg-red-500/15'}
                                ${hasSubmitted && 'cursor-not-allowed'}
                            `}
                        >
                            <div className="flex items-start gap-3 min-w-0 w-full">
                                {/* Checkbox/Radio */}
                                <div className={`
                                    w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                                    border-2 transition-colors
                                    ${status === 'default' && !isSelected && 'border-white/40'}
                                    ${status === 'default' && isSelected && 'border-purple-400 bg-purple-400'}
                                    ${status === 'correct' && 'border-green-500 bg-green-500'}
                                    ${status === 'incorrect' && 'border-red-500 bg-red-500'}
                                `}>
                                    {hasSubmitted && status === 'correct' && (
                                        <Check className="w-3 h-3 text-white" />
                                    )}
                                    {hasSubmitted && status === 'incorrect' && (
                                        <X className="w-3 h-3 text-white" />
                                    )}
                                    {!hasSubmitted && isSelected && (
                                        <Check className="w-3 h-3 text-white" />
                                    )}
                                </div>

                                {/* Option Text */}
                                <span className={`
                                    text-sm flex-1 break-words overflow-wrap-anywhere min-w-0 whitespace-normal
                                    ${status === 'default' && 'text-white/90'}
                                    ${status === 'correct' && 'text-green-100 font-medium'}
                                    ${status === 'incorrect' && 'text-red-100'}
                                `}>
                                    {option.text}
                                </span>
                            </div>

                            {/* Explanation */}
                            {hasSubmitted && showExplanation && option.explanation && (
                                <div className="mt-2 pt-2 border-t border-white/10">
                                    <p className="text-xs text-white/70 italic break-words">
                                        {option.explanation}
                                    </p>
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                {!hasSubmitted ? (
                    <button
                        onClick={handleSubmit}
                        disabled={selectedIndices.length === 0}
                        className="
                            px-4 py-2 rounded-lg text-sm font-medium
                            bg-purple-500/20 hover:bg-purple-500/30
                            border border-purple-400/40
                            text-purple-100
                            transition-all duration-200
                            disabled:opacity-50 disabled:cursor-not-allowed
                            focus:outline-none focus:ring-2 focus:ring-purple-400/50
                        "
                    >
                        Check Answer
                    </button>
                ) : (
                    <>
                        {/* Result Badge */}
                        <div className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                            ${isCorrect() 
                                ? 'bg-green-500/20 border border-green-400/40 text-green-100' 
                                : 'bg-orange-500/20 border border-orange-400/40 text-orange-100'
                            }
                        `}>
                            {isCorrect() ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Correct! Well done! 🎉</span>
                                </>
                            ) : (
                                <>
                                    <X className="w-4 h-4" />
                                    <span>Not quite - try again!</span>
                                </>
                            )}
                        </div>

                        {/* Try Again Button */}
                        <button
                            onClick={handleReset}
                            className="
                                px-4 py-2 rounded-lg text-sm font-medium
                                bg-white/10 hover:bg-white/15
                                border border-white/20
                                text-white/90
                                transition-all duration-200
                                focus:outline-none focus:ring-2 focus:ring-white/30
                            "
                        >
                            Try Again
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

