import { Check, Circle } from 'lucide-react'

interface Step {
    label: string
    completed: boolean
}

interface StudyProgressProps {
    steps: Step[]
    currentStep?: number
}

export function StudyProgress({ steps, currentStep }: StudyProgressProps) {
    return (
        <div className="my-6 p-5 rounded-xl border border-blue-500/30 bg-blue-500/5 backdrop-blur-sm">
            <h4 className="text-sm font-semibold text-blue-100 mb-4 flex items-center gap-2">
                <span>📈</span>
                <span>Your Progress</span>
            </h4>

            <div className="space-y-3">
                {steps.map((step, index) => {
                    const isActive = currentStep === index
                    const isCompleted = step.completed
                    const isFuture = !isCompleted && !isActive

                    return (
                        <div key={index} className="flex items-start gap-3">
                            {/* Step Indicator */}
                            <div className={`
                                relative flex items-center justify-center
                                w-8 h-8 rounded-full flex-shrink-0
                                border-2 transition-all duration-300
                                ${isCompleted && 'border-green-500 bg-green-500'}
                                ${isActive && 'border-blue-400 bg-blue-400/20 ring-4 ring-blue-400/20'}
                                ${isFuture && 'border-white/30 bg-white/5'}
                            `}>
                                {isCompleted ? (
                                    <Check className="w-4 h-4 text-white" />
                                ) : (
                                    <span className={`
                                        text-sm font-semibold
                                        ${isActive && 'text-blue-100'}
                                        ${isFuture && 'text-white/50'}
                                    `}>
                                        {index + 1}
                                    </span>
                                )}

                                {/* Connecting Line */}
                                {index < steps.length - 1 && (
                                    <div className={`
                                        absolute top-full left-1/2 -translate-x-1/2
                                        w-0.5 h-6
                                        ${isCompleted ? 'bg-green-500/50' : 'bg-white/20'}
                                    `} />
                                )}
                            </div>

                            {/* Step Content */}
                            <div className="flex-1 pt-1">
                                <p className={`
                                    text-sm leading-relaxed
                                    ${isCompleted && 'text-green-100 line-through opacity-75'}
                                    ${isActive && 'text-blue-100 font-medium'}
                                    ${isFuture && 'text-white/60'}
                                `}>
                                    {step.label}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Progress Bar */}
            <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                    <span>Overall Progress</span>
                    <span>
                        {steps.filter(s => s.completed).length} / {steps.length} completed
                    </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500 ease-out"
                        style={{
                            width: `${(steps.filter(s => s.completed).length / steps.length) * 100}%`
                        }}
                    />
                </div>
            </div>
        </div>
    )
}

