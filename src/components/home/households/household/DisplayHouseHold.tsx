import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProxCard, ProxCardContent, ProxCardHeader, ProxCardTitle } from '@/components/ProxCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Users, Calendar, LogOut, Copy, Check } from 'lucide-react';

interface Household {
  id: number;
  name: string;
  head_of: string;
  join_key: string;
  created_at: string;
  updated_at: string;
}

interface HeadOfHousehold {
  first_name: string;
  last_name: string;
}

export function DisplayHouseHold() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [household, setHousehold] = useState<Household | null>(null);
  const [headOfHousehold, setHeadOfHousehold] = useState<HeadOfHousehold | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHouseholdData();
    }
  }, [user]);

  const fetchHouseholdData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get household ID from user's raw_user_meta_data
      const householdId = user.user_metadata?.household;
      
      if (!householdId) {
        console.error('No household ID found in user metadata');
        return;
      }

      // Fetch household data
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('*')
        .eq('id', householdId)
        .single();

      if (householdError) throw householdError;

      if (householdData) {
        setHousehold(householdData);

        // Fetch head of household data
        const { data: headData, error: headError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', householdData.head_of)
          .single();

        if (headError) {
          // If profile not found, try to get from auth users
          const { data: authUserData, error: authError } = await supabase.auth.admin.getUserById(householdData.head_of);
          if (!authError && authUserData.user) {
            setHeadOfHousehold({
              first_name: authUserData.user.user_metadata?.first_name || 'Unknown',
              last_name: authUserData.user.user_metadata?.last_name || 'User'
            });
          }
        } else {
          setHeadOfHousehold(headData);
        }
      }
    } catch (error) {
      console.error('Error fetching household data:', error);
      toast({
        title: "Error",
        description: "Failed to load household data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveHousehold = async () => {
    if (!user || !household) return;

    setLeaving(true);
    try {
      // Check if user is head of household
      const isHeadOfHousehold = household.head_of === user.id;

      if (isHeadOfHousehold) {
        // If head of household, delete the household entry
        const { error: householdError } = await supabase
          .from('households')
          .delete()
          .eq('id', household.id);

        if (householdError) throw householdError;
      }

      // Remove household from user's raw_user_meta_data
      const { error: userError } = await supabase.auth.updateUser({
        data: {
          household: null
        }
      });

      if (userError) throw userError;

      toast({
        title: "Success",
        description: isHeadOfHousehold 
          ? "Household deleted successfully" 
          : "Left household successfully",
      });

      // Refresh the page to show the household selection
      window.location.reload();
    } catch (error) {
      console.error('Error leaving household:', error);
      toast({
        title: "Error",
        description: "Failed to leave household. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLeaving(false);
    }
  };

  const copyJoinKey = async () => {
    if (!household) return;
    
    try {
      await navigator.clipboard.writeText(household.join_key);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Join key copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy join key:', error);
      toast({
        title: "Error",
        description: "Failed to copy join key",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground font-secondary">Loading household data...</p>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground font-secondary">No household data found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Household Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-accent/10 rounded-prox mx-auto mb-4 flex items-center justify-center">
          <Building2 className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground font-primary mb-2">
          {household.name}
        </h2>
        <p className="text-muted-foreground font-secondary">
          {headOfHousehold ? 
            `Head of Household: ${headOfHousehold.first_name} ${headOfHousehold.last_name}` :
            'Head of Household: Unknown'
          }
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProxCard>
          <ProxCardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-accent/10 rounded-prox flex items-center justify-center">
                <Building2 className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground font-primary">
                  {household.name}
                </p>
                <p className="text-sm text-muted-foreground font-secondary">
                  Household Name
                </p>
              </div>
            </div>
          </ProxCardContent>
        </ProxCard>

        <ProxCard>
          <ProxCardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-highlight/10 rounded-prox flex items-center justify-center">
                <Calendar className="h-5 w-5 text-highlight" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground font-primary">
                  {new Date(household.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground font-secondary">
                  Created
                </p>
              </div>
            </div>
          </ProxCardContent>
        </ProxCard>

        <ProxCard>
          <ProxCardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-muted/50 rounded-prox flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground font-primary">
                  Active
                </p>
                <p className="text-sm text-muted-foreground font-secondary">
                  Status
                </p>
              </div>
            </div>
          </ProxCardContent>
        </ProxCard>
      </div>

      {/* Join Key Section */}
      <ProxCard>
        <ProxCardHeader>
          <ProxCardTitle className="font-primary">Household Join Key</ProxCardTitle>
        </ProxCardHeader>
        <ProxCardContent>
          <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-prox">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground font-secondary mb-1">
                Share this key with family members to invite them to join:
              </p>
              <p className="font-mono text-lg font-medium text-foreground break-all">
                {household.join_key}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={copyJoinKey}
              className="flex-shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </ProxCardContent>
      </ProxCard>

      {/* Leave Household Button */}
      <div className="text-center">
        <Button
          onClick={handleLeaveHousehold}
          disabled={leaving}
          variant="destructive"
          className="font-secondary"
        >
          {leaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Leaving...
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-2" />
              Leave Household
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
