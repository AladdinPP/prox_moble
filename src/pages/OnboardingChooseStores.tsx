import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from '@/components/ProxCard';
import { supabase } from '@/integrations/supabase/client';

type StoreId = 'walmart' | 'target' | 'ralphs' | 'vons' | 'costco' | 'sams';

interface StoreOption {
  id: StoreId;
  label: string;
}

const STORE_OPTIONS: StoreOption[] = [
  { id: 'walmart', label: 'Walmart' },
  { id: 'target', label: 'Target' },
  { id: 'ralphs', label: 'Ralphs' },
  { id: 'vons', label: 'Vons' },
  { id: 'costco', label: 'Costco' },
  { id: 'sams', label: "Sam's Club" },
];

export function OnboardingChooseStores() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<StoreId[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  function toggleStore(id: StoreId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const selectedCount = selected.length;

  async function handleContinue() {
    setIsSaving(true);
    try {
      const { data, error: userError } = await supabase.auth.getUser();

      if (!userError && data?.user) {
        const user = data.user;
        const selectedStores = STORE_OPTIONS.filter((option) =>
          selected.includes(option.id),
        );

        const grocer1 = selectedStores[0]?.label ?? null;
        const grocer2 = selectedStores[1]?.label ?? null;

        if (grocer1 || grocer2) {
          const { error } = await supabase
            .from('profiles')
            .update({
              grocer_1: grocer1,
              grocer_2: grocer2,
            })
            .eq('id', user.id);

          if (error) {
            console.warn(
              'Failed to save preferred stores to profiles table',
              error,
            );
          }
        }
      } else {
        console.log(
          'No logged-in user; skipping saving store preferences to Supabase',
        );
      }
    } catch (error) {
      console.warn('Unexpected error while saving preferred stores', error);
    } finally {
      setIsSaving(false);
      navigate('/onboarding/savings-preview');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <ProxCard className="w-full max-w-lg">
        <ProxCardHeader>
          <button
            type="button"
            className="text-sm text-muted-foreground mb-2"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

          <ProxCardTitle className="font-secondary text-2xl">
            Choose your stores
          </ProxCardTitle>

          <p className="text-sm text-muted-foreground">
            Select one or more stores you typically shop at. We&apos;ll use this
            to compare prices.
          </p>
        </ProxCardHeader>

        <ProxCardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {STORE_OPTIONS.map((store) => {
              const isSelected = selected.includes(store.id);
              return (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => toggleStore(store.id)}
                  className={[
                    'flex items-center justify-between rounded-xl border px-3 py-3 text-left transition-all',
                    'bg-background',
                    isSelected
                      ? 'border-accent bg-accent/10 shadow-sm'
                      : 'border-border hover:border-accent/70',
                  ].join(' ')}
                >
                  <span className="font-secondary text-sm">{store.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-accent" />}
                </button>
              );
            })}
          </div>

          {selectedCount === 0 && (
            <p className="text-xs text-muted-foreground">
              Choose at least one store to continue.
            </p>
          )}

          <Button
            className="w-full h-12 font-secondary"
            disabled={selectedCount === 0 || isSaving}
            onClick={handleContinue}
          >
            {isSaving
              ? 'Saving...'
              : selectedCount > 0
              ? `Continue with ${selectedCount} store${
                  selectedCount > 1 ? 's' : ''
                }`
              : 'Continue'}
          </Button>
        </ProxCardContent>
      </ProxCard>
    </div>
  );
}
