import { useState, useEffect, JSX } from "react";
import { Header } from "./components/dashboard/Header";
import { ActivityLog, LogEntry } from "./components/dashboard/ActivityLog";
import { ProfileEditView } from "./components/dashboard/ProfileEditView";
import { ProfileReadView } from "./components/dashboard/ProfileReadView";
import { Dashboard } from "./components/dashboard/Dashboard";
import { History } from "lucide-react";

// Main Application Component
function App(): JSX.Element {
  // State for user profile existence (resume uploaded/parsed).
  const [hasResume, setHasResume] = useState(false);
  // State for storing activity logs received from the main process.
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // State for tracking automation running status.
  const [isRunning, setIsRunning] = useState(false);
  // State for tracking automation pause status.
  const [isPaused, setIsPaused] = useState(false);
  // State for tracking resume parsing operation.
  const [isParsing, setIsParsing] = useState(false);
  // State for initial loading of profile data.
  const [isLoading, setIsLoading] = useState(true);
  // State for toggling profile edit mode.
  const [editMode, setEditMode] = useState(false);
  // State for toggling the dashboard view.
  const [showDashboard, setShowDashboard] = useState(false);

  // Helper function to add a new log entry.
  // Adds a timestamp to the incoming log data.
  const addLog = (entry: Omit<LogEntry, "timestamp">): void => {
    setLogs((prev) => [...prev, { ...entry, timestamp: new Date() }]);
  };

  // Effect to load the user profile on component mount.
  useEffect(() => {
    const loadProfile = async (): Promise<void> => {
      try {
        // Fetch user profile status from the main process via IPC.
        // @ts-ignore window.api is exposed in preload
        const savedProfile = await window.api.getUserProfile();
        if (savedProfile && savedProfile.hasResume) {
          setHasResume(true); // User has a resume processed.
        } else {
          setEditMode(true); // No resume, default to edit mode for upload.
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        setEditMode(true); // Fallback to edit mode on error.
      } finally {
        setIsLoading(false); // Loading complete.
      }
    };
    loadProfile();
  }, []);

  // Effect to set up the log listener via IPC.
  useEffect(() => {
    // Registered callback receives log messages from main process.
    // @ts-ignore window.api is exposed in preload
    const cleanup = window.api.onLog((msg: LogEntry) => {
      setLogs((prev) => [...prev, { ...msg, timestamp: new Date() }]);
    });
    // Cleanup listener on unmount.
    return cleanup;
  }, []);

  // Handler to start the automation process.
  const handleStart = (): void => {
    setIsRunning(true);
    setIsPaused(false);
    // Send start signal to main process.
    // @ts-ignore window.api is exposed in preload
    window.api.startAutomation();
  };

  // Handler for file upload (resume).
  const handleFileUpload = async (file: File): Promise<void> => {
    setIsParsing(true);
    addLog({ message: "Uploading resume...", type: "info" });

    try {
      const buffer = await file.arrayBuffer(); // Convert file to buffer.
      // Send buffer to main process to save and process.
      // @ts-ignore window.api is exposed in preload
      await window.api.saveResume(buffer);
      setHasResume(true);
      addLog({ message: "Resume uploaded and parsed!", type: "success" });
      setEditMode(false); // Exit edit mode upon success.
    } catch (error) {
      console.error(error);
      addLog({ message: "Error parsing resume", type: "error" });
    } finally {
      setIsParsing(false);
    }
  };

  // Handler to toggle pause/resume state of automation.
  const handleTogglePause = (): void => {
    if (isPaused) {
      // Resume automation.
      // @ts-ignore window.api is exposed in preload
      window.api.resumeAutomation();
      setIsPaused(false);
    } else {
      // Pause automation.
      // @ts-ignore window.api is exposed in preload
      window.api.pauseAutomation();
      setIsPaused(true);
    }
  };

  return (
    // Layout container: Sidebar width fixed to 450px to match main process window setup.
    <div className="h-screen w-[450px] bg-background border-r flex flex-col">
      <div className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center">
          <Header />
          {/* History/Dashboard toggle button (only visible when not in dashboard/edit mode) */}
          {!showDashboard && !editMode && (
            <button
              onClick={() => setShowDashboard(true)}
              className="p-2 hover:bg-muted rounded-full"
              title="View History"
            >
              <History className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Conditional Rendering of Views */}
        {showDashboard ? (
          <Dashboard onBack={() => setShowDashboard(false)} />
        ) : isLoading ? (
          <div className="text-center text-sm text-muted-foreground">
            Loading profile...
          </div>
        ) : editMode ? (
          <ProfileEditView
            hasResume={hasResume}
            onCancel={hasResume ? () => setEditMode(false) : undefined}
            onFileUpload={handleFileUpload}
            isParsing={isParsing}
            isRunning={isRunning}
          />
        ) : (
          <ProfileReadView
            hasResume={hasResume}
            onEdit={() => setEditMode(true)}
            isRunning={isRunning}
            isPaused={isPaused}
            onStart={handleStart}
            onTogglePause={handleTogglePause}
          />
        )}

        {/* Activity Log (visible when not in dashboard) */}
        {!showDashboard && <ActivityLog logs={logs} />}
      </div>
    </div>
  );
}

export default App;
