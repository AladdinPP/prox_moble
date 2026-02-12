import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type SignInForm = z.infer<typeof signInSchema>;

interface SignInProps {
  onSuccess: () => void;
  onSwitchToSignUp: (email?: string) => void;
  prefillEmail?: string;
}

export function SignIn({ onSuccess, onSwitchToSignUp, prefillEmail }: SignInProps) {
  const { signIn, forgotPassword, checkWaitlistEmail } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: prefillEmail || '',
      password: '',
    },
  });

  // Pre-fill email when passed from SignUp redirect
  useEffect(() => {
    if (prefillEmail) {
      setValue('email', prefillEmail);
    }
  }, [prefillEmail, setValue]);

  const emailValue = watch('email');

  const onSubmit = async (data: SignInForm) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);

      if (error) {
        const signInErrorMessage = getErrorMessage(error, 'Sign in failed.');

        // If credentials are invalid, check whether the account even exists
        // to give a more helpful error message
        if (
          signInErrorMessage.toLowerCase().includes('invalid login credentials') ||
          signInErrorMessage.toLowerCase().includes('invalid credentials')
        ) {
          try {
            const status = await checkWaitlistEmail(data.email);
            if (status.status === 'new_user') {
              toast({
                title: "No account found",
                description: "This email doesn't have an account yet. Would you like to sign up?",
                variant: "destructive",
              });
              return;
            }
            if (status.status === 'legacy_waitlist') {
              toast({
                title: "Account not yet set up",
                description: "We found your waitlist entry, but you need to sign up first to set a password.",
              });
              onSwitchToSignUp(data.email);
              return;
            }
          } catch {
            // Fall through to generic error
          }
        }

        toast({
          title: "Sign in failed",
          description: signInErrorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
        reset();
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailValue || !emailValue.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address first, then tap Forgot Password.",
        variant: "destructive",
      });
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue.trim())) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);

    try {
      const result = await forgotPassword(emailValue.trim());

      if (result.isWaitlistOnly) {
        // This email has no auth account — they need to sign up first
        toast({
          title: "No account found",
          description: "This email is on our waitlist but doesn't have an account yet. Let's get you signed up!",
        });
        onSwitchToSignUp(emailValue.trim());
        return;
      }

      if (result.error) {
        toast({
          title: "Reset failed",
          description: getErrorMessage(result.error, "Failed to send reset email. Please try again."),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check your email 📧",
          description: "We've sent a password reset link to your email.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <ProxCard className="w-full max-w-md mx-auto">
      <ProxCardHeader>
        <ProxCardTitle className="text-center text-2xl font-primary font-semibold text-black">Sign In</ProxCardTitle>
      </ProxCardHeader>
      <ProxCardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-secondary text-black">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              className="h-12"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="font-secondary text-black">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register('password')}
                className="h-12 pr-10"
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
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Forgot Password link */}
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isResettingPassword || isLoading}
              className="text-sm text-accent hover:underline font-secondary disabled:opacity-50"
            >
              {isResettingPassword ? "Checking account..." : "Forgot Password?"}
            </button>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary"
            disabled={isLoading || isResettingPassword}
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => onSwitchToSignUp()}
              className="text-sm text-accent hover:underline font-secondary"
            >
              Don't have an account? Sign up
            </button>
          </div>
        </form>
      </ProxCardContent>
    </ProxCard>
  );
}
