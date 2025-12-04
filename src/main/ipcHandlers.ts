import { BrowserWindow, ipcMain } from 'electron';
import { WhatsAppManager } from './WhatsAppManager';
import { MessageProcessor } from './MessageProcessor';
import { QueueWorker } from './workers/QueueWorker';

let whatsappManager: WhatsAppManager | null = null;
let messageProcessor: MessageProcessor | null = null;
let queueWorker: QueueWorker | null = null;

/**
 * Setup IPC handlers for WhatsApp operations
 * @param mainWindow - Main Electron window
 * @param wm - WhatsAppManager instance
 * @param mp - MessageProcessor instance
 * @param qw - QueueWorker instance
 */
export const setupIPC = (
    mainWindow: BrowserWindow,
    wm?: WhatsAppManager,
    mp?: MessageProcessor,
    qw?: QueueWorker
) => {
    console.log('[IPC] Setting up IPC handlers...');

    // Initialize Managers from arguments or create new ones (fallback)
    if (wm) {
        whatsappManager = wm;
    } else {
        console.log('[IPC] Creating new WhatsAppManager (Fallback)');
        whatsappManager = new WhatsAppManager(mainWindow);
    }

    if (mp) {
        messageProcessor = mp;
    } else {
        console.log('[IPC] Creating new MessageProcessor (Fallback)');
        messageProcessor = new MessageProcessor(whatsappManager, mainWindow);
    }

    if (qw) {
        queueWorker = qw;
    } else if (messageProcessor) {
        console.log('[IPC] Creating new QueueWorker (Fallback)');
        queueWorker = new QueueWorker(messageProcessor);
    }

    /**
     * Connect to WhatsApp
     */
    ipcMain.handle('whatsapp:connect', async () => {
        try {
            console.log('[IPC] whatsapp:connect called');

            if (!whatsappManager) {
                throw new Error('WhatsAppManager not initialized');
            }

            const result = await whatsappManager.connect();
            return { success: true, connected: result };
        } catch (error) {
            console.error('[IPC] whatsapp:connect error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });

    /**
     * Disconnect from WhatsApp
     */
    ipcMain.handle('whatsapp:disconnect', async () => {
        try {
            console.log('[IPC] whatsapp:disconnect called');

            if (!whatsappManager) {
                throw new Error('WhatsAppManager not initialized');
            }

            await whatsappManager.disconnect();
            return { success: true };
        } catch (error) {
            console.error('[IPC] whatsapp:disconnect error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });

    /**
     * Send message (Single)
     */
    ipcMain.handle('whatsapp:send-message', async (_, { to, content, assets }) => {
        try {
            console.log(`[IPC] whatsapp:send-message called for ${to}`);

            if (!whatsappManager) {
                throw new Error('WhatsAppManager not initialized');
            }

            let result: boolean;

            if (assets && assets.length > 0) {
                // Send with media
                result = await whatsappManager.sendMessageWithMedia(to, content, assets[0]);
            } else {
                // Send text only
                result = await whatsappManager.sendMessage(to, content);
            }

            return { success: result };
        } catch (error) {
            console.error('[IPC] whatsapp:send-message error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });

    /**
     * Get WhatsApp status
     */
    ipcMain.handle('whatsapp:get-status', async () => {
        try {
            if (!whatsappManager) {
                return { status: 'disconnected', ready: false };
            }

            const status = whatsappManager.getStatus();
            const ready = whatsappManager.isReady();

            return { status, ready };
        } catch (error) {
            console.error('[IPC] whatsapp:get-status error:', error);
            return { status: 'disconnected', ready: false };
        }
    });

    /**
     * Get client info
     */
    ipcMain.handle('whatsapp:get-client-info', async () => {
        try {
            console.log('[IPC] whatsapp:get-client-info called');

            if (!whatsappManager) {
                return null;
            }

            const info = await whatsappManager.getClientInfo();
            return info;
        } catch (error) {
            console.error('[IPC] whatsapp:get-client-info error:', error);
            return null;
        }
    });

    /**
     * Process bulk message job
     */
    ipcMain.handle('whatsapp:process-job', async (_, { jobId, contacts, template, assets, delayConfig }) => {
        try {
            console.log(`[IPC] whatsapp:process-job called for job ${jobId}`);

            if (!whatsappManager || !whatsappManager.isReady()) {
                throw new Error('WhatsApp is not ready');
            }

            // Use QueueWorker if available
            if (queueWorker) {
                console.log(`[IPC] Adding job ${jobId} to queue`);
                queueWorker.addToQueue({
                    jobId,
                    contacts,
                    template,
                    assets,
                    delayConfig
                }).catch(err => {
                    console.error('[IPC] Error adding to queue:', err);
                });
            } else if (messageProcessor) {
                console.warn('[IPC] QueueWorker not available, processing directly');
                messageProcessor.processJob({
                    jobId,
                    contacts,
                    template,
                    assets,
                    delayConfig
                }).catch(err => {
                    console.error('[IPC] Job processing error:', err);
                });
            } else {
                throw new Error('MessageProcessor not initialized');
            }

            return {
                success: true,
                message: 'Job started',
                jobId
            };
        } catch (error) {
            console.error('[IPC] whatsapp:process-job error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });

    /**
     * Pause job
     */
    ipcMain.handle('whatsapp:pause-job', async (_, { jobId }) => {
        console.log(`[IPC] whatsapp:pause-job called for job ${jobId}`);
        if (messageProcessor) {
            const success = messageProcessor.pause();
            return { success, message: success ? 'Job paused' : 'Failed to pause' };
        }
        return { success: false, message: 'Processor not ready' };
    });

    /**
     * Resume job
     */
    ipcMain.handle('whatsapp:resume-job', async (_, { jobId }) => {
        console.log(`[IPC] whatsapp:resume-job called for job ${jobId}`);
        if (messageProcessor) {
            const success = messageProcessor.resume();
            return { success, message: success ? 'Job resumed' : 'Failed to resume' };
        }
        return { success: false, message: 'Processor not ready' };
    });

    console.log('[IPC] IPC handlers setup complete');
};

/**
 * Get WhatsAppManager instance
 */
export const getWhatsAppManager = (): WhatsAppManager | null => {
    return whatsappManager;
};
