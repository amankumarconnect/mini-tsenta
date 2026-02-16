import { JSX } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Download } from "lucide-react";

// Props interface for ProfileReadView component.
interface ProfileReadViewProps {
  hasResume: boolean; // Indicates if a resume is uploaded.
  onEdit: () => void; // Callback to switch to edit mode.
  isRunning: boolean; // Indicates if automation is actively running.
  isPaused: boolean; // Indicates if automation is paused.
  onStart: () => void; // Callback to start automation.
  onTogglePause: () => void; // Callback to toggle pause/resume.
}

// Component to view current resume status and control automation.
export function ProfileReadView({
  hasResume,
  onEdit,
  isRunning,
  isPaused,
  onStart,
  onTogglePause,
}: ProfileReadViewProps): JSX.Element {
  // Handler for downloading the stored resume.
  const handleDownload = async (): Promise<void> => {
    // Invoke IPC handler exposed via preload script.
    // @ts-ignore window.api is defined in preload.
    await window.api.downloadResume();
  };

  return (
    <div className="space-y-4">
      <Card className="flex-shrink-0">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Resume Status</CardTitle>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {hasResume ? "Replace" : "Upload"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {hasResume
              ? "Resume uploaded and ready for matching."
              : "No resume uploaded yet."}
          </div>

          {/* Show download button if resume exists */}
          {hasResume && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              Download Resume
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Control Buttons: Start or Pause/Resume */}
      {!isRunning ? (
        <Button className="w-full" onClick={onStart} disabled={!hasResume}>
          Start Applying
        </Button>
      ) : (
        <Button
          variant={isPaused ? "default" : "secondary"}
          className="w-full"
          onClick={onTogglePause}
        >
          {isPaused ? "Continue Applying" : "Pause Applying"}
        </Button>
      )}
    </div>
  );
}
