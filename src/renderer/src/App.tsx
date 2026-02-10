import React, { useState, useEffect, JSX } from 'react'
import { Button } from './components/ui/button'
import { Textarea } from './components/ui/textarea'
import { ScrollArea } from './components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'

function App(): JSX.Element {
  const [profile, setProfile] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    // Listen for logs from Main process
    // @ts-ignore (Assuming window.api exists from preload)
    window.api.onLog((msg: string) => {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    })
  }, [])

  const handleStart = () => {
    setIsRunning(true)
    // @ts-ignore
    window.api.startAutomation({ userProfile: profile })
  }

  const handleStop = () => {
    setIsRunning(false)
    // @ts-ignore
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Your Profile</CardTitle>
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
              className="min-h-[200px]"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex gap-2">
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

        <div className="flex-1 min-h-0 flex flex-col">
          <h3 className="text-sm font-semibold mb-2">Activity Log</h3>
          <ScrollArea className="flex-1 bg-muted/50 rounded-md border p-2">
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-xs font-mono text-muted-foreground">
                  {log}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

export default App
