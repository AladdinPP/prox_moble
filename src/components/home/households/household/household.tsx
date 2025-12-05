import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MakeHouseHold } from './MakeHouseHold';
import { JoinHouseHold } from './JoinHouseHold';
import { DisplayHouseHold } from './DisplayHouseHold';

export function HouseholdOverview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasHousehold, setHasHousehold] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      checkHouseholdStatus();
    }
  }, [user]);

  const checkHouseholdStatus = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Check if user has a household in their raw_user_meta_data
      const householdId = user.user_metadata?.household;
      
      if (!householdId) {
        setHasHousehold(false);
        return;
      }

      // Verify the household exists in the database
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('id')
        .eq('id', householdId)
        .single();

      if (householdError || !householdData) {
        // Household doesn't exist, clear it from user metadata
        await supabase.auth.updateUser({
          data: {
            household: null
          }
        });
        setHasHousehold(false);
      } else {
        setHasHousehold(true);
      }
    } catch (error) {
      console.error('Error checking household status:', error);
      toast({
        title: "Error",
        description: "Failed to check household status",
        variant: "destructive",
      });
      setHasHousehold(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground font-secondary">Loading household data...</p>
      </div>
    );
  }

  if (hasHousehold === true) {
    return <DisplayHouseHold />;
  }

  if (hasHousehold === false) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-foreground font-primary mb-2">
            Join or Create a Household
          </h2>
          <p className="text-muted-foreground font-secondary">
            Connect with your family to manage groceries together
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MakeHouseHold />
          <JoinHouseHold />
        </div>
      </div>
    );
  }

  return null;
}