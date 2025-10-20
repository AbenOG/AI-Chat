import { MarkdownContent } from '@/components/MarkdownContent'

interface StreamingMessageProps {
    content: string
}

export function StreamingMessage({ content }: StreamingMessageProps) {
    return (
        <div className="group relative py-6">
            <div className="max-w-3xl mx-auto px-6">
                {/* Streaming Content */}
                <div>
                    <div className="text-[15px] leading-7 streaming-content">
                        <MarkdownContent content={content} deferHighlight={true} />
                        {/* Animated cursor */}
                        <span className="streaming-cursor" />
                    </div>
                </div>
            </div>
        </div>
    )
}

