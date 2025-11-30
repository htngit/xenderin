import { WhatsAppManager } from './WhatsAppManager';
import { BrowserWindow } from 'electron';

export interface JobData {
    jobId: string;
    contacts: any[];
    template: any;
    assets?: string[];
}

export class MessageProcessor {
    private whatsappManager: WhatsAppManager;
    private mainWindow: BrowserWindow;
    private isProcessing: boolean = false;
    private isPaused: boolean = false;
    private currentJob: JobData | null = null;

    constructor(whatsappManager: WhatsAppManager, mainWindow: BrowserWindow) {
        this.whatsappManager = whatsappManager;
        this.mainWindow = mainWindow;
    }

    /**
     * Get current job being processed
     */
    getCurrentJob(): JobData | null {
        return this.currentJob;
    }

    /**
     * Process a bulk message job
     */
    async processJob(job: JobData) {
        if (this.isProcessing) {
            throw new Error('Already processing a job');
        }

        this.isProcessing = true;
        this.currentJob = job;
        this.isPaused = false;

        console.log(`[MessageProcessor] Starting job ${job.jobId} with ${job.contacts.length} contacts`);

        let processed = 0;
        let success = 0;
        let failed = 0;

        // Report initial status
        this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, 'processing');

        for (const contact of job.contacts) {
            // Handle pause
            if (this.isPaused) {
                this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, 'paused');
                await this.waitForResume();
                this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, 'processing');
            }

            // Handle stop/cancel
            if (!this.isProcessing) break;

            try {
                // Get template content - use random variant if available
                let templateContent = job.template.content || '';

                // If template has variants, pick a random one
                if (job.template.variants && job.template.variants.length > 0) {
                    const randomIndex = Math.floor(Math.random() * job.template.variants.length);
                    templateContent = job.template.variants[randomIndex];
                }

                // Format message (Task 3.2: SendWorker logic)
                const messageContent = this.formatMessage(templateContent, contact);

                // Debug logging
                console.log(`[MessageProcessor] Template has ${job.template.variants?.length || 0} variants`);
                console.log(`[MessageProcessor] Selected template content: "${templateContent}"`);
                console.log(`[MessageProcessor] Formatted message: "${messageContent}"`);
                console.log(`[MessageProcessor] Has assets: ${job.assets && job.assets.length > 0}`);

                // Send message
                if (job.assets && job.assets.length > 0) {
                    await this.whatsappManager.sendMessageWithMedia(contact.phone, messageContent, job.assets[0]);
                } else {
                    await this.whatsappManager.sendMessage(contact.phone, messageContent);
                }

                success++;
            } catch (error) {
                console.error(`[MessageProcessor] Failed to send to ${contact.phone}:`, error);

                // Send detailed error to renderer
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('whatsapp:job-error-detail', {
                        jobId: job.jobId,
                        phone: contact.phone,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }

                failed++;
            }

            processed++;
            this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, 'processing');

            // Random delay to prevent ban (2-5 seconds)
            // TODO: Make this configurable from settings
            await this.delay(2000 + Math.random() * 3000);
        }

        this.isProcessing = false;
        this.currentJob = null;

        // Final report
        this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, 'completed');
        console.log(`[MessageProcessor] Job ${job.jobId} completed`);
    }

    /**
     * Pause current job
     */
    pause() {
        if (this.isProcessing && !this.isPaused) {
            this.isPaused = true;
            console.log('[MessageProcessor] Job paused');
            return true;
        }
        return false;
    }

    /**
     * Resume current job
     */
    resume() {
        if (this.isProcessing && this.isPaused) {
            this.isPaused = false;
            console.log('[MessageProcessor] Job resumed');
            return true;
        }
        return false;
    }

    /**
     * Stop current job
     */
    stop() {
        if (this.isProcessing) {
            this.isProcessing = false;
            this.isPaused = false;
            this.currentJob = null;
            console.log('[MessageProcessor] Job stopped');
            return true;
        }
        return false;
    }

    /**
     * Format message by replacing variables
     * Supported variables: {{name}}, {{phone}}, {{var1}}, {{var2}}, etc.
     */
    private formatMessage(template: string, contact: any): string {
        let message = template;

        // Replace standard variables
        message = message.replace(/{{name}}/g, contact.name || '');
        message = message.replace(/{{phone}}/g, contact.phone || '');

        // Replace custom variables if they exist in contact object
        // Example: {{company}} -> contact.company
        const matches = message.match(/{{(.*?)}}/g);
        if (matches) {
            matches.forEach(match => {
                const key = match.replace(/{{|}}/g, '');
                if (contact[key] !== undefined) {
                    message = message.replace(new RegExp(match, 'g'), String(contact[key]));
                }
            });
        }

        return message;
    }

    /**
     * Report progress to renderer
     */
    private reportProgress(
        jobId: string,
        processed: number,
        total: number,
        success: number,
        failed: number,
        status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused'
    ) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('whatsapp:job-progress', {
                jobId,
                processed,
                total,
                success,
                failed,
                status
            });
        }
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private waitForResume() {
        return new Promise<void>(resolve => {
            const check = setInterval(() => {
                if (!this.isPaused) {
                    clearInterval(check);
                    resolve();
                }
            }, 500);
        });
    }
}
