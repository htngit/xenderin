import { WhatsAppManager } from './WhatsAppManager';
import { BrowserWindow } from 'electron';

export interface JobData {
    jobId: string;
    contacts: any[];
    template: any;
    assets?: string[];
    delayConfig?: {
        mode: 'static' | 'dynamic';
        delayRange: number[];
    };
}

export interface MessageLog {
    id: string;
    activity_log_id: string;
    contact_id: string;
    contact_name: string;
    contact_phone: string;
    status: 'sent' | 'failed' | 'pending';
    sent_at?: string;
    error_message?: string;
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
        // Debug: Log received template data
        console.log('[MessageProcessor] Received job template:', JSON.stringify(job.template, null, 2));

        // Validate template before processing
        if (!job.template) {
            throw new Error('Template is required for job processing');
        }

        // Check for content OR variants
        const hasContent = job.template.content && job.template.content.trim().length > 0;
        const hasVariants = Array.isArray(job.template.variants) && job.template.variants.length > 0;

        console.log(`[MessageProcessor] Template check - hasContent: ${hasContent}, hasVariants: ${hasVariants}`);

        if (!hasContent && !hasVariants) {
            console.error('[MessageProcessor] Template validation failed:', {
                content: job.template.content,
                variants: job.template.variants,
                templateKeys: Object.keys(job.template)
            });
            throw new Error(`Template must have content or variants defined. Received: content=${job.template.content}, variants=${JSON.stringify(job.template.variants)}`);
        }

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

        // Array to store individual message logs for metadata
        const messageLogs: MessageLog[] = [];

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

                // Create successful message log
                messageLogs.push({
                    id: crypto.randomUUID(),
                    activity_log_id: job.jobId,
                    contact_id: contact.id || '',
                    contact_name: contact.name || contact.contact_name || 'Unknown Contact',
                    contact_phone: contact.phone || contact.contact_phone || 'Unknown Phone',
                    status: 'sent',
                    sent_at: new Date().toISOString()
                });

                success++;
            } catch (error) {
                console.error(`[MessageProcessor] Failed to send to ${contact.phone}:`, error);

                // Create failed message log
                messageLogs.push({
                    id: crypto.randomUUID(),
                    activity_log_id: job.jobId,
                    contact_id: contact.id || '',
                    contact_name: contact.name || contact.contact_name || 'Unknown Contact',
                    contact_phone: contact.phone || contact.contact_phone || 'Unknown Phone',
                    status: 'failed',
                    sent_at: new Date().toISOString(),
                    error_message: error instanceof Error ? error.message : String(error)
                });

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

            // Apply configurable delay based on user settings
            const delayMs = this.calculateDelayFromConfig(job.delayConfig);
            await this.delay(delayMs);
        }

        this.isProcessing = false;
        this.currentJob = null;

        // Final report with message logs metadata
        this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, 'completed', {
            logs: messageLogs
        });
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
        status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused',
        metadata?: Record<string, any>
    ) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('whatsapp:job-progress', {
                jobId,
                processed,
                total,
                success,
                failed,
                status,
                metadata
            });
        }
    }

    /**
     * Calculate delay in milliseconds based on delay configuration
     * @param delayConfig - Optional delay configuration from job settings
     * @returns Delay in milliseconds
     */
    private calculateDelayFromConfig(delayConfig?: {
        mode: 'static' | 'dynamic';
        delayRange: number[];
    }): number {
        // Default fallback values (2-5 seconds in milliseconds)
        const DEFAULT_MIN_DELAY_MS = 2000;
        const DEFAULT_MAX_DELAY_MS = 5000;

        // Handle missing or invalid delay configuration
        if (!delayConfig || !delayConfig.delayRange || delayConfig.delayRange.length === 0) {
            console.warn('[MessageProcessor] No valid delayConfig provided, using default values');
            return DEFAULT_MIN_DELAY_MS + Math.random() * (DEFAULT_MAX_DELAY_MS - DEFAULT_MIN_DELAY_MS);
        }

        // Validate delay range
        if (delayConfig.delayRange.length < 1) {
            console.warn('[MessageProcessor] Invalid delayRange, using default values');
            return DEFAULT_MIN_DELAY_MS + Math.random() * (DEFAULT_MAX_DELAY_MS - DEFAULT_MIN_DELAY_MS);
        }

        // Convert seconds to milliseconds
        const minDelayMs = delayConfig.delayRange[0] * 1000;
        let maxDelayMs = minDelayMs; // Default to static mode

        // For dynamic mode with valid range, use random value between min and max
        if (delayConfig.mode === 'dynamic' && delayConfig.delayRange.length >= 2) {
            maxDelayMs = delayConfig.delayRange[1] * 1000;

            // Ensure max is greater than min
            if (maxDelayMs <= minDelayMs) {
                console.warn('[MessageProcessor] Invalid delay range (max <= min), using static mode');
                return minDelayMs;
            }

            return minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
        }

        // For static mode or dynamic mode with single value, return the min value
        return minDelayMs;
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
