// src/pages/CartFinder.tsx (REPLACE the whole file)

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

// --- (Data Types are unchanged) ---
type EditableCartItem = {
  name: string;
  brand: string;
  size: string;
  details: string;
};
type DealMenuItem = {
  retailer: string;
  zip_code: string;
  searched_item_name: string; 
  product_name: string;
  product_price: number;
  distance_m: number;
};
type OptimizedCartItem = {
  searched_item: string;
  product_name: string;
  product_price: number;
  retailer: string;
  zip_code: string;
  distance_m: number; 
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
};

// Safeguard
const MAX_CANDIDATE_STORES = 30; 

export function CartFinder() {
  // --- (State is unchanged) ---
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

  /**
   * -----------------------------------------------------------------
   * The "Optimizer" Brain (Using "topK=5" pruning)
   * -----------------------------------------------------------------
   */
  const findBestCart = (
    dealMenu: DealMenuItem[], 
    searchTerms: string[],
    storeLimit: number
  ): { bestCart: OptimizedCart | null, allStoreCarts: SingleStoreResult[] } => {
    
    console.time("Optimizer: 1. Pre-processing");
    const topK = 5; // As requested: find top 5 stores for each item
    const candidateStoreIds = new Set<StoreID>();
    const storeMap = new Map<StoreID, { retailer: string, zip_code: string, distance_m: number }>();
    const priceMenu = new Map<string, Map<StoreID, DealMenuItem>>();

    // 1. Build the fast lookup maps
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

    // 2. Build the Candidate Store Group (using "topK=5" logic)
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

    // 3. Generate combinations (Iterative generator)
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
    // 4. Simulate Carts
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
              if (
                !cheapestDeal ||
                deal.product_price < cheapestDeal.product_price || 
                (deal.product_price === cheapestDeal.product_price && deal.distance_m < cheapestDeal.distance_m)
              ) {
                cheapestDeal = {
                  searched_item: item,
                  product_name: deal.product_name,
                  product_price: deal.product_price,
                  retailer: deal.retailer,
                  zip_code: deal.zip_code,
                  distance_m: deal.distance_m,
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
  const handleRunOptimizer = async (searchTerms: string[]) => {
    console.log("--- handleRunOptimizer: START ---");
    console.time("Total Search Time"); 
    setLoading(true);
    setError(null);
    setResult(null);
    setSingleStoreResults([]);

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
      console.log("handleRunOptimizer: Calling RPC 'get_deal_menu_v5'...");
      console.time("SQL Query Time");
      const { data: rawData, error: rpcError } = await supabase
        .rpc('get_deal_menu_v5', { 
          user_zip: zipcode, 
          search_terms: searchTerms, 
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
          const bestByBrand = new Map<string, SingleStoreResult>();
          for (const storeCart of allStoreCarts) {
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
    
    console.log("handleInitialSearch: Running optimizer with initial terms:", searchTerms);
    handleRunOptimizer(searchTerms);
  };

  /**
   * "Re-run Search" button logic
   */
  const handleReRunSearch = () => {
    console.log("--- handleReRunSearch: START ---");
    const newSearchTerms = editableCartItems.map(item => {
      return `${item.name} ${item.brand} ${item.size} ${item.details}`
        .trim() 
        .replace(/\s+/g, ' '); 
    }).filter(term => term.length > 0); 
    
    console.log("handleReRunSearch: Running optimizer with refined terms:", newSearchTerms);
    handleRunOptimizer(newSearchTerms);
  };

  const handleEditCartItem = (index: number, field: keyof EditableCartItem, value: string) => {
    const newItems = [...editableCartItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditableCartItems(newItems);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Cart Optimizer</h1>
      <p className="mb-4 text-gray-600">
        Find the cheapest combination of stores for your whole cart.
      </p>

      <form onSubmit={handleInitialSearch} className="flex flex-col gap-4 mb-4">
        <div className="flex-grow">
          <Label htmlFor="items" className="text-base font-semibold">1. Enter Your Items</Label>
          <input
            id="items"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g., milk; chicken; eggs"
            className="border p-2 rounded-md w-full" 
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Separate items with a semicolon ( ; ).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="zip" className="text-base font-semibold">Zip Code</Label>
            <input id="zip" type="text" maxLength={5} value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              placeholder="5-digit zip" className="border p-2 rounded-md w-full" required />
          </div>
          <div>
            <Label htmlFor="radius" className="text-base font-semibold">Radius</Label>
            <div className="flex items-center border p-2 rounded-md">
              <input id="radius" type="number" min="1" value={radius}
                onChange={(e) => setRadius(e.target.value)}
                placeholder="e.g., 10" className="border-none p-0 w-full focus:outline-none focus:ring-0" required />
              <span className="text-sm text-gray-500 ml-1">miles</span>
            </div>
          </div>
          <div>
            <Label htmlFor="retailer-count" className="text-base font-semibold">Max Stores</Label>
            <Select value={retailerCountLimit} onValueChange={setRetailerCountLimit}>
              <SelectTrigger id="retailer-count" className="w-full">
                <SelectValue placeholder="Select max stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Store</SelectItem>
                <SelectItem value="2">2 Stores</SelectItem>
                <SelectItem value="3">3 Stores</SelectItem>
                <SelectItem value="4">4 Stores</SelectItem>
                <SelectItem value="5">5 Stores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Button
          type="submit"
          disabled={loading}
          className="w-full text-lg p-6"
        >
          {loading ? 'Loading...' : 'Load Item List & Search'}
        </Button>
      </form>
      
      {error && <div className="text-red-500 font-semibold p-3 bg-red-50 rounded-lg">{error}</div>}

      {initialSearchDone && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">2. Refine Your Search (Optional)</h2>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2 font-semibold">
              <Label>Product Name</Label>
              <Label>Brand</Label>
              <Label>Size</Label>
              <Label>Additional Details</Label>
            </div>
            {editableCartItems.map((item, index) => (
              <div key={index} className="grid grid-cols-4 gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => handleEditCartItem(index, 'name', e.target.value)}
                  placeholder="e.g., milk"
                />
                <Input
                  value={item.brand}
                  onChange={(e) => handleEditCartItem(index, 'brand', e.target.value)}
                  placeholder="e.g., Lactaid"
                />
                <Input
                  value={item.size}
                  // ⬇️ TYPO 1: FIXED ⬇️
                  onChange={(e) => handleEditCartItem(index, 'size', e.target.value)}
                  placeholder="e.g., 1 gal"
                />
                <Input
                  value={item.details}
                  onChange={(e) => handleEditCartItem(index, 'details', e.target.value)}
                  placeholder="e.g., whole"
                />
              </div>
            ))}
          </div>
          <Button
            onClick={handleReRunSearch}
            disabled={loading}
            className="w-full text-lg p-6 mt-4"
          >
            {loading ? 'Finding Best Cart...' : 'Re-run Search'}
          </Button>

          {/* --- ⬇️ PRODUCTION RENDER LOGIC (TYPOS FIXED) ⬇️ --- */}
          <div className="mt-6">
            {singleStoreResults.length > 0 && !loading && (
              <div>
                <h2 className="text-xl font-semibold">Best Price by Retailer</h2>
                <ul className="mt-2 space-y-2">
                  {singleStoreResults.map(store => (
                    <li key={`${store.retailer}-${store.zip_code}`} className="border p-4 rounded-lg">
                      <p className="text-lg font-bold">{store.retailer} (Zip: {store.zip_code})</p>
                      <p className="text-xl text-green-700">${store.total_cart_price.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">
                        Found {store.items_found_count} of {editableCartItems.length} items.
                      </p> {/* ⬅️ TYPO 2: FIXED (was /D) */}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result && !loading && (
              <div>
                <h2 className="text-xl font-semibold">Cheapest Combination Found!</h2>
                <div className="mt-2 border p-4 rounded-lg bg-green-50/50">
                  <h3 className="text-2xl font-bold text-green-700">
                    Total Price: ${result.total_cart_price.toFixed(2)}
                  </h3>
                  <p className="text-lg font-semibold">
                    Using {result.stores.length} store(s): 
                    {/* ⬇️ TYPO 3: FIXED (extra parenthesis) ⬇️ */}
                    {result.stores.map(storeId => storeId.replace('@', ' (Zip: ')).join('), ')}
                  </p>
                  <hr className="my-3" />
                  <h4 className="font-semibold mb-2">Cart Details:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.items_found.map(item => (
                      <li key={`${item.retailer}-${item.product_name}`}>
                        {item.product_name} (${item.product_price.toFixed(2)})
                        <span className="text-xs text-gray-500">
                          (for "{item.searched_item}" from {item.retailer} @ {item.zip_code})
                        </span>
                      </li>
                    ))}
                  </ul>
                  {result.items_missing.length > 0 && (
                    <>
                      <h4 className="font-semibold mb-2 mt-3 text-red-600">Missing Items:</h4>
                      <p className="text-sm text-gray-600">
                        Could not find these items: {result.items_missing.join(', ')}
                      </p>
                    </>
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
  );
}