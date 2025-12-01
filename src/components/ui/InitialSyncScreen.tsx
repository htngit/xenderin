import { AlertCircle } from 'lucide-react';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AnimatedCard } from './animated-card';
import type { SyncProgress } from '../../lib/services/InitialSyncOrchestrator';

interface InitialSyncScreenProps {
  progress: SyncProgress | null;
}

export function InitialSyncScreen({ progress }: InitialSyncScreenProps) {
  const currentProgress = progress?.progress || 0;
  const currentStep = progress?.step || 'data';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <AnimatedCard className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome to Xender-In!</CardTitle>
          <CardDescription>
            Setting up your workspace for the first time. This may take a few moments...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Syncing {currentStep}...</span>
              <span>{Math.round(currentProgress)}%</span>
            </div>
            <Progress value={currentProgress} />
          </div>

          {progress?.status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {progress.error || 'Sync failed. Please try again later.'}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground text-center pt-2">
            Please keep the application open during this process.
          </p>
        </CardContent>
      </AnimatedCard>
    </div>
  );
}