# **Xender-In WhatsApp Runtime Integration Guide**

## **Overview**

This guide outlines the implementation plan for integrating WhatsApp runtime capabilities into Xender-In using `whatsapp-web.js` and Puppeteer. The implementation will follow the local-first architecture principle where the WhatsApp automation runs fully on the user's device while Supabase remains as the meta disk for authentication, metadata, and quota management.

## **Current Architecture Summary**

### **Services Overview**
- **ServiceInitializationManager**: Singleton manager for initializing and accessing all application services
- **SyncManager**: Handles data synchronization between local IndexedDB and Supabase
- **AuthService**: Authentication and user management
- **TemplateService**: Template management with variants and variables
- **ContactService**: Contact management with group associations
- **GroupService**: Contact group management
- **AssetService**: Asset file management including caching
- **HistoryService**: Activity and message history tracking
- **QuotaService**: Quota reservation and commitment with RPC calls
- **PaymentService**: Payment processing with DUITKU integration

### **Database Schema (Dexie)**
- **IndexedDB with offline-first approach**
- **WAL (Write-Ahead Logging)**: `messageJobs` table for tracking sending operations
- **Sync metadata**: `_syncStatus`, `_lastModified`, `_version`, `_deleted` for each record

### **Current Send Flow (Phase 2 - Mock)**
1. User configures: group, template, delay range, sending mode
2. **Reserve quota** → Supabase RPC
3. **Persist to WAL** → `messageJobs` table
4. **Simulate sending process** → Mock implementation
5. **Commit quota** → Update usage
6. **Create history log**

## **Phase 3: WhatsApp Runtime Implementation Plan**

### **1. Architecture Overview**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Main Process    │    │   WhatsApp      │
│   (Renderer)    │◄──►│   (Node.js)      │◄──►│   Runtime       │
│                 │    │                  │    │ (whatsapp-web.js│
│ SendPage.tsx    │    │ WhatsAppManager  │    │ + Puppeteer)    │
│ ServiceContext  │    │ MessageProcessor │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Dexie DB      │◄──►│   IPC Bridge     │    │ WhatsApp Web    │
│ (messageJobs,   │    │ (secure preload) │    │ (browser tab)   │
│ contacts, etc)  │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **2. Core Components to Implement**

#### **2.1 WhatsApp Manager (Main Process)**
```typescript
// src/main/WhatsAppManager.ts
import { Browser, Page } from 'puppeteer';
import { WhatsApp, Message } from 'whatsapp-web.js';
import { ipcMain, BrowserWindow } from 'electron';

export class WhatsAppManager {
  private whatsappClient: WhatsApp | null = null;
  private browser: Browser | null = null;
  private mainWindow: BrowserWindow | null = null;
  private isReady: boolean = false;
  
  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupIPC();
  }
  
  async initialize(): Promise<void>;
  async connect(): Promise<boolean>;
  async disconnect(): Promise<void>;
  async sendMessage(to: string, content: string, assets?: string[]): Promise<boolean>;
  async sendBulkMessages(jobId: string): Promise<void>;
  async getStatus(): Promise<string>;
  async getQRCode(): Promise<string>;
  
  private setupIPC(): void;
  private setupEventHandlers(): void;
}
```

#### **2.2 Message Processor (State Machine)**
```typescript
// src/main/MessageProcessor.ts
export class MessageProcessor {
  private state: 'idle' | 'processing' | 'paused' | 'error' = 'idle';
  private currentJobId: string | null = null;
  
  async processJob(jobId: string): Promise<void>;
  async processMessage(messageData: ProcessedMessage): Promise<boolean>;
  private calculateDelay(sendingMode: 'static' | 'dynamic', delayRange: [number, number]): number;
  private updateJobStatus(jobId: string, status: string): Promise<void>;
}
```

#### **2.3 IPC Communication Layer**
```typescript
// src/main/ipcHandlers.ts
export function setupWhatsAppIPC(whatsappManager: WhatsAppManager): void;
```

#### **2.4 Preload Bridge (Renderer Access)**
```typescript
// src/preload/whatsappBridge.ts
const { contextBridge, ipcRenderer } = require('electron');
export const whatsappAPI = {
  connect: () => ipcRenderer.invoke('whatsapp-connect'),
  disconnect: () => ipcRenderer.invoke('whatsapp-disconnect'),
  sendMessage: (to: string, content: string, assets?: string[]) => 
    ipcRenderer.invoke('whatsapp-send-message', to, content, assets),
  getStatus: () => ipcRenderer.invoke('whatsapp-get-status'),
  onStatusChange: (callback: (status: string) => void) => 
    ipcRenderer.on('whatsapp-status-change', callback),
};
```

### **3. Implementation Steps**

#### **Step 1: Set up Electron Main Process Structure**
1. Create `src/main/` directory
2. Implement `main.ts` with WhatsApp integration
3. Set up secure IPC channels
4. Configure Puppeteer to run WhatsApp Web

#### **Step 2: Implement WhatsApp Manager**
1. Integrate `whatsapp-web.js` with Puppeteer
2. Implement connection lifecycle
3. Add QR code display for authentication
4. Implement message sending with error handling

#### **Step 3: Build Message Processor State Machine**
1. Create state machine for bulk message processing
2. Implement delay logic (static/dynamic)
3. Add retry mechanisms for failed messages
4. Implement progress tracking

#### **Step 4: Update Frontend Service**
1. Create `WhatsAppService` in renderer process
2. Connect to main process via IPC
3. Update `simulateSend` to use real WhatsApp API
4. Add real-time progress updates

#### **Step 5: Update Database Operations**
1. Modify `messageJobs` processing to use real WhatsApp
2. Update status tracking (processing, completed, failed)
3. Enhance error handling and retry logic

### **4. Detailed Implementation**

#### **4.1 Package Dependencies**
```bash
npm install whatsapp-web.js puppeteer
npm install -D @types/puppeteer
```

#### **4.2 Main Process Implementation**
```typescript
// src/main/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { WhatsAppManager } from './WhatsAppManager';

let mainWindow: BrowserWindow | null = null;
let whatsappManager: WhatsAppManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile('index.html');
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(() => {
  createWindow();
  whatsappManager = new WhatsAppManager(mainWindow);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

#### **4.3 WhatsApp Integration**
```typescript
// src/main/WhatsAppManager.ts
import { WhatsApp, Client, LocalAuth } from 'whatsapp-web.js';
import * as puppeteer from 'puppeteer';

export class WhatsAppManager {
  private client: Client | null = null;
  private mainWindow: BrowserWindow | null = null;
  
  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.initializeClient();
  }
  
  private initializeClient(): void {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.client.on('qr', (qr: string) => {
      this.mainWindow.webContents.send('whatsapp-qr', qr);
    });
    
    this.client.on('ready', () => {
      this.mainWindow.webContents.send('whatsapp-status', 'ready');
    });
    
    this.client.on('authenticated', () => {
      this.mainWindow.webContents.send('whatsapp-status', 'authenticated');
    });
    
    this.client.on('auth_failure', (msg: string) => {
      this.mainWindow.webContents.send('whatsapp-status', 'auth_failure');
    });
    
    this.client.on('disconnected', () => {
      this.mainWindow.webContents.send('whatsapp-status', 'disconnected');
    });
  }
  
  async connect(): Promise<void> {
    if (this.client) {
      this.client.initialize();
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
    }
  }
  
  async sendMessage(to: string, content: string, assets?: string[]): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      // Format phone number (add @c.us if not present)
      const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;
      
      if (assets && assets.length > 0) {
        // Send media with caption
        for (const assetUrl of assets) {
          const media = await MessageMedia.fromUrl(assetUrl);
          await this.client.sendMessage(formattedNumber, media, {
            caption: content
          });
        }
      } else {
        // Send text message
        await this.client.sendMessage(formattedNumber, content);
      }
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }
  
  async processJob(jobId: string): Promise<void> {
    // Get job details from IndexedDB
    // Process each message in the job with delays
    // Update progress in real-time
  }
}
```

### **5. Service Integration**

#### **5.1 Update SendPage.tsx**
Replace the `simulateSend` function with real WhatsApp processing:

```typescript
const sendMessages = async () => {
  // ... (validation code remains the same)
  
  try {
    // Step 1: Reserve quota (same as before)
    const reserveResult = await quotaService.reserveQuota(currentUserId, targetContacts.length);
    if (!reserveResult.success) {
      throw new Error('Failed to reserve quota');
    }

    // Step 2: Create job in WAL (same as before)
    const jobId = crypto.randomUUID();
    await db.messageJobs.add({
      // ... (job configuration)
      status: 'pending',
    });

    // Step 3: Send to WhatsApp Manager for processing
    const success = await window.electron.whatsapp.processJob(jobId);
    
    if (success) {
      // Step 4: Commit quota (same as before)
      await quotaService.commitQuota(reserveResult.reservation_id, successCount);
      
      // Update job status
      await db.messageJobs.update(jobId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    }

    // ... (rest of the logic)
  } catch (error) {
    // ... (error handling)
  }
};
```

### **6. State Machine for Message Processing**

Implement a robust state machine to handle bulk messaging:

```typescript
// Core states
enum ProcessingState {
  IDLE = 'idle',
  PENDING = 'pending',
  PROCESSING = 'processing', 
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

class BulkMessageProcessor {
  private state: ProcessingState = ProcessingState.IDLE;
  private progress: { 
    processed: number; 
    total: number; 
    success: number; 
    failed: number 
  } = { processed: 0, total: 0, success: 0, failed: 0 };
  
  async processJob(jobId: string): Promise<boolean> {
    this.state = ProcessingState.PENDING;
    
    const job = await db.messageJobs.get(jobId);
    if (!job) return false;
    
    this.state = ProcessingState.PROCESSING;
    this.progress.total = job.total_contacts;
    
    // Get all contacts for this job
    const contacts = await this.getContactsForJob(job);
    
    // Process each contact
    for (let i = 0; i < contacts.length; i++) {
      if (this.state !== ProcessingState.PROCESSING) break;
      
      const contact = contacts[i];
      const template = await templateService.getTemplateById(job.template_id);
      const messageContent = this.getFormattedMessage(template);
      
      const success = await this.sendMessageWithRetry(
        contact.phone, 
        messageContent, 
        job.config
      );
      
      this.updateProgress(success);
      await this.delayWithMode(job.config);
    }
    
    this.state = this.progress.failed > 0 ? ProcessingState.FAILED : ProcessingState.COMPLETED;
    return this.progress.failed === 0;
  }
  
  private async delayWithMode(config: { sendingMode: 'static' | 'dynamic'; delayRange: [number, number] }): Promise<void> {
    let delayMs: number;
    
    if (config.sendingMode === 'static') {
      delayMs = config.delayRange[0] * 1000;
    } else {
      const [min, max] = config.delayRange;
      delayMs = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
    }
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
```

### **7. Error Handling & Retry Logic**

Implement comprehensive error handling:

```typescript
private async sendMessageWithRetry(to: string, content: string, config: any, maxRetries: number = 3): Promise<boolean> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const success = await this.whatsappManager.sendMessage(to, content);
      if (success) return true;
      
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    } catch (error) {
      lastError = error as Error;
      console.error(`Send attempt ${attempt + 1} failed:`, error);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  // Log final failure
  console.error(`Failed to send message to ${to} after ${maxRetries} attempts:`, lastError);
  return false;
}
```

### **8. UI Integration**

Update the UI to show real-time progress:

```tsx
// In SendPage.tsx
const [jobProgress, setJobProgress] = useState({
  status: 'idle' as 'idle' | 'processing' | 'completed' | 'failed',
  processed: 0,
  total: 0,
  success: 0,
  failed: 0
});

// Listen to real-time updates from main process
useEffect(() => {
  const unsubscribe = window.electron.whatsapp.onJobProgress((progress) => {
    setJobProgress(progress);
  });
  
  return unsubscribe;
}, []);

// Show progress bar in UI
{jobProgress.status === 'processing' && (
  <div className="mt-4">
    <Progress value={(jobProgress.processed / jobProgress.total) * 100} />
    <p className="text-sm mt-2">
      {jobProgress.processed} of {jobProgress.total} messages processed
      ({jobProgress.success} success, {jobProgress.failed} failed)
    </p>
  </div>
)}
```

### **9. Security Considerations**

1. **Secure IPC**: Only expose necessary APIs through preload script
2. **Input Validation**: Validate all message content before sending
3. **Rate Limiting**: Implement delays to prevent account restrictions
4. **Session Persistence**: Store WhatsApp sessions securely

### **10. Testing Strategy**

1. **Unit Tests**: Test message proces/compresssing logic
2. **Integration Tests**: Test main/renderer process communication
3. **End-to-End**: Test complete send flow with real WhatsApp
4. **Error Scenarios**: Test connection failures, rate limits, etc.

### **11. Future Development: Unsubscribe/Whitelist Feature**

This section outlines a critical future feature for compliance and user experience: automatic detection of unsubscribe requests and contact whitelisting.

#### **11.1 Feature Overview**
- **Purpose**: Automatically detect "Unsubscribe" requests from recipients and add their numbers to a whitelist
- **Compliance**: Helps maintain anti-spam compliance and reduces account restrictions
- **User Experience**: Respects recipient preferences by stopping unwanted messages

#### **11.2 Database Schema Updates**
```typescript
// Future schema update for version 7
export interface LocalUnsubscribe {
  id: string;
  phone: string; // WhatsApp number format (e.g., "6281234567890@c.us")
  reason: string; // "Unsubscribe", "Block", etc
  unsubscribed_at: string;
  master_user_id: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted: boolean;
}

// Update schema version 7
this.version(7).stores({
  // ... existing tables
  unsubscribes: '&id, phone, master_user_id, unsubscribed_at, _syncStatus, _lastModified, _version, _deleted'
});
```

#### **11.3 WhatsApp Message Reception Integration**
```typescript
// In WhatsAppManager.ts - Future implementation
private setupEventHandlers(): void {
  // ... existing handlers

  // New handler for incoming messages
  this.client.on('message', async (message: Message) => {
    this.mainWindow.webContents.send('whatsapp-message-received', {
      id: message.id._serialized,
      from: message.from,
      to: message.to,
      body: message.body,
      type: message.type,
      timestamp: message.timestamp
    });

    // Future: Check for unsubscribe requests when feature is enabled
    if (await this.isUnsubscribeFeatureEnabled()) {
      await this.checkUnsubscribeRequest(message);
    }
  });
}

private async checkUnsubscribeRequest(message: Message): Promise<void> {
  const body = message.body.toLowerCase().trim();
  const unsubKeywords = ['unsubscribe', 'berhenti', 'stop', 'hentikan', 'tidak ingin', 'jangan kirim'];

  if (unsubKeywords.some(keyword => body.includes(keyword))) {
    // Add to unsubscribe list
    await this.addUnsubscribeEntry(message.from);

    // Send confirmation message (optional)
    await this.client.sendMessage(message.from, "Terima kasih, nomor Anda telah dimasukkan ke dalam daftar whitelist. Anda tidak akan menerima pesan lagi dari kami.");

    // Send event to frontend
    this.mainWindow.webContents.send('contact-unsubscribed', {
      phone: message.from,
      message: message.body
    });
  }
}

private async isUnsubscribeFeatureEnabled(): Promise<boolean> {
  // Check user settings from IndexedDB
  // Implementation will connect to settings service
  const settings = await this.getUserSettings();
  return settings.enableUnsubscribeDetection || false;
}
```

#### **11.4 Unsubscribe Service**
```typescript
// src/lib/services/UnsubscribeService.ts - Future implementation
export class UnsubscribeService {
  private syncManager: SyncManager;
  private masterUserId: string | null = null;

  constructor(syncManager?: SyncManager) {
    this.syncManager = syncManager || new SyncManager();
  }

  async initialize(masterUserId: string) {
    this.masterUserId = masterUserId;
    this.syncManager.setMasterUserId(masterUserId);
  }

  async addUnsubscribe(phone: string, reason: string = 'Unsubscribe'): Promise<void> {
    if (!this.masterUserId) throw new Error('Master user ID not set');

    const unsubscribeEntry: LocalUnsubscribe = {
      id: crypto.randomUUID(),
      phone,
      reason,
      unsubscribed_at: new Date().toISOString(),
      master_user_id: this.masterUserId,
      _syncStatus: 'pending',
      _lastModified: new Date().toISOString(),
      _version: 1,
      _deleted: false
    };

    await db.unsubscribes.add(unsubscribeEntry);

    // Add to sync queue
    await this.syncManager.addToSyncQueue(
      'unsubscribes', 'create', unsubscribeEntry.id, unsubscribeEntry
    );
  }

  async isUnsubscribed(phone: string): Promise<boolean> {
    if (!this.masterUserId) return false;

    const unsubscribe = await db.unsubscribes
      .where('phone').equals(phone)
      .and(item => !item._deleted)
      .first();

    return !!unsubscribe;
  }

  async getUnsubscribes(): Promise<LocalUnsubscribe[]> {
    if (!this.masterUserId) return [];

    return db.unsubscribes
      .where('master_user_id').equals(this.masterUserId!)
      .and(item => !item._deleted)
      .toArray();
  }
}
```

#### **11.5 Integration with ContactService**
```typescript
// Update ContactService.ts to filter unsubscribed contacts
async getContacts(): Promise<Contact[]> {
  // ... existing code

  // Future: Filter out unsubscribed contacts when feature is enabled
  if (await this.isUnsubscribeFeatureEnabled()) {
    const unsubscribedPhones = await this.getUnsubscribedPhones();
    const filteredContacts = contacts.filter(contact =>
      !unsubscribedPhones.includes(contact.phone)
    );
    return filteredContacts;
  }

  return contacts;
}

private async isUnsubscribeFeatureEnabled(): Promise<boolean> {
  // Check user settings
  // Implementation connects to settings service
  const settings = await settingsService.getUserSettings();
  return settings.enableUnsubscribeDetection || false;
}
```

#### **11.6 Settings Integration (Security Tab)**
The unsubscribe feature activation must be controlled through the Settings page under the Security tab:

```typescript
// In Settings service, add unsubscribe settings
export interface UserSettings {
  // ... existing settings
  enableUnsubscribeDetection: boolean;
  unsubscribeMessage: string; // Message to append to outgoing messages
}

// In Security tab of Settings page:
const SecurityTab = () => {
  const [enableUnsubscribeDetection, setEnableUnsubscribeDetection] = useState(false);
  const [unsubscribeMessage, setUnsubscribeMessage] = useState(
    "Jika anda terganggu dengan pesan ini, mohon balas pesan ini dengan \"Unsubscribe\" agar kami melakukan whitelist pada nomor anda"
  );

  const saveSecuritySettings = async () => {
    await settingsService.updateSettings({
      // ... other settings
      enableUnsubscribeDetection,
      unsubscribeMessage
    });
  };

  return (
    <div className="space-y-6">
      {/* ... existing security settings */}

      {/* Unsubscribe Feature Section */}
      <Card>
        <CardHeader>
          <CardTitle>Unsubscribe Detection</CardTitle>
          <CardDescription>Enable automatic detection of unsubscribe requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-unsubscribe">Enable Unsubscribe Detection</Label>
            <Switch
              id="enable-unsubscribe"
              checked={enableUnsubscribeDetection}
              onCheckedChange={setEnableUnsubscribeDetection}
            />
          </div>

          <div>
            <Label htmlFor="unsubscribe-message">Unsubscribe Message</Label>
            <Textarea
              id="unsubscribe-message"
              value={unsubscribeMessage}
              onChange={(e) => setUnsubscribeMessage(e.target.value)}
              placeholder="Message to append to outgoing messages"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

#### **11.7 SendPage Integration**
```typescript
// In SendPage.tsx - Future implementation
const getFormattedMessage = (template: Template, contact: Contact) => {
  // Get random template variant
  const randomVariant = templateService.getRandomVariant(template);
  let message = randomVariant;

  // Append unsubscribe message if feature is enabled
  if (settings.enableUnsubscribeDetection) {
    message = `${randomVariant}\n\n${settings.unsubscribeMessage}`;
  }

  return message;
};
```

#### **11.8 Contacts Page Analytics Integration**

The unsubscribe feature also requires analytics capabilities on the Contacts page. The current analytics cards (Total Contacts, Groups, Average Group Size) should be updated to include unsubscribe metrics. **This UI update is part of the future development and will be implemented together with the unsubscribe feature.**

Currently, the Contacts page shows: Total Contacts, Groups, and Average Group Size. In the future, this will be updated to: Total Contacts, Groups, and Unsubscribed (replacing Average Group Size).

```tsx
// Update ContactsPage.tsx analytics cards
const ContactsAnalytics = () => {
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalUnsubscribes, setTotalUnsubscribes] = useState(0); // NEW: Replace average group size
  const [unsubscribeRate, setUnsubscribeRate] = useState(0); // Additional metric

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    const { contactService, groupService, unsubscribeService } = useServices();

    const contacts = await contactService.getContacts();
    const groups = await groupService.getGroups();
    const unsubscribes = await unsubscribeService.getUnsubscribes();

    setTotalContacts(contacts.length);
    setTotalGroups(groups.length);
    setTotalUnsubscribes(unsubscribes.length);

    // Calculate unsubscribe rate
    if (contacts.length > 0) {
      setUnsubscribeRate(parseFloat(((unsubscribes.length / contacts.length) * 100).toFixed(2)));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Total Contacts Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalContacts}</div>
        </CardContent>
      </Card>

      {/* Total Groups Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Groups</CardTitle>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalGroups}</div>
        </CardContent>
      </Card>

      {/* NEW: Total Unsubscribes Card - replacing Average Group Size */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unsubscribed</CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUnsubscribes}</div>
          <p className="text-xs text-muted-foreground">
            {unsubscribeRate}% of total contacts
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
```

#### **11.9 Enhanced Contact Filtering and Management**

To support unsubscribe analytics, the ContactService should provide additional methods:

```typescript
// In ContactService.ts - Future implementation
async getContactsWithStatus(): Promise<Array<Contact & { isUnsubscribed: boolean }>> {
  const contacts = await this.getContacts();
  const unsubscribedPhones = await this.getUnsubscribedPhones();

  return contacts.map(contact => ({
    ...contact,
    isUnsubscribed: unsubscribedPhones.includes(contact.phone)
  }));
}

async getUnsubscribedContacts(): Promise<Contact[]> {
  const contacts = await this.getContacts();
  const unsubscribedPhones = await this.getUnsubscribedPhones();

  return contacts.filter(contact => unsubscribedPhones.includes(contact.phone));
}

async getActiveContacts(): Promise<Contact[]> {
  // Contacts that are not unsubscribed
  const contacts = await this.getContacts();
  const unsubscribedPhones = await this.getUnsubscribedPhones();

  return contacts.filter(contact => !unsubscribedPhones.includes(contact.phone));
}
```

#### **11.10 Preparations for Current Implementation**
To ensure the current codebase supports this future feature, the following preparations should be made:

1. **Settings Service**: Ensure settings are stored in IndexedDB with extensible structure
2. **Message Processing**: Design the message processing pipeline to support conditional message modifications
3. **Contact Filtering**: Design the contact retrieval system to support filtering based on various criteria
4. **Event System**: Ensure the IPC and event system can handle future message reception events
5. **Database Schema**: Plan for future schema migrations to include unsubscribe table
6. **Analytics Preparation**: Prepare Contacts page structure to support future unsubscribe analytics card (will replace Average Group Size card)
7. **Contact Status Tracking**: Modify ContactService to support status-based filtering (active vs unsubscribed)

This comprehensive approach ensures that the unsubscribe feature is fully integrated across the application, from message reception and processing to analytics and reporting, while maintaining the local-first architecture principles and enhancing user experience.

**Note**: The analytics UI updates (Unsubscribed card on Contacts page) are specifically designated as Future Development and will be implemented together with the complete unsubscribe feature, not as part of the initial WhatsApp runtime implementation.

This implementation plan provides a complete roadmap to integrate WhatsApp runtime capabilities while maintaining the local-first architecture principles and ensuring robust error handling, real-time progress updates, and proper quota management.