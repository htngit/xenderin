/**
 * Global type definitions for Electron API exposed to renderer
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

    // Job processing
    processJob: (jobId: string, contacts: any[], template: any, assets?: string[]) => Promise<{ success: boolean; error?: string; jobId?: string; message?: string }>;
    pauseJob: (jobId: string) => Promise<{ success: boolean; message?: string }>;
    resumeJob: (jobId: string) => Promise<{ success: boolean; message?: string }>;

    // Event listeners
    onQRCode: (callback: (qr: string) => void) => () => void;
    onStatusChange: (callback: (status: string) => void) => () => void;
    onMessageReceived: (callback: (data: IncomingMessageData) => void) => () => void;
    onUnsubscribeDetected: (callback: (data: UnsubscribeData) => void) => () => void;
    onError: (callback: (error: ErrorData) => void) => () => void;
    onJobProgress: (callback: (progress: JobProgressData) => void) => () => void;
    onJobErrorDetail: (callback: (errorDetail: JobErrorDetailData) => void) => () => void;
}

export interface IncomingMessageData {
    id: string;
    from: string;
    to: string;
    body: string;
    type: string;
    timestamp: number;
    hasMedia: boolean;
}

export interface UnsubscribeData {
    phoneNumber: string;
    message: string;
    timestamp: string;
}

export interface ErrorData {
    type: string;
    message: string;
}

export interface JobProgressData {
    metadata: any;
    jobId: string;
    total: number;
    processed: number;
    success: number;
    failed: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
}

export interface JobErrorDetailData {
    jobId: string;
    phone: string;
    error: string;
}

declare global {
    interface Window {
        electron: {
            whatsapp: WhatsAppAPI;
        };
    }
}

export { };
