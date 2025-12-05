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

  // Redirect authenticated users
  useEffect(() => {
    if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  const handleSuccess = () => {
    navigate('/home');
  };

  const handleSwitchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setSearchParams({ mode: newMode });
  };

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      {mode === 'signin' ? (
        <SignIn
          onSuccess={handleSuccess}
          onSwitchToSignUp={() => handleSwitchMode('signup')}
        />
      ) : (
        <SignUp
          onSuccess={handleSuccess}
          onSwitchToSignIn={() => handleSwitchMode('signin')}
        />
      )}
    </div>
  );
}