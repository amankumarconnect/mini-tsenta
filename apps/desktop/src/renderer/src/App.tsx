import { useState, useEffect, JSX } from 'react'
import { Header } from './components/dashboard/Header'
import { ActivityLog, LogEntry } from './components/dashboard/ActivityLog'
import { ProfileEditView } from './components/dashboard/ProfileEditView'
import { ProfileReadView } from './components/dashboard/ProfileReadView'
import { Dashboard } from './components/dashboard/Dashboard'
import { History } from 'lucide-react'

function App(): JSX.Element {
  const [hasResume, setHasResume] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)

  const addLog = (entry: Omit<LogEntry, 'timestamp'>): void => {
    setLogs((prev) => [...prev, { ...entry, timestamp: new Date() }])
  }

  useEffect(() => {
    const loadProfile = async (): Promise<void> => {
      try {
        // @ts-ignore window.api is exposed in preload
        const savedProfile = await window.api.getUserProfile()
        if (savedProfile && savedProfile.hasResume) {
          setHasResume(true)
        } else {
          setEditMode(true)
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
    // @ts-ignore window.api is exposed in preload
    const cleanup = window.api.onLog((msg: LogEntry) => {
      setLogs((prev) => [...prev, { ...msg, timestamp: new Date() }])
    })
    return cleanup
  }, [])

  const handleStart = (): void => {
    setIsRunning(true)
    setIsPaused(false)
    // @ts-ignore window.api is exposed in preload
    window.api.startAutomation()
  }

  const handleFileUpload = async (file: File): Promise<void> => {
    setIsParsing(true)
    addLog({ message: 'Uploading resume...', type: 'info' })

    try {
      const buffer = await file.arrayBuffer()
      // @ts-ignore window.api is exposed in preload
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
      // @ts-ignore window.api is exposed in preload
      window.api.resumeAutomation()
      setIsPaused(false)
    } else {
      // @ts-ignore window.api is exposed in preload
      window.api.pauseAutomation()
      setIsPaused(true)
    }
  }

  return (
    // Width matches the sidebar constant in main/index.ts createWindow()
    <div className="h-screen w-[450px] bg-background border-r flex flex-col">
      <div className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center">
          <Header />
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

        {showDashboard ? (
          <Dashboard onBack={() => setShowDashboard(false)} />
        ) : isLoading ? (
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

        {!showDashboard && <ActivityLog logs={logs} />}
      </div>
    </div>
  )
}

export default App
