import { ElectronAPI } from "@electron-toolkit/preload";

// Extend the global Window interface to include the exposed APIs.
declare global {
  interface Window {
    // Standard Electron API exposed by @electron-toolkit (if utilized).
    electron: ElectronAPI;
    // Custom API exposed in preload/index.ts.
    api: {
      startAutomation: (data: { userProfile: string }) => Promise<void>;
      stopAutomation: () => void;
      pauseAutomation: () => void;
      resumeAutomation: () => void;
      saveResume: (buffer: ArrayBuffer) => Promise<boolean>;
      downloadResume: () => Promise<void>;
      onLog: (callback: (msg: unknown) => void) => () => void; // Returns unsubscribe function.
      getUserProfile: () => Promise<{ hasResume: boolean } | null>;
      getApplications: () => Promise<any[]>; // Returns Promise of Application array.
    };
  }
}
