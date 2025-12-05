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
      {/* Card with background image + overlay */}
      <ProxCard 
        className="relative w-full max-w-md mx-auto text-center bg-cover bg-center overflow-hidden"
        style={{ backgroundImage: "url('/produce_background.jpg')" }}
      >

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50"></div>

        {/* Actual content */}
        <div className="relative z-10">
          <ProxCardHeader>
            <div className="w-32 h-32 rounded-prox mx-auto mt-4 mb-2 overflow-hidden flex items-center justify-center">
              <img
                src="/Icon-01.png"
                alt="Prox Logo"
                className="w-full h-full object-contain object-center"
              />
            </div>

            {/* Title text (no box, frosted color) */}
            <ProxCardTitle className="text-3xl text-white/70 mb-1 font-primary">
              Welcome to Prox
            </ProxCardTitle>

            {/* Subtitle text */}
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

            <div className="relative">
              {/* <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div> */}

              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-2 text-white/70 font-semibold">Or</span>
              </div>
            </div>

            <Button
              onClick={handleContinueAsGuest}
              variant="secondary"
              className="w-full h-12 font-secondary hover:bg-prox hover:text-white hover:border-prox"
            >
              Continue as Guest
            </Button>

            {/* Footer text (also frosted color, no box) */}
            <p className="text-xs text-white/70 font-bold pb-4">
              Guest mode stores data locally only. Create an account to sync across devices and enable notifications.
            </p>

          </ProxCardContent>
        </div>
      </ProxCard>
    </div>
  );
}
