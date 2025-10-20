import { useState } from 'react'
import { ArrowRight, SkipForward } from 'lucide-react'
import type { ClarifyingQuestion } from '@/types'

interface ClarifyingQuestionsProps {
    questions: ClarifyingQuestion[]
    onSubmit: (answeredQuestions: ClarifyingQuestion[]) => void
    onSkip: () => void
}

export function ClarifyingQuestions({ questions, onSubmit, onSkip }: ClarifyingQuestionsProps) {
    const [answers, setAnswers] = useState<Record<string, string>>({})

    const handleAnswerChange = (questionId: string, answer: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }))
    }

    const handleSubmit = () => {
        const answeredQuestions = questions.map(q => ({
            ...q,
            answer: answers[q.id] || ''
        }))
        onSubmit(answeredQuestions)
    }

    const allAnswered = questions.every(q => answers[q.id]?.trim())

    return (
        <div className="max-w-3xl mx-auto px-6 py-8">
            <div className="
                p-8 rounded-2xl
                bg-gradient-to-br from-white/[0.12] to-white/[0.06]
                backdrop-blur-xl backdrop-saturate-150
                border border-white/20
                shadow-[0_8px_32px_rgba(0,0,0,0.12)]
                animate-fade-in
            ">
                {/* Header */}
                <div className="mb-6">
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                        Before we begin...
                    </h3>
                    <p className="text-sm text-muted-foreground/80">
                        To provide the best research, I have a few clarifying questions:
                    </p>
                </div>

                {/* Questions */}
                <div className="space-y-5 mb-6">
                    {questions.map((question, index) => (
                        <div
                            key={question.id}
                            className="animate-fade-in"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <label className="block mb-2">
                                <span className="text-sm font-medium text-foreground/90">
                                    {index + 1}. {question.question}
                                </span>
                            </label>

                            {question.type === 'choice' && question.options ? (
                                <div className="space-y-2">
                                    {question.options.map((option, optIndex) => (
                                        <button
                                            key={optIndex}
                                            onClick={() => handleAnswerChange(question.id, option)}
                                            className={`
                                                w-full text-left px-4 py-3 rounded-lg
                                                border transition-all duration-200
                                                ${answers[question.id] === option
                                                    ? 'bg-white/10 border-white/30 text-foreground'
                                                    : 'bg-white/[0.03] border-white/10 text-foreground/80 hover:bg-white/[0.06] hover:border-white/20'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`
                                                    w-4 h-4 rounded-full border-2 flex items-center justify-center
                                                    ${answers[question.id] === option
                                                        ? 'border-white bg-white'
                                                        : 'border-white/30'
                                                    }
                                                `}>
                                                    {answers[question.id] === option && (
                                                        <div className="w-2 h-2 rounded-full bg-background" />
                                                    )}
                                                </div>
                                                <span className="text-sm">{option}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <textarea
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    className="
                                        w-full px-4 py-3 rounded-lg
                                        bg-white/[0.04] border border-white/10
                                        text-foreground placeholder:text-muted-foreground/40
                                        focus:outline-none focus:border-white/30 focus:bg-white/[0.06]
                                        transition-all duration-200
                                        resize-none
                                    "
                                    rows={3}
                                    placeholder="Type your answer..."
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={!allAnswered}
                        className="
                            flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                            bg-gradient-to-r from-white/95 to-white/90
                            hover:from-white hover:to-white/95
                            text-background font-semibold text-sm
                            transition-all duration-300
                            disabled:opacity-50 disabled:cursor-not-allowed
                            shadow-[0_4px_16px_rgba(255,255,255,0.2)]
                            hover:shadow-[0_6px_24px_rgba(255,255,255,0.3)]
                        "
                    >
                        <span>Start Research</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onSkip}
                        className="
                            flex items-center gap-2 px-6 py-3 rounded-xl
                            bg-white/[0.05] border border-white/10
                            hover:bg-white/[0.10] hover:border-white/20
                            text-foreground/80 hover:text-foreground
                            font-medium text-sm
                            transition-all duration-200
                        "
                    >
                        <SkipForward className="w-4 h-4" />
                        <span>Skip</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

