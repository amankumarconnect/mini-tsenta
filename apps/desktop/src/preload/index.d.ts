import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      startAutomation: (data: { userProfile: string }) => Promise<void>
      stopAutomation: () => void
      saveResume: (buffer: ArrayBuffer) => Promise<boolean>
      downloadResume: () => Promise<void>
      onLog: (callback: (msg: unknown) => void) => () => void
      getUserProfile: () => Promise<{ hasResume: boolean } | null>
    }
  }
}
