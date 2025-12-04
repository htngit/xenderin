import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
  retryButtonText?: string;
  additionalHelp?: string;
}

export function ErrorScreen({ error, onRetry, retryButtonText = 'Try Again', additionalHelp }: ErrorScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>An Error Occurred</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        {additionalHelp && (
          <div className="bg-muted p-3 rounded-md text-sm">
            <p>{additionalHelp}</p>
          </div>
        )}
        <Button onClick={onRetry} className="w-full">
          {retryButtonText}
        </Button>
      </div>
    </div>
  );
}