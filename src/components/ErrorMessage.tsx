import { AlertCircle, AlertTriangle, Info, XCircle, Copy, Check, X } from 'lucide-react'
import { useState } from 'react'
import { formatErrorMessage, getUserFriendlyError } from './ErrorBoundary'

interface ErrorMessageProps {
    error: unknown
    title?: string
    severity?: 'error' | 'warning' | 'info'
    onDismiss?: () => void
    showCopy?: boolean
    className?: string
}

export function ErrorMessage({
    error,
    title,
    severity = 'error',
    onDismiss,
    showCopy = true,
    className = ''
}: ErrorMessageProps) {
    const [copied, setCopied] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)

    const message = getUserFriendlyError(error)
    const technicalMessage = formatErrorMessage(error)
    const showTechnical = message !== technicalMessage

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(technicalMessage)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const config = {
        error: {
            icon: XCircle,
            bgColor: 'bg-red-500/10',
            borderColor: 'border-red-500/20',
            textColor: 'text-red-400',
            iconBg: 'bg-red-500/20'
        },
        warning: {
            icon: AlertTriangle,
            bgColor: 'bg-yellow-500/10',
            borderColor: 'border-yellow-500/20',
            textColor: 'text-yellow-400',
            iconBg: 'bg-yellow-500/20'
        },
        info: {
            icon: Info,
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/20',
            textColor: 'text-blue-400',
            iconBg: 'bg-blue-500/20'
        }
    }

    const { icon: Icon, bgColor, borderColor, textColor, iconBg } = config[severity]

    return (
        <div
            className={`${bgColor} ${borderColor} border rounded-lg overflow-hidden ${className}`}
            role="alert"
            aria-live="assertive"
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`${iconBg} p-2 rounded-lg flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${textColor}`} aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {title && (
                            <h3 className="text-sm font-semibold text-white mb-1">
                                {title}
                            </h3>
                        )}
                        <div className={`text-sm ${textColor} break-words`}>
                            {message}
                        </div>

                        {/* Technical Details (Expandable) */}
                        {showTechnical && (
                            <details
                                className="mt-3"
                                open={isExpanded}
                                onToggle={(e) => setIsExpanded((e.target as HTMLDetailsElement).open)}
                            >
                                <summary className="text-xs text-white/60 cursor-pointer hover:text-white/80 transition-colors select-none">
                                    Technical details
                                </summary>
                                <div className="mt-2 p-3 bg-black/30 rounded border border-white/10 overflow-auto max-h-32">
                                    <code className="text-xs text-white/70 break-words whitespace-pre-wrap font-mono">
                                        {technicalMessage}
                                    </code>
                                </div>
                            </details>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {showCopy && (
                            <button
                                onClick={handleCopy}
                                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                aria-label="Copy error message"
                                title="Copy error message"
                            >
                                {copied ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        )}
                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                aria-label="Dismiss error"
                                title="Dismiss"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Compact version for inline errors
interface InlineErrorProps {
    error: unknown
    className?: string
}

export function InlineError({ error, className = '' }: InlineErrorProps) {
    const message = getUserFriendlyError(error)

    return (
        <div
            className={`flex items-center gap-2 text-sm text-red-400 ${className}`}
            role="alert"
            aria-live="polite"
        >
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="break-words">{message}</span>
        </div>
    )
}

// Toast-style error notification
interface ErrorToastProps {
    error: unknown
    onClose: () => void
    duration?: number
}

export function ErrorToast({ error, onClose, duration = 5000 }: ErrorToastProps) {
    const [isVisible, setIsVisible] = useState(true)
    const message = getUserFriendlyError(error)

    useState(() => {
        const timer = setTimeout(() => {
            setIsVisible(false)
            setTimeout(onClose, 300) // Wait for fade out animation
        }, duration)
        return () => clearTimeout(timer)
    })

    if (!isVisible) return null

    return (
        <div
            className={`fixed bottom-6 right-6 max-w-md bg-[#0a0a0a] border border-red-500/20 rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            role="alert"
            aria-live="assertive"
        >
            <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" aria-hidden="true" />
                    <span className="text-sm font-medium text-white">Error</span>
                </div>
                <button
                    onClick={() => {
                        setIsVisible(false)
                        setTimeout(onClose, 300)
                    }}
                    className="p-1 text-white/60 hover:text-white transition-colors"
                    aria-label="Close notification"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="px-4 py-3">
                <p className="text-sm text-white/90 break-words">{message}</p>
            </div>
        </div>
    )
}

