const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ironzUpdates", {
  download: (version) => ipcRenderer.invoke("ironz:update:download", version),
  install: (version) => ipcRenderer.invoke("ironz:update:install", version),
  onProgress: (listener) => {
    const onProgress = (_event, progress) => listener(progress);
    ipcRenderer.on("ironz:update:progress", onProgress);
    return () =>
      ipcRenderer.removeListener("ironz:update:progress", onProgress);
  },
});
