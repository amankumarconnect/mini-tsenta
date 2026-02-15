import { contextBridge, ipcRenderer } from 'electron'

interface LogEntry {
  message: string
  type: 'info' | 'success' | 'error' | 'skip' | 'match'
  jobTitle?: string
  matchScore?: number
}

contextBridge.exposeInMainWorld('api', {
  startAutomation: (data: { userProfile: string }) => ipcRenderer.invoke('start-automation', data),
  stopAutomation: () => ipcRenderer.send('stop-automation'),
  pauseAutomation: () => ipcRenderer.send('pause-automation'),
  resumeAutomation: () => ipcRenderer.send('resume-automation'),
  saveResume: (buffer: ArrayBuffer) => ipcRenderer.invoke('save-resume', buffer),
  downloadResume: () => ipcRenderer.invoke('download-resume'),
  onLog: (callback: (msg: LogEntry) => void) => {
    const handler = (_: unknown, msg: LogEntry): void => callback(msg)
    ipcRenderer.on('log', handler)
    return () => {
      ipcRenderer.removeListener('log', handler)
    }
  },
  getUserProfile: () => ipcRenderer.invoke('get-user-profile'),
  getApplications: () => ipcRenderer.invoke('get-applications')
})
