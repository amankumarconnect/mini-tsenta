import { contextBridge, ipcRenderer } from "electron";

// Interface for log messages sent from the main process.
interface LogEntry {
  message: string;
  type: "info" | "success" | "error" | "skip" | "match";
  jobTitle?: string;
  matchScore?: number;
}

// Expose the 'api' object to the renderer process via contextBridge.
// This allows the renderer (React app) to communicate with the main process safely.
contextBridge.exposeInMainWorld("api", {
  // Start the automation process.
  startAutomation: (data: { userProfile: string }) =>
    ipcRenderer.invoke("start-automation", data),

  // Stop the automation process.
  stopAutomation: () => ipcRenderer.send("stop-automation"),

  // Pause the automation.
  pauseAutomation: () => ipcRenderer.send("pause-automation"),

  // Resume the automation.
  resumeAutomation: () => ipcRenderer.send("resume-automation"),

  // Save the uploaded resume (PDF buffer) to the user data directory.
  saveResume: (buffer: ArrayBuffer) =>
    ipcRenderer.invoke("save-resume", buffer),

  // Trigger the download of the stored resume.
  downloadResume: () => ipcRenderer.invoke("download-resume"),

  // Set up a listener for log messages from the main process.
  // Returns a cleanup function to remove the listener.
  onLog: (callback: (msg: LogEntry) => void) => {
    // Wrapper for the callback to match Electron's event handler signature.
    const handler = (_: unknown, msg: LogEntry): void => callback(msg);
    ipcRenderer.on("log", handler);
    // Return function to unsubscribe.
    return () => {
      ipcRenderer.removeListener("log", handler);
    };
  },

  // Get the current user profile status (e.g., hasResume).
  getUserProfile: () => ipcRenderer.invoke("get-user-profile"),

  // Get the list of job applications from the database.
  getApplications: () => ipcRenderer.invoke("get-applications"),
});
