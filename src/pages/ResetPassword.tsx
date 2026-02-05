import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useToast } from '@/hooks/use-toast';

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters')
      .max(128, 'Password must be less than 128 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

export function ResetPassword() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Listen for the PASSWORD_RECOVERY auth event
  // When user clicks the reset link in email, Supabase auto-exchanges the
  // token and fires this event, giving us a valid session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsReady(true);
        }
      }
    );

    // Also check if we already have a session (user might have already been
    // authenticated by the time this component mounts)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await resetPassword(password);

      if (error) {
        toast({
          title: "Reset failed",
          description: error.message || "Failed to update password. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password updated! ✅",
          description: "Your password has been reset. You're now signed in.",
        });
        // Navigate to home — user is already authenticated
        navigate('/home', { replace: true });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show a loading/waiting state while the auth token is being exchanged
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
        <ProxCard className="w-full max-w-md mx-auto">
          <ProxCardHeader>
            <ProxCardTitle className="text-center text-2xl font-primary font-semibold text-black">
              Reset Password
            </ProxCardTitle>
          </ProxCardHeader>
          <ProxCardContent>
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-muted-foreground font-secondary">
                Verifying your reset link...
              </p>
              <p className="text-sm text-muted-foreground font-secondary">
                If this takes too long, the link may have expired.{' '}
                <button
                  onClick={() => navigate('/auth')}
                  className="text-accent hover:underline"
                >
                  Go back to Sign In
                </button>
              </p>
            </div>
          </ProxCardContent>
        </ProxCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <ProxCard className="w-full max-w-md mx-auto">
        <ProxCardHeader>
          <ProxCardTitle className="text-center text-2xl font-primary font-semibold text-black">
            Set New Password
          </ProxCardTitle>
        </ProxCardHeader>
        <ProxCardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="font-secondary text-black">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-secondary text-black">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary"
              disabled={isLoading}
            >
              {isLoading ? 'Updating Password...' : 'Update Password'}
            </Button>
          </form>
        </ProxCardContent>
      </ProxCard>
    </div>
  );
}
