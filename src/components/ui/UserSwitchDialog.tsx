import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface UserSwitchDialogProps {
  isOpen: boolean;
  previousUserId: string;
  onConfirm: (action: 'cleanup' | 'keep' | 'always') => void;
  onClose: () => void;
}

export function UserSwitchDialog({ isOpen, onConfirm, onClose }: UserSwitchDialogProps) {
  const [selectedAction, setSelectedAction] = useState<'cleanup' | 'keep' | 'always'>('cleanup');
  const [rememberChoice, setRememberChoice] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAction('cleanup');
      setRememberChoice(false);
    }
  }, [isOpen]);

  // Handle cleanup with user choice
  const handleConfirm = () => {
    if (rememberChoice) {
      // Save user preference to localStorage to respect on future switches
      localStorage.setItem('userSwitchPreference', selectedAction);
      localStorage.setItem('userSwitchRememberChoice', 'true');
    }

    onConfirm(selectedAction);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>User Data Cleanup</CardTitle>
          <CardDescription>
            You're switching to a different user account. What would you like to do with the previous user's data?
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <RadioGroup value={selectedAction} onValueChange={(value: any) => setSelectedAction(value)}>
            <div className="flex items-center space-x-2 mb-3">
              <RadioGroupItem value="cleanup" id="cleanup" />
              <Label htmlFor="cleanup">Clear previous user's data</Label>
            </div>
            
            <div className="flex items-center space-x-2 mb-3">
              <RadioGroupItem value="keep" id="keep" />
              <Label htmlFor="keep">Keep previous user's data</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="always" id="always" />
              <Label htmlFor="always">Always auto-cleanup on user switch</Label>
            </div>
          </RadioGroup>
          
          <div className="mt-4 flex items-center space-x-2">
            <input
              type="checkbox"
              id="remember-choice"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="remember-choice">Remember my choice for future user switches</Label>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}