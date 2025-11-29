# 📋 Phase 3: WhatsApp Runtime Integration - Task & Walkthrough

**Project**: Xender-In WhatsApp Automation  
**Goal**: Implement the Electron Main Process and WhatsApp Runtime Integration (Bidirectional Messaging)  
**Reference Documents**: All located in `Plan/` folder.

---

## 🛑 Pre-requisites (Critical Fixes)

Before starting the main development, you **MUST** complete these tasks:

1.  **Install Missing Package**
    - [x] Run `npm install @supabase/supabase-js` ✅ **DONE** (Already installed v2.81.1)
    - [x] Verify installation with `node -e "console.log(require('@supabase/supabase-js'))"` ✅ **DONE**

2.  **Fix Template Schema**
    - [x] Migrate Supabase `templates` table: Change `content` (TEXT) to `variants` (TEXT[]) ✅ **DONE** (Already has `variants: ARRAY`)
    - [x] Update local Dexie schema if needed (ensure alignment) ✅ **DONE** (Schema aligned)
    - [ ] Verify sync works correctly

3.  **Environment Setup**
    - [ ] Backup Dexie database (Export JSON)
    - [ ] Create new branch: `git checkout -b feature/whatsapp-integration`

4.  **Supabase Development Rule** ⚠️
    - [ ] **MANDATORY**: All Supabase interactions (Migrations, SQL execution, Table management) **MUST** be done using the **MCP Supabase Tool**.
    - [ ] Do **NOT** use the Supabase Dashboard manually unless absolutely necessary for debugging.
    - [ ] Always write SQL migrations to a file first, then apply via MCP.

---

## ✅ Task List (To Do)

### **Week 1: Infrastructure Setup** ✅ **COMPLETED**
- [x] **1.1 Install Dependencies** ✅ **DONE**
    - [x] `electron`, `electron-builder` (v33.2.1)
    - [x] `whatsapp-web.js` (v1.26.0), `puppeteer` (v18.2.1)
    - [x] `qrcode-terminal`, `node-fetch`
    - [x] `@types/electron`, `@types/puppeteer`
    - [x] `vite-plugin-electron`, `vite-plugin-electron-renderer`
- [x] **1.2 Configure Build System** ✅ **DONE**
    - [x] Update `vite.config.ts` (Dual build: Renderer + Main)
    - [x] Update `package.json` (Scripts: `electron:dev`, `electron:build`, main entry)
    - [x] Create `electron-builder.yml`
- [x] **1.3 Create Main Process Skeleton** ✅ **DONE**
    - [x] Create `src/main/main.ts` (Entry point)
    - [x] Create `src/main/preload.ts` (ContextBridge with WhatsApp API)
    - [x] Create `src/main/ipcHandlers.ts` (Placeholder handlers)
- [x] **1.4 Verify Window Launch** ✅ **DONE**
    - [x] Run `npm run electron:dev`
    - [x] Ensure React app loads inside Electron window
    - [x] DevTools opened successfully

**Week 1 Notes**:
- ✅ Electron window launches successfully
- ✅ Build process working (main.js: 1.45 kB, preload.js: 1.55 kB)
- ⚠️ Minor DevTools warnings (Autofill) - not critical
- ✅ IPC skeleton ready for expansion

---

### **Week 2: WhatsApp Core (Worker 1 & 3)** 🔄 **IN PROGRESS**
- [ ] **2.1 Implement WhatsAppManager (Worker 1)**
    - [ ] Initialize `Client` (whatsapp-web.js)
    - [ ] Handle QR Code generation
    - [ ] Handle Session persistence (LocalAuth)
    - [ ] Implement `sendMessage` (Text & Media)
- [ ] **2.2 Implement IPC Handlers (Worker 3)**
    - [ ] Connect Renderer to Main (`whatsapp:connect`, `whatsapp:send-message`)
    - [ ] Broadcast events (`whatsapp:qr-code`, `whatsapp:status-change`)
- [ ] **2.3 Build Preload Bridge (Worker 4)**
    - [ ] Expose safe API via `window.electron.whatsapp`
- [ ] **2.4 Test Authentication**
    - [ ] Verify QR code appears in Console/UI
    - [ ] Verify Session restores after restart

### **Week 3: Message Processing (Worker 2 & 6)**
- [ ] **3.1 Implement MessageProcessor (Worker 2)**
    - [ ] Create State Machine (IDLE → PENDING → PROCESSING)
    - [ ] Implement `processJob(jobId)`
    - [ ] Handle Delays (Static/Dynamic)
- [ ] **3.2 Implement SendWorker (Worker 6)**
    - [ ] Format messages (Replace variables `{{name}}`)
    - [ ] Attach assets
    - [ ] Execute sending via `WhatsAppManager`
- [ ] **3.3 Connect to Database**
    - [ ] Ensure Main Process can read `messageJobs` from Dexie (or pass data via IPC)

### **Week 4: Background Workers & Receiver (Worker 5, 7, 8)**
- [ ] **4.1 Implement QueueWorker (Worker 5)**
    - [ ] Monitor for pending jobs
    - [ ] Manage Priority Queue
- [ ] **4.2 Implement StatusWorker (Worker 7)**
    - [ ] Monitor Connection Health
    - [ ] Auto-reconnect logic
- [ ] **4.3 Implement MessageReceiverWorker (Worker 8) ⭐**
    - [ ] Listen for incoming messages
    - [ ] Detect Unsubscribe keywords
    - [ ] Broadcast `whatsapp:message-received`
- [ ] **4.4 Final Integration Testing**
    - [ ] End-to-End Send Flow
    - [ ] Receive Flow
    - [ ] Build & Package App

---

## 🚶 Walkthrough Guide

This guide explains **how** to execute the tasks above using the documentation provided in the `Plan/` folder.

### **Step 1: Understand the Architecture** ✅ **COMPLETED**
*   **Read**: `Plan/BACKEND_WHATSAPP_ANALYSIS_REPORT.md`
*   **Focus**: Look at the "Arsitektur Backend WhatsApp" diagram. Understand that we are building a **Node.js layer** (Main Process) that sits between your React UI and the WhatsApp Web instance (Puppeteer).
*   **Key Concept**: The UI *never* talks to WhatsApp directly. It sends an IPC message to the Main Process, which then delegates to the `WhatsAppManager`.

### **Step 2: Set up the Foundation (Week 1)** ✅ **COMPLETED**
*   **Reference**: `Plan/WORKERS_IMPLEMENTATION_CHECKLIST.md` -> Section "Dependencies Installation" & "Configuration Files".
*   **Action**:
    1.  ✅ Run the npm install commands.
    2.  ✅ Copy the file structure layout to your `src/main` folder.
    3.  ✅ **Crucial**: You need to configure Vite to build *both* the React app and the Electron main process. This usually involves a specific `vite-electron-plugin` or a separate build config. Check `vite.config.ts` instructions carefully.

### **Step 3: Build the Core Client (Week 2)** 🔄 **NEXT**
*   **Reference**: `Plan/WORKERS_IMPLEMENTATION_CHECKLIST.md` -> "Worker 1: WhatsAppManager".
*   **Action**:
    1.  Create `src/main/WhatsAppManager.ts`.
    2.  Implement the `initialize()` method using `whatsapp-web.js`.
    3.  **Tip**: Start simple. Just try to get the QR code to log to the terminal first.
    4.  Once that works, implement the IPC Handlers (`src/main/ipcHandlers.ts`) to send that QR code string to the React UI so it can display it.

### **Step 4: The Brain of the Operation (Week 3)**
*   **Reference**: `Plan/Guide_to_Backend_Server_Whatsapp.md` -> Section "Message Processor Implementation".
*   **Action**:
    1.  This is the hardest part. You are building a **State Machine**.
    2.  The `MessageProcessor` needs to fetch a "Job" from the database (Dexie).
    3.  Since Dexie is native to the Browser (Renderer), you have two choices:
        *   **Option A (Recommended)**: The Renderer reads the DB and sends the *entire* job data to the Main Process via IPC.
        *   **Option B**: The Main Process accesses the underlying IndexedDB (harder with Electron).
    4.  Stick to **Option A** for simplicity in Phase 3. Pass the data needed for sending (Phone numbers, Message content) to the `processJob` IPC call.

### **Step 5: The Workers (Week 4)**
*   **Reference**: `Plan/UPDATE_SUMMARY_MESSAGERECEIVER.md` & `Plan/WORKERS_IMPLEMENTATION_CHECKLIST.md`.
*   **Action**:
    1.  **QueueWorker**: Simple poller. Checks if there's work to do.
    2.  **StatusWorker**: Just a heartbeat. "Are we connected?" If no, try `client.initialize()` again.
    3.  **MessageReceiverWorker**: This is the new star.
        *   Hook into `client.on('message', ...)` in `WhatsAppManager`.
        *   Pass the message to `MessageReceiverWorker`.
        *   Check if `msg.body.toLowerCase()` is in your keyword list.
        *   If yes, fire an IPC event `whatsapp:unsubscribe-detected`.

### **Step 6: Final Polish**
*   **Action**:
    1.  Run the full build: `npm run electron:build`.
    2.  Install the resulting `.exe` or `.dmg`.
    3.  Test the full flow: Open App -> Scan QR -> Send Bulk Message -> Receive Reply.

---

## 💡 Tips for Success

1.  **IPC is Async**: Remember that communication between React and Electron is asynchronous. Always use `async/await` or Promises.
2.  **Security**: Never enable `nodeIntegration: true` in the BrowserWindow. Use the `preload.ts` bridge as designed.
3.  **Logging**: `console.log` in the Main Process appears in your **Terminal**, not the Browser Console. Use it liberally for debugging.
4.  **Whatsapp-web.js**: This library relies on the actual WhatsApp Web DOM. If WhatsApp updates their UI, this library might break. Keep it updated.

---

## 📊 Progress Summary

**Overall Progress**: 25% (Week 1 of 4 completed)

| Week | Status | Progress |
|------|--------|----------|
| Week 1: Infrastructure Setup | ✅ COMPLETED | 100% |
| Week 2: WhatsApp Core | 🔄 NEXT | 0% |
| Week 3: Message Processing | ⏸️ PENDING | 0% |
| Week 4: Workers & Receiver | ⏸️ PENDING | 0% |

**Last Updated**: 2025-11-29 12:58 WIB

---

**Ready to start Week 2?** Go to `Plan/WORKERS_IMPLEMENTATION_CHECKLIST.md` and check off the first item!
