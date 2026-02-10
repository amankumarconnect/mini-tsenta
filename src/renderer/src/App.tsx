import React, { useState, useEffect, useRef, JSX } from 'react'
import { Button } from './components/ui/button'
import { Textarea } from './components/ui/textarea'

import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'

function App(): JSX.Element {
  const [profile, setProfile] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    // Listen for logs from Main process
    // @ts-ignore (Assuming window.api exists from preload)
    window.api.onLog((msg: string) => {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    })
  }, [])

  const handleStart = (): void => {
    setIsRunning(true)
    // @ts-ignore (Assuming window.api exists from preload)
    window.api.startAutomation({ userProfile: profile })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Uploading resume...`])

    try {
      const buffer = await file.arrayBuffer()
      // @ts-ignore (Assuming window.api exists from preload)
      const text = await window.api.parseResume(buffer)
      setProfile(text)
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Resume parsed successfully!`
      ])
    } catch (error) {
      console.error(error)
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Error parsing resume`])
    } finally {
      setIsParsing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleStop = (): void => {
    setIsRunning(false)
    // @ts-ignore (Assuming window.api exists from preload)
    window.api.stopAutomation()
  }

  return (
    // Only occupy the left 450px. The Main process handles the view on the right.
    <div className="h-screen w-[450px] bg-background border-r flex flex-col">
      <div className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
        <header>
          <h1 className="text-xl font-bold">LazyMate AI</h1>
          <p className="text-sm text-muted-foreground">Automated WorkAtAStartup Applier</p>
        </header>

        <Card className="flex-shrink-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Your Profile</CardTitle>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing || isRunning}
            >
              {isParsing ? 'Parsing...' : 'Upload PDF Resume'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Describe yourself in a paragraph. Include:
• Skills (e.g., React, Node.js, Python, ML)
• Preferred role (e.g., Full Stack, Backend, Frontend)
• Years of experience
• Salary expectations (e.g., $100k-150k, open)
• Location preference (e.g., Remote, SF Bay Area)
• Any other relevant info..."
              className="min-h-[150px] max-h-[300px] overflow-y-auto"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex gap-2 flex-shrink-0">
          {!isRunning ? (
            <Button className="w-full" onClick={handleStart} disabled={!profile}>
              Start Applying
            </Button>
          ) : (
            <Button variant="destructive" className="w-full" onClick={handleStop}>
              Stop
            </Button>
          )}
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold mb-2 flex-shrink-0">Activity Log</h3>
          <div className="flex-1 overflow-y-auto bg-muted/50 rounded-md border p-2">
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-xs font-mono text-muted-foreground break-all">
                  {log}
                </div>
              ))}
            </div>
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
