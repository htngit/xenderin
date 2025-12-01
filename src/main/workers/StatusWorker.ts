import { WhatsAppManager } from '../WhatsAppManager';
import { BrowserWindow } from 'electron';

export class StatusWorker {
    private whatsappManager: WhatsAppManager;
    private mainWindow: BrowserWindow;
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL_MS = 30000; // 30 seconds

    constructor(whatsappManager: WhatsAppManager, mainWindow: BrowserWindow) {
        this.whatsappManager = whatsappManager;
        this.mainWindow = mainWindow;
    }

    /**
     * Start monitoring connection status
     */
    startMonitoring() {
        if (this.checkInterval) return;

        console.log('[StatusWorker] Starting status monitoring');

        // Initial check
        this.checkHealth();

        this.checkInterval = setInterval(async () => {
            await this.checkHealth();
        }, this.CHECK_INTERVAL_MS);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('[StatusWorker] Stopped status monitoring');
        }
    }

    /**
     * Check health and auto-reconnect if needed
     */
    private async checkHealth() {
        const status = this.whatsappManager.getStatus();
        console.log(`[StatusWorker] Health check: ${status}`);

        // Broadcast current status
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('whatsapp:status-change', status);
        }

        // Auto-reconnect if disconnected
        if (status === 'disconnected') {
            console.log('[StatusWorker] Detected disconnection, attempting reconnect...');
            try {
                // Only attempt reconnect if not already connecting
                // WhatsAppManager.connect() handles the check, but we can double check here
                await this.whatsappManager.connect();
            } catch (err) {
                console.error('[StatusWorker] Reconnect failed:', err);
            }
        }
    }
}
