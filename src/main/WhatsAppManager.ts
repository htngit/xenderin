import { Client, LocalAuth, Message, MessageMedia } from 'whatsapp-web.js';
import { BrowserWindow, app } from 'electron';
import * as qrcode from 'qrcode-terminal';
import { MessageReceiverWorker } from './workers/MessageReceiverWorker';
import path from 'path';
import fs from 'fs';

/**
 * WhatsAppManager - Core WhatsApp client manager
 * Handles connection, authentication, and message operations
 */
export class WhatsAppManager {
    private client: Client | null = null;
    private mainWindow: BrowserWindow | null = null;
    private status: 'disconnected' | 'connecting' | 'ready' = 'disconnected';
    private messageReceiverWorker: MessageReceiverWorker | null = null;

    // File cache to avoid re-downloading the same asset URL during a session
    private fileCache: Map<string, string> = new Map();

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        this.initializeClient();
    }

    /**
     * Set the MessageReceiverWorker
     */
    setMessageReceiverWorker(worker: MessageReceiverWorker) {
        this.messageReceiverWorker = worker;
    }

    /**
     * Get the correct executable path for Puppeteer in production
     */
    private getChromiumExecutablePath(): string | undefined {
        if (!app.isPackaged) {
            // Development mode - let Puppeteer use default
            return undefined;
        }

        // Production mode - point to unpacked chromium
        // Path: resources/app.asar.unpacked/node_modules/whatsapp-web.js/node_modules/puppeteer-core/.local-chromium/win64-1045629/chrome-win/chrome.exe
        const chromiumPath = path.join(
            process.resourcesPath,
            'app.asar.unpacked',
            'node_modules',
            'whatsapp-web.js',
            'node_modules',
            'puppeteer-core',
            '.local-chromium',
            'win64-1045629',
            'chrome-win',
            'chrome.exe'
        );

        console.log('[WhatsAppManager] Checking Chromium path:', chromiumPath);

        if (fs.existsSync(chromiumPath)) {
            console.log('[WhatsAppManager] Chromium found at:', chromiumPath);
            return chromiumPath;
        } else {
            console.error('[WhatsAppManager] Chromium not found at expected path:', chromiumPath);
            // Return undefined to let Puppeteer try its default resolution
            return undefined;
        }
    }

    /**
     * Initialize WhatsApp client with LocalAuth strategy
     */
    private initializeClient(): void {
        try {
            console.log('[WhatsAppManager] Initializing client...');

            const executablePath = this.getChromiumExecutablePath();

            // Puppeteer configuration
            const puppeteerConfig: any = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            };

            // Set executablePath if we found it
            if (executablePath) {
                puppeteerConfig.executablePath = executablePath;
            }

            console.log('[WhatsAppManager] Puppeteer config:', JSON.stringify(puppeteerConfig, null, 2));

            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: app.isPackaged
                        ? path.join(app.getPath('userData'), '.wwebjs_auth')
                        : '.wwebjs_auth'
                }),
                puppeteer: puppeteerConfig,
                // Fix for "Cannot read properties of undefined (reading 'VERSION')" error
                // This tells the library to fetch the latest WhatsApp Web version from a remote cache
                webVersionCache: {
                    type: 'remote',
                    remotePath: 'https://raw.githubusercontent.com/AntoniaSaGe/AntoniaSaGe/main/whatsapp-web-version'
                }
            });

            this.setupEventHandlers();
        } catch (error) {
            console.error('[WhatsAppManager] Error initializing client:', error);
            this.status = 'disconnected';
            this.broadcastStatus('disconnected');
        }
    }

    /**
     * Setup event handlers for WhatsApp client
     */
    private setupEventHandlers(): void {
        if (!this.client) return;

        // QR Code event
        this.client.on('qr', (qr: string) => {
            console.log('[WhatsAppManager] QR Code received');

            // Display QR in terminal for debugging
            qrcode.generate(qr, { small: true });

            // Send QR to renderer
            if (this.mainWindow) {
                this.mainWindow.webContents.send('whatsapp:qr-code', qr);
            }

            this.status = 'connecting';
            this.broadcastStatus('connecting');
        });

        // Ready event
        this.client.on('ready', () => {
            console.log('[WhatsAppManager] Client is ready!');
            this.status = 'ready';
            this.broadcastStatus('ready');
        });

        // Authenticated event
        this.client.on('authenticated', () => {
            console.log('[WhatsAppManager] Client authenticated');
            // Some whatsapp-web.js versions don't fire 'ready' properly with webVersionCache
            // Set a fallback timeout to force 'ready' status
            setTimeout(() => {
                if (this.status !== 'ready') {
                    console.log('[WhatsAppManager] Fallback: Setting status to ready after authentication');
                    this.status = 'ready';
                    this.broadcastStatus('ready');
                }
            }, 5000); // 5 second fallback
        });

        // Authentication failure event
        this.client.on('auth_failure', (msg) => {
            console.error('[WhatsAppManager] Authentication failed:', msg);
            this.status = 'disconnected';
            this.broadcastStatus('disconnected');

            if (this.mainWindow) {
                this.mainWindow.webContents.send('whatsapp:error', {
                    type: 'auth_failure',
                    message: 'Authentication failed. Please try again.'
                });
            }
        });

        // Disconnected event
        this.client.on('disconnected', (reason) => {
            console.log('[WhatsAppManager] Client disconnected:', reason);
            this.status = 'disconnected';
            this.broadcastStatus('disconnected');
        });

        // Loading screen event
        this.client.on('loading_screen', (percent, message) => {
            console.log(`[WhatsAppManager] Loading... ${percent}% - ${message}`);
        });

        // Message received event
        this.client.on('message', async (message: Message) => {
            console.log('[WhatsAppManager] Message received:', message.from);

            // Forward to MessageReceiverWorker
            if (this.messageReceiverWorker) {
                await this.messageReceiverWorker.handleIncomingMessage(message);
            } else {
                // Fallback broadcast if worker not set
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('whatsapp:message-received', {
                        id: message.id._serialized,
                        from: message.from,
                        to: message.to,
                        body: message.body,
                        type: message.type,
                        timestamp: message.timestamp,
                        hasMedia: message.hasMedia
                    });
                }
            }
        });
    }

    /**
     * Connect to WhatsApp
     */
    async connect(): Promise<boolean> {
        try {
            console.log('[WhatsAppManager] Connecting...');

            if (!this.client) {
                throw new Error('Client not initialized');
            }

            // Don't initialize if already ready
            if (this.status === 'ready') {
                console.log('[WhatsAppManager] Already connected');
                return true;
            }

            // Reset status to connecting before initializing
            this.status = 'connecting';
            this.broadcastStatus('connecting');

            await this.client.initialize();
            return true;
        } catch (error) {
            console.error('[WhatsAppManager] Connection error:', error);
            this.status = 'disconnected';
            this.broadcastStatus('disconnected');

            if (this.mainWindow) {
                this.mainWindow.webContents.send('whatsapp:error', {
                    type: 'connection_error',
                    message: error instanceof Error ? error.message : 'Unknown connection error'
                });
            }
            throw error;
        }
    }

    /**
     * Disconnect from WhatsApp
     */
    async disconnect(): Promise<void> {
        try {
            console.log('[WhatsAppManager] Disconnecting...');

            if (this.client) {
                await this.client.destroy();
                this.client = null;
            }

            this.status = 'disconnected';
            this.broadcastStatus('disconnected');

            // Clear file cache on disconnect
            this.clearFileCache();

            // Re-initialize client so it can be connected again
            this.initializeClient();
        } catch (error) {
            console.error('[WhatsAppManager] Disconnect error:', error);
            this.status = 'disconnected';
            this.broadcastStatus('disconnected');
            throw error;
        }
    }

    /**
     * Format phone number to WhatsApp ID format
     * Handles:
     * - Removing non-numeric characters
     * - Replacing leading '0' with '62' (Indonesia)
     * - Appending '@c.us'
     */
    private formatPhoneNumber(phone: string): string {
        // 1. Remove all non-numeric characters
        let formatted = phone.replace(/\D/g, '');

        // 2. Handle leading '0' -> '62'
        if (formatted.startsWith('0')) {
            formatted = '62' + formatted.slice(1);
        }

        // 3. Append suffix if not present
        if (!formatted.endsWith('@c.us')) {
            formatted += '@c.us';
        }

        return formatted;
    }

    /**
     * Download a file from URL to temporary directory with retry mechanism and caching
     * @param url - URL of the file to download
     * @param maxRetries - Maximum number of retries (default: 3)
     * @returns Path to the downloaded file
     */
    private async downloadFile(url: string, maxRetries = 3): Promise<string> {
        // Check cache first
        const cachedPath = this.fileCache.get(url);
        if (cachedPath && fs.existsSync(cachedPath)) {
            console.log(`[WhatsAppManager] Using cached file for: ${url}`);
            return cachedPath;
        }

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const filePath = await this._downloadFileInternal(url);
                // Cache the downloaded file path
                this.fileCache.set(url, filePath);
                console.log(`[WhatsAppManager] File cached for URL: ${url}`);
                return filePath;
            } catch (error) {
                console.warn(`[WhatsAppManager] Download attempt ${attempt + 1}/${maxRetries} failed:`, error);
                if (attempt === maxRetries - 1) throw error;
                // Exponential backoff: 1s, 2s, 4s...
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
        throw new Error(`Failed to download file after ${maxRetries} attempts`);
    }

    /**
     * Internal implementation of file download
     */
    private async _downloadFileInternal(url: string): Promise<string> {
        const https = await import('https');
        const http = await import('http');
        const fsAsync = await import('fs');
        const pathModule = await import('path');
        const os = await import('os');

        return new Promise((resolve, reject) => {
            try {
                // Generate temp file path
                const tempDir = os.tmpdir();
                const fileName = `whatsapp_media_${Date.now()}_${pathModule.basename(url).split('?')[0]}`;
                const tempFilePath = pathModule.join(tempDir, fileName);

                console.log(`[WhatsAppManager] Downloading to: ${tempFilePath}`);

                // Choose http or https based on URL
                const client = url.startsWith('https://') ? https : http;

                const file = fsAsync.createWriteStream(tempFilePath);

                client.get(url, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
                        return;
                    }

                    response.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        console.log(`[WhatsAppManager] Download complete: ${tempFilePath}`);
                        resolve(tempFilePath);
                    });

                    file.on('error', (err) => {
                        fsAsync.unlink(tempFilePath, () => { }); // Delete the file on error
                        reject(err);
                    });
                }).on('error', (err) => {
                    fsAsync.unlink(tempFilePath, () => { }); // Delete the file on error
                    reject(err);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Clear the file cache and delete cached files
     */
    clearFileCache(): void {
        console.log(`[WhatsAppManager] Clearing file cache (${this.fileCache.size} files)`);
        for (const [url, filePath] of this.fileCache.entries()) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[WhatsAppManager] Deleted cached file: ${filePath}`);
                }
            } catch (error) {
                console.warn(`[WhatsAppManager] Failed to delete cached file: ${filePath}`, error);
            }
        }
        this.fileCache.clear();
    }

    /**
     * Send text message
     * @param to - Phone number with country code (e.g., "6281234567890@c.us")
     * @param content - Message content
     */
    async sendMessage(to: string, content: string): Promise<boolean> {
        try {
            if (!this.client || this.status !== 'ready') {
                throw new Error('WhatsApp client is not ready');
            }

            // Format phone number
            const chatId = this.formatPhoneNumber(to);
            console.log(`[WhatsAppManager] Sending message to ${to} (formatted: ${chatId})`);

            await this.client.sendMessage(chatId, content);
            console.log(`[WhatsAppManager] Message sent successfully to ${to}`);

            return true;
        } catch (error) {
            console.error('[WhatsAppManager] Send message error:', error);
            throw error;
        }
    }

    /**
     * Send message with media
     * @param to - Phone number with country code
     * @param content - Message content
     * @param mediaPath - Path to media file or URL
     */
    async sendMessageWithMedia(
        to: string,
        content: string,
        mediaPath: string
    ): Promise<boolean> {
        try {
            if (!this.client || this.status !== 'ready') {
                throw new Error('WhatsApp client is not ready');
            }

            // Format phone number
            const chatId = this.formatPhoneNumber(to);
            console.log(`[WhatsAppManager] Sending media message to ${to} (formatted: ${chatId})`);

            let media: MessageMedia;
            let localFilePath: string;

            // Check if mediaPath is a URL
            if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
                console.log(`[WhatsAppManager] Downloading remote file: ${mediaPath}`);
                // downloadFile now uses cache internally - no need to manage cleanup here for cached files
                localFilePath = await this.downloadFile(mediaPath);
                media = MessageMedia.fromFilePath(localFilePath);
            } else {
                // Local file path
                localFilePath = mediaPath;
                media = MessageMedia.fromFilePath(mediaPath);
            }

            await this.client.sendMessage(chatId, media, { caption: content });
            console.log(`[WhatsAppManager] Media message sent successfully to ${to}`);

            // Note: We don't clean up cached files here - they will be cleaned when:
            // 1. Job completes (MessageProcessor should call clearFileCache)
            // 2. Client disconnects
            // 3. App closes

            return true;
        } catch (error) {
            console.error('[WhatsAppManager] Send media message error:', error);
            throw error;
        }
    }

    /**
     * Get current status
     */
    getStatus(): 'disconnected' | 'connecting' | 'ready' {
        return this.status;
    }

    /**
     * Check if client is ready
     */
    isReady(): boolean {
        return this.status === 'ready' && this.client !== null;
    }

    /**
     * Broadcast status change to renderer
     */
    private broadcastStatus(status: string): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('whatsapp:status-change', status);
        }
    }

    /**
     * Get client info (for debugging)
     */
    async getClientInfo(): Promise<any> {
        try {
            if (!this.client || this.status !== 'ready') {
                return null;
            }

            const info = this.client.info;
            return {
                wid: info.wid._serialized,
                pushname: info.pushname,
                platform: info.platform
            };
        } catch (error) {
            console.error('[WhatsAppManager] Get client info error:', error);
            return null;
        }
    }
}
