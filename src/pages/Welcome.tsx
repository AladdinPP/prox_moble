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
    <div className="fixed inset-0 overflow-hidden overscroll-none touch-none">
      {/* Full-screen background image */}
      <img
        src="/produce_background.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />

      {/* Centered content */}
      <div className="relative z-10 h-full w-full flex items-center justify-center px-4">
        <ProxCard className="w-full max-w-md mx-auto text-center bg-transparent border-none shadow-none">
          <ProxCardHeader>
            <div className="w-32 h-32 rounded-prox mx-auto mt-4 mb-2 overflow-hidden flex items-center justify-center">
              <img
                src="/Icon-01.png"
                alt="Prox Logo"
                className="w-full h-full object-contain object-center"
                draggable={false}
              />
            </div>

            <ProxCardTitle className="text-3xl text-white/70 mb-1 font-primary">
              Welcome to Prox
            </ProxCardTitle>

            <p className="text-white/70 text-sm font-bold">
              Save up to $2,500 per year by finding the lowest prices on the products you love.
            </p>
          </ProxCardHeader>

          <ProxCardContent className="space-y-4">
            <Button
              onClick={handleSignUp}
              className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary"
            >
              Create Account
            </Button>

            <Button
              onClick={handleSignIn}
              variant="outline"
              className="w-full h-12 font-secondary hover:bg-prox hover:text-white"
            >
              Sign In
            </Button>

            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 text-white/70 font-semibold">Or</span>
            </div>

            <Button
              onClick={handleContinueAsGuest}
              variant="secondary"
              className="w-full h-12 font-secondary hover:bg-prox hover:text-white hover:border-prox"
            >
              Continue as Guest
            </Button>

            <p className="text-xs text-white/70 font-bold pb-4">
              Guest mode stores data locally only. Create an account to sync across devices and enable notifications.
            </p>
          </ProxCardContent>
        </ProxCard>
      </div>
    </div>
  );
}
