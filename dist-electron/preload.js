"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  whatsapp: {
    connect: () => electron.ipcRenderer.invoke("whatsapp:connect"),
    disconnect: () => electron.ipcRenderer.invoke("whatsapp:disconnect"),
    sendMessage: (to, content, assets) => electron.ipcRenderer.invoke("whatsapp:send-message", { to, content, assets }),
    getStatus: () => electron.ipcRenderer.invoke("whatsapp:get-status"),
    // Events
    onQRCode: (callback) => {
      const subscription = (_, qr) => callback(qr);
      electron.ipcRenderer.on("whatsapp:qr-code", subscription);
      return () => electron.ipcRenderer.removeListener("whatsapp:qr-code", subscription);
    },
    onStatusChange: (callback) => {
      const subscription = (_, status) => callback(status);
      electron.ipcRenderer.on("whatsapp:status-change", subscription);
      return () => electron.ipcRenderer.removeListener("whatsapp:status-change", subscription);
    },
    onMessageReceived: (callback) => {
      const subscription = (_, data) => callback(data);
      electron.ipcRenderer.on("whatsapp:message-received", subscription);
      return () => electron.ipcRenderer.removeListener("whatsapp:message-received", subscription);
    },
    onUnsubscribeDetected: (callback) => {
      const subscription = (_, data) => callback(data);
      electron.ipcRenderer.on("whatsapp:unsubscribe-detected", subscription);
      return () => electron.ipcRenderer.removeListener("whatsapp:unsubscribe-detected", subscription);
    }
  }
});
