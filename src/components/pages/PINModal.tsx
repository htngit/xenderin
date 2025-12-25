import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedButton } from '@/components/ui/animated-button';
import { FadeIn } from '@/components/ui/animations';
import { PINValidation } from '@/lib/services/types';
import { Lock, Shield, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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
  userId?: string;
}

interface ProfileOption {
  id: string;
  name: string;
  role: string;
  email: string;
  pin: string;
}

export function PINModal({ onPINValidated, userName, userId }: PINModalProps) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);

  // Fetch profiles from Supabase
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!userId) {
        setIsLoadingProfiles(false);
        return;
      }

      try {
        setIsLoadingProfiles(true);

        // Fetch the current user's profile and any staff profiles under this master
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, name, role, email, pin')
          .or(`id.eq.${userId},master_user_id.eq.${userId}`);

        if (fetchError) {
          console.error('Error fetching profiles:', fetchError);
          // Fallback to default owner profile
          setProfiles([{
            id: userId,
            name: 'Owner',
            role: 'owner',
            email: '',
            pin: '123456'
          }]);
          setSelectedProfile(userId);
          return;
        }

        if (data && data.length > 0) {
          const profileOptions: ProfileOption[] = data.map(p => ({
            id: p.id,
            name: p.name || 'Unknown',
            role: p.role || 'staff',
            email: p.email || '',
            pin: p.pin || '123456'
          }));

          setProfiles(profileOptions);
          // Select current user's profile by default
          const currentProfile = profileOptions.find(p => p.id === userId);
          setSelectedProfile(currentProfile?.id || profileOptions[0]?.id || '');
        } else {
          // No profiles found, create default
          setProfiles([{
            id: userId,
            name: userName || 'Owner',
            role: 'owner',
            email: '',
            pin: '123456'
          }]);
          setSelectedProfile(userId);
        }
      } catch (err) {
        console.error('Error in fetchProfiles:', err);
        // Fallback
        setProfiles([{
          id: userId,
          name: 'Owner',
          role: 'owner',
          email: '',
          pin: '123456'
        }]);
        setSelectedProfile(userId);
      } finally {
        setIsLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, [userId, userName]);

  const handlePINChange = (index: number, value: string) => {
    if (value.length > 1) return;

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

    if (error) {
      setError('');
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
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

    if (!selectedProfile) {
      setError('Please select a profile');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Find the selected profile
      const profile = profiles.find(p => p.id === selectedProfile);

      if (!profile) {
        setError('Profile not found');
        return;
      }

      // Validate PIN against the profile's stored PIN
      if (pinString === profile.pin) {
        toast.success(`Welcome, ${profile.name}!`);
        onPINValidated({
          is_valid: true,
          role: profile.role as 'owner' | 'staff'
        }, selectedProfile);
      } else {
        toast.error('Invalid PIN');
        setError('Invalid PIN. Please try again.');
      }
    } catch (err) {
      console.error('PIN validation error:', err);
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
              Welcome back, {userName}! Please select your profile and enter PIN
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Profile Selection */}
              <div className="space-y-2">
                <Label>Select Profile</Label>
                {isLoadingProfiles ? (
                  <div className="h-10 bg-muted animate-pulse rounded-md" />
                ) : (
                  <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{profile.name}</span>
                            {profile.role === 'owner' && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                Owner
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                  disabled={isLoading || isLoadingProfiles}
                  animation="scale"
                >
                  {isLoading ? 'Validating...' : 'Continue'}
                </AnimatedButton>

                <div className="text-center text-sm text-muted-foreground">
                  Default PIN: <span className="font-mono font-semibold">123456</span>
                </div>
              </div>

              <div className="text-xs text-center text-muted-foreground">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Lock className="h-3 w-3" />
                  <span>Secure PIN Verification</span>
                </div>
                <div>You can change your PIN in Settings</div>
              </div>
            </form>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}