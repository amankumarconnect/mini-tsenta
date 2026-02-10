import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  startAutomation: (data: { userProfile: string }) => ipcRenderer.invoke('start-automation', data),
  stopAutomation: () => ipcRenderer.send('stop-automation'),
  onLog: (callback: (msg: string) => void) => {
    ipcRenderer.on('log', (_, msg) => callback(msg))
  }
})
