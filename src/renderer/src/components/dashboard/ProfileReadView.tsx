import { JSX } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

// @ts-ignore (lucide-react is installed)
import { Download } from 'lucide-react'

interface ProfileReadViewProps {
  hasResume: boolean
  onEdit: () => void
  isRunning: boolean
  onStart: () => void
  onStop: () => void
}

export function ProfileReadView({
  hasResume,
  onEdit,
  isRunning,
  onStart,
  onStop
}: ProfileReadViewProps): JSX.Element {
  const handleDownload = async (): Promise<void> => {
    // @ts-ignore (exposed by preload)
    await window.api.downloadResume()
  }

  return (
    <div className="space-y-4">
      <Card className="flex-shrink-0">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Resume Status</CardTitle>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {hasResume ? 'Replace' : 'Upload'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {hasResume ? 'Resume uploaded and ready for matching.' : 'No resume uploaded yet.'}
          </div>

          {hasResume && (
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download Resume
            </Button>
          )}
        </CardContent>
      </Card>

      {!isRunning ? (
        <Button className="w-full" onClick={onStart} disabled={!hasResume}>
          Start Applying
        </Button>
      ) : (
        <Button variant="destructive" className="w-full" onClick={onStop}>
          Stop
        </Button>
      )}
    </div>
  )
}
