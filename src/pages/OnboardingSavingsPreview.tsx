import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from '@/components/ProxCard';

export function OnboardingSavingsPreview() {
  const navigate = useNavigate();

  function handleStartComparing() {
    navigate('/home');
  }

  function handleShare() {
    console.log('Share with a friend clicked (not implemented yet)');
  }

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <ProxCard className="w-full max-w-md">
        <ProxCardHeader>
          <button
            type="button"
            className="text-sm text-muted-foreground mb-2"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

          <ProxCardTitle className="font-secondary text-2xl">
            You&apos;re all set
          </ProxCardTitle>

          <p className="text-sm text-muted-foreground">
            Based on your ZIP code and stores, we&apos;ll help you find the
            cheapest basket of groceries and track what you have at home.
          </p>
        </ProxCardHeader>

        <ProxCardContent className="space-y-4">
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Compare prices across your favorite stores.</li>
            <li>See what&apos;s expiring soon in your kitchen.</li>
            <li>Keep your cart and pantry in sync.</li>
          </ul>

          <Button
            className="w-full h-12 font-secondary"
            onClick={handleStartComparing}
          >
            Start comparing prices
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 font-secondary"
            onClick={handleShare}
          >
            Share with a friend
          </Button>
        </ProxCardContent>
      </ProxCard>
    </div>
  );
}
