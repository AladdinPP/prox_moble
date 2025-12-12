import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client'; 
import { Button } from '@/components/ui/button'; 
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { getLatestRefreshDate, formatDistance } from '@/lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from "@/components/BottomNav";

// --- Types ---
type EditableCartItem = { name: string; brand: string; size: string; details: string; };

type DealMenuItem = {
  retailer: string;
  zip_code: string;
  searched_item_name: string; 
  product_name: string;
  product_price: number;
  distance_m: number;
  product_size: string | null;
  image_link: string | null;
  retailer_logo_url: string | null;
};

type OptimizedCartItem = {
  searched_item: string; 
  product_name: string;
  product_price: number;
  retailer: string;
  zip_code: string;
  distance_m: number; 
  product_size: string | null;
  image_link: string | null;
  retailer_logo_url: string | null;
};

type StoreID = string; 
type OptimizedCart = { stores: StoreID[]; total_cart_price: number; items_found: OptimizedCartItem[]; items_missing: string[]; };
type SingleStoreResult = {
  retailer: string;
  zip_code: string;
  total_cart_price: number;
  items_found_count: number;
  distance_m: number;
  items_found: OptimizedCartItem[];
  retailer_logo_url: string | null;
};

const MAX_CANDIDATE_STORES = 30; 
const PLACEHOLDER_IMG = "https://via.placeholder.com/100x100.png?text=No+Image";

export function CartFinder() {
  const navigate = useNavigate();
  const { saveOptimizedCart, items } = useCart(); // Get items count
  const { toast } = useToast();

  // --- State ---
  const [searchQuery, setSearchQuery] = useState(''); 
  const [zipcode, setZipcode] = useState(''); 
  const [radius, setRadius] = useState('10'); 
  const [retailerCountLimit, setRetailerCountLimit] = useState('1'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialSearchDone, setInitialSearchDone] = useState(false);
  const [editableCartItems, setEditableCartItems] = useState<EditableCartItem[]>([]);
  const [result, setResult] = useState<OptimizedCart | null>(null);
  const [singleStoreResults, setSingleStoreResults] = useState<SingleStoreResult[]>([]);
  
  // UI State for collapse
  const [refineOpen, setRefineOpen] = useState(false);

  // --- Logic Helpers ---
  const handleSaveCart = () => {
    if (!result) return;
    saveOptimizedCart({
      total_price: result.total_cart_price,
      store_count: result.stores.length,
      stores: result.stores,
      items: result.items_found
    });
    toast({ title: "Cart Saved", description: "This combination has been saved to your carts page." });
  };

  // --- Optimizer Logic ---
  const findBestCart = (dealMenu: DealMenuItem[], searchTerms: string[], storeLimit: number)
    : { bestCart: OptimizedCart | null, allStoreCarts: SingleStoreResult[] } => {
    
    const topK = 5;
    const candidateStoreIds = new Set<StoreID>();
    const storeMap = new Map<StoreID, { retailer: string, zip_code: string, distance_m: number, logo: string|null }>();
    const priceMenu = new Map<string, Map<StoreID, DealMenuItem>>();

    for (const deal of dealMenu) {
      const storeId: StoreID = `${deal.retailer}@${deal.zip_code}`;
      if (!storeMap.has(storeId)) {
        storeMap.set(storeId, { 
          retailer: deal.retailer, 
          zip_code: deal.zip_code, 
          distance_m: deal.distance_m,
          logo: deal.retailer_logo_url 
        });
      }
      if (!priceMenu.has(deal.searched_item_name)) {
        priceMenu.set(deal.searched_item_name, new Map<StoreID, DealMenuItem>());
      }
      priceMenu.get(deal.searched_item_name)!.set(storeId, deal);
    }

    for (const item of searchTerms) {
      const itemDeals = Array.from(priceMenu.get(item)?.values() || []);
      if (itemDeals.length === 0) continue; 
      itemDeals.sort((a, b) => {
        if (a.product_price !== b.product_price) return a.product_price - b.product_price;
        return a.distance_m - b.distance_m;
      });
      const topKDeals = itemDeals.slice(0, topK);
      for (const deal of topKDeals) candidateStoreIds.add(`${deal.retailer}@${deal.zip_code}`);
    }

    if (candidateStoreIds.size > MAX_CANDIDATE_STORES) {
      throw new Error(`Too many stores (${candidateStoreIds.size}) to optimize. Please reduce your radius.`);
    }

    const uniqueStoreIds = Array.from(candidateStoreIds); 
    let bestCart: OptimizedCart | null = null;
    const allStoreCarts: SingleStoreResult[] = [];
    let allCombos: StoreID[][] = [];

    for (let k = 1; k <= storeLimit; k++) {
      const stack: { index: number, currentCombo: StoreID[] }[] = [];
      for(let i = 0; i <= uniqueStoreIds.length - k; i++) {
        stack.push({ index: i + 1, currentCombo: [uniqueStoreIds[i]] });
      }
      while(stack.length > 0) {
        const { index, currentCombo } = stack.pop()!;
        if (currentCombo.length === k) {
          const brandsInCombo = currentCombo.map(id => storeMap.get(id)!.retailer);
          if (new Set(brandsInCombo).size === brandsInCombo.length) {
            allCombos.push(currentCombo);
          }
          continue;
        }
        for (let j = index; j <= uniqueStoreIds.length - (k - currentCombo.length); j++) {
          stack.push({ index: j + 1, currentCombo: [...currentCombo, uniqueStoreIds[j]] });
        }
      }
    }

    for (const combo of allCombos) {
      const currentCart: OptimizedCart = {
        stores: combo, total_cart_price: 0, items_found: [], items_missing: [],
      };
      
      for (const item of searchTerms) {
        let cheapestDeal: OptimizedCartItem | null = null;
        const itemPrices = priceMenu.get(item);
        if (itemPrices) {
          for (const storeId of combo) {
            const deal = itemPrices.get(storeId);
            if (deal) {
              if (!cheapestDeal || deal.product_price < cheapestDeal.product_price || 
                 (deal.product_price === cheapestDeal.product_price && deal.distance_m < cheapestDeal.distance_m)) {
                cheapestDeal = {
                  searched_item: item, product_name: deal.product_name, product_price: deal.product_price,
                  retailer: deal.retailer, zip_code: deal.zip_code, distance_m: deal.distance_m,
                  product_size: deal.product_size, image_link: deal.image_link, 
                  retailer_logo_url: deal.retailer_logo_url
                };
              }
            }
          }
        }
        if (cheapestDeal) {
          currentCart.items_found.push(cheapestDeal);
          currentCart.total_cart_price += cheapestDeal.product_price;
        } else {
          currentCart.items_missing.push(item);
        }
      } 
      
      if (combo.length === 1) {
        const storeId = combo[0];
        const storeInfo = storeMap.get(storeId)!;
        allStoreCarts.push({
          retailer: storeInfo.retailer, zip_code: storeInfo.zip_code,
          total_cart_price: currentCart.total_cart_price, items_found_count: currentCart.items_found.length,
          distance_m: storeInfo.distance_m, items_found: currentCart.items_found,
          retailer_logo_url: storeInfo.logo
        });
      }

      if (!bestCart || 
          currentCart.items_missing.length < bestCart.items_missing.length ||
          (currentCart.items_missing.length === bestCart.items_missing.length && currentCart.total_cart_price < bestCart.total_cart_price)) {
        bestCart = currentCart;
      }
    }
    return { bestCart, allStoreCarts };
  };

  const handleRunOptimizer = async (itemsToFind: EditableCartItem[]) => {
    setLoading(true); setError(null); setResult(null); setSingleStoreResults([]);
    const searchTerms = itemsToFind.map(item => item.name);

    if (searchTerms.length === 0) { setError('Your item list is empty.'); setLoading(false); return; }
    if (!/^\d{5}$/.test(zipcode)) { setError('Invalid zip code.'); setLoading(false); return; }
    
    const radiusNum = parseInt(radius, 10);
    const meters = Math.round(radiusNum * 1609.34);
    const retailerLimit = parseInt(retailerCountLimit, 10);

    try {
      const minDate = getLatestRefreshDate();
      const { data: rawData, error: rpcError } = await supabase
        .rpc('get_deal_menu_v8', { 
          user_zip: zipcode, 
          items_to_find: itemsToFind, 
          radius_meters: meters,
          min_date: minDate 
        });
      
      const dealMenu = rawData as DealMenuItem[];
      if (rpcError) throw rpcError;

      if (dealMenu && dealMenu.length > 0) {
        const { bestCart, allStoreCarts } = findBestCart(dealMenu, searchTerms, retailerLimit);
        
        if (retailerLimit === 1) {
          const completeStoreCarts = allStoreCarts.filter(cart => cart.items_found_count === searchTerms.length);
          const bestByBrand = new Map<string, SingleStoreResult>();
          for (const storeCart of completeStoreCarts) {
            const currentBest = bestByBrand.get(storeCart.retailer);
            if (!currentBest || storeCart.total_cart_price < currentBest.total_cart_price ||
               (storeCart.total_cart_price === currentBest.total_cart_price && storeCart.distance_m < currentBest.distance_m)) {
              bestByBrand.set(storeCart.retailer, storeCart);
            }
          }
          setSingleStoreResults(Array.from(bestByBrand.values()).sort((a,b) => a.total_cart_price - b.total_cart_price));
        } else {
          setResult(bestCart);
        }
      } else {
        setError("No recent deals found for this combination. Try broadening your search.");
      }
    } catch (err: any) {
      console.error('Optimizer Error:', err);
      setError(err.message || 'Failed to fetch cart.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const searchTerms = searchQuery.split(';').map(term => term.trim()).filter(term => term.length > 0);
    if (searchTerms.length === 0) { setError('Please enter at least one item.'); return; }
    const initialItems = searchTerms.map(name => ({ name, brand: '', size: '', details: '' }));
    setEditableCartItems(initialItems); setInitialSearchDone(true);
    handleRunOptimizer(initialItems);
  };

  const handleReRunSearch = () => { handleRunOptimizer(editableCartItems); };
  const handleEditCartItem = (index: number, field: keyof EditableCartItem, value: string) => {
    const newItems = [...editableCartItems]; newItems[index] = { ...newItems[index], [field]: value }; setEditableCartItems(newItems);
  };

  // --- Helper for Render ---
  const renderCartItems = (items: OptimizedCartItem[]) => (
    <ul className="space-y-3 pt-2">
      {items.map((item, idx) => (
        <li key={`${item.product_name}-${idx}`} className="flex items-center gap-4 border-b pb-3 last:border-b-0">
          <img src={item.image_link || PLACEHOLDER_IMG} alt={item.product_name}
            className="w-16 h-16 object-cover rounded-md border bg-gray-50 flex-shrink-0"
            onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
          <div className="min-w-0 text-sm">
            <p className="font-medium truncate">{item.product_name}</p>
            {item.product_size && <p className="text-gray-500">{item.product_size}</p>}
            <p className="text-base font-bold text-green-600">${item.product_price.toFixed(2)}</p>
            <p className="text-xs text-gray-400">(For: "{item.searched_item}")</p>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background text-foreground">
      <div className="flex-1">
        <div className="container mx-auto p-4 max-w-2xl pb-24">
          {/* --- HERO CARD FOR CART OPTIMIZER --- */}
          <div className="rounded-3xl border border-border/60 bg-card shadow-soft px-5 py-4 mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              
              {/* LEFT SIDE */}
              <div className="space-y-2">
                {/* Home + Title */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="-ml-2 h-8 w-8" 
                    onClick={() => navigate('/cart-finder')}
                  >
                    <img 
                      src="/Icon-01.png" 
                      alt="Prox Logo" 
                      className="h-5 w-5 object-contain opacity-80"
                    />
                  </Button>

                  <h1 className="text-2xl font-semibold tracking-tight">
                    Cart Optimizer
                  </h1>
                </div>

                {/* Subtitle */}
                <p className="text-sm text-muted-foreground">
                  Find the cheapest combination of stores for your whole cart.
                </p>
              </div>

              {/* RIGHT SIDE BUTTONS */}
              <div className="mt-2 sm:mt-0 flex flex-wrap gap-2">
                <Button 
                  size="sm"
                  className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto" 
                  onClick={() => navigate('/deal-search')}
                >
                  <Search className="h-4 w-4 mr-2" /> Single Deal Search
                </Button>

                <Button 
                  size="sm"
                  variant="outline"
                  className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto" 
                  onClick={() => navigate('/cart')}
                >
                  <ShoppingBag className="h-4 w-4 mr-2" /> Cart Result ({items.length})
                </Button>
              </div>
            </div>
          </div>

          {/* --- CART OPTIMIZER SEARCH + FILTERS CARD --- */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5 space-y-5">
            <form onSubmit={handleInitialSearch} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                
                {/* 1. Enter Items */}
                <div className="flex flex-col gap-1.5 md:col-span-3">
                  <Label
                    htmlFor="items"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    1. Enter items
                  </Label>
                  <Input
                    id="items"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g., milk; chicken"
                    className="text-sm"
                    required
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Separate items with a semicolon <span className="font-mono">;</span>.
                  </p>
                </div>

                {/* Zip */}
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="zipcode"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Zip code
                  </Label>
                  <Input
                    id="zipcode"
                    type="text"
                    maxLength={5}
                    value={zipcode}
                    onChange={(e) => setZipcode(e.target.value)}
                    placeholder="e.g., 90025"
                    className="text-sm"
                    required
                  />
                </div>

                {/* Radius */}
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="radius"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Radius (miles)
                  </Label>
                  <Input
                    id="radius"
                    type="number"
                    min="1"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    placeholder="10"
                    className="text-sm"
                    required
                  />
                </div>

                {/* Stores */}
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="stores"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Stores
                  </Label>
                  <Select
                    value={retailerCountLimit}
                    onValueChange={setRetailerCountLimit}
                  >
                    <SelectTrigger className="h-9 text-sm" id="stores">
                      <SelectValue placeholder="Select stores" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} Store{n > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Button row */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
                >
                  {loading ? "Loading..." : "Load Item List & Search"}
                </Button>
              </div>

              <p className="text-[10px] text-gray-400 text-right pt-1">
                Prices reflect the most recent weekly update.
              </p>
            </form>
          </div>

          {error && (
            <div className="text-red-500 bg-red-50 p-3 rounded-md mt-4 text-sm">
              {error}
            </div>
          )}

          {initialSearchDone && (
            <div className="mt-6 pb-24">
              <h2 className="text-lg font-semibold mb-2">2. Refine Search</h2>
              <div className="flex flex-col gap-2 mb-4">
                <div className="grid grid-cols-4 gap-2 text-sm font-semibold text-gray-600">
                  <span>Name</span><span>Brand</span><span>Size</span><span>Details</span>
                </div>
                {editableCartItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2">
                    <Input value={item.name} onChange={e=>handleEditCartItem(idx,'name',e.target.value)} className="text-xs px-2 h-8"/>
                    <Input value={item.brand} onChange={e=>handleEditCartItem(idx,'brand',e.target.value)} className="text-xs px-2 h-8"/>
                    <Input value={item.size} onChange={e=>handleEditCartItem(idx,'size',e.target.value)} className="text-xs px-2 h-8"/>
                    <Input value={item.details} onChange={e=>handleEditCartItem(idx,'details',e.target.value)} className="text-xs px-2 h-8"/>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleReRunSearch}
                disabled={loading}
                className="w-full text-lg p-6 mt-4 bg-prox hover:bg-prox-hover text-white font-bold rounded-xl shadow-sm"
              >
                {loading ? ' optimizing...' : 'Re-run Search'}
              </Button>

              <div className="mt-8">
                {/* 1-Store Results */}
                {singleStoreResults.length > 0 && !loading && (
                  <div>
                    <h2 className="text-xl font-bold mb-3">Best Single-Store Carts</h2>
                    <Accordion type="multiple" className="w-full space-y-2">
                      {singleStoreResults.map(store => {
                        const storeId = `${store.retailer}@${store.zip_code}`;
                        return (
                          <AccordionItem value={storeId} key={storeId} className="border rounded-lg px-2 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                              <div className="flex items-center justify-between w-full pr-2">
                                <div className="flex items-center gap-2 text-left">
                                  {store.retailer_logo_url && <img src={store.retailer_logo_url} className="h-5 w-auto object-contain"/>}
                                  <div>
                                    <p className="font-semibold text-gray-900">{store.retailer}</p>
                                    <p className="text-xs text-gray-500 font-normal">({formatDistance(store.distance_m)})</p>
                                  </div>
                                </div>
                                <span className="text-lg font-bold text-green-700">${store.total_cart_price.toFixed(2)}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>{renderCartItems(store.items_found)}</AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  </div>
                )}

                {/* Multi-Store Result */}
                {result && !loading && (
                  <div>
                    <h2 className="text-xl font-bold mb-3 text-blue-900">Cheapest Multi-Store Combo</h2>
                    <div className="border-2 border-blue-100 rounded-xl p-4 bg-blue-50/30">
                      <div className="flex justify-between items-center mb-4 border-b border-blue-100 pb-4">
                        <div>
                          <p className="text-2xl font-bold text-green-700">${result.total_cart_price.toFixed(2)}</p>
                          <p className="text-sm text-gray-600 mt-1">Using {result.stores.length} stores</p>
                        </div>
                        <Button onClick={handleSaveCart} size="sm" className="bg-prox text-white hover:bg-prox-hover">
                          Save Cart
                        </Button>
                      </div>
                      
                      <Accordion type="multiple" className="w-full space-y-2">
                        {Array.from(
                          result.items_found.reduce((acc, item) => {
                            const key: StoreID = `${item.retailer}@${item.zip_code}`;
                            if (!acc.has(key)) acc.set(key, []);
                            acc.get(key)!.push(item);
                            return acc;
                          }, new Map<StoreID, OptimizedCartItem[]>())
                        ).map(([storeId, items]) => {
                          const firstItem = items[0]; 
                          return (
                            <AccordionItem value={storeId} key={storeId} className="border rounded-lg px-2 bg-white">
                              <AccordionTrigger className="hover:no-underline py-2">
                                <div className="flex items-center gap-2">
                                  {firstItem.retailer_logo_url && <img src={firstItem.retailer_logo_url} className="h-5 w-auto object-contain"/>}
                                  <div className="text-left">
                                    <p className="font-semibold text-sm">{firstItem.retailer}</p>
                                    <p className="text-xs text-gray-500 font-normal">({formatDistance(firstItem.distance_m)})</p>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>{renderCartItems(items)}</AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>

                      {result.items_missing.length > 0 && (
                        <div className="mt-4 p-3 bg-red-50 rounded-md border border-red-100">
                          <p className="text-sm font-semibold text-red-800">Missing Items:</p>
                          <p className="text-sm text-red-600">{result.items_missing.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {!result && singleStoreResults.length === 0 && !loading && error && (
                  <p className="text-red-600 font-semibold">{error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav current="CartFinder" />
    </div>
  );
}
