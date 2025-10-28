import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Bell, Settings, Trash2, Edit2, Check, X, Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useUi } from '@/contexts/UiContext';
import { useGuestStore } from '@/stores/guestStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { AddCategory } from '@/components/home/AddCategory';
import { DeleteCategory } from '@/components/home/DeleteCategory';
import { DatePicker } from '@/components/ui/date-picker';
import { QuantityDisplay } from '@/components/QuantityDisplay';

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







export function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { allCategories, categoriesChangeTracker, setCategoriesChangeTracker } = useUi();
  const { items: guestItems, isGuest } = useGuestStore();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [items, setItems] = useState<Item[]>([]);
  const [householdItems, setHouseholdItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [editingExpiration, setEditingExpiration] = useState<string | null>(null);
  const [newExpirationDate, setNewExpirationDate] = useState('');
  const [activeTab, setActiveTab] = useState<'my-items' | 'household-items'>('my-items');
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
      // Get user's household from raw_user_meta_data
      const userHousehold = user.user_metadata?.household;
      if (!userHousehold) {
        setHouseholdMembers([]);
        return;
      }

      // Use the database function to get household members
      const householdId = typeof userHousehold === 'string' ? parseInt(userHousehold) : userHousehold;
      
      const { data: membersData, error: membersError } = await (supabase as any)
        .rpc('get_household_members', { household_id_param: householdId });

      if (membersError) {
        console.error('Database function error:', membersError);
        // If the function doesn't exist, try alternative approach
        if (membersError.code === 'PGRST202') {
          console.log('Database function not found, trying alternative approach');
          await fetchHouseholdMembersAlternative(householdId);
          return;
        }
        throw membersError;
      }

      const members = (membersData as any[])?.map((member: any) => ({
        id: member.id,
        first_name: member.first_name || 'Unknown',
        last_name: member.last_name || 'User'
      })) || [];

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
      // Alternative approach: Get all users from auth.users using a different method
      // This is a fallback if the RPC function doesn't work
      console.log('Using alternative method to fetch household members');
      
      // For now, just show the current user as a fallback
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

      // Add owner information to each item
      const itemsWithOwners = (data || []).map(item => {
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/welcome');
  };

  const handleDeleteItem = async (itemId: string) => {
    if (isGuest) {
      // For guest users, delete from local store
      useGuestStore.getState().deleteItem(itemId);
    } else {
      // For authenticated users, delete from database
      try {
        const { error } = await supabase
          .from('items')
          .delete()
          .eq('id', itemId);

        if (error) throw error;

        // Remove the item from local state immediately
        setItems(prevItems => prevItems.filter(item => item.id !== itemId));

        toast({
          title: "Item deleted",
          description: "The item has been removed from your pantry.",
        });
      } catch (error) {
        console.error('Error deleting item:', error);
        toast({
          title: "Error",
          description: "Failed to delete the item. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleStartEditExpiration = (item: Item) => {
    setEditingExpiration(item.id);
    setNewExpirationDate(item.estimated_expiration_at || '');
  };

  const handleCancelEditExpiration = () => {
    setEditingExpiration(null);
    setNewExpirationDate('');
  };

  const handleUpdateExpiration = async (itemId: string) => {
    try {
      const newDate = newExpirationDate ? new Date(newExpirationDate).toISOString() : null;

      if (isGuest) {
        // For guest users, update local store
        useGuestStore.getState().updateItem(itemId, {
          estimated_expiration_at: newDate,
          updated_at: new Date().toISOString()
        });

        // Update local state immediately
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId
              ? { ...item, estimated_expiration_at: newDate }
              : item
          )
        );
      } else {
        // For authenticated users, update database
        const { error } = await supabase
          .from('items')
          .update({
            estimated_expiration_at: newDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId);

        if (error) throw error;

        // Update local state immediately
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId
              ? { ...item, estimated_expiration_at: newDate }
              : item
          )
        );
      }

      toast({
        title: "Expiration date updated",
        description: "The item's expiration date has been updated successfully.",
      });

      setEditingExpiration(null);
      setNewExpirationDate('');
    } catch (error) {
      console.error('Error updating expiration date:', error);
      toast({
        title: "Error",
        description: "Failed to update the expiration date. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCategory = async (itemId: string, newCategory: string) => {
    try {
      if (isGuest) {
        // For guest users, update local store
        useGuestStore.getState().updateItem(itemId, {
          category: newCategory,
          updated_at: new Date().toISOString()
        });

        // Update local state immediately
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId
              ? { ...item, category: newCategory }
              : item
          )
        );
      } else {
        // For authenticated users, update database
        const { error } = await supabase
          .from('items')
          .update({
            category: newCategory,
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId);

        if (error) throw error;

        // Update local state immediately
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId
              ? { ...item, category: newCategory }
              : item
          )
        );
      }

      toast({
        title: "Category updated",
        description: `Item moved to ${newCategory} category.`,
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Error",
        description: "Failed to update the category. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateQuantity = (itemId: string, quantity: number | null, unit: string | null) => {
    // Update local state immediately
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, quantity, unit }
          : item
      )
    );
  };

  const currentItems = activeTab === 'my-items' ? items : householdItems;
  const currentLoading = activeTab === 'my-items' ? loading : householdLoading;

  const filteredItems = currentItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedItems = filteredItems.reduce((groups, item) => {
    const category = item.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {} as Record<string, Item[]>);

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className={`mx-auto px-4 py-4 ${isMobile ? 'px-3 py-3' : 'max-w-4xl'}`}>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`rounded-prox overflow-hidden ${isMobile ? 'w-8 h-8' : 'w-10 h-10'}`}>
                <img
                  src="/Icon-01.jpg"
                  alt="Prox Logo"
                  className={`object-cover object-center transform translate-x-[5%] translate-y-[-25%] ${isMobile ? 'w-16 h-16' : 'w-20 h-20'}`}
                />
              </div>
              <div>
                <h1 className={`font-semibold text-foreground font-primary ${isMobile ? 'text-lg' : 'text-xl'}`}>
                  {isGuest ? 'Guest Mode' : `Hello, ${user?.user_metadata?.first_name || 'there'}!`}
                </h1>
                <p className={`text-muted-foreground font-secondary ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  {items.length} items in your pantry
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/expiring-soon')}
                className={`relative ${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`}
              >
                <Bell className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`relative ${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`}
                  >
                    <Settings className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => navigate('/home/settings')}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-accent/10 focus:bg-accent/10"
                  >
                    <Settings className="h-4 w-4 text-accent" />
                    <span className="font-secondary text-sm">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate('/home/households')}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-accent/10 focus:bg-accent/10"
                  >
                    <Building2 className="h-4 w-4 text-accent" />
                    <span className="font-secondary text-sm">Households</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className={`font-secondary ${isMobile ? 'text-xs px-2' : 'text-sm'}`}
              >
                {isGuest ? 'Sign In' : 'Sign Out'}
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className={`flex items-center space-x-2 mb-4 ${isMobile ? 'space-x-1' : ''}`}>
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 font-secondary ${isMobile ? 'h-8 text-sm' : 'h-10'}`}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`}
            >
              <Filter className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/deal-search')}
              className={`font-secondary whitespace-nowrap ${isMobile ? 'h-8 text-xs px-2' : 'h-10'}`}
            >
              Find Deals
            </Button>
          </div>

          {/* Category Filter */}
          <div className={`flex overflow-x-auto pb-2 ${isMobile ? 'space-x-1' : 'space-x-2'}`}>
            {allCategories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap ${isMobile ? 'text-xs px-2 py-1' : ''}`}
              >
                {category}
              </Button>
            ))}
            <AddCategory setCategoriesChangeTracker={setCategoriesChangeTracker} categoriesChangeTracker={categoriesChangeTracker}/>
            <DeleteCategory setCategoriesChangeTracker={setCategoriesChangeTracker} categoriesChangeTracker={categoriesChangeTracker}/>

          </div>

          {/* Items Tab */}
          {!isGuest && (
            <div className="mt-4">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'my-items' | 'household-items')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="my-items">My Items</TabsTrigger>
                  <TabsTrigger value="household-items">Household Items</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>
        
      </div>

      {/* Main Content */}
      <div className={`mx-auto px-4 py-6 ${isMobile ? 'px-3 py-4' : 'max-w-4xl'}`}>
        {isGuest && (
          <ProxCard className={`mb-6 bg-gradient-to-r from-accent/10 to-highlight/10 border-accent/20 ${isMobile ? 'mb-4' : ''}`}>
            <ProxCardContent className={`flex items-center justify-between ${isMobile ? 'p-3 flex-col space-y-3' : 'p-4'}`}>
              <div className={`${isMobile ? 'text-center' : ''}`}>
                <p className={`font-medium text-accent ${isMobile ? 'text-sm' : ''}`}>You're in guest mode</p>
                <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>Create an account to sync across devices</p>
              </div>
              <Button
                onClick={() => navigate('/auth?mode=signup')}
                size="sm"
                className={`bg-accent hover:bg-accent/90 ${isMobile ? 'w-full' : ''}`}
              >
                Sign Up
              </Button>
            </ProxCardContent>
            
          </ProxCard>
        )}

        {/* Items List */}
        {currentLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading items...</p>
          </div>
        ) : activeTab === 'household-items' && householdMembers.length === 0 ? (
          <ProxCard className="text-center py-12">
            <ProxCardContent>
              <div className="w-16 h-16 bg-muted rounded-prox mx-auto mb-4 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Not in a household</h3>
              <p className="text-muted-foreground mb-4">
                You need to join or create a household to view household items
              </p>
              <Button
                onClick={() => navigate('/home/households')}
                className="bg-accent hover:bg-accent/90"
              >
                Manage Household
              </Button>
            </ProxCardContent>
          </ProxCard>
        ) : Object.keys(groupedItems).length === 0 ? (
          <ProxCard className="text-center py-12">
            
            <ProxCardContent>
              <div className="w-16 h-16 bg-muted rounded-prox mx-auto mb-4 flex items-center justify-center">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No items yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by adding your first grocery item
              </p>
              <Button
                onClick={() => navigate('/add-item')}
                className="bg-accent hover:bg-accent/90"
              >
                Add Your First Item
              </Button>
            </ProxCardContent>
          </ProxCard>
        ) : (
          <div className="space-y-6">
          
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category}>
                
                <h2 className={`font-semibold text-foreground mb-3 sticky top-32 bg-gradient-background/95 backdrop-blur-sm py-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
                  {category} ({categoryItems.length})
                </h2>
                <div className={`grid gap-3 ${isMobile ? 'gap-2' : ''}`}>
                  {categoryItems.map((item) => (
                    <ProxCard key={item.id} className="hover:shadow-medium transition-all group">
                      
                      <ProxCardContent className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'}`}>
                        
                        <div className="flex-1 min-w-0">
                          <div className={`flex items-center space-x-2 ${isMobile ? 'flex-wrap' : ''}`}>
                            <h3 className={`font-medium text-foreground ${isMobile ? 'text-sm' : ''}`}>{item.name}</h3>
                            {activeTab === 'household-items' && item.owner_first_name && (
                              <span className={`text-muted-foreground bg-muted px-2 py-1 rounded ${isMobile ? 'text-xs' : 'text-xs'}`}>
                                {item.owner_first_name} {item.owner_last_name}
                              </span>
                            )}
                          </div>
                          <div className={`flex items-center mt-1 text-muted-foreground ${isMobile ? 'flex-wrap gap-2 text-xs' : 'space-x-4 text-sm'}`}>
                            <span>Purchased: {format(new Date(item.purchased_at), 'MMM d')}</span>
                            {editingExpiration === item.id ? (
                              <div className="flex items-center space-x-2">
                                <span>Expires:</span>
                                <DatePicker
                                  date={newExpirationDate ? new Date(newExpirationDate) : undefined}
                                  onDateChange={setNewExpirationDate}
                                  placeholder="Select date"
                                  className="w-32 h-8"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateExpiration(item.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEditExpiration}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              
                              </div>
                              
                            ) : (
                              <div className="flex items-center space-x-2">
                                {item.estimated_expiration_at && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStartEditExpiration(item)}
                                    className="h-auto p-0 text-sm text-muted-foreground hover:text-accent transition-colors"
                                  >
                                    Expires: {format(new Date(item.estimated_expiration_at), 'MMM d')}
                                  </Button>
                                )}
                                {!item.estimated_expiration_at && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStartEditExpiration(item)}
                                    className="h-auto p-0 text-sm text-muted-foreground hover:text-accent transition-colors"
                                  >
                                    Set expiration
                                  </Button>
                                )}
                                <Select
                                  value={item.category}
                                  onValueChange={(value) => handleUpdateCategory(item.id, value)}
                                >
                                  <SelectTrigger className="w-auto h-6 text-xs border border-muted bg-muted/30 hover:bg-muted/50 px-2 text-muted-foreground hover:text-foreground transition-colors">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allCategories.filter(cat => cat !== 'All').map((category) => (
                                      <SelectItem key={category} value={category} className="text-xs">
                                        {category}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                          </div>
                          {item.store_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              From {item.store_name}
                              
                            </p>
                          )}
                          <div className="mt-1">
                            <QuantityDisplay
                              itemId={item.id}
                              quantity={item.quantity}
                              unit={item.unit}
                              isGuest={isGuest}
                              onUpdate={handleUpdateQuantity}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {item.estimated_expiration_at &&
                           new Date(item.estimated_expiration_at) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) && (
                            <div className="w-2 h-2 bg-destructive rounded-full"></div>
                          )}
                          {activeTab === 'my-items' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteItem(item.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </ProxCardContent>
                    </ProxCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Floating Action Button */}
        <Button
          onClick={() => navigate('/add-item')}
          className={`fixed rounded-full bg-accent hover:bg-accent/90 shadow-medium hover:shadow-glow transition-all ${isMobile ? 'bottom-4 right-4 w-12 h-12' : 'bottom-6 right-6 w-14 h-14'}`}
          size="icon"
        >
          <Plus className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
        </Button>
      </div>
    </div>
  );
}