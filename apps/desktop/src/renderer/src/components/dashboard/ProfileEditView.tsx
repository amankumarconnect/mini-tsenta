import { useRef, JSX } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

// Props interface for ProfileEditView component.
interface ProfileEditViewProps {
  hasResume: boolean; // Indicates if a resume already exists.
  onCancel?: () => void; // Optional callback to cancel editing.
  onFileUpload: (file: File) => Promise<void>; // Async callback to handle file upload.
  isParsing: boolean; // Loading state during resume parsing.
  isRunning: boolean; // State to disable upload if automation is running.
}

// Component for uploading or replacing the user's resume.
export function ProfileEditView({
  hasResume,
  onCancel,
  onFileUpload,
  isParsing,
  isRunning,
}: ProfileEditViewProps): JSX.Element {
  // Ref to the hidden file input element.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handler for file selection event.
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    await onFileUpload(file); // Trigger upload.
    // Reset input value to allow re-selecting the same file if needed.
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {hasResume ? "Replace Resume" : "Upload Resume"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground mb-4">
          Upload your resume (PDF only). We will automatically parse it to
          generate your job persona.
        </div>

        {/* Hidden file input controlled via the Button below */}
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
          onClick={() => fileInputRef.current?.click()} // Programmatically click input.
          disabled={isParsing || isRunning} // Prevent interaction during parsing/running.
        >
          {isParsing ? "Parsing..." : "Select PDF Resume"}
        </Button>

        {/* Cancel button shown only if onCancel prop is provided (e.g. when resuming exists) */}
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
