import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from '@/components/ProxCard';
import { supabase } from '@/integrations/supabase/client';

export function OnboardingZipCode() {
  const navigate = useNavigate();
  const [zip, setZip] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isValidZip = /^\d{5}$/.test(zip);

  async function handleContinue() {
    setIsSaving(true);
    try {
      const { data, error: userError } = await supabase.auth.getUser();

      if (!userError && data?.user) {
        const user = data.user;

        const { error } = await supabase
          .from('profiles')
          .update({ zip_code: zip })
          .eq('id', user.id);

        if (error) {
          console.warn('Failed to save ZIP code to profiles table', error);
        }
      } else {
        console.log('No logged-in user; skipping saving ZIP to Supabase');
      }
    } catch (error) {
      console.warn('Unexpected error while saving ZIP', error);
    } finally {
      setIsSaving(false);
      navigate('/onboarding/choose-stores');
    }
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
            Find savings near you
          </ProxCardTitle>

          <p className="text-sm text-muted-foreground">
            This powers the cheapest basket in your area. Enter your ZIP code to
            get started.
          </p>
        </ProxCardHeader>

        <ProxCardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zip" className="font-secondary">
              ZIP code
            </Label>

            <Input
              id="zip"
              inputMode="numeric"
              maxLength={5}
              value={zip}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, '').slice(0, 5);
                setZip(value);
              }}
              className="h-12 text-lg tracking-[0.3em] text-center"
              placeholder="12345"
            />

            {zip.length > 0 && !isValidZip && (
              <p className="text-xs text-destructive">
                ZIP codes should be exactly 5 numbers.
              </p>
            )}
          </div>

          <Button
            className="w-full h-12 font-secondary"
            onClick={handleContinue}
            disabled={!isValidZip || isSaving}
          >
            {isSaving ? 'Saving...' : 'Continue'}
          </Button>
        </ProxCardContent>
      </ProxCard>
    </div>
  );
}
