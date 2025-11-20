import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedButton } from '@/components/ui/animated-button';
import { FadeIn } from '@/components/ui/animations';
import { PINValidation } from '@/lib/services/types';
import { Lock, Shield, User, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PINModalProps {
  onPINValidated: (pinData: PINValidation, accountId: string) => void;
  userName: string;
  userId?: string; // Optional userId to identify the owner account
}

interface AccountOption {
  id: string;
  name: string;
  role: string;
}

export function PINModal({ onPINValidated, userName, userId }: PINModalProps) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  // Initialize accounts
  useEffect(() => {
    // In a real implementation, this would fetch teams/accounts the user belongs to
    // For now, we default to the Owner account as requested
    const ownerAccount: AccountOption = {
      id: userId || 'owner-account', // Use actual userId if available
      name: 'Owner', // Default display name as requested
      role: 'owner'
    };

    setAccounts([ownerAccount]);
    setSelectedAccount(ownerAccount.id);
  }, [userId, userName]);

  const handlePINChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`pin-${index + 1}`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    }

    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const pinString = pin.join('');

    if (pinString.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    if (!selectedAccount) {
      setError('Please select an account');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Default PIN Logic for Owner:
      // If the user is an Owner and no specific PIN is set (simulated here),
      // we accept '123456' as the default PIN to allow initial access.
      if (pinString === '123456') {
        onPINValidated({
          is_valid: true,
          role: 'owner'
        }, selectedAccount);
      } else {
        setError('Invalid PIN. Default PIN for Owner is 123456.');
      }
    } catch (err) {
      setError('PIN validation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);

    if (/^\d+$/.test(pastedData)) {
      const newPin = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
      setPin(newPin);

      // Focus last filled input
      const lastIndex = pastedData.length - 1;
      if (lastIndex < 6) {
        const input = document.getElementById(`pin-${lastIndex}`) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <FadeIn duration={0.4}>
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Enter PIN
            </CardTitle>
            <CardDescription>
              Welcome back, {userName}! Please select your account and enter PIN
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Account Selection */}
              <div className="space-y-2">
                <Label>Select Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{account.name}</span>
                          {account.role === 'owner' && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Owner
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-center block">Security PIN</Label>
                <div className="flex justify-center gap-2" onPaste={handlePaste}>
                  {pin.map((digit, index) => (
                    <Input
                      key={index}
                      id={`pin-${index}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePINChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-12 text-center text-lg font-semibold"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <AnimatedButton
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  animation="scale"
                >
                  {isLoading ? 'Validating...' : 'Continue'}
                </AnimatedButton>

                <div className="text-center text-sm text-muted-foreground">
                  Demo PIN: <span className="font-mono font-semibold">123456</span>
                </div>
              </div>

              <div className="text-xs text-center text-muted-foreground">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Lock className="h-3 w-3" />
                  <span>Secure PIN Verification</span>
                </div>
                <div>Default role: Owner</div>
              </div>
            </form>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}