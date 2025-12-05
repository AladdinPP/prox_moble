import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProxCard, ProxCardContent } from '@/components/ProxCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus } from 'lucide-react';

export function MakeHouseHold() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [householdName, setHouseholdName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateHousehold = async () => {
    if (!user || !householdName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a household name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create household entry
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .insert({
          name: householdName.trim(),
          head_of: user.id
        })
        .select()
        .single();

      if (householdError) throw householdError;

      // Update user's raw_user_meta_data
      const { error: userError } = await supabase.auth.updateUser({
        data: {
          household: householdData.id
        }
      });

      if (userError) throw userError;

      toast({
        title: "Success",
        description: "Household created successfully!",
      });

      // Reset form
      setHouseholdName('');
      
      // Refresh the page to show the new household
      window.location.reload();
    } catch (error) {
      console.error('Error creating household:', error);
      toast({
        title: "Error",
        description: "Failed to create household. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProxCard>
      <ProxCardContent className="p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-accent/10 rounded-prox mx-auto mb-4 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-foreground font-primary mb-2">
            Create New Household
          </h3>
          <p className="text-muted-foreground font-secondary mb-6">
            Start your own household and invite family members to join
          </p>
          
          <div className="max-w-md mx-auto space-y-4">
            <Input
              placeholder="Enter household name (e.g., The Johnson Family)"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="font-secondary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateHousehold();
                }
              }}
            />
            <Button
              onClick={handleCreateHousehold}
              disabled={loading || !householdName.trim()}
              className="w-full bg-accent hover:bg-accent/90 font-secondary"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Household
                </>
              )}
            </Button>
          </div>
        </div>
      </ProxCardContent>
    </ProxCard>
  );
}
