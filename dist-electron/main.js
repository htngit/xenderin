"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const whatsappWeb_js = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const qrcode__namespace = /* @__PURE__ */ _interopNamespaceDefault(qrcode);
class WhatsAppManager {
  constructor(mainWindow2) {
    __publicField(this, "client", null);
    __publicField(this, "mainWindow", null);
    __publicField(this, "status", "disconnected");
    __publicField(this, "messageReceiverWorker", null);
    // File cache to avoid re-downloading the same asset URL during a session
    __publicField(this, "fileCache", /* @__PURE__ */ new Map());
    this.mainWindow = mainWindow2;
    this.initializeClient();
  }
  /**
   * Set the MessageReceiverWorker
   */
  setMessageReceiverWorker(worker) {
    this.messageReceiverWorker = worker;
  }
  /**
   * Get the correct executable path for Puppeteer in production
   */
  getChromiumExecutablePath() {
    if (!electron.app.isPackaged) {
      return void 0;
    }
    const chromiumPath = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "whatsapp-web.js",
      "node_modules",
      "puppeteer-core",
      ".local-chromium",
      "win64-1045629",
      "chrome-win",
      "chrome.exe"
    );
    console.log("[WhatsAppManager] Checking Chromium path:", chromiumPath);
    if (fs.existsSync(chromiumPath)) {
      console.log("[WhatsAppManager] Chromium found at:", chromiumPath);
      return chromiumPath;
    } else {
      console.error("[WhatsAppManager] Chromium not found at expected path:", chromiumPath);
      return void 0;
    }
  }
  /**
   * Initialize WhatsApp client with LocalAuth strategy
   */
  initializeClient() {
    try {
      console.log("[WhatsAppManager] Initializing client...");
      const executablePath = this.getChromiumExecutablePath();
      const puppeteerConfig = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu"
        ]
      };
      if (executablePath) {
        puppeteerConfig.executablePath = executablePath;
      }
      console.log("[WhatsAppManager] Puppeteer config:", JSON.stringify(puppeteerConfig, null, 2));
      this.client = new whatsappWeb_js.Client({
        authStrategy: new whatsappWeb_js.LocalAuth({
          dataPath: electron.app.isPackaged ? path.join(electron.app.getPath("userData"), ".wwebjs_auth") : ".wwebjs_auth"
        }),
        puppeteer: puppeteerConfig,
        // Fix for "Cannot read properties of undefined (reading 'VERSION')" error
        // This tells the library to fetch the latest WhatsApp Web version from a remote cache
        webVersionCache: {
          type: "remote",
          remotePath: "https://raw.githubusercontent.com/AntoniaSaGe/AntoniaSaGe/main/whatsapp-web-version"
        }
      });
      this.setupEventHandlers();
    } catch (error) {
      console.error("[WhatsAppManager] Error initializing client:", error);
      this.status = "disconnected";
      this.broadcastStatus("disconnected");
    }
  }
  /**
   * Setup event handlers for WhatsApp client
   */
  setupEventHandlers() {
    if (!this.client) return;
    this.client.on("qr", (qr) => {
      console.log("[WhatsAppManager] QR Code received");
      qrcode__namespace.generate(qr, { small: true });
      if (this.mainWindow) {
        this.mainWindow.webContents.send("whatsapp:qr-code", qr);
      }
      this.status = "connecting";
      this.broadcastStatus("connecting");
    });
    this.client.on("ready", () => {
      console.log("[WhatsAppManager] Client is ready!");
      this.status = "ready";
      this.broadcastStatus("ready");
    });
    this.client.on("authenticated", () => {
      console.log("[WhatsAppManager] Client authenticated");
      setTimeout(() => {
        if (this.status !== "ready") {
          console.log("[WhatsAppManager] Fallback: Setting status to ready after authentication");
          this.status = "ready";
          this.broadcastStatus("ready");
        }
      }, 5e3);
    });
    this.client.on("auth_failure", (msg) => {
      console.error("[WhatsAppManager] Authentication failed:", msg);
      this.status = "disconnected";
      this.broadcastStatus("disconnected");
      if (this.mainWindow) {
        this.mainWindow.webContents.send("whatsapp:error", {
          type: "auth_failure",
          message: "Authentication failed. Please try again."
        });
      }
    });
    this.client.on("disconnected", (reason) => {
      console.log("[WhatsAppManager] Client disconnected:", reason);
      this.status = "disconnected";
      this.broadcastStatus("disconnected");
    });
    this.client.on("loading_screen", (percent, message) => {
      console.log(`[WhatsAppManager] Loading... ${percent}% - ${message}`);
    });
    this.client.on("message", async (message) => {
      console.log("[WhatsAppManager] Message received:", message.from);
      if (this.messageReceiverWorker) {
        await this.messageReceiverWorker.handleIncomingMessage(message);
      } else {
        if (this.mainWindow) {
          this.mainWindow.webContents.send("whatsapp:message-received", {
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
  async connect() {
    try {
      console.log("[WhatsAppManager] Connecting...");
      if (!this.client) {
        throw new Error("Client not initialized");
      }
      if (this.status === "ready") {
        console.log("[WhatsAppManager] Already connected");
        return true;
      }
      this.status = "connecting";
      this.broadcastStatus("connecting");
      await this.client.initialize();
      return true;
    } catch (error) {
      console.error("[WhatsAppManager] Connection error:", error);
      this.status = "disconnected";
      this.broadcastStatus("disconnected");
      if (this.mainWindow) {
        this.mainWindow.webContents.send("whatsapp:error", {
          type: "connection_error",
          message: error instanceof Error ? error.message : "Unknown connection error"
        });
      }
      throw error;
    }
  }
  /**
   * Disconnect from WhatsApp
   */
  async disconnect() {
    try {
      console.log("[WhatsAppManager] Disconnecting...");
      if (this.client) {
        await this.client.destroy();
        this.client = null;
      }
      this.status = "disconnected";
      this.broadcastStatus("disconnected");
      this.clearFileCache();
      this.initializeClient();
    } catch (error) {
      console.error("[WhatsAppManager] Disconnect error:", error);
      this.status = "disconnected";
      this.broadcastStatus("disconnected");
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
  formatPhoneNumber(phone) {
    let formatted = phone.replace(/\D/g, "");
    if (formatted.startsWith("0")) {
      formatted = "62" + formatted.slice(1);
    }
    if (!formatted.endsWith("@c.us")) {
      formatted += "@c.us";
    }
    return formatted;
  }
  /**
   * Download a file from URL to temporary directory with retry mechanism and caching
   * @param url - URL of the file to download
   * @param maxRetries - Maximum number of retries (default: 3)
   * @returns Path to the downloaded file
   */
  async downloadFile(url, maxRetries = 3) {
    const cachedPath = this.fileCache.get(url);
    if (cachedPath && fs.existsSync(cachedPath)) {
      console.log(`[WhatsAppManager] Using cached file for: ${url}`);
      return cachedPath;
    }
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const filePath = await this._downloadFileInternal(url);
        this.fileCache.set(url, filePath);
        console.log(`[WhatsAppManager] File cached for URL: ${url}`);
        return filePath;
      } catch (error) {
        console.warn(`[WhatsAppManager] Download attempt ${attempt + 1}/${maxRetries} failed:`, error);
        if (attempt === maxRetries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1e3));
      }
    }
    throw new Error(`Failed to download file after ${maxRetries} attempts`);
  }
  /**
   * Internal implementation of file download
   */
  async _downloadFileInternal(url) {
    const https = await import("https");
    const http = await import("http");
    const fsAsync = await import("fs");
    const pathModule = await import("path");
    const os = await import("os");
    return new Promise((resolve, reject) => {
      try {
        const tempDir = os.tmpdir();
        const fileName = `whatsapp_media_${Date.now()}_${pathModule.basename(url).split("?")[0]}`;
        const tempFilePath = pathModule.join(tempDir, fileName);
        console.log(`[WhatsAppManager] Downloading to: ${tempFilePath}`);
        const client = url.startsWith("https://") ? https : http;
        const file = fsAsync.createWriteStream(tempFilePath);
        client.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            console.log(`[WhatsAppManager] Download complete: ${tempFilePath}`);
            resolve(tempFilePath);
          });
          file.on("error", (err) => {
            fsAsync.unlink(tempFilePath, () => {
            });
            reject(err);
          });
        }).on("error", (err) => {
          fsAsync.unlink(tempFilePath, () => {
          });
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
  clearFileCache() {
    console.log(`[WhatsAppManager] Clearing file cache (${this.fileCache.size} files)`);
    for (const [, filePath] of this.fileCache.entries()) {
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
  async sendMessage(to, content) {
    try {
      if (!this.client || this.status !== "ready") {
        throw new Error("WhatsApp client is not ready");
      }
      const chatId = this.formatPhoneNumber(to);
      console.log(`[WhatsAppManager] Sending message to ${to} (formatted: ${chatId})`);
      const isRegistered = await this.client.isRegisteredUser(chatId);
      if (!isRegistered) {
        console.warn(`[WhatsAppManager] User ${to} is not registered on WhatsApp.`);
        throw new Error(`User ${to} is not registered on WhatsApp`);
      }
      await this.client.sendMessage(chatId, content);
      console.log(`[WhatsAppManager] Message sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error("[WhatsAppManager] Send message error:", error);
      throw error;
    }
  }
  /**
   * Send message with media
   * @param to - Phone number with country code
   * @param content - Message content
   * @param mediaPath - Path to media file or URL
   */
  async sendMessageWithMedia(to, content, mediaPath) {
    try {
      if (!this.client || this.status !== "ready") {
        throw new Error("WhatsApp client is not ready");
      }
      const chatId = this.formatPhoneNumber(to);
      console.log(`[WhatsAppManager] Sending media message to ${to} (formatted: ${chatId})`);
      const isRegistered = await this.client.isRegisteredUser(chatId);
      if (!isRegistered) {
        console.warn(`[WhatsAppManager] User ${to} is not registered on WhatsApp.`);
        throw new Error(`User ${to} is not registered on WhatsApp`);
      }
      let media;
      let localFilePath;
      if (mediaPath.startsWith("http://") || mediaPath.startsWith("https://")) {
        console.log(`[WhatsAppManager] Downloading remote file: ${mediaPath}`);
        localFilePath = await this.downloadFile(mediaPath);
        media = whatsappWeb_js.MessageMedia.fromFilePath(localFilePath);
      } else {
        localFilePath = mediaPath;
        media = whatsappWeb_js.MessageMedia.fromFilePath(mediaPath);
      }
      await this.client.sendMessage(chatId, media, { caption: content });
      console.log(`[WhatsAppManager] Media message sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error("[WhatsAppManager] Send media message error:", error);
      throw error;
    }
  }
  /**
   * Get current status
   */
  getStatus() {
    return this.status;
  }
  /**
   * Check if client is ready
   */
  isReady() {
    return this.status === "ready" && this.client !== null;
  }
  /**
   * Broadcast status change to renderer
   */
  broadcastStatus(status) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("whatsapp:status-change", status);
    }
  }
  /**
   * Get client info (for debugging)
   */
  async getClientInfo() {
    try {
      if (!this.client || this.status !== "ready") {
        return null;
      }
      const info = this.client.info;
      return {
        wid: info.wid._serialized,
        pushname: info.pushname,
        platform: info.platform
      };
    } catch (error) {
      console.error("[WhatsAppManager] Get client info error:", error);
      return null;
    }
  }
}
class MessageProcessor {
  constructor(whatsappManager2, mainWindow2) {
    __publicField(this, "whatsappManager");
    __publicField(this, "mainWindow");
    __publicField(this, "isProcessing", false);
    __publicField(this, "isPaused", false);
    __publicField(this, "currentJob", null);
    this.whatsappManager = whatsappManager2;
    this.mainWindow = mainWindow2;
  }
  /**
   * Get current job being processed
   */
  getCurrentJob() {
    return this.currentJob;
  }
  /**
   * Process a bulk message job
   */
  async processJob(job) {
    var _a;
    console.log("[MessageProcessor] Received job template:", JSON.stringify(job.template, null, 2));
    if (!job.template) {
      throw new Error("Template is required for job processing");
    }
    const hasContent = job.template.content && job.template.content.trim().length > 0;
    const hasVariants = Array.isArray(job.template.variants) && job.template.variants.length > 0;
    console.log(`[MessageProcessor] Template check - hasContent: ${hasContent}, hasVariants: ${hasVariants}`);
    if (!hasContent && !hasVariants) {
      console.error("[MessageProcessor] Template validation failed:", {
        content: job.template.content,
        variants: job.template.variants,
        templateKeys: Object.keys(job.template)
      });
      throw new Error(`Template must have content or variants defined. Received: content=${job.template.content}, variants=${JSON.stringify(job.template.variants)}`);
    }
    if (this.isProcessing) {
      throw new Error("Already processing a job");
    }
    this.isProcessing = true;
    this.currentJob = job;
    this.isPaused = false;
    console.log(`[MessageProcessor] Starting job ${job.jobId} with ${job.contacts.length} contacts`);
    let processed = 0;
    let success = 0;
    let failed = 0;
    const messageLogs = [];
    this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, "processing");
    for (const contact of job.contacts) {
      if (this.isPaused) {
        this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, "paused");
        await this.waitForResume();
        this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, "processing");
      }
      if (!this.isProcessing) break;
      try {
        let templateContent = job.template.content || "";
        if (job.template.variants && job.template.variants.length > 0) {
          const randomIndex = Math.floor(Math.random() * job.template.variants.length);
          templateContent = job.template.variants[randomIndex];
        }
        const messageContent = this.formatMessage(templateContent, contact);
        console.log(`[MessageProcessor] Template has ${((_a = job.template.variants) == null ? void 0 : _a.length) || 0} variants`);
        console.log(`[MessageProcessor] Selected template content: "${templateContent}"`);
        console.log(`[MessageProcessor] Formatted message: "${messageContent}"`);
        console.log(`[MessageProcessor] Has assets: ${job.assets && job.assets.length > 0}`);
        if (job.assets && job.assets.length > 0) {
          await this.whatsappManager.sendMessageWithMedia(contact.phone, messageContent, job.assets[0]);
        } else {
          await this.whatsappManager.sendMessage(contact.phone, messageContent);
        }
        messageLogs.push({
          id: crypto.randomUUID(),
          activity_log_id: job.jobId,
          contact_id: contact.id || "",
          contact_name: contact.name || contact.contact_name || "Unknown Contact",
          contact_phone: contact.phone || contact.contact_phone || "Unknown Phone",
          status: "sent",
          sent_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        success++;
      } catch (error) {
        console.error(`[MessageProcessor] Failed to send to ${contact.phone}:`, error);
        messageLogs.push({
          id: crypto.randomUUID(),
          activity_log_id: job.jobId,
          contact_id: contact.id || "",
          contact_name: contact.name || contact.contact_name || "Unknown Contact",
          contact_phone: contact.phone || contact.contact_phone || "Unknown Phone",
          status: "failed",
          sent_at: (/* @__PURE__ */ new Date()).toISOString(),
          error_message: error instanceof Error ? error.message : String(error)
        });
        if (this.mainWindow) {
          this.mainWindow.webContents.send("whatsapp:job-error-detail", {
            jobId: job.jobId,
            phone: contact.phone,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        failed++;
      }
      processed++;
      this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, "processing");
      const delayMs = this.calculateDelayFromConfig(job.delayConfig);
      await this.delay(delayMs);
    }
    this.isProcessing = false;
    this.currentJob = null;
    this.reportProgress(job.jobId, processed, job.contacts.length, success, failed, "completed", {
      logs: messageLogs
    });
    console.log(`[MessageProcessor] Job ${job.jobId} completed`);
  }
  /**
   * Pause current job
   */
  pause() {
    if (this.isProcessing && !this.isPaused) {
      this.isPaused = true;
      console.log("[MessageProcessor] Job paused");
      return true;
    }
    return false;
  }
  /**
   * Resume current job
   */
  resume() {
    if (this.isProcessing && this.isPaused) {
      this.isPaused = false;
      console.log("[MessageProcessor] Job resumed");
      return true;
    }
    return false;
  }
  /**
   * Stop current job
   */
  stop() {
    if (this.isProcessing) {
      this.isProcessing = false;
      this.isPaused = false;
      this.currentJob = null;
      console.log("[MessageProcessor] Job stopped");
      return true;
    }
    return false;
  }
  /**
   * Format message by replacing variables
   * Supported variables: {{name}}, {{phone}}, {{var1}}, {{var2}}, etc.
   */
  formatMessage(template, contact) {
    let message = template;
    message = message.replace(/{{name}}/g, contact.name || "");
    message = message.replace(/{{phone}}/g, contact.phone || "");
    const matches = message.match(/{{(.*?)}}/g);
    if (matches) {
      matches.forEach((match) => {
        const key = match.replace(/{{|}}/g, "");
        if (contact[key] !== void 0) {
          message = message.replace(new RegExp(match, "g"), String(contact[key]));
        }
      });
    }
    return message;
  }
  /**
   * Report progress to renderer
   */
  reportProgress(jobId, processed, total, success, failed, status, metadata) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send("whatsapp:job-progress", {
        jobId,
        processed,
        total,
        success,
        failed,
        status,
        metadata
      });
    }
  }
  /**
   * Calculate delay in milliseconds based on delay configuration
   * @param delayConfig - Optional delay configuration from job settings
   * @returns Delay in milliseconds
   */
  calculateDelayFromConfig(delayConfig) {
    const DEFAULT_MIN_DELAY_MS = 2e3;
    const DEFAULT_MAX_DELAY_MS = 5e3;
    if (!delayConfig || !delayConfig.delayRange || delayConfig.delayRange.length === 0) {
      console.warn("[MessageProcessor] No valid delayConfig provided, using default values");
      return DEFAULT_MIN_DELAY_MS + Math.random() * (DEFAULT_MAX_DELAY_MS - DEFAULT_MIN_DELAY_MS);
    }
    if (delayConfig.delayRange.length < 1) {
      console.warn("[MessageProcessor] Invalid delayRange, using default values");
      return DEFAULT_MIN_DELAY_MS + Math.random() * (DEFAULT_MAX_DELAY_MS - DEFAULT_MIN_DELAY_MS);
    }
    const minDelayMs = delayConfig.delayRange[0] * 1e3;
    let maxDelayMs = minDelayMs;
    if (delayConfig.mode === "dynamic" && delayConfig.delayRange.length >= 2) {
      maxDelayMs = delayConfig.delayRange[1] * 1e3;
      if (maxDelayMs <= minDelayMs) {
        console.warn("[MessageProcessor] Invalid delay range (max <= min), using static mode");
        return minDelayMs;
      }
      return minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
    }
    return minDelayMs;
  }
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  waitForResume() {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!this.isPaused) {
          clearInterval(check);
          resolve();
        }
      }, 500);
    });
  }
}
class QueueWorker {
  constructor(messageProcessor2) {
    __publicField(this, "queue", []);
    __publicField(this, "isRunning", false);
    __publicField(this, "messageProcessor");
    this.messageProcessor = messageProcessor2;
  }
  /**
   * Add a job to the queue and start processing if not already running
   */
  async addToQueue(job) {
    console.log(`[QueueWorker] Adding job ${job.jobId} to queue`);
    this.queue.push(job);
    this.processQueue();
  }
  /**
   * Process the queue sequentially
   */
  async processQueue() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[QueueWorker] Starting queue processing");
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (job) {
        try {
          console.log(`[QueueWorker] Processing job ${job.jobId}`);
          await this.messageProcessor.processJob(job);
        } catch (error) {
          console.error(`[QueueWorker] Error processing job ${job.jobId}:`, error);
        }
      }
    }
    this.isRunning = false;
    console.log("[QueueWorker] Queue processing finished");
  }
  /**
   * Get current queue length
   */
  getQueueLength() {
    return this.queue.length;
  }
}
let whatsappManager$1 = null;
let messageProcessor$1 = null;
let queueWorker$1 = null;
const setupIPC = (mainWindow2, wm, mp, qw) => {
  console.log("[IPC] Setting up IPC handlers...");
  if (wm) {
    whatsappManager$1 = wm;
  } else {
    console.log("[IPC] Creating new WhatsAppManager (Fallback)");
    whatsappManager$1 = new WhatsAppManager(mainWindow2);
  }
  if (mp) {
    messageProcessor$1 = mp;
  } else {
    console.log("[IPC] Creating new MessageProcessor (Fallback)");
    messageProcessor$1 = new MessageProcessor(whatsappManager$1, mainWindow2);
  }
  if (qw) {
    queueWorker$1 = qw;
  } else if (messageProcessor$1) {
    console.log("[IPC] Creating new QueueWorker (Fallback)");
    queueWorker$1 = new QueueWorker(messageProcessor$1);
  }
  electron.ipcMain.handle("whatsapp:connect", async () => {
    try {
      console.log("[IPC] whatsapp:connect called");
      if (!whatsappManager$1) {
        throw new Error("WhatsAppManager not initialized");
      }
      const result = await whatsappManager$1.connect();
      return { success: true, connected: result };
    } catch (error) {
      console.error("[IPC] whatsapp:connect error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });
  electron.ipcMain.handle("whatsapp:disconnect", async () => {
    try {
      console.log("[IPC] whatsapp:disconnect called");
      if (!whatsappManager$1) {
        throw new Error("WhatsAppManager not initialized");
      }
      await whatsappManager$1.disconnect();
      return { success: true };
    } catch (error) {
      console.error("[IPC] whatsapp:disconnect error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });
  electron.ipcMain.handle("whatsapp:send-message", async (_, { to, content, assets }) => {
    try {
      console.log(`[IPC] whatsapp:send-message called for ${to}`);
      if (!whatsappManager$1) {
        throw new Error("WhatsAppManager not initialized");
      }
      let result;
      if (assets && assets.length > 0) {
        result = await whatsappManager$1.sendMessageWithMedia(to, content, assets[0]);
      } else {
        result = await whatsappManager$1.sendMessage(to, content);
      }
      return { success: result };
    } catch (error) {
      console.error("[IPC] whatsapp:send-message error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });
  electron.ipcMain.handle("whatsapp:get-status", async () => {
    try {
      if (!whatsappManager$1) {
        return { status: "disconnected", ready: false };
      }
      const status = whatsappManager$1.getStatus();
      const ready = whatsappManager$1.isReady();
      return { status, ready };
    } catch (error) {
      console.error("[IPC] whatsapp:get-status error:", error);
      return { status: "disconnected", ready: false };
    }
  });
  electron.ipcMain.handle("whatsapp:get-client-info", async () => {
    try {
      console.log("[IPC] whatsapp:get-client-info called");
      if (!whatsappManager$1) {
        return null;
      }
      const info = await whatsappManager$1.getClientInfo();
      return info;
    } catch (error) {
      console.error("[IPC] whatsapp:get-client-info error:", error);
      return null;
    }
  });
  electron.ipcMain.handle("whatsapp:process-job", async (_, { jobId, contacts, template, assets, delayConfig }) => {
    try {
      console.log(`[IPC] whatsapp:process-job called for job ${jobId}`);
      if (!whatsappManager$1 || !whatsappManager$1.isReady()) {
        throw new Error("WhatsApp is not ready");
      }
      if (queueWorker$1) {
        console.log(`[IPC] Adding job ${jobId} to queue`);
        queueWorker$1.addToQueue({
          jobId,
          contacts,
          template,
          assets,
          delayConfig
        }).catch((err) => {
          console.error("[IPC] Error adding to queue:", err);
        });
      } else if (messageProcessor$1) {
        console.warn("[IPC] QueueWorker not available, processing directly");
        messageProcessor$1.processJob({
          jobId,
          contacts,
          template,
          assets,
          delayConfig
        }).catch((err) => {
          console.error("[IPC] Job processing error:", err);
        });
      } else {
        throw new Error("MessageProcessor not initialized");
      }
      return {
        success: true,
        message: "Job started",
        jobId
      };
    } catch (error) {
      console.error("[IPC] whatsapp:process-job error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });
  electron.ipcMain.handle("whatsapp:pause-job", async (_, { jobId }) => {
    console.log(`[IPC] whatsapp:pause-job called for job ${jobId}`);
    if (messageProcessor$1) {
      const success = messageProcessor$1.pause();
      return { success, message: success ? "Job paused" : "Failed to pause" };
    }
    return { success: false, message: "Processor not ready" };
  });
  electron.ipcMain.handle("whatsapp:resume-job", async (_, { jobId }) => {
    console.log(`[IPC] whatsapp:resume-job called for job ${jobId}`);
    if (messageProcessor$1) {
      const success = messageProcessor$1.resume();
      return { success, message: success ? "Job resumed" : "Failed to resume" };
    }
    return { success: false, message: "Processor not ready" };
  });
  console.log("[IPC] IPC handlers setup complete");
};
class StatusWorker {
  // 3 minutes (180,000 ms)
  constructor(whatsappManager2, mainWindow2) {
    __publicField(this, "whatsappManager");
    __publicField(this, "mainWindow");
    __publicField(this, "checkInterval", null);
    __publicField(this, "CHECK_INTERVAL_MS", 18e4);
    this.whatsappManager = whatsappManager2;
    this.mainWindow = mainWindow2;
  }
  /**
   * Start monitoring connection status
   */
  startMonitoring() {
    if (this.checkInterval) return;
    console.log("[StatusWorker] Starting status monitoring");
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
      console.log("[StatusWorker] Stopped status monitoring");
    }
  }
  /**
   * Check health and auto-reconnect if needed
   */
  async checkHealth() {
    const status = this.whatsappManager.getStatus();
    console.log(`[StatusWorker] Health check: ${status}`);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("whatsapp:status-change", status);
    }
    if (status === "disconnected") {
      console.log("[StatusWorker] Detected disconnection, attempting reconnect...");
      try {
        await this.whatsappManager.connect();
      } catch (err) {
        console.error("[StatusWorker] Reconnect failed:", err);
      }
    }
  }
}
class MessageReceiverWorker {
  constructor(_whatsappManager, mainWindow2) {
    // private whatsappManager: WhatsAppManager; // Removed unused property
    __publicField(this, "mainWindow");
    __publicField(this, "unsubscribeKeywords", ["unsubscribe", "stop", "batal", "berhenti", "jangan kirim", "keluar", "cancel"]);
    this.mainWindow = mainWindow2;
  }
  /**
   * Handle incoming message from WhatsAppManager
   */
  async handleIncomingMessage(message) {
    try {
      console.log("[MessageReceiverWorker] Processing incoming message from:", message.from);
      const isUnsubscribe = this.isUnsubscribeRequest(message.body);
      if (isUnsubscribe) {
        console.log("[MessageReceiverWorker] Unsubscribe request detected from:", message.from);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send("whatsapp:unsubscribe-detected", {
            phoneNumber: message.from,
            message: message.body,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("whatsapp:message-received", {
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
      console.error("[MessageReceiverWorker] Error handling message:", error);
    }
  }
  /**
   * Check if message content contains unsubscribe keywords
   */
  isUnsubscribeRequest(content) {
    if (!content) return false;
    const lowerContent = content.toLowerCase();
    return this.unsubscribeKeywords.some((keyword) => lowerContent.includes(keyword));
  }
}
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
    return true;
  } catch (error) {
    console.debug(`[Main] File does not exist or is not accessible: ${filePath}`, error);
    return false;
  }
}
let mainWindow = null;
let whatsappManager = null;
let messageProcessor = null;
let queueWorker = null;
let statusWorker = null;
let messageReceiverWorker = null;
const createWindow = async () => {
  let iconPath;
  try {
    if (process.env.VITE_DEV_SERVER_URL) {
      const publicPath = path.join("C:", "Users", "andry", "AnotherProjectCode", "Server", "XalesIn-Whatsapp", "xenderin", "public", "icon.png");
      console.log("[Main] Development mode - trying icon path:", publicPath);
      const fileExistsResult = await fileExists(publicPath);
      if (fileExistsResult) {
        iconPath = publicPath;
      } else {
        console.warn("[Main] Development icon not found, falling back to default");
        iconPath = void 0;
      }
    } else {
      const productionIconPath = path.join("C:", "Users", "andry", "AnotherProjectCode", "Server", "XalesIn-Whatsapp", "xenderin", "public", "icon.ico");
      console.log("[Main] Production mode - trying icon path:", productionIconPath);
      const fileExistsResult = await fileExists(productionIconPath);
      if (fileExistsResult) {
        iconPath = productionIconPath;
      } else {
        const resourcesIconPath = path.join("C:", "Users", "andry", "AnotherProjectCode", "Server", "XalesIn-Whatsapp", "xenderin", "public", "icon.ico");
        console.log("[Main] Fallback icon path:", resourcesIconPath);
        const resourcesFileExists = await fileExists(resourcesIconPath);
        iconPath = resourcesFileExists ? resourcesIconPath : void 0;
      }
    }
  } catch (error) {
    console.error("[Main] Error determining icon path:", error);
    iconPath = void 0;
  }
  try {
    mainWindow = new electron.BrowserWindow({
      width: 1200,
      height: 800,
      autoHideMenuBar: true,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        // Enable web security but allow local file access for packaged app
        webSecurity: true
      }
    });
    mainWindow.webContents.on("before-input-event", (_event, input) => {
      if (input.alt) {
        _event.preventDefault();
      }
    });
    if (process.platform === "win32" && iconPath) {
      try {
        mainWindow.setIcon(iconPath);
      } catch (iconError) {
        console.error("[Main] Failed to set window icon:", iconError);
      }
    }
  } catch (windowError) {
    console.error("[Main] Failed to create browser window:", windowError);
    mainWindow = new electron.BrowserWindow({
      width: 1200,
      height: 800,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });
    mainWindow.webContents.on("before-input-event", (_event, input) => {
      if (input.alt) {
        _event.preventDefault();
      }
    });
  }
  console.log("[Main] Initializing workers...");
  whatsappManager = new WhatsAppManager(mainWindow);
  messageProcessor = new MessageProcessor(whatsappManager, mainWindow);
  queueWorker = new QueueWorker(messageProcessor);
  statusWorker = new StatusWorker(whatsappManager, mainWindow);
  messageReceiverWorker = new MessageReceiverWorker(whatsappManager, mainWindow);
  whatsappManager.setMessageReceiverWorker(messageReceiverWorker);
  statusWorker.startMonitoring();
  setupIPC(mainWindow, whatsappManager, messageProcessor, queueWorker);
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(electron.app.getAppPath(), "dist", "index.html");
    console.log("[Main] Loading from:", indexPath);
    mainWindow.loadFile(indexPath);
  }
  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.key === "F5" || input.control && input.key === "r") {
      _event.preventDefault();
    }
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error("[Main] Failed to load:", errorCode, errorDescription);
  });
  mainWindow.webContents.on("crashed", (_event, killed) => {
    console.error("[Main] Renderer crashed:", killed);
  });
};
electron.app.whenReady().then(async () => {
  await createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        console.error("[Main] Error in activate handler:", error);
      });
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (statusWorker) {
    statusWorker.stopMonitoring();
  }
  if (whatsappManager) {
    whatsappManager.disconnect();
  }
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
