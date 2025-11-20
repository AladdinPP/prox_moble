// src/pages/CartFinder.tsx

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client'; 
import { Button } from '@/components/ui/button'; 
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// --- Data Types ---
type EditableCartItem = {
  name: string;
  brand: string;
  size: string;
  details: string;
};
type DealMenuItem = {
  retailer: string;
  zip_code: string;
  searched_item_name: string; // The "name" from EditableCartItem, e.g., "milk"
  product_name: string;
  product_price: number;
  distance_m: number;
  product_size: string | null;
  image_link: string | null;
};
type OptimizedCartItem = {
  searched_item: string; // The "name" from EditableCartItem
  product_name: string;
  product_price: number;
  retailer: string;
  zip_code: string;
  distance_m: number;
  product_size: string | null;
  image_link: string | null;
};
type StoreID = string; 
type OptimizedCart = {
  stores: StoreID[]; 
  total_cart_price: number;
  items_found: OptimizedCartItem[];
  items_missing: string[]; 
};
type SingleStoreResult = {
  retailer: string;
  zip_code: string;
  total_cart_price: number;
  items_found_count: number;
  distance_m: number;
  items_found: OptimizedCartItem[];
};

// Safeguard
const MAX_CANDIDATE_STORES = 30; 
const PLACEHOLDER_IMG = "https://via.placeholder.com/100x100.png?text=No+Image";

export function CartFinder() {
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
  const [refineOpen, setRefineOpen] = useState(false); // UI-only: controls collapse

  /**
   * -----------------------------------------------------------------
   * The "Optimizer" Brain (This is the fast one, no changes needed)
   * -----------------------------------------------------------------
   */
  const findBestCart = (
    dealMenu: DealMenuItem[], 
    searchTerms: string[], // This is just the list of "name" fields
    storeLimit: number
  ): { bestCart: OptimizedCart | null, allStoreCarts: SingleStoreResult[] } => {
    
    console.time("Optimizer: 1. Pre-processing");
    const topK = 5;
    const candidateStoreIds = new Set<StoreID>();
    const storeMap = new Map<StoreID, { retailer: string, zip_code: string, distance_m: number }>();
    const priceMenu = new Map<string, Map<StoreID, DealMenuItem>>();

    for (const deal of dealMenu) {
      const storeId: StoreID = `${deal.retailer}@${deal.zip_code}`;
      if (!storeMap.has(storeId)) {
        storeMap.set(storeId, { retailer: deal.retailer, zip_code: deal.zip_code, distance_m: deal.distance_m });
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
        if (a.product_price !== b.product_price) {
          return a.product_price - b.product_price;
        }
        return a.distance_m - b.distance_m;
      });
      const topKDeals = itemDeals.slice(0, topK);
      for (const deal of topKDeals) {
        candidateStoreIds.add(`${deal.retailer}@${deal.zip_code}`);
      }
    }

    console.timeEnd("Optimizer: 1. Pre-processing");
    console.log(`Optimizing with ${candidateStoreIds.size} candidate stores.`);

    if (candidateStoreIds.size > MAX_CANDIDATE_STORES) {
      console.warn("Too many candidate stores. Aborting optimization.");
      throw new Error(`Too many stores (${candidateStoreIds.size}) to optimize. Please reduce your radius or refine your search.`);
    }

    console.time("Optimizer: 2. Generating Combos");
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
          const hasDuplicates = new Set(brandsInCombo).size !== brandsInCombo.length;
          if (!hasDuplicates) {
            allCombos.push(currentCombo);
          }
          continue;
        }
        for (let j = index; j <= uniqueStoreIds.length - (k - currentCombo.length); j++) {
          stack.push({ index: j + 1, currentCombo: [...currentCombo, uniqueStoreIds[j]] });
        }
      }
    }

    console.timeEnd("Optimizer: 2. Generating Combos");
    console.log(`Generated ${allCombos.length} valid combinations.`);

    console.time("Optimizer: 3. Simulating Carts");
    for (const combo of allCombos) {
      const currentCart: OptimizedCart = {
        stores: combo,
        total_cart_price: 0,
        items_found: [],
        items_missing: [],
      };
      
      for (const item of searchTerms) {
        let cheapestDeal: OptimizedCartItem | null = null;
        const itemPrices = priceMenu.get(item);
        
        if (itemPrices) {
          for (const storeId of combo) {
            const deal = itemPrices.get(storeId);
            if (deal) {
              if (!cheapestDeal || deal.product_price < cheapestDeal.product_price || (deal.product_price === cheapestDeal.product_price && deal.distance_m < cheapestDeal.distance_m)) {
                cheapestDeal = {
                  searched_item: item, // This is just the "name" field
                  product_name: deal.product_name,
                  product_price: deal.product_price,
                  retailer: deal.retailer,
                  zip_code: deal.zip_code,
                  distance_m: deal.distance_m,
                  product_size: deal.product_size,
                  image_link: deal.image_link,
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
          retailer: storeInfo.retailer,
          zip_code: storeInfo.zip_code,
          total_cart_price: currentCart.total_cart_price,
          items_found_count: currentCart.items_found.length,
          distance_m: storeInfo.distance_m,
          items_found: currentCart.items_found,
        });
      }

      if (!bestCart || 
          currentCart.items_missing.length < bestCart.items_missing.length ||
          (currentCart.items_missing.length === bestCart.items_missing.length && 
           currentCart.total_cart_price < bestCart.total_cart_price)
         ) {
        bestCart = currentCart;
      }
    }
    console.timeEnd("Optimizer: 3. Simulating Carts");
    console.log("--- findBestCart: FINISHED ---");
    return { bestCart, allStoreCarts };
  };

  /**
   * -----------------------------------------------------------------
   * Core Optimizer function (Production Version)
   * -----------------------------------------------------------------
   */
  const handleRunOptimizer = async (itemsToFind: EditableCartItem[]) => {
    console.log("--- handleRunOptimizer: START ---");
    console.time("Total Search Time"); 
    setLoading(true);
    setError(null);
    setResult(null);
    setSingleStoreResults([]);

    // Get just the names for the optimizer
    const searchTerms = itemsToFind.map(item => item.name);

    if (searchTerms.length === 0) {
        console.error("handleRunOptimizer: Validation failed: No search terms.");
        setError('Your item list is empty. Add items above.');
        setLoading(false);
        return;
    }
    if (!/^\d{5}$/.test(zipcode)) {
      console.error("handleRunOptimizer: Validation failed: Invalid zip code.");
      setError('Please enter a valid 5-digit zip code.');
      setLoading(false);
      return;
    }
    
    const radiusNum = parseInt(radius, 10);
    const meters = Math.round(radiusNum * 1609.34);
    const retailerLimit = parseInt(retailerCountLimit, 10);

    try {
      console.log("handleRunOptimizer: Calling RPC 'get_deal_menu_v7'...");
      console.time("SQL Query Time");
      const { data: rawData, error: rpcError } = await supabase
        .rpc('get_deal_menu_v7', { 
          user_zip: zipcode, 
          items_to_find: itemsToFind,
          radius_meters: meters
        });
      
      const dealMenu = rawData as DealMenuItem[];
      console.timeEnd("SQL Query Time");

      if (rpcError) {
        console.error("handleRunOptimizer: RPC Error", rpcError);
        throw rpcError;
      }
      
      console.log(`handleRunOptimizer: RPC returned ${dealMenu ? dealMenu.length : 0} deals.`);

      if (dealMenu && dealMenu.length > 0) {
        console.log("handleRunOptimizer: Calling findBestCart...");
        const { bestCart, allStoreCarts } = findBestCart(
          dealMenu, 
          searchTerms,
          retailerLimit
        );
        
        if (retailerLimit === 1) {
          console.log("handleRunOptimizer: Processing 1-store results.");
          const completedStoreCarts = allStoreCarts.filter(
            cart => cart.items_found_count === searchTerms.length
          );
          const bestByBrand = new Map<string, SingleStoreResult>();
          for (const storeCart of completedStoreCarts) {
            const currentBest = bestByBrand.get(storeCart.retailer);
            if (
              !currentBest ||
              storeCart.total_cart_price < currentBest.total_cart_price ||
              (storeCart.total_cart_price === currentBest.total_cart_price &&
               storeCart.distance_m < currentBest.distance_m)
            ) {
              bestByBrand.set(storeCart.retailer, storeCart);
            }
          }
          setSingleStoreResults(
            Array.from(bestByBrand.values()).sort((a,b) => a.total_cart_price - b.total_cart_price)
          );
        } else {
          console.log("handleRunOptimizer: Processing multi-store results.");
          setResult(bestCart);
        }
        
      } else {
        console.log("handleRunOptimizer: No deals found, setting error.");
        setError("No deals found for this combination. Try broadening your search.");
      }

    } catch (err: any) {
      console.error('--- handleRunOptimizer: CRASH ---', err);
      setError(err.message || 'An unknown error occurred during the search.');
    } finally {
      setLoading(false);
      console.timeEnd("Total Search Time"); 
      console.log("--- handleRunOptimizer: FINISHED ---");
    }
  };

  /**
   * "Load Item List & Search" button
   */
  const handleInitialSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("--- handleInitialSearch: START ---");
    const searchTerms = searchQuery.split(';')
      .map(term => term.trim())
      .filter(term => term.length > 0);
    if (searchTerms.length === 0) {
      setError('Please enter at least one item name.');
      return;
    }
    const initialItems = searchTerms.map(name => ({
      name,
      brand: '',
      size: '',
      details: '',
    }));
    setEditableCartItems(initialItems);
    setInitialSearchDone(true);
    
    console.log("handleInitialSearch: Running optimizer with initial items:", initialItems);
    handleRunOptimizer(initialItems);
  };

  /**
   * "Re-run Search" button logic
   */
  const handleReRunSearch = () => {
    console.log("--- handleReRunSearch: START ---");
    console.log("handleReRunSearch: Running optimizer with refined items:", editableCartItems);
    handleRunOptimizer(editableCartItems);
  };

  const handleEditCartItem = (index: number, field: keyof EditableCartItem, value: string) => {
    const newItems = [...editableCartItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditableCartItems(newItems);
  };

  return (
    <div className="min-h-screen bg-gradient-background text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
        {/* Header card */}
        <div className="rounded-3xl border border-border/60 bg-card px-5 py-4 shadow-soft">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_theme(colors.accent.DEFAULT)]" />
              Cart tools · Prox
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cart Optimizer
            </h1>
            <p className="text-sm text-muted-foreground">
              Find the cheapest combination of stores for your whole cart.
              Paste your list once and let Prox do the math.
            </p>
          </div>
        </div>

        {/* Form + refine card */}
        <div className="space-y-6 rounded-2xl border border-border/60 bg-card px-4 py-5 shadow-soft">
          {/* Step 1: search form */}
          <form onSubmit={handleInitialSearch} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="items" className="text-sm font-semibold">
                1. Enter your items
              </Label>
              <Input
                id="items"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., milk; chicken; eggs; cereal"
                className="text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">
                Separate items with a semicolon <span className="font-mono">;</span> so we treat
                each as its own product.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="zip" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Zip code
                </Label>
                <Input
                  id="zip"
                  type="text"
                  maxLength={5}
                  value={zipcode}
                  onChange={(e) => setZipcode(e.target.value)}
                  placeholder="5-digit zip"
                  className="text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="radius" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Search radius (miles)
                </Label>
                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                  <input
                    id="radius"
                    type="number"
                    min="1"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    placeholder="10"
                    className="w-full border-none bg-transparent p-0 text-sm outline-none focus:ring-0"
                    required
                  />
                  <span className="text-[11px] text-muted-foreground">miles</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="retailer-count" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Max # of stores
                </Label>
                <Select value={retailerCountLimit} onValueChange={setRetailerCountLimit}>
                  <SelectTrigger id="retailer-count" className="text-sm">
                    <SelectValue placeholder="Select max stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 store (single trip)</SelectItem>
                    <SelectItem value="2">2 stores</SelectItem>
                    <SelectItem value="3">3 stores</SelectItem>
                    <SelectItem value="4">4 stores</SelectItem>
                    <SelectItem value="5">5 stores</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-full py-3 text-sm font-semibold shadow-glow bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {loading ? 'Loading…' : 'Load item list & search'}
            </Button>
          </form>
          
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {initialSearchDone && (
            <div className="space-y-6">
              {/* Step 2: refine (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setRefineOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl bg-background/60 px-3 py-2 text-left transition hover:bg-background/80"
                >
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight">
                      2. Refine your search{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Add brands, sizes, or extra details so we match exactly what you’d buy.
                    </p>
                  </div>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-lg leading-none text-accent-foreground shadow-glow">
                    {refineOpen ? '−' : '+'}
                  </span>
                </button>

                {refineOpen && (
                  <>
                    <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-background/60 p-3">
                      <div className="grid grid-cols-4 gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        <Label>Product name</Label>
                        <Label>Brand</Label>
                        <Label>Size</Label>
                        <Label>Additional details</Label>
                      </div>
                      {editableCartItems.map((item, index) => (
                        <div key={index} className="grid grid-cols-4 gap-2">
                          <Input
                            value={item.name}
                            onChange={(e) => handleEditCartItem(index, 'name', e.target.value)}
                            placeholder="e.g., milk"
                            className="text-sm"
                          />
                          <Input
                            value={item.brand}
                            onChange={(e) => handleEditCartItem(index, 'brand', e.target.value)}
                            placeholder="e.g., Lactaid"
                            className="text-sm"
                          />
                          <Input
                            value={item.size}
                            onChange={(e) => handleEditCartItem(index, 'size', e.target.value)}
                            placeholder="e.g., 1 gal"
                            className="text-sm"
                          />
                          <Input
                            value={item.details}
                            onChange={(e) => handleEditCartItem(index, 'details', e.target.value)}
                            placeholder="e.g., whole"
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={handleReRunSearch}
                      disabled={loading}
                      className="mt-4 w-full rounded-full py-3 text-sm font-semibold bg-accent text-accent-foreground shadow-glow hover:bg-accent/90"
                    >
                      {loading ? 'Finding best cart…' : 'Re-run search'}
                    </Button>
                  </>
                )}
              </div>

              {/* Results */}
              <div className="space-y-6">
                {singleStoreResults.length > 0 && !loading && (
                  <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                    <h2 className="text-base font-semibold">Best price by retailer</h2>
                    <Accordion type="multiple" className="mt-2 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {singleStoreResults.map(store => {
                        const storeId = `${store.retailer}@${store.zip_code}`;
                        return (
                          <AccordionItem
                            value={storeId}
                            key={storeId}
                            className="rounded-lg border bg-card/70 lg:col-span-1 data-[state=open]:lg:col-span-3"
                          >
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                              <div className="flex w-full items-center justify-between">
                                <span className="text-sm font-semibold text-left">
                                  {store.retailer} (Zip: {store.zip_code})
                                </span>
                                <span className="text-lg font-bold text-green-700 pr-2">
                                  ${store.total_cart_price.toFixed(2)}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-1">
                              <ul className="space-y-3 pt-2">
                                {store.items_found.map(item => (
                                  <li
                                    key={item.product_name}
                                    className="flex items-center gap-4 border-b pb-3 last:border-b-0"
                                  >
                                    <img
                                      src={item.image_link || PLACEHOLDER_IMG}
                                      alt={item.product_name}
                                      className="h-20 w-20 flex-shrink-0 rounded-md border bg-gray-50 object-cover"
                                      onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                                    />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">
                                        {item.product_name}
                                      </p>
                                      {item.product_size && (
                                        <p className="text-xs text-muted-foreground">
                                          {item.product_size}
                                        </p>
                                      )}
                                      <p className="text-sm font-bold text-green-600">
                                        ${item.product_price.toFixed(2)}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                )}

                {result && !loading && (
                  <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                    <h2 className="text-base font-semibold">
                      Cheapest combination found
                    </h2>
                    <div className="mt-2 rounded-xl bg-emerald-50/70 p-4">
                      <h3 className="text-2xl font-bold text-green-700">
                        Total price: ${result.total_cart_price.toFixed(2)}
                      </h3>
                      <p className="mt-1 text-sm font-medium">
                        Using {result.stores.length} store
                        {result.stores.length === 1 ? '' : 's'}:{' '}
                        {result.stores
                          .map(storeId => storeId.replace('@', ' (Zip: ') + ')')
                          .join(', ')}
                      </p>
                    </div>

                    <div className="mt-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Cart details by store
                      </h4>
                      <Accordion type="multiple" className="w-full">
                        {Array.from(
                          result.items_found.reduce((acc, item) => {
                            const key: StoreID = `${item.retailer}@${item.zip_code}`;
                            if (!acc.has(key)) acc.set(key, []);
                            acc.get(key)!.push(item);
                            return acc;
                          }, new Map<StoreID, OptimizedCartItem[]>())
                        ).map(([storeId, items]) => (
                          <AccordionItem value={storeId} key={storeId}>
                            <AccordionTrigger className="px-4 py-2 hover:no-underline">
                              <span className="text-sm font-semibold">
                                {storeId.replace('@', ' (Zip: ') + ')'}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-1">
                              <ul className="space-y-3">
                                {items.map(item => (
                                  <li
                                    key={item.product_name}
                                    className="flex items-center gap-4 border-b pb-3 last:border-b-0"
                                  >
                                    <img
                                      src={item.image_link || PLACEHOLDER_IMG}
                                      alt={item.product_name}
                                      className="h-20 w-20 flex-shrink-0 rounded-md border bg-gray-50 object-cover"
                                      onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                                    />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">
                                        {item.product_name}
                                      </p>
                                      {item.product_size && (
                                        <p className="text-xs text-muted-foreground">
                                          {item.product_size}
                                        </p>
                                      )}
                                      <p className="text-sm font-bold text-green-600">
                                        ${item.product_price.toFixed(2)}
                                      </p>
                                      <p className="mt-1 text-[11px] text-muted-foreground">
                                        (Searched for: "{item.searched_item}")
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>

                      {result.items_missing.length > 0 && (
                        <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
                          <span className="font-semibold">Missing items: </span>
                          Could not find these items:{' '}
                          {result.items_missing.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!result &&
                  singleStoreResults.length === 0 &&
                  !loading &&
                  error && (
                    <p className="text-sm font-semibold text-red-600">
                      {error}
                    </p>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
