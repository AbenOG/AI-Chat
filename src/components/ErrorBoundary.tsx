import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, Copy, RefreshCw, Home, Check } from 'lucide-react'

interface Props {
    children: ReactNode
    fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
    copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            copied: false
        }
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo)
        this.setState({
            error,
            errorInfo
        })
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            copied: false
        })
    }

    handleCopyError = async () => {
        const { error, errorInfo } = this.state
        if (!error) return

        const errorText = `
**Error Message:**
${error.message}

**Error Stack:**
${error.stack || 'No stack trace available'}

**Component Stack:**
${errorInfo?.componentStack || 'No component stack available'}

**User Agent:**
${navigator.userAgent}

**Timestamp:**
${new Date().toISOString()}
        `.trim()

        try {
            await navigator.clipboard.writeText(errorText)
            this.setState({ copied: true })
            setTimeout(() => this.setState({ copied: false }), 2000)
        } catch (err) {
            console.error('Failed to copy error:', err)
        }
    }

    handleGoHome = () => {
        this.handleReset()
        window.location.href = '/'
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback(
                    this.state.error!,
                    this.state.errorInfo!,
                    this.handleReset
                )
            }

            const { error } = this.state
            const errorMessage = error?.message || 'An unexpected error occurred'

            return (
                <div className="min-h-screen bg-black flex items-center justify-center p-6">
                    <div className="max-w-2xl w-full">
                        {/* Error Card */}
                        <div className="bg-[#0a0a0a] border border-red-500/20 rounded-xl overflow-hidden">
                            {/* Header */}
                            <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/20 rounded-lg">
                                        <AlertCircle className="w-6 h-6 text-red-400" aria-hidden="true" />
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-semibold text-white">
                                            Something Went Wrong
                                        </h1>
                                        <p className="text-sm text-white/60 mt-0.5">
                                            We encountered an unexpected error
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Error Message */}
                            <div className="px-6 py-5">
                                <div className="mb-4">
                                    <h2 className="text-sm font-medium text-white/80 mb-2">
                                        Error Details
                                    </h2>
                                    <div 
                                        className="bg-white/5 border border-white/10 rounded-lg p-4 overflow-auto max-h-48"
                                        role="alert"
                                        aria-live="assertive"
                                    >
                                        <code className="text-sm text-red-400 break-words whitespace-pre-wrap font-mono">
                                            {errorMessage}
                                        </code>
                                    </div>
                                </div>

                                {/* Stack Trace (Collapsed by default) */}
                                {error?.stack && (
                                    <details className="mb-4">
                                        <summary className="text-sm font-medium text-white/60 cursor-pointer hover:text-white/80 transition-colors mb-2">
                                            Technical Details (Click to expand)
                                        </summary>
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-4 overflow-auto max-h-64">
                                            <code className="text-xs text-white/60 break-words whitespace-pre-wrap font-mono">
                                                {error.stack}
                                            </code>
                                        </div>
                                    </details>
                                )}

                                {/* Helpful Message */}
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-5">
                                    <h3 className="text-sm font-medium text-white mb-2">
                                        What can you do?
                                    </h3>
                                    <ul className="text-sm text-white/70 space-y-1.5">
                                        <li className="flex items-start gap-2">
                                            <span className="text-white/40 mt-0.5">•</span>
                                            <span>Try refreshing the page or going back to the home screen</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-white/40 mt-0.5">•</span>
                                            <span>Copy the error details and report it to support</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-white/40 mt-0.5">•</span>
                                            <span>Check your internet connection and try again</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-white/40 mt-0.5">•</span>
                                            <span>Clear your browser cache and reload</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={this.handleCopyError}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors"
                                        aria-label="Copy error details to clipboard"
                                    >
                                        {this.state.copied ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                Copy Error
                                            </>
                                        )}
                                    </button>
                                    
                                    <button
                                        onClick={this.handleReset}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors"
                                        aria-label="Try again"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Try Again
                                    </button>
                                    
                                    <button
                                        onClick={this.handleGoHome}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors"
                                        aria-label="Go to home page"
                                    >
                                        <Home className="w-4 h-4" />
                                        Go Home
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Additional Help */}
                        <div className="mt-4 text-center">
                            <p className="text-sm text-white/50">
                                If this problem persists, please contact support with the error details
                            </p>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

// Hook-based error handler for functional components
export function useErrorHandler() {
    const [error, setError] = React.useState<Error | null>(null)

    React.useEffect(() => {
        if (error) {
            throw error
        }
    }, [error])

    return setError
}

// Utility function to format error messages
export function formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === 'string') {
        return error
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message)
    }
    return 'An unknown error occurred'
}

// Utility function to create user-friendly error messages
export function getUserFriendlyError(error: unknown): string {
    const message = formatErrorMessage(error)
    
    // Network errors
    if (message.includes('fetch') || message.includes('network') || message.includes('NetworkError')) {
        return 'Unable to connect to the server. Please check your internet connection and try again.'
    }
    
    // Authentication errors
    if (message.includes('401') || message.includes('unauthorized') || message.includes('Unauthorized')) {
        return 'Your session has expired. Please log in again.'
    }
    
    // Permission errors
    if (message.includes('403') || message.includes('forbidden') || message.includes('Forbidden')) {
        return 'You don\'t have permission to perform this action.'
    }
    
    // Not found errors
    if (message.includes('404') || message.includes('not found') || message.includes('Not Found')) {
        return 'The requested resource was not found.'
    }
    
    // Server errors
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
        return 'The server is experiencing issues. Please try again later.'
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
        return `Validation error: ${message}`
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
        return 'The request took too long. Please try again.'
    }
    
    // Default to the original message if it's user-friendly enough
    if (message.length < 100 && !message.includes('undefined') && !message.includes('null')) {
        return message
    }
    
    return 'An unexpected error occurred. Please try again or contact support if the problem persists.'
}

