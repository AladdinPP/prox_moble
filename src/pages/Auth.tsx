import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SignIn } from '@/components/auth/SignIn';
import { SignUp } from '@/components/auth/SignUp';
import { useAuth } from '@/contexts/AuthContext';

export function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  );

  // Track email to pre-fill when switching between signin/signup
  const [prefillEmail, setPrefillEmail] = useState<string>('');

  // Redirect authenticated users
  useEffect(() => {
    if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  const handleSignInSuccess = () => {
    navigate('/home');
  };

  const handleSignUpSuccess = () => {
    navigate('/onboarding');
  };

  const handleSwitchMode = (newMode: 'signin' | 'signup', email?: string) => {
    setMode(newMode);
    setSearchParams({ mode: newMode });
    if (email) {
      setPrefillEmail(email);
    } else {
      setPrefillEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      {mode === 'signin' ? (
        <SignIn
          onSuccess={handleSignInSuccess}
          onSwitchToSignUp={(email?: string) => handleSwitchMode('signup', email)}
          prefillEmail={prefillEmail}
        />
      ) : (
        <SignUp
          onSuccess={handleSignUpSuccess}
          onSwitchToSignIn={(email?: string) => handleSwitchMode('signin', email)}
        />
      )}
    </div>
  );
}
