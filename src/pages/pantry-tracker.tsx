import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Bell, Settings, Trash2, Building2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProxCard, ProxCardContent } from '@/components/ProxCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useUi } from '@/contexts/UiContext';
import { useGuestStore } from '@/stores/guestStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { AddCategory } from '@/components/home/AddCategory';
import { DeleteCategory } from '@/components/home/DeleteCategory';
import { BottomNav } from "@/components/BottomNav";

interface Item {
  id: string;
  user_id?: string | null;
  guest_owner_id?: string | null;

  name: string;
  brand?: string | null;
  category: string;

  purchased_at: string;
  estimated_expiration_at?: string | null;
  estimated_restock_at?: string | null;

  store_name?: string | null;
  quantity?: number | null;
  unit?: string | null;

  created_at?: string;
  updated_at?: string;
  estimate_source?: string | null;

  owner_first_name?: string;
  owner_last_name?: string;
}

type ExpirationStatus = 'expired' | 'soon' | 'fresh';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysUntil(expirationIso: string): number {
  const today = startOfToday().getTime();
  const exp = new Date(expirationIso);
  exp.setHours(0, 0, 0, 0);
  const diffMs = exp.getTime() - today;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getExpirationStatus(item: Item): { status: ExpirationStatus; daysLeft: number | null } {
  if (!item.estimated_expiration_at) return { status: 'fresh', daysLeft: null };
  const d = daysUntil(item.estimated_expiration_at);
  if (d < 0) return { status: 'expired', daysLeft: d };
  if (d <= 3) return { status: 'soon', daysLeft: d };
  return { status: 'fresh', daysLeft: d };
}

function formatUnit(unit?: string | null) {
  if (!unit) return '';
  const map: Record<string, string> = {
    count: 'ct',
    oz: 'oz',
    lb: 'lb',
    g: 'g',
    kg: 'kg',
    ml: 'mL',
    l: 'L',
    pack: 'pack',
    gal: 'gal',
  };
  return map[unit] ?? unit;
}

export function PantryTracker() {
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

  const [activeTab, setActiveTab] = useState<'my-items' | 'household-items'>('my-items');
  const [householdMembers, setHouseholdMembers] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [householdLoading, setHouseholdLoading] = useState(false);

  // image cache map: pantry_item_id -> image_link (or null)
  const [imagesById, setImagesById] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (isGuest) {
      setItems(guestItems as any);
      return;
    }

    if (user) {
      fetchUserItems();
      fetchHouseholdMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isGuest, guestItems]);

  useEffect(() => {
    if (householdMembers.length > 0) {
      fetchHouseholdItems();
    } else {
      setHouseholdItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdMembers]);

  const fetchUserItems = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        // @ts-expect-error
        .from('pantry_tracker')
        .select('id, name, brand, category, purchased_at, estimated_expiration_at, estimated_restock_at, store_name, quantity, unit, created_at, updated_at, user_id, guest_owner_id, estimate_source')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data || []) as any);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load items", variant: "destructive" });
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

      const householdId = typeof userHousehold === 'string' ? parseInt(userHousehold, 10) : userHousehold;

      const { data: membersData, error: membersError } = await (supabase as any)
        .rpc('get_household_members', { household_id_param: householdId });

      if (membersError) {
        if (membersError.code === 'PGRST202') {
          setHouseholdMembers([{
            id: user?.id || '',
            first_name: user?.user_metadata?.first_name || 'Unknown',
            last_name: user?.user_metadata?.last_name || 'User'
          }]);
          return;
        }
        throw membersError;
      }

      const members = (membersData as any[])?.map((m: any) => ({
        id: m.id,
        first_name: m.first_name || 'Unknown',
        last_name: m.last_name || 'User'
      })) || [];

      setHouseholdMembers(members);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load household members", variant: "destructive" });
    } finally {
      setHouseholdLoading(false);
    }
  };

  const fetchHouseholdItems = async () => {
    if (householdMembers.length === 0) return;

    setHouseholdLoading(true);
    try {
      const memberIds = householdMembers.map(m => m.id);

      const { data, error } = await supabase
        // @ts-expect-error
        .from('pantry_tracker')
        .select('id, name, brand, category, purchased_at, estimated_expiration_at, estimated_restock_at, store_name, quantity, unit, created_at, updated_at, user_id, guest_owner_id, estimate_source')
        .in('user_id', memberIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const itemsWithOwners = (data || []).map((item: any) => {
        const owner = householdMembers.find(m => m.id === item.user_id);
        return { ...item, owner_first_name: owner?.first_name, owner_last_name: owner?.last_name };
      });

      setHouseholdItems(itemsWithOwners as any);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load household items", variant: "destructive" });
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
      useGuestStore.getState().deleteItem(itemId);
      setItems(prev => prev.filter(it => it.id !== itemId));
      return;
    }

    try {
      const { error } = await supabase
        // @ts-expect-error
        .from('pantry_tracker')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev => prev.filter(it => it.id !== itemId));

      // also delete cached image row (optional; FK cascade handles only if pantry item deleted)
      await supabase
        // @ts-expect-error
        .from('pantry_item_images')
        .delete()
        .eq('pantry_item_id', itemId);

      toast({ title: "Item deleted", description: "The item has been removed from your pantry." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete the item. Please try again.", variant: "destructive" });
    }
  };

  const canEditItem = (item: Item) => {
    if (isGuest) return true;
    if (!user) return false;
    return item.user_id === user.id;
  };

  const currentItems = activeTab === 'my-items' ? items : householdItems;
  const currentLoading = activeTab === 'my-items' ? loading : householdLoading;

  const filteredItems = useMemo(() => {
    return currentItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [currentItems, searchTerm, selectedCategory]);

  const groupedByStatus = useMemo(() => {
    const expired: Item[] = [];
    const soon: Item[] = [];
    const fresh: Item[] = [];

    for (const item of filteredItems) {
      const { status } = getExpirationStatus(item);
      if (status === 'expired') expired.push(item);
      else if (status === 'soon') soon.push(item);
      else fresh.push(item);
    }

    return { expired, soon, fresh };
  }, [filteredItems]);

  // 1) Load cached images for currently visible items
  // 2) Resolve missing images via edge function in one batch
  useEffect(() => {
    if (isGuest) return;
    if (!user) return;

    const visibleIds = filteredItems.map(i => i.id);
    if (visibleIds.length === 0) return;

    const run = async () => {
      try {
        // Fetch cached image rows
        const { data: cacheRows, error } = await supabase
          // @ts-expect-error
          .from('pantry_item_images')
          .select('pantry_item_id, image_link, status, updated_at')
          .in('pantry_item_id', visibleIds);

        if (error) throw error;

        const nextMap: Record<string, string | null> = { ...imagesById };
        (cacheRows || []).forEach((r: any) => {
          nextMap[r.pantry_item_id] = r.image_link ?? null;
        });
        setImagesById(nextMap);

        // Find IDs that are missing from cacheRows OR have no image_link (null)
        const cachedIds = new Set((cacheRows || []).map((r: any) => r.pantry_item_id));
        const missingIds = visibleIds.filter((id) => !cachedIds.has(id));

        // Only resolve missing cache rows (not every null) — null could be "not_found" and still valid
        if (missingIds.length > 0) {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('resolve-pantry-images', {
            body: { itemIds: missingIds },
          });

          if (fnErr) throw fnErr;

          const results = fnData?.results || {};
          const merged: Record<string, string | null> = { ...nextMap };
          Object.keys(results).forEach((id) => {
            merged[id] = results[id] ?? null;
          });
          setImagesById(merged);
        }
      } catch (e) {
        // silent fail; placeholders still show
        console.warn('Image resolution failed:', e);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems.map(i => i.id).join('|'), isGuest, user]);

  const renderStatusRow = (item: Item) => {
    const { status, daysLeft } = getExpirationStatus(item);

    if (!item.estimated_expiration_at) {
      return (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-secondary text-emerald-600">
            No expiration date set
          </span>
        </div>
      );
    }

    if (status === 'expired') {
      return (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-xs font-secondary text-destructive">Expired</span>
        </div>
      );
    }

    if (status === 'soon') {
      return (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-xs font-secondary text-yellow-600">
            Expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-secondary text-emerald-600">
          Expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}
        </span>
      </div>
    );
  };

  const renderItemCard = (item: Item) => {
    const editable = canEditItem(item);
    const imageUrl = imagesById[item.id] ?? null;

    return (
      <ProxCard key={item.id} className="hover:shadow-medium transition-all">
        <ProxCardContent className={`flex items-center gap-4 ${isMobile ? 'p-3' : 'p-4'}`}>
          {/* Image */}
          <div className="w-12 h-12 rounded-prox bg-muted overflow-hidden shrink-0 flex items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-muted to-muted/60" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold text-foreground font-primary truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
                {item.name}
              </h3>

              {activeTab === 'household-items' && item.owner_first_name && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {item.owner_first_name} {item.owner_last_name}
                </span>
              )}
            </div>

            {item.brand && (
              <div className="text-xs text-muted-foreground font-secondary truncate">
                {item.brand}
              </div>
            )}

            <div className="text-xs text-muted-foreground font-secondary mt-1">
              {(item.quantity ?? '') !== '' ? item.quantity : ''}{item.quantity != null && item.unit ? ' ' : ''}
              {item.unit ? formatUnit(item.unit) : ''}
            </div>

            <div className="mt-2">{renderStatusRow(item)}</div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {editable && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/pantry-tracker/edit/${item.id}`)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </Button>
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
    );
  };

  const hasAnyItems = filteredItems.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background">
      <div className="flex-1 pb-24">
        {/* Header */}
        <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
          <div className={`mx-auto px-4 py-4 ${isMobile ? 'px-3 py-3' : 'max-w-4xl'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`rounded-prox overflow-hidden ${isMobile ? 'w-8 h-8' : 'w-10 h-10'}`}>
                  <img
                    src="/Icon-01.png"
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
                <Button variant="ghost" size="icon" onClick={() => navigate('/expiring-soon')} className={`relative ${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`}>
                  <Bell className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={`relative ${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`}>
                      <Settings className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate('/home/settings')} className="flex items-center space-x-2 cursor-pointer hover:bg-accent/10 focus:bg-accent/10">
                      <Settings className="h-4 w-4 text-accent" />
                      <span className="font-secondary text-sm">Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/home/households')} className="flex items-center space-x-2 cursor-pointer hover:bg-accent/10 focus:bg-accent/10">
                      <Building2 className="h-4 w-4 text-accent" />
                      <span className="font-secondary text-sm">Households</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="ghost" onClick={handleSignOut} className={`font-secondary ${isMobile ? 'text-xs px-2' : 'text-sm'}`}>
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

              <Button variant="outline" size="icon" className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`}>
                <Filter className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
              </Button>

              <Button variant="outline" onClick={() => navigate('/deals')} className={`font-secondary whitespace-nowrap ${isMobile ? 'h-8 text-xs px-2' : 'h-10'}`}>
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
              <AddCategory setCategoriesChangeTracker={setCategoriesChangeTracker} categoriesChangeTracker={categoriesChangeTracker} />
              <DeleteCategory setCategoriesChangeTracker={setCategoriesChangeTracker} categoriesChangeTracker={categoriesChangeTracker} />
            </div>

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

        {/* Main */}
        <div className={`mx-auto px-4 py-6 ${isMobile ? 'px-3 py-4' : 'max-w-4xl'}`}>
          {currentLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading items...</p>
            </div>
          ) : !hasAnyItems ? (
            <ProxCard className="text-center py-12">
              <ProxCardContent>
                <div className="w-16 h-16 bg-muted rounded-prox mx-auto mb-4 flex items-center justify-center">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No items yet</h3>
                <p className="text-muted-foreground mb-4">Start by adding your first grocery item</p>
                <Button onClick={() => navigate('/add-item')} className="bg-accent hover:bg-accent/90">
                  Add Your First Item
                </Button>
              </ProxCardContent>
            </ProxCard>
          ) : (
            <div className="space-y-6">
              {groupedByStatus.expired.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground font-primary">Expired</span>
                    <span className="text-xs text-muted-foreground">({groupedByStatus.expired.length})</span>
                  </div>
                  <div className="grid gap-3">
                    {groupedByStatus.expired.map(renderItemCard)}
                  </div>
                </div>
              )}

              {groupedByStatus.soon.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground font-primary">Expiring Soon</span>
                    <span className="text-xs text-muted-foreground">({groupedByStatus.soon.length})</span>
                  </div>
                  <div className="grid gap-3">
                    {groupedByStatus.soon.map(renderItemCard)}
                  </div>
                </div>
              )}

              {groupedByStatus.fresh.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground font-primary">Fresh</span>
                    <span className="text-xs text-muted-foreground">({groupedByStatus.fresh.length})</span>
                  </div>
                  <div className="grid gap-3">
                    {groupedByStatus.fresh.map(renderItemCard)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FAB */}
          <Button
            onClick={() => navigate('/add-item')}
            className={`fixed rounded-full bg-accent hover:bg-accent/90 shadow-medium hover:shadow-glow transition-all ${isMobile ? 'bottom-20 right-4 w-12 h-12' : 'bottom-24 right-6 w-14 h-14'}`}
            size="icon"
          >
            <Plus className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
          </Button>
        </div>
      </div>

      <BottomNav current="PantryTracker" />
    </div>
  );
}
