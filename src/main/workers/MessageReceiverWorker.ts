import { WhatsAppManager } from '../WhatsAppManager';
import { BrowserWindow } from 'electron';
import { Message } from 'whatsapp-web.js';

export class MessageReceiverWorker {
    // private whatsappManager: WhatsAppManager; // Removed unused property
    private mainWindow: BrowserWindow;
    private unsubscribeKeywords = ['unsubscribe', 'stop', 'batal', 'berhenti', 'jangan kirim', 'keluar', 'cancel'];

    constructor(_whatsappManager: WhatsAppManager, mainWindow: BrowserWindow) {
        // this.whatsappManager = whatsappManager;
        this.mainWindow = mainWindow;
        // Keep whatsappManager in constructor for future use and compatibility, but don't store it yet
    }

    /**
     * Handle incoming message from WhatsAppManager
     */
    async handleIncomingMessage(message: Message) {
        try {
            console.log('[MessageReceiverWorker] Processing incoming message from:', message.from);

            const isUnsubscribe = this.isUnsubscribeRequest(message.body);

            // 1. Check for unsubscribe
            if (isUnsubscribe) {
                console.log('[MessageReceiverWorker] Unsubscribe request detected from:', message.from);

                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('whatsapp:unsubscribe-detected', {
                        phoneNumber: message.from,
                        message: message.body,
                        timestamp: new Date().toISOString()
                    });
                }

                // Optional: Auto-reply confirming unsubscribe
                // Note: Will need whatsappManager for this in the future
            }

            // 2. Broadcast to Renderer
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('whatsapp:message-received', {
                    id: message.id._serialized,
                    from: message.from,
                    to: message.to,
                    body: message.body,
                    type: message.type,
                    timestamp: message.timestamp,
                    hasMedia: message.hasMedia,
                    isUnsubscribeRequest: isUnsubscribe
                });
            }
        } catch (error) {
            console.error('[MessageReceiverWorker] Error handling message:', error);
        }
    }

    /**
     * Check if message content contains unsubscribe keywords
     */
    private isUnsubscribeRequest(content: string): boolean {
        if (!content) return false;
        const lowerContent = content.toLowerCase();
        return this.unsubscribeKeywords.some(keyword => lowerContent.includes(keyword));
    }
}
