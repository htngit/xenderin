"use strict";
const electron = require("electron");
const path = require("path");
const setupIPC = (mainWindow2) => {
  electron.ipcMain.handle("whatsapp:connect", async () => {
    console.log("Connecting to WhatsApp...");
    return true;
  });
  electron.ipcMain.handle("whatsapp:disconnect", async () => {
    console.log("Disconnecting from WhatsApp...");
    return true;
  });
  electron.ipcMain.handle("whatsapp:send-message", async (_, { to, content, assets }) => {
    console.log(`Sending message to ${to}: ${content}`);
    return true;
  });
  electron.ipcMain.handle("whatsapp:get-status", async () => {
    return "disconnected";
  });
};
let mainWindow = null;
const createWindow = () => {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  setupIPC();
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
};
electron.app.on("ready", createWindow);
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
