import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BubbleBackground } from '@/components/ui/bubble';
import { AuthService, AuthResponse, serviceManager } from '@/lib/services';
import { useToast } from '@/hooks/use-toast';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  UserPlus,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send
} from 'lucide-react';
import { useIntl, FormattedMessage } from 'react-intl';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

type ViewType = 'login' | 'register' | 'forgot-password' | 'success-register' | 'success-reset';

interface LoginPageProps {
  onLoginSuccess: (authData: AuthResponse) => void;
  initialView?: ViewType;
}

export function LoginPage({ onLoginSuccess, initialView = 'login' }: LoginPageProps) {
  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { toast } = useToast();
  const intl = useIntl();
  // Create AuthService directly - LoginPage loads before serviceManager initialization
  const authService = useMemo(() => new AuthService(), []);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
  };

  const handleViewChange = (view: ViewType) => {
    resetForm();
    setCurrentView(view);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authService.login(email, password);
      toast({
        title: intl.formatMessage({ id: 'common.status.success', defaultMessage: 'Success!' }),
        description: intl.formatMessage({ id: 'auth.login.success', defaultMessage: 'Logged in successfully' })
      });
      onLoginSuccess(response);
    } catch (err: any) {
      setError(err.message || intl.formatMessage({ id: 'auth.login.failed', defaultMessage: 'Login failed' }));
      toast({
        title: intl.formatMessage({ id: 'common.status.error', defaultMessage: 'Error' }),
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(intl.formatMessage({ id: 'auth.register.password_mismatch', defaultMessage: 'Passwords do not match' }));
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.register(email, password, name);

      // Check if email confirmation is required
      if (response.requiresEmailConfirmation) {
        toast({
          title: intl.formatMessage({ id: 'common.status.success', defaultMessage: 'Success!' }),
          description: intl.formatMessage({
            id: 'auth.register.check_email',
            defaultMessage: 'Registration successful! Please check your email to confirm your account.'
          })
        });

        // Switch to login tab after 2 seconds
        setTimeout(() => {
          handleViewChange('login');
        }, 2000);
      } else {
        // Email already confirmed (shouldn't happen in normal flow)
        toast({
          title: intl.formatMessage({ id: 'common.status.success', defaultMessage: 'Success!' }),
          description: intl.formatMessage({ id: 'auth.register.success', defaultMessage: 'Account created successfully' })
        });
        onLoginSuccess(response);
      }
    } catch (err: any) {
      const errorMessage = err.message?.toLowerCase() || '';
      console.error('Registration failed:', err.message);

      // Handle specific error cases if needed
      let displayError = err.message || intl.formatMessage({ id: 'auth.register.failed', defaultMessage: 'Registration failed' });

      if (errorMessage.includes('already registered') || errorMessage.includes('unique constraint')) {
        displayError = intl.formatMessage({ id: 'auth.register.email_exists', defaultMessage: 'Email already registered. Please login.' });
      }

      setError(displayError);
      toast({
        title: intl.formatMessage({ id: 'common.status.error', defaultMessage: 'Error' }),
        description: displayError,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.forgotPassword(email);
      toast({
        title: intl.formatMessage({ id: 'common.status.success', defaultMessage: 'Success!' }),
        description: intl.formatMessage({ id: 'auth.forgot_password.sent', defaultMessage: 'Reset email sent' })
      });
      handleViewChange('success-reset');
    } catch (err: any) {
      setError(err.message || intl.formatMessage({ id: 'auth.forgot_password.failed', defaultMessage: 'Failed to send reset email' }));
      toast({
        title: intl.formatMessage({ id: 'common.status.error', defaultMessage: 'Error' }),
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BubbleBackground interactive={true} className="absolute inset-0" />

      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher className="text-white hover:bg-white/20" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {currentView === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <Card className="backdrop-blur-xl bg-white/20 border-white/20 shadow-2xl">
                <CardHeader className="text-center space-y-2">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-blue-500/20 rounded-full backdrop-blur-sm">
                      <Lock className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-white">
                    <FormattedMessage id="common.app.name" defaultMessage="Xender-In" />
                  </CardTitle>
                  <CardDescription className="text-white/80">
                    <FormattedMessage id="auth.login.subtitle" defaultMessage="Sign in to your WhatsApp automation account" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white/90">
                        <FormattedMessage id="auth.login.email.label" defaultMessage="Email" />
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                        <Input
                          id="email"
                          type="email"
                          placeholder={intl.formatMessage({ id: 'auth.login.email.placeholder', defaultMessage: 'Enter your email' })}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-white/90">
                        <FormattedMessage id="auth.login.password.label" defaultMessage="Password" />
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder={intl.formatMessage({ id: 'auth.login.password.placeholder', defaultMessage: 'Enter your password' })}
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
                    </div>

                    {error && (
                      <Alert className="bg-red-500/20 border-red-500/50 text-white">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <FormattedMessage id="auth.login.signing_in" defaultMessage="Signing in..." />
                        </>
                      ) : (
                        <FormattedMessage id="common.button.login" defaultMessage="Sign In" />
                      )}
                    </Button>

                    <div className="text-center space-y-2">
                      <button
                        type="button"
                        onClick={() => handleViewChange('forgot-password')}
                        className="text-sm text-white/80 hover:text-white underline"
                      >
                        <FormattedMessage id="auth.login.forgot_password" defaultMessage="Forgot password?" />
                      </button>
                      <div className="text-sm text-white/80">
                        <FormattedMessage id="auth.login.no_account" defaultMessage="Don't have an account?" />{' '}
                        <button
                          type="button"
                          onClick={() => handleViewChange('register')}
                          className="text-white font-semibold hover:underline"
                        >
                          <FormattedMessage id="auth.login.sign_up_link" defaultMessage="Sign up" />
                        </button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
                <CardHeader className="text-center space-y-2">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-green-500/20 rounded-full backdrop-blur-sm">
                      <UserPlus className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-white">
                    <FormattedMessage id="auth.register.title" defaultMessage="Create Account" />
                  </CardTitle>
                  <CardDescription className="text-white/80">
                    <FormattedMessage id="auth.register.subtitle" defaultMessage="Join Xender-In WhatsApp Automation" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white/90">
                        <FormattedMessage id="auth.register.name.label" defaultMessage="Full Name" />
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder={intl.formatMessage({ id: 'auth.register.name.placeholder', defaultMessage: 'Enter your name' })}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-email" className="text-white/90">
                        <FormattedMessage id="auth.login.email.label" defaultMessage="Email" />
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                        <Input
                          id="reg-email"
                          type="email"
                          placeholder={intl.formatMessage({ id: 'auth.login.email.placeholder', defaultMessage: 'Enter your email' })}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-password" className="text-white/90">
                        <FormattedMessage id="auth.login.password.label" defaultMessage="Password" />
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                        <Input
                          id="reg-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder={intl.formatMessage({ id: 'auth.login.password.placeholder', defaultMessage: 'Enter your password' })}
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-white/90">
                        <FormattedMessage id="auth.register.confirm_password.label" defaultMessage="Confirm Password" />
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder={intl.formatMessage({ id: 'auth.register.confirm_password.placeholder', defaultMessage: 'Confirm your password' })}
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

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <FormattedMessage id="auth.register.creating" defaultMessage="Creating account..." />
                        </>
                      ) : (
                        <FormattedMessage id="auth.register.submit" defaultMessage="Create Account" />
                      )}
                    </Button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => handleViewChange('login')}
                        className="text-sm text-white/80 hover:text-white"
                      >
                        <FormattedMessage id="auth.register.have_account" defaultMessage="Already have an account?" />{' '}
                        <span className="font-semibold underline">
                          <FormattedMessage id="common.button.login" defaultMessage="Sign in" />
                        </span>
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'forgot-password' && (
            <motion.div
              key="forgot-password"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
                <CardHeader className="text-center space-y-2">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-orange-500/20 rounded-full backdrop-blur-sm">
                      <Send className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-white">
                    <FormattedMessage id="auth.forgot_password.title" defaultMessage="Reset Password" />
                  </CardTitle>
                  <CardDescription className="text-white/80">
                    <FormattedMessage id="auth.forgot_password.subtitle" defaultMessage="Enter your email to receive reset instructions" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email" className="text-white/90">
                        <FormattedMessage id="auth.login.email.label" defaultMessage="Email" />
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-5 w-5 text-white/60" />
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder={intl.formatMessage({ id: 'auth.login.email.placeholder', defaultMessage: 'Enter your email' })}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <Alert className="bg-red-500/20 border-red-500/50 text-white">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <FormattedMessage id="auth.forgot_password.sending" defaultMessage="Sending..." />
                        </>
                      ) : (
                        <FormattedMessage id="auth.forgot_password.submit" defaultMessage="Send Reset Email" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleViewChange('login')}
                      variant="outline"
                      className="w-full bg-transparent border-white/30 text-white hover:bg-white/10"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      <FormattedMessage id="auth.forgot_password.back_to_login" defaultMessage="Back to Login" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'success-register' && (
            <motion.div
              key="success-register"
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
                    <h2 className="text-2xl font-bold text-white">
                      <FormattedMessage id="auth.register.success_title" defaultMessage="Registration Successful!" />
                    </h2>
                    <p className="text-white/80">
                      <FormattedMessage id="auth.register.success_message" defaultMessage="Your account has been created successfully. You can now log in." />
                    </p>
                  </div>
                  <Button
                    onClick={() => handleViewChange('login')}
                    className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                  >
                    <FormattedMessage id="auth.register.continue_login" defaultMessage="Continue to Login" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'success-reset' && (
            <motion.div
              key="success-reset"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
                <CardContent className="pt-6 text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="p-4 bg-blue-500/20 rounded-full backdrop-blur-sm">
                      <Mail className="h-16 w-16 text-blue-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">
                      <FormattedMessage id="auth.forgot_password.success_title" defaultMessage="Reset Email Sent!" />
                    </h2>
                    <p className="text-white/80">
                      <FormattedMessage id="auth.forgot_password.success_message" defaultMessage="Please check your email for password reset instructions." />
                    </p>
                  </div>
                  <Button
                    onClick={() => handleViewChange('login')}
                    className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                  >
                    <FormattedMessage id="auth.forgot_password.back_to_login" defaultMessage="Back to Login" />
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