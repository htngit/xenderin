import { MessageProcessor, JobData } from '../MessageProcessor';

export class QueueWorker {
    private queue: JobData[] = [];
    private isRunning: boolean = false;
    private messageProcessor: MessageProcessor;

    constructor(messageProcessor: MessageProcessor) {
        this.messageProcessor = messageProcessor;
    }

    /**
     * Add a job to the queue and start processing if not already running
     */
    async addToQueue(job: JobData) {
        console.log(`[QueueWorker] Adding job ${job.jobId} to queue`);
        this.queue.push(job);
        this.processQueue();
    }

    /**
     * Process the queue sequentially
     */
    private async processQueue() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log('[QueueWorker] Starting queue processing');

        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (job) {
                try {
                    console.log(`[QueueWorker] Processing job ${job.jobId}`);
                    await this.messageProcessor.processJob(job);
                } catch (error) {
                    console.error(`[QueueWorker] Error processing job ${job.jobId}:`, error);
                }
            }
        }

        this.isRunning = false;
        console.log('[QueueWorker] Queue processing finished');
    }

    /**
     * Get current queue length
     */
    getQueueLength(): number {
        return this.queue.length;
    }
}
