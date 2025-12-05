import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProxCard, ProxCardContent } from '@/components/ProxCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus } from 'lucide-react';

export function JoinHouseHold() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [joinKey, setJoinKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinHousehold = async () => {
    if (!user || !joinKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a household join key",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Check if household exists with the join key
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('id, name')
        .eq('join_key', joinKey.trim())
        .single();

      if (householdError || !householdData) {
        toast({
          title: "Error",
          description: "Invalid join key. Please check and try again.",
          variant: "destructive",
        });
        return;
      }

      // Update user's raw_user_meta_data
      const { error: userError } = await supabase.auth.updateUser({
        data: {
          household: householdData.id
        }
      });

      if (userError) throw userError;

      toast({
        title: "Success",
        description: `Successfully joined ${householdData.name}!`,
      });

      // Reset form
      setJoinKey('');
      
      // Refresh the page to show the joined household
      window.location.reload();
    } catch (error) {
      console.error('Error joining household:', error);
      toast({
        title: "Error",
        description: "Failed to join household. Please try again.",
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
          <div className="w-16 h-16 bg-highlight/10 rounded-prox mx-auto mb-4 flex items-center justify-center">
            <Users className="h-8 w-8 text-highlight" />
          </div>
          <h3 className="text-lg font-semibold text-foreground font-primary mb-2">
            Join Existing Household
          </h3>
          <p className="text-muted-foreground font-secondary mb-6">
            Enter the join key provided by the household head to join their household
          </p>
          
          <div className="max-w-md mx-auto space-y-4">
            <Input
              placeholder="Enter household join key"
              value={joinKey}
              onChange={(e) => setJoinKey(e.target.value)}
              className="font-secondary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleJoinHousehold();
                }
              }}
            />
            <Button
              onClick={handleJoinHousehold}
              disabled={loading || !joinKey.trim()}
              className="w-full bg-highlight hover:bg-highlight/90 font-secondary"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Joining...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Join Household
                </>
              )}
            </Button>
          </div>
        </div>
      </ProxCardContent>
    </ProxCard>
  );
}
