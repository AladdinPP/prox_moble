import React, { useState, useEffect } from 'react';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Users, User } from 'lucide-react';

interface HouseholdMember {
    id: string;
    email: string;
  raw_user_meta_data: {
      first_name?: string;
      last_name?: string;
    household?: number;
  };
}

export function MembersManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasHousehold, setHasHousehold] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      checkHouseholdMembership();
    }
  }, [user]);

  const checkHouseholdMembership = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Check if user has a household in their user_metadata
      let householdId = user.user_metadata?.household;
      
      // If no household in user_metadata, check if user is head of any household
      if (!householdId) {
        const { data: headHousehold, error: headError } = await supabase
          .from('households')
          .select('id')
          .eq('head_of', user.id)
          .single();
        
        if (!headError && headHousehold) {
          householdId = headHousehold.id;
        }
      }
      
      if (!householdId) {
        setHasHousehold(false);
        setLoading(false);
        return;
      }

      // Verify the household exists in the database
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('id')
        .eq('id', householdId)
        .single();

      if (householdError || !householdData) {
        // Household doesn't exist, user is not a member
        setHasHousehold(false);
        setLoading(false);
        return;
      }

      // User is a member, fetch all members of this household
      await fetchHouseholdMembers(householdId);
    } catch (error) {
      console.error('Error checking household membership:', error);
      toast({
        title: "Error",
        description: "Failed to check household membership",
        variant: "destructive",
      });
      setHasHousehold(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchHouseholdMembers = async (householdId: number) => {
    try {
      // Try to call the database function to get household members
      const { data: membersData, error: membersError } = await supabase
        .rpc('get_household_members', { household_id_param: householdId });

      if (membersError) {
        console.error('Database function error:', membersError);
        
        // If the function doesn't exist, show current user as a fallback
        if (membersError.code === 'PGRST202') {
          console.log('Database function not found, showing current user as fallback');
          const currentUserMember = {
            id: user?.id || '',
            email: user?.email || '',
            raw_user_meta_data: {
              first_name: user?.user_metadata?.first_name,
              last_name: user?.user_metadata?.last_name,
              household: householdId
            }
          };
          setMembers([currentUserMember]);
          setHasHousehold(true);
          return;
        }
        
        throw membersError;
      }

      // Map the data to our interface
      const householdMembers = (membersData || []).map((member: any) => ({
        id: member.id,
        email: member.email || '',
        raw_user_meta_data: {
          first_name: member.first_name,
          last_name: member.last_name,
          household: householdId
        }
      }));

      setMembers(householdMembers);
      setHasHousehold(true);
    } catch (error) {
      console.error('Error fetching household members:', error);
      
      // Fallback: Show current user if there's any error
      const currentUserMember = {
        id: user?.id || '',
        email: user?.email || '',
        raw_user_meta_data: {
          first_name: user?.user_metadata?.first_name,
          last_name: user?.user_metadata?.last_name,
          household: householdId
        }
      };
      setMembers([currentUserMember]);
      setHasHousehold(true);

      toast({
        title: "Note",
        description: "Showing current user only. Full member list requires database setup.",
        variant: "default",
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground font-secondary">Loading members...</p>
      </div>
    );
  }

  // If user is not a member of any household
  if (hasHousehold === false) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted/30 rounded-prox mx-auto mb-4 flex items-center justify-center">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground font-primary mb-2">
          Please Join a Household
        </h2>
        <p className="text-muted-foreground font-secondary">
          You need to join a household to view its members
        </p>
      </div>
    );
  }

  // If user is a member, display all household members
  return (
    <div className="space-y-6">
      {/* Header */}
        <div>
          <h2 className={`font-semibold text-foreground font-primary ${isMobile ? 'text-xl' : 'text-2xl'}`}>
          Household Members
          </h2>
          <p className={`text-muted-foreground font-secondary mt-1 ${isMobile ? 'text-sm' : 'text-base'}`}>
          All members of your household
        </p>
      </div>

      {/* Members List */}
      <ProxCard>
        <ProxCardHeader>
          <ProxCardTitle className="font-primary">
            Members ({members.length})
          </ProxCardTitle>
        </ProxCardHeader>
        <ProxCardContent>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-secondary">
                No members found in this household
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className={`flex items-center bg-muted/30 rounded-prox ${isMobile ? 'p-3' : 'p-4'}`}>
                  <div className={`bg-accent/10 rounded-prox flex items-center justify-center ${isMobile ? 'w-8 h-8 mr-2' : 'w-10 h-10 mr-3'}`}>
                    <User className={`text-accent ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-foreground font-secondary ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {member.raw_user_meta_data?.first_name || 'Unknown'}
                      {member.raw_user_meta_data?.last_name && ` ${member.raw_user_meta_data.last_name}`}
                      </p>
                      <p className={`text-muted-foreground break-all ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {member.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ProxCardContent>
      </ProxCard>
    </div>
  );
}
