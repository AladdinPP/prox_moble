import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Clock, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProxCard, ProxCardContent } from '@/components/ProxCard';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStore } from '@/stores/guestStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isWithinInterval, addDays } from 'date-fns';

interface Item {
  id: string;
  name: string;
  category: string;
  purchased_at: string;
  estimated_expiration_at?: string;
  estimated_restock_at?: string;
  store_name?: string;
  quantity?: number;
  unit?: string;
  owner_first_name?: string;
  owner_last_name?: string;
}

export function ExpiringSoon() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items: guestItems, isGuest } = useGuestStore();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [householdItems, setHouseholdItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState<{id: string, first_name: string, last_name: string}[]>([]);
  const [householdLoading, setHouseholdLoading] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setItems(guestItems);
    } else if (user) {
      fetchUserItems();
      fetchHouseholdMembers();
    }
  }, [user, isGuest, guestItems]);

  useEffect(() => {
    if (householdMembers.length > 0) {
      fetchHouseholdItems();
    }
  }, [householdMembers]);

  const fetchUserItems = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, category, purchased_at, estimated_expiration_at, estimated_restock_at, store_name, quantity, unit, created_at, updated_at, user_id, guest_owner_id, estimate_source')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchHouseholdMembers = async () => {
    if (!user) return;

    setHouseholdLoading(true);
    try {
      const userHousehold = user.user_metadata?.household;
      if (!userHousehold) {
        setHouseholdMembers([]);
        return;
      }

      const householdId = typeof userHousehold === 'string' ? parseInt(userHousehold) : userHousehold;
      
      const { data: membersData, error: membersError } = await supabase
        .rpc('get_household_members', { household_id_param: householdId });

      if (membersError) {
        console.error('Database function error:', membersError);
        if (membersError.code === 'PGRST202') {
          console.log('Database function not found, trying alternative approach');
          await fetchHouseholdMembersAlternative(householdId);
          return;
        }
        throw membersError;
      }

      const members = (membersData || []).map((member: any) => ({
        id: member.id,
        first_name: member.first_name || 'Unknown',
        last_name: member.last_name || 'User'
      }));

      setHouseholdMembers(members);
    } catch (error) {
      console.error('Error fetching household members:', error);
      toast({
        title: "Error",
        description: "Failed to load household members",
        variant: "destructive",
      });
    } finally {
      setHouseholdLoading(false);
    }
  };

  const fetchHouseholdMembersAlternative = async (householdId: number) => {
    try {
      console.log('Using alternative method to fetch household members');
      
      const currentUserMember = {
        id: user?.id || '',
        first_name: user?.user_metadata?.first_name || 'Unknown',
        last_name: user?.user_metadata?.last_name || 'User'
      };
      
      console.log('Fallback: showing current user only:', currentUserMember);
      setHouseholdMembers([currentUserMember]);
    } catch (error) {
      console.error('Error in alternative household members fetch:', error);
      setHouseholdMembers([]);
    }
  };

  const fetchHouseholdItems = async () => {
    if (householdMembers.length === 0) return;

    setHouseholdLoading(true);
    try {
      const memberIds = householdMembers.map(member => member.id);
      
      const { data, error } = await supabase
        .from('items')
        .select('id, name, category, purchased_at, estimated_expiration_at, estimated_restock_at, store_name, quantity, unit, created_at, updated_at, user_id, guest_owner_id, estimate_source')
        .in('user_id', memberIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out the current user's items to avoid duplicates
      const otherMembersItems = (data || []).filter(item => item.user_id !== user?.id);

      const itemsWithOwners = otherMembersItems.map(item => {
        const owner = householdMembers.find(member => member.id === item.user_id);
        return {
          ...item,
          owner_first_name: owner?.first_name,
          owner_last_name: owner?.last_name
        };
      });

      setHouseholdItems(itemsWithOwners);
    } catch (error) {
      console.error('Error fetching household items:', error);
      toast({
        title: "Error",
        description: "Failed to load household items",
        variant: "destructive",
      });
    } finally {
      setHouseholdLoading(false);
    }
  };

  // Filter items that expire within a week and sort by expiration date
  const getExpiringItems = () => {
    const allItems = [...items, ...householdItems];
    const oneWeekFromNow = addDays(new Date(), 7);
    
    return allItems
      .filter(item => {
        if (!item.estimated_expiration_at) return false;
        const expirationDate = new Date(item.estimated_expiration_at);
        return expirationDate <= oneWeekFromNow;
      })
      .sort((a, b) => {
        const dateA = new Date(a.estimated_expiration_at!);
        const dateB = new Date(b.estimated_expiration_at!);
        return dateA.getTime() - dateB.getTime();
      });
  };

  const expiringItems = getExpiringItems();
  const isLoading = loading || householdLoading;

  const getExpirationStatus = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return { text: 'Expired', color: 'text-destructive' };
    if (diffDays === 1) return { text: 'Tomorrow', color: 'text-destructive' };
    if (diffDays <= 3) return { text: `${diffDays} days`, color: 'text-orange-500' };
    return { text: `${diffDays} days`, color: 'text-yellow-500' };
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/home')}
                className="h-10 w-10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground font-primary">
              Expiring Soon
            </h1>
                <p className="text-sm text-muted-foreground font-secondary">
                  {expiringItems.length} items expiring within a week
            </p>
              </div>
            </div>
          </div>
        </div>
          </div>
          
      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading items...</p>
          </div>
        ) : expiringItems.length === 0 ? (
          <ProxCard className="text-center py-12">
            <ProxCardContent>
              <div className="w-16 h-16 bg-muted rounded-prox mx-auto mb-4 flex items-center justify-center">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No items expiring soon</h3>
              <p className="text-muted-foreground mb-4">
                All your items are fresh! Check back later for items that might be expiring soon.
              </p>
              <Button
                onClick={() => navigate('/add-item')}
                className="bg-accent hover:bg-accent/90"
              >
                Add New Item
              </Button>
            </ProxCardContent>
          </ProxCard>
        ) : (
          <div className="space-y-3">
            {expiringItems.map((item) => {
              const expirationStatus = getExpirationStatus(item.estimated_expiration_at!);
              return (
                <ProxCard key={item.id} className="hover:shadow-medium transition-all group">
                  <ProxCardContent className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-foreground">{item.name}</h3>
                        {item.owner_first_name && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {item.owner_first_name} {item.owner_last_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <span>Category: {item.category}</span>
                        <span>Purchased: {format(new Date(item.purchased_at), 'MMM d')}</span>
                        {item.store_name && (
                          <span>From {item.store_name}</span>
                        )}
                      </div>
                      {item.quantity && item.unit && (
                        <div className="mt-1 text-sm text-muted-foreground">
                          Quantity: {item.quantity} {item.unit}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className={`font-medium ${expirationStatus.color}`}>
                          {expirationStatus.text}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(item.estimated_expiration_at!), 'MMM d, yyyy')}
                        </div>
                      </div>
                      {expirationStatus.text === 'Expired' || expirationStatus.text === 'Tomorrow' ? (
                        <div className="w-3 h-3 bg-destructive rounded-full"></div>
                      ) : (
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      )}
            </div>
                  </ProxCardContent>
                </ProxCard>
              );
            })}
          </div>
        )}

        {/* Floating Action Button */}
        <Button
          onClick={() => navigate('/add-item')}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent hover:bg-accent/90 shadow-medium hover:shadow-glow transition-all"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
