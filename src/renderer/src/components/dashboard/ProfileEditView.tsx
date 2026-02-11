import { useRef, JSX } from 'react'
import { Button } from '../ui/button'

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface ProfileEditViewProps {
  hasResume: boolean
  onCancel?: () => void
  onFileUpload: (file: File) => Promise<void>
  isParsing: boolean
  isRunning: boolean
}

export function ProfileEditView({
  hasResume,
  onCancel,
  onFileUpload,
  isParsing,
  isRunning
}: ProfileEditViewProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return
    await onFileUpload(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{hasResume ? 'Replace Resume' : 'Upload Resume'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground mb-4">
          Upload your resume (PDF only). We will automatically parse it to generate your job
          persona.
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf"
          onChange={handleFileChange}
        />

        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isParsing || isRunning}
        >
          {isParsing ? 'Parsing...' : 'Select PDF Resume'}
        </Button>

        {onCancel && (
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
