import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BubbleBackground } from '@/components/ui/bubble';
import { AuthService, serviceManager } from '@/lib/services';
import { useToast } from '@/hooks/use-toast';
import {
  Eye,
  EyeOff,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

type ViewType = 'reset-form' | 'success' | 'error';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const authService = useMemo(() => serviceManager.getAuthService(), []);

  const [currentView, setCurrentView] = useState<ViewType>('reset-form');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      // Check if we have hash params (Supabase sends token in URL hash)
      const hash = location.hash || window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');
      
      console.log('Reset password page loaded');
      console.log('Hash params:', hash);
      console.log('Access token:', accessToken ? 'Present' : 'Not found');
      console.log('Type:', type);
      
      // Check for errors in URL
      if (error) {
        console.error('Auth error:', error, errorDescription);
        setTokenValid(false);
        setCurrentView('error');
        toast({
          title: "Reset Link Error",
          description: errorDescription || "The reset link is invalid or has expired.",
          variant: "destructive",
        });
        return;
      }
      
      // If we have access_token and type=recovery, Supabase has already set the session
      if (accessToken && type === 'recovery') {
        console.log('Valid recovery token found, user should be authenticated');
        setTokenValid(true);
        toast({
          title: "Ready to Reset",
          description: "You can now set your new password.",
        });
        return;
      }
      
      // Wait a bit for Supabase to process the token
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Otherwise, check if user is already authenticated
      const user = await authService.getCurrentUser();
      
      if (!user) {
        console.log('No authenticated user found, showing error');
        setTokenValid(false);
        setCurrentView('error');
      } else {
        console.log('User authenticated:', user.email);
        setTokenValid(true);
      }
    };

    checkToken();
  }, [authService, location.hash, toast]);

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (pwd.length >= 6) strength += 25;
    if (pwd.length >= 8) strength += 25;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 10;

    let label = '';
    let color = '';
    
    if (strength <= 25) {
      label = 'Weak';
      color = 'bg-red-500';
    } else if (strength <= 50) {
      label = 'Fair';
      color = 'bg-orange-500';
    } else if (strength <= 75) {
      label = 'Good';
      color = 'bg-yellow-500';
    } else {
      label = 'Strong';
      color = 'bg-green-500';
    }

    return { strength: Math.min(strength, 100), label, color };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (isLoading) return;

    setIsLoading(true);

    try {
      await authService.resetPassword(password);
      setCurrentView('success');
      toast({
        title: "Password Reset Successful!",
        description: "Your password has been updated successfully.",
      });

      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
      toast({
        title: "Error",
        description: err.message || 'Failed to reset password',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking token
  if (tokenValid === null) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BubbleBackground interactive={true} className="absolute inset-0" />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl w-full max-w-md">
            <CardContent className="pt-6 text-center space-y-6">
              <div className="flex justify-center">
                <Loader2 className="h-16 w-16 text-white animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Verifying Reset Link...</h2>
                <p className="text-white/80">Please wait while we verify your reset link.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BubbleBackground interactive={true} className="absolute inset-0" />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {currentView === 'reset-form' && tokenValid && (
            <motion.div
              key="reset-form"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
                <CardHeader className="text-center space-y-2">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-blue-500/20 rounded-full backdrop-blur-sm">
                      <KeyRound className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-white">Reset Your Password</CardTitle>
                  <CardDescription className="text-white/80">
                    Enter your new password below
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-white/90">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter new password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-white/60 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      
                      {password && (
                        <div className="space-y-1 mt-2">
                          <div className="flex items-center justify-between text-xs text-white/80">
                            <span>Password strength:</span>
                            <span className="font-medium">{passwordStrength.label}</span>
                          </div>
                          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${passwordStrength.color} transition-all duration-300`}
                              style={{ width: `${passwordStrength.strength}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-white/90">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-white/60 hover:text-white"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <Alert className="bg-red-500/20 border-red-500/50 text-white">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 text-xs text-white/80">
                      <p className="font-medium mb-2">Password requirements:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>At least 6 characters long</li>
                        <li>Mix of uppercase and lowercase letters (recommended)</li>
                        <li>Include numbers and special characters (recommended)</li>
                      </ul>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading || tokenValid === false}
                      className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Resetting password...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Reset Password
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => navigate('/login')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full bg-transparent border-white/30 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
                <CardContent className="pt-6 text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="p-4 bg-green-500/20 rounded-full backdrop-blur-sm">
                      <CheckCircle className="h-16 w-16 text-green-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Password Reset Successful!</h2>
                    <p className="text-white/80">
                      Your password has been updated successfully.
                    </p>
                    <p className="text-sm text-white/70">
                      Redirecting to login page...
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Please wait...</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
                <CardContent className="pt-6 text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="p-4 bg-red-500/20 rounded-full backdrop-blur-sm">
                      <AlertCircle className="h-16 w-16 text-red-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Invalid Reset Link</h2>
                    <p className="text-white/80">
                      This password reset link is invalid or has expired.
                    </p>
                    <p className="text-sm text-white/70">
                      Please request a new password reset link.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate('/login')}
                    className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                  >
                    Back to Login
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
