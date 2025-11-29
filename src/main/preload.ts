import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    whatsapp: {
        connect: () => ipcRenderer.invoke('whatsapp:connect'),
        disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
        sendMessage: (to: string, content: string, assets?: string[]) => ipcRenderer.invoke('whatsapp:send-message', { to, content, assets }),
        getStatus: () => ipcRenderer.invoke('whatsapp:get-status'),

        // Events
        onQRCode: (callback: (qr: string) => void) => {
            const subscription = (_: any, qr: string) => callback(qr);
            ipcRenderer.on('whatsapp:qr-code', subscription);
            return () => ipcRenderer.removeListener('whatsapp:qr-code', subscription);
        },
        onStatusChange: (callback: (status: string) => void) => {
            const subscription = (_: any, status: string) => callback(status);
            ipcRenderer.on('whatsapp:status-change', subscription);
            return () => ipcRenderer.removeListener('whatsapp:status-change', subscription);
        },
        onMessageReceived: (callback: (data: any) => void) => {
            const subscription = (_: any, data: any) => callback(data);
            ipcRenderer.on('whatsapp:message-received', subscription);
            return () => ipcRenderer.removeListener('whatsapp:message-received', subscription);
        },
        onUnsubscribeDetected: (callback: (data: any) => void) => {
            const subscription = (_: any, data: any) => callback(data);
            ipcRenderer.on('whatsapp:unsubscribe-detected', subscription);
            return () => ipcRenderer.removeListener('whatsapp:unsubscribe-detected', subscription);
        }
    }
});
