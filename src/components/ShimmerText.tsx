export interface ShimmerTextProps {
    text: string
    className?: string
}

export function ShimmerText({ text, className = '' }: ShimmerTextProps) {
    return (
        <span className={`animate-shimmer ${className}`}>
            {text}
        </span>
    )
}

