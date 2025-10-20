export interface User {
    id: number
    username: string
    selectedModel?: string
    onboardingComplete?: boolean
}

export interface UserSettings {
    display_name?: string | null
    system_prompt?: string | null
    provider?: string | null
    provider_api_key_masked?: string | null
    provider_api_key?: string | null
    provider_base_url?: string | null
    selected_model?: string | null
    embedding_api_key_masked?: string | null
    embedding_api_key?: string | null
    embedding_model?: string | null
    onboarding_complete?: boolean
    font_size?: 'small' | 'medium' | 'large' | 'extra-large' | null
    font_family?: 'inter' | 'atkinson' | 'opendyslexic' | 'literata' | 'system' | null
}

export interface QuotedText {
    text: string
    messageId: string
}

export interface Attachment {
    id: string
    type: 'image' | 'file' | 'document_reference'
    name: string
    url?: string // data URL or blob URL (not needed for document references)
    mimeType: string
    size: number
    extractedText?: string // For PDFs and text files
    documentId?: number // For document references
}

export type ResearchPhase = 'clarification' | 'planning' | 'searching' | 'analysis' | 'compilation' | 'complete'

export interface ResearchProgress {
    phase: ResearchPhase
    status: string
    findings: string[]
    progress: number // 0-100
}

export interface ClarifyingQuestion {
    id: string
    question: string
    type: 'text' | 'choice'
    options?: string[]
    answer?: string
}

export interface ResearchMetadata {
    phase: ResearchPhase
    progress: ResearchProgress
    clarifyingQuestions?: ClarifyingQuestion[]
    searchQueries?: string[]
    sources?: Array<{ title: string; url: string }>
    durationSeconds?: number
    artifactHtml?: string
    artifactGeneratedAt?: Date
}

// Universal Artifact types
export type ArtifactKind = 'html' | 'python' | 'mermaid' | 'katex'

export type ArtifactPayload = {
    // Full HTML document to render as-is
    htmlDoc?: string
    // Or assemble from parts
    html?: string
    css?: string
    js?: string
    // Python code
    pythonCode?: string
    // Mermaid diagram code
    mermaidCode?: string
    // KaTeX/LaTeX code
    katexCode?: string
    // Generic code/text payload (fallback)
    code?: string
    text?: string
    // Optional dependency hints (e.g., micropip packages)
    deps?: string[]
}

export interface Artifact {
    id: string
    kind: ArtifactKind
    title?: string
    payload: ArtifactPayload
    createdAt: Date
}

export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
    model?: string
    tokens?: {
        input: number
        output: number
        thinking?: number
    }
    cost?: number
    thinking?: string
    isThinking?: boolean
    quotedText?: QuotedText
    attachments?: Attachment[]
    researchMetadata?: ResearchMetadata
    isResearch?: boolean
    artifacts?: Artifact[]
}

export interface Chat {
    id: string
    title: string
    messages: Message[]
    model: string
    mode?: ChatMode
    createdAt: Date
    updatedAt: Date
}

export interface Model {
    id: string
    name: string
    provider: string
    description?: string
}

export type ChatMode = 'chat' | 'study' | 'research'

export interface AppSettings {
    apiKey: string
    maxTokens: number
    temperature: number
    model: string
}