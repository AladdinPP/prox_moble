import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useGuestStore } from '@/stores/guestStore';

export function Welcome() {
  const navigate = useNavigate();
  const { setIsGuest } = useGuestStore();

  const handleContinueAsGuest = () => {
    setIsGuest(true);
    navigate('/home');
  };

  const handleSignUp = () => {
    navigate('/auth?mode=signup');
  };

  const handleSignIn = () => {
    navigate('/auth?mode=signin');
  };

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <ProxCard className="w-full max-w-md mx-auto text-center">
        <ProxCardHeader>
          <div className="w-32 h-32 rounded-prox mx-auto mt-4 mb-2 overflow-hidden">
            <img
              src="/Icon-01.jpg"
              alt="Prox Logo"
              className="w-48 h-48 object-cover object-center transform translate-x-[-12.5%] translate-y-[-12.5%]"
            />
          </div>
          <ProxCardTitle className="text-3xl text-primary mb-1 font-primary">
            Welcome to Prox
          </ProxCardTitle>
          <p className="text-muted-foreground font-secondary text-sm">
            Track your groceries, reduce waste, and never run out of essentials.
          </p>
        </ProxCardHeader>
        <ProxCardContent className="space-y-4">
          <Button
            onClick={handleSignUp}
            className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-secondary"
          >
            Create Account
          </Button>

          <Button
            onClick={handleSignIn}
            variant="outline"
            className="w-full h-12 font-secondary"
          >
            Sign In
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          
          <Button
            onClick={handleContinueAsGuest}
            variant="secondary"
            className="w-full h-12 font-secondary"
          >
            Continue as Guest
          </Button>

          <p className="text-xs text-muted-foreground font-secondary">
            Guest mode stores data locally only. Create an account to sync across devices and enable notifications.
          </p>
        </ProxCardContent>
      </ProxCard>
    </div>
  );
}