import { useState, useEffect, JSX } from 'react'
import { Header } from './components/dashboard/Header'
import { ActivityLog, LogEntry } from './components/dashboard/ActivityLog'
import { ProfileEditView } from './components/dashboard/ProfileEditView'
import { ProfileReadView } from './components/dashboard/ProfileReadView'

function App(): JSX.Element {
  const [hasResume, setHasResume] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)

  const addLog = (entry: Omit<LogEntry, 'timestamp'>): void => {
    setLogs((prev) => [...prev, { ...entry, timestamp: new Date() }])
  }

  useEffect(() => {
    // Load existing profile
    const loadProfile = async (): Promise<void> => {
      try {
        // @ts-ignore (window.api is exposed by preload)
        const savedProfile = await window.api.getUserProfile()
        if (savedProfile && savedProfile.hasResume) {
          setHasResume(true)
        } else {
          setEditMode(true) // No profile, go to edit mode
        }
      } catch (error) {
        console.error('Failed to load profile:', error)
        setEditMode(true)
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [])

  useEffect(() => {
    // Listen for logs from Main process
    // @ts-ignore (Assuming window.api exists from preload)
    const cleanup = window.api.onLog((msg: LogEntry) => {
      setLogs((prev) => [...prev, { ...msg, timestamp: new Date() }])
    })
    return cleanup
  }, [])

  const handleStart = (): void => {
    setIsRunning(true)
    setIsPaused(false)
    // @ts-ignore (Assuming window.api exists from preload)
    window.api.startAutomation()
  }

  const handleFileUpload = async (file: File): Promise<void> => {
    setIsParsing(true)
    addLog({ message: 'Uploading resume...', type: 'info' })

    try {
      const buffer = await file.arrayBuffer()
      // @ts-ignore (window.api is exposed by preload)
      // @ts-ignore (window.api is exposed by preload)
      await window.api.saveResume(buffer)
      setHasResume(true)
      addLog({ message: 'Resume uploaded and parsed!', type: 'success' })
      setEditMode(false)
    } catch (error) {
      console.error(error)
      addLog({ message: 'Error parsing resume', type: 'error' })
    } finally {
      setIsParsing(false)
    }
  }

  const handleTogglePause = (): void => {
    if (isPaused) {
      // Resume
      // @ts-ignore (exposed by preload)
      window.api.resumeAutomation()
      setIsPaused(false)
    } else {
      // Pause
      // @ts-ignore (exposed by preload)
      window.api.pauseAutomation()
      setIsPaused(true)
    }
  }

  return (
    // Only occupy the left 450px. The Main process handles the view on the right.
    <div className="h-screen w-[450px] bg-background border-r flex flex-col">
      <div className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
        <Header />

        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground">Loading profile...</div>
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

        <ActivityLog logs={logs} />
      </div>
    </div>
  )
}

export default App
