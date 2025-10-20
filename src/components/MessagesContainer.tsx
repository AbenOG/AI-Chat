import { useEffect, useRef } from 'react'
import { MessageBubble } from '@/components/MessageBubble'
import { StreamingMessage } from '@/components/StreamingMessage'
import { ThinkingIndicator } from '@/components/ThinkingIndicator'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { ResearchingIndicator } from '@/components/ResearchingIndicator'
import { ClarifyingQuestions } from '@/components/ClarifyingQuestions'
import type { Message, QuotedText, ResearchProgress as ResearchProgressType, ClarifyingQuestion } from '@/types'

interface MessagesContainerProps {
    messages: Message[]
    isGenerating: boolean
    streamingContent?: string
    onSuggestionClick: (suggestion: string) => void
    onQuote: (quote: QuotedText) => void
    onEdit: (messageId: string, newContent: string) => void
    onRetry: (messageId: string) => void
    isIncognito?: boolean
    onToggleIncognito?: () => void
    researchProgress?: ResearchProgressType | null
    clarifyingQuestions?: ClarifyingQuestion[]
    onClarifyingAnswers?: (answers: ClarifyingQuestion[]) => void
    onSkipClarifying?: () => void
    researchStartTime?: number
    hasMoreMessages?: boolean
    isLoadingMoreMessages?: boolean
    totalMessageCount?: number
    onLoadMore?: () => void
    isStudyMode?: boolean
}

export function MessagesContainer({
    messages,
    isGenerating,
    streamingContent = '',
    onSuggestionClick,
    onQuote,
    onEdit,
    onRetry,
    isIncognito,
    onToggleIncognito,
    researchProgress,
    clarifyingQuestions = [],
    onClarifyingAnswers,
    onSkipClarifying,
    researchStartTime,
    hasMoreMessages = false,
    isLoadingMoreMessages = false,
    totalMessageCount = 0,
    onLoadMore,
    isStudyMode = false
}: MessagesContainerProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const isUserAtBottom = useRef(true)
    const rafId = useRef<number | null>(null)
    const loadMoreTriggerRef = useRef<HTMLDivElement>(null)

    // Keep scroll at bottom during streaming - batched with RAF
    useEffect(() => {
        if (!isGenerating || !streamingContent) return

        const el = scrollContainerRef.current
        if (!el) return

        // Cancel any pending scroll update
        if (rafId.current) {
            cancelAnimationFrame(rafId.current)
        }

        // Batch scroll update with next frame
        rafId.current = requestAnimationFrame(() => {
            // Only auto-scroll if user was at bottom
            if (isUserAtBottom.current) {
                el.scrollTop = el.scrollHeight - el.clientHeight
            }
            rafId.current = null
        })

        return () => {
            if (rafId.current) {
                cancelAnimationFrame(rafId.current)
            }
        }
    }, [streamingContent, isGenerating])

    // Track if user is at bottom
    useEffect(() => {
        const el = scrollContainerRef.current
        if (!el) return

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = el
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight
            isUserAtBottom.current = distanceFromBottom < 50 // 50px threshold
        }

        el.addEventListener('scroll', handleScroll, { passive: true })
        return () => el.removeEventListener('scroll', handleScroll)
    }, [])

    // Scroll to bottom after generation completes
    useEffect(() => {
        if (!isGenerating && messages.length > 0) {
            const el = scrollContainerRef.current
            if (!el) return
            // Immediate jump to bottom
            el.scrollTop = el.scrollHeight - el.clientHeight
            // Do a couple of follow-ups to catch post-render size changes (e.g. syntax highlight)
            requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight - el.clientHeight
                setTimeout(() => {
                    el.scrollTop = el.scrollHeight - el.clientHeight
                }, 50)
            })
        }
    }, [messages.length, isGenerating])

    // Infinite scroll - Load more messages when scrolling to top
    useEffect(() => {
        const trigger = loadMoreTriggerRef.current
        const container = scrollContainerRef.current
        
        if (!trigger || !hasMoreMessages || isLoadingMoreMessages || !onLoadMore || !container) return
        
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0]
                if (entry.isIntersecting && hasMoreMessages && !isLoadingMoreMessages) {
                    // Save scroll position before loading
                    const scrollHeightBefore = container.scrollHeight
                    const scrollTopBefore = container.scrollTop
                    
                    onLoadMore()
                    
                    // Restore scroll position after new messages load
                    requestAnimationFrame(() => {
                        const scrollHeightAfter = container.scrollHeight
                        const addedHeight = scrollHeightAfter - scrollHeightBefore
                        container.scrollTop = scrollTopBefore + addedHeight
                    })
                }
            },
            {
                root: container,
                rootMargin: '100px',
                threshold: 0.1
            }
        )
        
        observer.observe(trigger)
        return () => observer.disconnect()
    }, [hasMoreMessages, isLoadingMoreMessages, onLoadMore])

    return (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar messages-container relative">
            {messages.length === 0 ? (
                <div key="welcome" className="animate-fade-in min-h-full">
                    <WelcomeScreen
                        onSuggestionClick={onSuggestionClick}
                        isIncognito={isIncognito}
                        onToggleIncognito={onToggleIncognito}
                    />
                </div>
            ) : (
                <div key="chat" className="py-4 animate-fade-in-slide">
                    {/* Load More Trigger - at the top */}
                    {hasMoreMessages && (
                        <div ref={loadMoreTriggerRef} className="h-4 flex items-center justify-center">
                            {isLoadingMoreMessages && (
                                <div className="text-xs text-muted-foreground/60 animate-pulse">
                                    Loading older messages...
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Message count indicator */}
                    {totalMessageCount > messages.length && (
                        <div className="text-center text-xs text-muted-foreground/50 py-2">
                            Showing {messages.length} of {totalMessageCount} messages
                        </div>
                    )}
                    
                    {/* Completed messages - stable, no streaming jitter */}
                    <div className="space-y-0">
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                onQuote={onQuote}
                                isStudyMode={isStudyMode}
                                onEdit={onEdit}
                                onRetry={onRetry}
                            />
                        ))}
                    </div>

                    {/* Clarifying Questions UI */}
                    {clarifyingQuestions.length > 0 && onClarifyingAnswers && onSkipClarifying && (
                        <ClarifyingQuestions
                            questions={clarifyingQuestions}
                            onSubmit={onClarifyingAnswers}
                            onSkip={onSkipClarifying}
                        />
                    )}

                    {/* Research Progress */}
                    {researchProgress && !clarifyingQuestions.length && (
                        <ResearchingIndicator
                            progress={researchProgress}
                            startTime={researchStartTime}
                        />
                    )}

                    {/* Reserve exact space for streaming content to prevent layout shift */}
                    {(isGenerating || streamingContent) && !researchProgress && !clarifyingQuestions.length && (
                        <div className="streaming-placeholder" style={{ minHeight: '100px' }}>
                            {streamingContent ? (
                                <StreamingMessage content={streamingContent} />
                            ) : (
                                <ThinkingIndicator isThinking={false} />
                            )}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            )}
        </div>
    )
}