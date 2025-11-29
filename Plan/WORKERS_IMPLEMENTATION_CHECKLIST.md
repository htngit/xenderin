# 🔧 Workers Implementation Checklist - Phase 3

**Project**: Xender-In WhatsApp Automation  
**Phase**: 3 - WhatsApp Runtime Integration  
**Estimated Duration**: 4 weeks  
**Start Date**: TBD

---

## 📋 Quick Summary

**Total Workers to Build**: 8 core components (7 original + 1 MessageReceiverWorker)  
**Dependencies to Install**: 4 packages  
**Configuration Files**: 3 files  
**Estimated LOC**: ~3,000 lines

⭐ **IMPORTANT UPDATE**: Added **MessageReceiverWorker** as the 8th worker for receiving incoming WhatsApp messages. This worker is critical for future features (Unsubscribe Detection, Auto-Reply, Chatbot) and must be built in Phase 3 even though UI is not ready yet.

---

## 🎯 Worker Overview

| # | Worker | Priority | Complexity | Est. Time | Status |
|---|--------|----------|------------|-----------|--------|
| 1 | WhatsAppManager | 🔴 Critical | High | 3 days | ⏸️ Not Started |
| 2 | MessageProcessor | 🔴 Critical | High | 3 days | ⏸️ Not Started |
| 3 | IPC Handlers | 🔴 Critical | Medium | 2 days | ⏸️ Not Started |
| 4 | Preload Bridge | 🔴 Critical | Medium | 1 day | ⏸️ Not Started |
| 5 | QueueWorker | 🟡 High | Medium | 2 days | ⏸️ Not Started |
| 6 | SendWorker | 🟡 High | Medium | 2 days | ⏸️ Not Started |
| 7 | StatusWorker | 🟢 Medium | Low | 1 day | ⏸️ Not Started |
| 8 | MessageReceiverWorker ⭐ | 🔴 Critical | Medium | 2 days | ⏸️ Not Started |

---

## 📦 Dependencies Installation

### **Step 1: Install Electron**
```bash
npm install electron electron-builder
npm install -D @types/electron
```

**Verification**:
```bash
npx electron --version
```

---

### **Step 2: Install WhatsApp Dependencies**
```bash
npm install whatsapp-web.js puppeteer
npm install -D @types/puppeteer
```

**Verification**:
```bash
node -e "console.log(require('whatsapp-web.js'))"
```

---

### **Step 3: Install Missing Supabase Client** ⚠️
```bash
npm install @supabase/supabase-js
```

**Verification**:
```bash
node -e "console.log(require('@supabase/supabase-js'))"
```

---

### **Step 4: Install Additional Utilities**
```bash
npm install qrcode-terminal  # For QR code display in terminal
npm install node-fetch        # For HTTP requests in main process
```

---

## 🏗️ File Structure to Create

```
src/main/
├── main.ts                    # ⏸️ Electron entry point
├── preload.ts                 # ⏸️ Security bridge
├── ipcHandlers.ts             # ⏸️ IPC communication
├── WhatsAppManager.ts         # ⏸️ Core WhatsApp client
├── MessageProcessor.ts        # ⏸️ State machine
├── workers/
│   ├── QueueWorker.ts         # ⏸️ Job queue management
│   ├── SendWorker.ts          # ⏸️ Message sending
│   ├── StatusWorker.ts        # ⏸️ Connection monitoring
│   └── MessageReceiverWorker.ts  # ⏸️ ⭐ Incoming message handler (NEW)
├── types/
│   └── whatsapp.d.ts          # ⏸️ TypeScript definitions
└── utils/
    ├── logger.ts              # ⏸️ Logging utility
    └── retry.ts               # ⏸️ Retry logic
```

---

## 🔧 Worker 1: WhatsAppManager

**File**: `src/main/WhatsAppManager.ts`  
**Priority**: 🔴 Critical  
**Estimated Time**: 3 days

### **Responsibilities**
- [ ] Initialize whatsapp-web.js client
- [ ] Handle QR code authentication
- [ ] Manage WhatsApp session (persist & restore)
- [ ] Send messages (text + media)
- [ ] Event handling (qr, ready, authenticated, disconnected)
- [ ] Status monitoring

### **Key Methods**
```typescript
class WhatsAppManager {
  // Initialization
  [ ] async initialize(): Promise<void>
  [ ] async connect(): Promise<boolean>
  [ ] async disconnect(): Promise<void>
  
  // Messaging
  [ ] async sendMessage(to: string, content: string, assets?: string[]): Promise<boolean>
  [ ] async sendBulkMessages(jobId: string): Promise<void>
  
  // Status
  [ ] async getStatus(): Promise<'disconnected' | 'connecting' | 'ready'>
  [ ] async getQRCode(): Promise<string>
  
  // Internal
  [ ] private setupEventHandlers(): void
  [ ] private handleQRCode(qr: string): void
  [ ] private handleReady(): void
  [ ] private handleDisconnected(): void
}
```

### **Implementation Checklist**
- [ ] Create WhatsAppManager class
- [ ] Setup whatsapp-web.js client with LocalAuth
- [ ] Implement QR code event handler
- [ ] Implement ready event handler
- [ ] Implement authenticated event handler
- [ ] Implement disconnected event handler
- [ ] Implement sendMessage() for text
- [ ] Implement sendMessage() for media (MessageMedia)
- [ ] Add error handling & logging
- [ ] Test QR authentication flow
- [ ] Test message sending (text)
- [ ] Test message sending (media)
- [ ] Test reconnection logic

### **Dependencies**
```typescript
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as puppeteer from 'puppeteer';
import { BrowserWindow } from 'electron';
import * as qrcode from 'qrcode-terminal';
```

---

## 🔧 Worker 2: MessageProcessor

**File**: `src/main/MessageProcessor.ts`  
**Priority**: 🔴 Critical  
**Estimated Time**: 3 days

### **Responsibilities**
- [ ] Process bulk message jobs from messageJobs table
- [ ] Implement state machine (idle → processing → completed/failed)
- [ ] Calculate delays (static/dynamic)
- [ ] Track progress in real-time
- [ ] Handle retries for failed messages
- [ ] Update job status in Dexie

### **State Machine**
```
IDLE → PENDING → PROCESSING → COMPLETED
                      ↓
                   PAUSED
                      ↓
                   RETRYING → FAILED
```

### **Key Methods**
```typescript
class MessageProcessor {
  // Job Processing
  [ ] async processJob(jobId: string): Promise<boolean>
  [ ] async processMessage(messageData: ProcessedMessage): Promise<boolean>
  
  // State Management
  [ ] async pauseJob(jobId: string): Promise<void>
  [ ] async resumeJob(jobId: string): Promise<void>
  [ ] async cancelJob(jobId: string): Promise<void>
  
  // Progress
  [ ] private updateJobProgress(jobId: string, progress: JobProgress): Promise<void>
  [ ] private calculateDelay(mode: 'static' | 'dynamic', range: [number, number]): number
  
  // Retry
  [ ] private retryMessage(messageData: ProcessedMessage, attempt: number): Promise<boolean>
}
```

### **Implementation Checklist**
- [ ] Create MessageProcessor class
- [ ] Implement state machine logic
- [ ] Implement processJob() method
- [ ] Load job from Dexie messageJobs table
- [ ] Get contacts from ContactService
- [ ] Get template from TemplateService
- [ ] Implement delay calculation (static mode)
- [ ] Implement delay calculation (dynamic mode)
- [ ] Implement progress tracking
- [ ] Implement retry logic (max 3 attempts)
- [ ] Implement exponential backoff
- [ ] Update job status in Dexie
- [ ] Broadcast progress via IPC
- [ ] Test with small batch (5 contacts)
- [ ] Test with large batch (100+ contacts)
- [ ] Test pause/resume functionality
- [ ] Test retry logic

---

## 🔧 Worker 3: IPC Handlers

**File**: `src/main/ipcHandlers.ts`  
**Priority**: 🔴 Critical  
**Estimated Time**: 2 days

### **Responsibilities**
- [ ] Setup IPC channels (main ↔ renderer)
- [ ] Expose WhatsApp API to renderer
- [ ] Handle requests from renderer
- [ ] Broadcast events to renderer
- [ ] Error handling & validation

### **IPC Channels**
```typescript
// Renderer → Main (Invoke)
[ ] 'whatsapp:connect'
[ ] 'whatsapp:disconnect'
[ ] 'whatsapp:send-message'
[ ] 'whatsapp:get-status'
[ ] 'whatsapp:process-job'
[ ] 'whatsapp:pause-job'
[ ] 'whatsapp:resume-job'

// Main → Renderer (Send)
[ ] 'whatsapp:qr-code'
[ ] 'whatsapp:status-change'
[ ] 'whatsapp:job-progress'
[ ] 'whatsapp:message-sent'
[ ] 'whatsapp:error'
```

### **Implementation Checklist**
- [ ] Create setupWhatsAppIPC() function
- [ ] Implement 'whatsapp:connect' handler
- [ ] Implement 'whatsapp:disconnect' handler
- [ ] Implement 'whatsapp:send-message' handler
- [ ] Implement 'whatsapp:get-status' handler
- [ ] Implement 'whatsapp:process-job' handler
- [ ] Implement 'whatsapp:pause-job' handler
- [ ] Implement 'whatsapp:resume-job' handler
- [ ] Add input validation for all handlers
- [ ] Add error handling for all handlers
- [ ] Implement event broadcasting (qr-code)
- [ ] Implement event broadcasting (status-change)
- [ ] Implement event broadcasting (job-progress)
- [ ] Test IPC communication (renderer → main)
- [ ] Test IPC communication (main → renderer)

---

## 🔧 Worker 4: Preload Bridge

**File**: `src/main/preload.ts`  
**Priority**: 🔴 Critical  
**Estimated Time**: 1 day

### **Responsibilities**
- [ ] Expose limited API to renderer (contextBridge)
- [ ] Type-safe IPC wrapper
- [ ] Security enforcement (no direct Node.js access)

### **Exposed API**
```typescript
window.electron = {
  whatsapp: {
    [ ] connect: () => Promise<boolean>
    [ ] disconnect: () => Promise<void>
    [ ] sendMessage: (to, content, assets) => Promise<boolean>
    [ ] getStatus: () => Promise<string>
    [ ] processJob: (jobId) => Promise<boolean>
    [ ] pauseJob: (jobId) => Promise<void>
    [ ] resumeJob: (jobId) => Promise<void>
    [ ] onQRCode: (callback) => void
    [ ] onStatusChange: (callback) => void
    [ ] onJobProgress: (callback) => void
    [ ] onError: (callback) => void
  }
}
```

### **Implementation Checklist**
- [ ] Create preload.ts file
- [ ] Import contextBridge & ipcRenderer
- [ ] Expose whatsapp.connect()
- [ ] Expose whatsapp.disconnect()
- [ ] Expose whatsapp.sendMessage()
- [ ] Expose whatsapp.getStatus()
- [ ] Expose whatsapp.processJob()
- [ ] Expose whatsapp.pauseJob()
- [ ] Expose whatsapp.resumeJob()
- [ ] Expose whatsapp.onQRCode()
- [ ] Expose whatsapp.onStatusChange()
- [ ] Expose whatsapp.onJobProgress()
- [ ] Expose whatsapp.onError()
- [ ] Create TypeScript definitions (window.d.ts)
- [ ] Test API access from renderer
- [ ] Verify security (no Node.js access)

---

## 🔧 Worker 5: QueueWorker

**File**: `src/main/workers/QueueWorker.ts`  
**Priority**: 🟡 High  
**Estimated Time**: 2 days

### **Responsibilities**
- [ ] Monitor messageJobs table for pending jobs
- [ ] Auto-start jobs based on priority
- [ ] Queue management (FIFO/Priority)
- [ ] Concurrent job limiting
- [ ] Job scheduling

### **Key Methods**
```typescript
class QueueWorker {
  [ ] async start(): Promise<void>
  [ ] async stop(): Promise<void>
  [ ] async addToQueue(jobId: string, priority: number): Promise<void>
  [ ] async getNextJob(): Promise<string | null>
  [ ] private monitorQueue(): void
  [ ] private processQueue(): void
}
```

### **Implementation Checklist**
- [ ] Create QueueWorker class
- [ ] Implement queue data structure (priority queue)
- [ ] Implement start() method
- [ ] Implement stop() method
- [ ] Implement addToQueue() method
- [ ] Implement getNextJob() method
- [ ] Implement monitorQueue() (polling Dexie)
- [ ] Implement processQueue() (auto-start jobs)
- [ ] Add concurrent job limiting (max 1 job at a time)
- [ ] Add priority sorting
- [ ] Test queue operations
- [ ] Test auto-start functionality

---

## 🔧 Worker 6: SendWorker

**File**: `src/main/workers/SendWorker.ts`  
**Priority**: 🟡 High  
**Estimated Time**: 2 days

### **Responsibilities**
- [ ] Execute actual message sending
- [ ] Template processing (replace variables)
- [ ] Asset attachment handling
- [ ] Rate limiting enforcement
- [ ] Retry with exponential backoff

### **Key Methods**
```typescript
class SendWorker {
  [ ] async sendToContact(contact: Contact, template: Template, assets?: Asset[]): Promise<boolean>
  [ ] async sendBatch(contacts: Contact[], template: Template): Promise<BatchResult>
  [ ] private formatMessage(template: Template, contact: Contact): string
  [ ] private attachAssets(assets: Asset[]): Promise<MessageMedia[]>
  [ ] private enforceRateLimit(): Promise<void>
  [ ] private retryWithBackoff(fn: Function, maxRetries: number): Promise<any>
}
```

### **Implementation Checklist**
- [ ] Create SendWorker class
- [ ] Implement sendToContact() method
- [ ] Implement sendBatch() method
- [ ] Implement formatMessage() (template variable replacement)
- [ ] Support {{name}} variable
- [ ] Support {{phone}} variable
- [ ] Support custom variables
- [ ] Implement attachAssets() (convert to MessageMedia)
- [ ] Implement enforceRateLimit() (prevent spam)
- [ ] Implement retryWithBackoff() (exponential backoff)
- [ ] Test message formatting
- [ ] Test asset attachment
- [ ] Test rate limiting
- [ ] Test retry logic

---

## 🔧 Worker 7: StatusWorker

**File**: `src/main/workers/StatusWorker.ts`  
**Priority**: 🟢 Medium  
**Estimated Time**: 1 day

### **Responsibilities**
- [ ] Monitor WhatsApp connection status
- [ ] Auto-reconnect on disconnect
- [ ] Health check periodic
- [ ] Status broadcast to renderer
- [ ] Session validation

### **Key Methods**
```typescript
class StatusWorker {
  [ ] async startMonitoring(): Promise<void>
  [ ] async stopMonitoring(): Promise<void>
  [ ] async checkHealth(): Promise<HealthStatus>
  [ ] private handleDisconnect(): Promise<void>
  [ ] private broadcastStatus(status: string): void
}
```

### **Implementation Checklist**
- [ ] Create StatusWorker class
- [ ] Implement startMonitoring() method
- [ ] Implement stopMonitoring() method
- [ ] Implement checkHealth() method
- [ ] Implement periodic health check (every 30s)
- [ ] Implement handleDisconnect() (auto-reconnect)
- [ ] Implement broadcastStatus() (IPC send)
- [ ] Test monitoring functionality
- [ ] Test auto-reconnect
- [ ] Test status broadcasting

---

## 🔧 Worker 8: MessageReceiverWorker ⭐ NEW

**File**: `src/main/workers/MessageReceiverWorker.ts`  
**Priority**: 🔴 Critical  
**Estimated Time**: 2 days

### **Responsibilities**
- [ ] Listen to incoming WhatsApp messages
- [ ] Parse message content & metadata
- [ ] Detect unsubscribe requests (keyword matching)
- [ ] Store incoming messages to Dexie (future: `incomingMessages` table)
- [ ] Trigger unsubscribe flow (add to whitelist)
- [ ] Broadcast incoming message events to renderer
- [ ] Support for future features (auto-reply, chatbot, analytics)

### **Key Methods**
```typescript
class MessageReceiverWorker {
  // Lifecycle
  [ ] async startListening(): Promise<void>
  [ ] async stopListening(): Promise<void>
  
  // Message Handling
  [ ] async handleIncomingMessage(message: Message): Promise<void>
  [ ] async detectUnsubscribeRequest(message: Message): Promise<boolean>
  [ ] async storeIncomingMessage(message: Message): Promise<void>
  
  // Unsubscribe Flow
  [ ] async triggerUnsubscribeFlow(phoneNumber: string): Promise<void>
  [ ] async addToWhitelist(phoneNumber: string): Promise<void>
  [ ] async sendUnsubscribeConfirmation(phoneNumber: string): Promise<void>
  
  // Utilities
  [ ] private parseMessageContent(message: Message): ParsedMessage
  [ ] private broadcastIncomingMessage(message: Message): void
  [ ] private matchUnsubscribeKeywords(content: string): boolean
}
```

### **Unsubscribe Keywords**
```typescript
const UNSUBSCRIBE_KEYWORDS = [
  'unsubscribe',
  'berhenti',
  'stop',
  'hentikan',
  'tidak ingin',
  'jangan kirim',
  'keluar',
  'cancel',
  'batal'
];
```

### **Future Database Schema (Version 7)**
```typescript
// Future: Add to db.ts
export interface LocalIncomingMessage {
  id: string;
  from: string; // Phone number with @c.us
  to: string;   // Our WhatsApp number
  body: string; // Message content
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  timestamp: string;
  is_unsubscribe_request: boolean;
  processed: boolean;
  master_user_id: string;
  created_at: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
}

// Future: Add to db.ts
export interface LocalUnsubscribe {
  id: string;
  phone: string; // WhatsApp number format
  reason: string; // "Unsubscribe", "Block", etc
  unsubscribed_at: string;
  master_user_id: string;
  _syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  _lastModified: string;
  _version: number;
  _deleted: boolean;
}
```

### **Implementation Checklist**
- [ ] Create MessageReceiverWorker class
- [ ] Implement startListening() method
- [ ] Implement stopListening() method
- [ ] Implement handleIncomingMessage() method
- [ ] Parse message metadata (from, to, timestamp, type)
- [ ] Parse message content (body, media)
- [ ] Implement detectUnsubscribeRequest() method
- [ ] Create keyword matching logic (case-insensitive)
- [ ] Support multiple languages (EN, ID)
- [ ] Implement storeIncomingMessage() method
- [ ] Create incomingMessages table in Dexie (future)
- [ ] Implement triggerUnsubscribeFlow() method
- [ ] Create unsubscribes table in Dexie (future)
- [ ] Implement addToWhitelist() method
- [ ] Implement sendUnsubscribeConfirmation() method
- [ ] Implement broadcastIncomingMessage() (IPC)
- [ ] Add logging for all incoming messages
- [ ] Add error handling for message parsing
- [ ] Test with text messages
- [ ] Test with media messages
- [ ] Test unsubscribe keyword detection
- [ ] Test whitelist functionality

### **Integration with WhatsAppManager**
```typescript
// In WhatsAppManager.ts - Add this to setupEventHandlers()
private setupEventHandlers(): void {
  // ... existing handlers (qr, ready, authenticated, disconnected)
  
  // NEW: Message received handler
  this.client.on('message', async (message: Message) => {
    console.log('Message received:', message.from, message.body);
    
    // Forward to MessageReceiverWorker
    await this.messageReceiverWorker.handleIncomingMessage(message);
  });
  
  // NEW: Message acknowledgement handler (optional)
  this.client.on('message_ack', (message: Message, ack: MessageAck) => {
    console.log('Message ACK:', message.id._serialized, ack);
  });
}
```

### **IPC Events to Add**
```typescript
// In ipcHandlers.ts - Add these events
mainWindow.webContents.send('whatsapp:message-received', {
  id: message.id._serialized,
  from: message.from,
  to: message.to,
  body: message.body,
  type: message.type,
  timestamp: message.timestamp,
  isUnsubscribeRequest: isUnsubscribe
});

mainWindow.webContents.send('whatsapp:unsubscribe-detected', {
  phoneNumber: message.from,
  message: message.body,
  timestamp: new Date().toISOString()
});
```

### **Preload API to Add**
```typescript
// In preload.ts - Add these methods
window.electron = {
  whatsapp: {
    // ... existing methods
    
    // NEW: Listen to incoming messages
    onMessageReceived: (callback: (data: IncomingMessageData) => void) => {
      ipcRenderer.on('whatsapp:message-received', (_, data) => callback(data));
    },
    
    // NEW: Listen to unsubscribe events
    onUnsubscribeDetected: (callback: (data: UnsubscribeData) => void) => {
      ipcRenderer.on('whatsapp:unsubscribe-detected', (_, data) => callback(data));
    }
  }
}
```

### **Why Build This Now?**

1. **Foundation for Future Features** ✅
   - Unsubscribe detection (compliance requirement)
   - Auto-reply system
   - Chatbot integration
   - Message analytics
   - Customer support automation

2. **Compliance & Best Practices** ✅
   - Anti-spam regulations require unsubscribe mechanism
   - Respect recipient preferences
   - Reduce account restrictions risk

3. **Architecture Benefits** ✅
   - Bidirectional communication (send + receive)
   - Complete WhatsApp integration
   - Better testing capabilities
   - Scalable for future features

4. **User Experience** ✅
   - Automatic whitelist management
   - No manual intervention needed
   - Professional communication

### **Note for Phase 3**
- ⚠️ **UI tidak perlu dibuat sekarang** - Worker ini hanya backend
- ✅ **Database schema** akan ditambahkan di future version (v7)
- ✅ **Logging** sudah cukup untuk monitoring saat ini
- ✅ **IPC events** sudah siap untuk future UI integration

### **Future UI Features** (Not in Phase 3)
- Inbox page untuk view incoming messages
- Unsubscribe list management
- Auto-reply configuration
- Chatbot flow builder
- Message analytics dashboard

---

## ⚙️ Configuration Files

### **1. electron-builder.yml**
```yaml
[ ] Create electron-builder.yml
[ ] Configure appId
[ ] Configure productName
[ ] Configure directories (output, buildResources)
[ ] Configure files (include/exclude)
[ ] Configure win configuration (target: nsis)
[ ] Configure mac configuration (target: dmg)
[ ] Configure linux configuration (target: AppImage)
[ ] Test build process
```

### **2. vite.config.ts (Update)**
```typescript
[ ] Add Electron plugin
[ ] Configure dual build (renderer + main)
[ ] Configure build.rollupOptions for main process
[ ] Configure build.outDir for Electron
[ ] Test build output
```

### **3. package.json (Update)**
```json
[ ] Add "main": "dist-electron/main.js"
[ ] Add script: "electron:dev"
[ ] Add script: "electron:build"
[ ] Add script: "electron:serve"
[ ] Add script: "package:win"
[ ] Add script: "package:mac"
[ ] Add script: "package:linux"
[ ] Test all scripts
```

---

## 🧪 Testing Checklist

### **Unit Tests**
- [ ] WhatsAppManager.sendMessage()
- [ ] MessageProcessor.calculateDelay()
- [ ] SendWorker.formatMessage()
- [ ] QueueWorker.getNextJob()
- [ ] MessageReceiverWorker.detectUnsubscribeRequest() ⭐ NEW
- [ ] MessageReceiverWorker.matchUnsubscribeKeywords() ⭐ NEW

### **Integration Tests**
- [ ] IPC communication (renderer ↔ main)
- [ ] WhatsApp authentication flow
- [ ] Message sending flow (end-to-end)
- [ ] Job processing flow
- [ ] Message receiving flow ⭐ NEW
- [ ] Unsubscribe detection flow ⭐ NEW

### **Manual Tests**
- [ ] QR code authentication
- [ ] Send single message
- [ ] Send bulk messages (5 contacts)
- [ ] Send bulk messages (100+ contacts)
- [ ] Pause/resume job
- [ ] Disconnect/reconnect WhatsApp
- [ ] Error handling (invalid phone number)
- [ ] Error handling (WhatsApp disconnected)
- [ ] Receive incoming message ⭐ NEW
- [ ] Detect unsubscribe keyword ⭐ NEW
- [ ] Verify whitelist addition ⭐ NEW
- [ ] Verify unsubscribe confirmation sent ⭐ NEW

---

## 📊 Progress Tracking

### **Week 1: Infrastructure Setup**
- [ ] Day 1-2: Install dependencies & setup structure
- [ ] Day 3-4: Implement main.ts & preload.ts
- [ ] Day 5: Test Electron window launch

### **Week 2: WhatsApp Core**
- [ ] Day 6-8: Implement WhatsAppManager
- [ ] Day 9-10: Implement IPC Handlers

### **Week 3: Message Processing**
- [ ] Day 11-13: Implement MessageProcessor
- [ ] Day 14-15: Implement SendWorker

### **Week 4: Workers & Receiving** ⭐ UPDATED
- [ ] Day 16-17: Implement QueueWorker & StatusWorker
- [ ] Day 18-19: Implement MessageReceiverWorker ⭐ NEW
- [ ] Day 20: Integration testing & documentation

**Note**: Timeline extended from 4 weeks to account for MessageReceiverWorker implementation.

---

## 🚨 Critical Issues to Fix First

Before starting Phase 3 development:

1. **Install Missing Package** 🔴
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Fix Template Schema** 🔴
   - Migrate Supabase templates table to use `variants: TEXT[]`
   - Update migration file
   - Test sync between Dexie ↔ Supabase

3. **Backup Database** 🟡
   ```bash
   # Export Dexie data
   # Backup Supabase (via dashboard)
   ```

4. **Create Feature Branch** 🟢
   ```bash
   git checkout -b feature/whatsapp-integration
   ```

---

## 📚 Resources & References

### **Documentation**
- [whatsapp-web.js Guide](https://wwebjs.dev/)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Puppeteer API](https://pptr.dev/)

### **Internal Docs**
- `Architecture_WhatsappAutomation.md` - Overall architecture
- `Guide_to_Backend_Server_Whatsapp.md` - Detailed implementation guide
- `PROJECT_STATUS_AND_ROADMAP.md` - Current status

### **Code References**
- `src/lib/db.ts` - Database schema (messageJobs table)
- `src/lib/services/QuotaService.ts` - Quota management
- `src/lib/services/ContactService.ts` - Contact operations
- `src/lib/services/TemplateService.ts` - Template operations

---

## ✅ Definition of Done

A worker is considered **DONE** when:

- [ ] Code implemented & follows TypeScript strict mode
- [ ] All methods have JSDoc comments
- [ ] Error handling implemented
- [ ] Logging added for debugging
- [ ] Unit tests written (if applicable)
- [ ] Integration tests passed
- [ ] Manual testing completed
- [ ] Code reviewed
- [ ] Documentation updated

---

## 🎯 Success Metrics

### **Phase 3 Completion Criteria**
- [ ] All 8 workers implemented ⭐ UPDATED (was 7)
- [ ] WhatsApp authentication working (QR code)
- [ ] Single message sending working
- [ ] Bulk message sending working (100+ contacts)
- [ ] Job queue system working
- [ ] Progress tracking real-time
- [ ] Error handling robust
- [ ] Auto-reconnect working
- [ ] Electron build successful
- [ ] End-to-end testing passed
- [ ] **Message receiving working** ⭐ NEW
- [ ] **Unsubscribe detection working** ⭐ NEW
- [ ] **Whitelist functionality working** ⭐ NEW

### **Additional Success Criteria for MessageReceiverWorker**
- [ ] Can receive text messages
- [ ] Can receive media messages (image, video, audio, document)
- [ ] Unsubscribe keywords detected correctly (EN + ID)
- [ ] Unsubscribe confirmation sent automatically
- [ ] Whitelist updated in database
- [ ] IPC events broadcasted to renderer
- [ ] Logging working for all incoming messages
- [ ] No crashes on malformed messages

---

**Last Updated**: 29 November 2025  
**Maintained By**: Development Team  
**Status**: Ready for Phase 3 Development
