import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

/**
 * Type definitions for WhatsApp API
 */
export interface WhatsAppAPI {
    // Connection
    connect: () => Promise<{ success: boolean; connected?: boolean; error?: string }>;
    disconnect: () => Promise<{ success: boolean; error?: string }>;

    // Messaging
    sendMessage: (to: string, content: string, assets?: string[]) => Promise<{ success: boolean; error?: string }>;

    // Status
    getStatus: () => Promise<{ status: string; ready: boolean }>;
    getClientInfo: () => Promise<any>;

    // Job processing (for Week 3)
    processJob: (jobId: string, contacts: any[], template: any) => Promise<{ success: boolean; error?: string; jobId?: string; message?: string }>;
    pauseJob: (jobId: string) => Promise<{ success: boolean; message?: string }>;
    resumeJob: (jobId: string) => Promise<{ success: boolean; message?: string }>;

    // Event listeners
    onQRCode: (callback: (qr: string) => void) => () => void;
    onStatusChange: (callback: (status: string) => void) => () => void;
    onMessageReceived: (callback: (data: any) => void) => () => void;
    onError: (callback: (error: any) => void) => () => void;
    onJobProgress: (callback: (progress: any) => void) => () => void;
    onJobErrorDetail: (callback: (errorDetail: any) => void) => () => void;
}

/**
 * Expose WhatsApp API to renderer process
 */
contextBridge.exposeInMainWorld('electron', {
    whatsapp: {
        // Connection methods
        connect: () => ipcRenderer.invoke('whatsapp:connect'),

        disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),

        // Messaging methods
        sendMessage: (to: string, content: string, assets?: string[]) =>
            ipcRenderer.invoke('whatsapp:send-message', { to, content, assets }),

        // Status methods
        getStatus: () => ipcRenderer.invoke('whatsapp:get-status'),

        getClientInfo: () => ipcRenderer.invoke('whatsapp:get-client-info'),

        // Job processing methods (for Week 3)
        // Updated to accept options object from SendPage: { template, assets, mode, delayRange }
        processJob: (jobId: string, contacts: any[], options: { template: any; assets?: string[]; mode?: string; delayRange?: number[] }) =>
            ipcRenderer.invoke('whatsapp:process-job', {
                jobId,
                contacts,
                template: options.template,  // Extract template from options
                assets: options.assets,
                delayConfig: { mode: options.mode, delayRange: options.delayRange }
            }),

        pauseJob: (jobId: string) =>
            ipcRenderer.invoke('whatsapp:pause-job', { jobId }),

        resumeJob: (jobId: string) =>
            ipcRenderer.invoke('whatsapp:resume-job', { jobId }),

        // Event listeners
        onQRCode: (callback: (qr: string) => void) => {
            const subscription = (_event: IpcRendererEvent, qr: string) => callback(qr);
            ipcRenderer.on('whatsapp:qr-code', subscription);

            // Return unsubscribe function
            return () => {
                ipcRenderer.removeListener('whatsapp:qr-code', subscription);
            };
        },

        onStatusChange: (callback: (status: string) => void) => {
            const subscription = (_event: IpcRendererEvent, status: string) => callback(status);
            ipcRenderer.on('whatsapp:status-change', subscription);

            return () => {
                ipcRenderer.removeListener('whatsapp:status-change', subscription);
            };
        },

        onMessageReceived: (callback: (data: any) => void) => {
            const subscription = (_event: IpcRendererEvent, data: any) => callback(data);
            ipcRenderer.on('whatsapp:message-received', subscription);

            return () => {
                ipcRenderer.removeListener('whatsapp:message-received', subscription);
            };
        },


        onError: (callback: (error: any) => void) => {
            const subscription = (_event: IpcRendererEvent, error: any) => callback(error);
            ipcRenderer.on('whatsapp:error', subscription);

            return () => {
                ipcRenderer.removeListener('whatsapp:error', subscription);
            };
        },

        onJobProgress: (callback: (progress: any) => void) => {
            const subscription = (_event: IpcRendererEvent, progress: any) => callback(progress);
            ipcRenderer.on('whatsapp:job-progress', subscription);

            return () => {
                ipcRenderer.removeListener('whatsapp:job-progress', subscription);
            };
        },

        onJobErrorDetail: (callback: (errorDetail: any) => void) => {
            const subscription = (_event: IpcRendererEvent, errorDetail: any) => callback(errorDetail);
            ipcRenderer.on('whatsapp:job-error-detail', subscription);

            return () => {
                ipcRenderer.removeListener('whatsapp:job-error-detail', subscription);
            };
        }
    } as WhatsAppAPI
});
