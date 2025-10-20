import { processDocument, deleteDocumentById } from './documents.js'

interface Job {
    documentId: number
    userId: number
    retries: number
}

class DocumentWorker {
    private queue: Job[] = []
    private processing = false
    private maxRetries = 3

    /**
     * Add a document to the processing queue
     */
    enqueue(documentId: number, userId: number) {
        this.queue.push({ documentId, userId, retries: 0 })
        console.log(`Document ${documentId} added to processing queue`)
        this.processNext()
    }

    /**
     * Process the next job in the queue
     */
    private async processNext() {
        if (this.processing || this.queue.length === 0) {
            return
        }

        this.processing = true
        const job = this.queue.shift()!

        try {
            console.log(`Processing document ${job.documentId} (attempt ${job.retries + 1})`)
            await processDocument(job.documentId, job.userId)
            console.log(`Document ${job.documentId} processed successfully`)
        } catch (error) {
            console.error(`Error processing document ${job.documentId}:`, error)
            
            // Retry if under max retries
            if (job.retries < this.maxRetries) {
                job.retries++
                this.queue.push(job)
                console.log(`Document ${job.documentId} will be retried (${job.retries}/${this.maxRetries})`)
            } else {
                console.error(`Document ${job.documentId} failed after ${this.maxRetries} attempts`)
                // Cleanup failed document automatically
                try {
                    await deleteDocumentById(job.documentId)
                    console.log(`Document ${job.documentId} deleted after failing`)        
                } catch (cleanupErr) {
                    console.error(`Failed to cleanup document ${job.documentId}:`, cleanupErr)
                }
            }
        } finally {
            this.processing = false
            // Process next job after a short delay
            setTimeout(() => this.processNext(), 100)
        }
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing
        }
    }

    /**
     * Flush all pending jobs from the queue without processing them
     */
    flushQueue() {
        const removed = this.queue.length
        this.queue = []
        return removed
    }
}

// Singleton instance
export const documentWorker = new DocumentWorker()

