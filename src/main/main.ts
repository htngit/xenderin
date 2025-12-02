import { app, BrowserWindow } from 'electron';
import path from 'path';
import { setupIPC } from './ipcHandlers';
import { WhatsAppManager } from './WhatsAppManager';
import { MessageProcessor } from './MessageProcessor';
import { QueueWorker } from './workers/QueueWorker';
import { StatusWorker } from './workers/StatusWorker';
import { MessageReceiverWorker } from './workers/MessageReceiverWorker';

let mainWindow: BrowserWindow | null = null;
let whatsappManager: WhatsAppManager | null = null;
let messageProcessor: MessageProcessor | null = null;
let queueWorker: QueueWorker | null = null;
let statusWorker: StatusWorker | null = null;
let messageReceiverWorker: MessageReceiverWorker | null = null;

const createWindow = () => {
    // Determine icon path based on environment
    const iconPath = process.env.VITE_DEV_SERVER_URL
        ? path.join(__dirname, '../../public/icon.png')
        : path.join(path.dirname(app.getAppPath()), 'icon.ico');

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // Enable web security but allow local file access for packaged app
            webSecurity: true,
        },
    });

    // Set application icon for Windows taskbar and window
    if (process.platform === 'win32') {
        mainWindow.setIcon(iconPath);
    }

    // Initialize Workers
    console.log('[Main] Initializing workers...');

    // 1. WhatsApp Manager (Core)
    whatsappManager = new WhatsAppManager(mainWindow);

    // 2. Message Processor (State Machine)
    messageProcessor = new MessageProcessor(whatsappManager, mainWindow);

    // 3. Queue Worker (Job Management)
    queueWorker = new QueueWorker(messageProcessor);

    // 4. Status Worker (Monitoring)
    statusWorker = new StatusWorker(whatsappManager, mainWindow);

    // 5. Message Receiver Worker (Incoming Messages)
    messageReceiverWorker = new MessageReceiverWorker(whatsappManager, mainWindow);

    // Inject MessageReceiverWorker into WhatsAppManager
    whatsappManager.setMessageReceiverWorker(messageReceiverWorker);

    // Start Status Worker
    statusWorker.startMonitoring();

    // Setup IPC handlers with dependencies
    setupIPC(mainWindow, whatsappManager, messageProcessor, queueWorker);

    // Load the app
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        // In production, load from app.asar
        const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
        console.log('[Main] Loading from:', indexPath);
        mainWindow.loadFile(indexPath);
    }

    // Prevent reload (F5, Ctrl+R)
    mainWindow.webContents.on('before-input-event', (_event, input) => {
        if (input.key === 'F5' || (input.control && input.key === 'r')) {
            _event.preventDefault();
        }
    });

    // Error listeners
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error('[Main] Failed to load:', errorCode, errorDescription);
    });

    mainWindow.webContents.on('crashed', (_event, killed) => {
        console.error('[Main] Renderer crashed:', killed);
    });
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Stop workers
    if (statusWorker) {
        statusWorker.stopMonitoring();
    }

    if (whatsappManager) {
        whatsappManager.disconnect();
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});
