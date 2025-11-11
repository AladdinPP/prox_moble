// src/pages/CartFinder.tsx

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client'; 
import { Button } from '@/components/ui/button'; 
import { Label } from "@/components/ui/label";
// ⬇️ NEW: Import Select for the dropdown
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// --- Data Types for this page ---
type DealMenuItem = {
  retailer: string;
  zip_code: string;
  searched_item: string; 
  product_name: string;
  product_price: number;
  distance_m: number;
};

type CartItem = {
  searched_item: string;
  product_name: string;
  product_price: number;
  retailer: string;
  zip_code: string;
  distance_m: number;
};

type OptimizedCart = {
  retailers: string[];
  total_cart_price: number;
  items_found: CartItem[];
  items_missing: string[];
};

export function CartFinder() {
  const [searchTerm, setSearchTerm] = useState(''); // e.g., "milk; chicken"
  const [zipcode, setZipcode] = useState(''); 
  const [radius, setRadius] = useState('10'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ⬇️ MODIFIED: New input for retailer count
  const [retailerCountLimit, setRetailerCountLimit] = useState('1'); 
  
  // ⬇️ MODIFIED: State for the final cart result
  const [result, setResult] = useState<OptimizedCart | null>(null);

  /**
   * -----------------------------------------------------------------
   * The "Optimizer" Brain
   * -----------------------------------------------------------------
   * This is where all the cart optimization logic happens.
   */
  const findBestCart = (
    dealMenu: DealMenuItem[], 
    searchTerms: string[], 
    retailerLimit: number
  ): OptimizedCart | null => {
    
    // 1. Get all unique retailers from the deal menu
    const uniqueRetailers = [...new Set(dealMenu.map(d => d.retailer))];
    
    // 2. Generate all retailer combinations (e.g., [1], [2], [1,2])
    let retailerCombos: string[][] = [];
    for (let i = 1; i <= retailerLimit; i++) {
      // This is a simple combination generator
      const getCombos = (start: number, currentCombo: string[]) => {
        if (currentCombo.length === i) {
          retailerCombos.push(currentCombo);
          return;
        }
        for (let j = start; j < uniqueRetailers.length; j++) {
          getCombos(j + 1, [...currentCombo, uniqueRetailers[j]]);
        }
      }
      getCombos(0, []);
    }

    let bestCart: OptimizedCart | null = null;

    // 3. Simulate a cart for every combination
    for (const combo of retailerCombos) {
      const currentCart: OptimizedCart = {
        retailers: combo,
        total_cart_price: 0,
        items_found: [],
        items_missing: [],
      };

      // 4. For each item, find the cheapest price *within this retailer combo*
      for (const item of searchTerms) {
        let cheapestDeal: CartItem | null = null;

        for (const deal of dealMenu) {
          // Check if deal matches the item AND is in our store combo
          if (deal.searched_item === item && combo.includes(deal.retailer)) {
            // If it's the first deal we've found for this item,
            // or if it's cheaper than the one we have, save it.
            if (!cheapestDeal || deal.product_price < cheapestDeal.product_price ||
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
        } // end deals loop
        
        // 5. Add the cheapest deal found (if any) to the cart
        if (cheapestDeal) {
          currentCart.items_found.push(cheapestDeal);
          currentCart.total_cart_price += cheapestDeal.product_price;
        } else {
          currentCart.items_missing.push(item);
        }
      } // end search terms loop
      
      // 6. Compare this cart to the best one we've found so far
      if (!bestCart) {
        bestCart = currentCart; // First cart is always the best so far
      } else {
        // Prioritize carts with NO missing items
        if (currentCart.items_missing.length < bestCart.items_missing.length) {
          bestCart = currentCart;
        } 
        // If they have the same number of missing items,
        // prioritize the cheaper one
        else if (currentCart.items_missing.length === bestCart.items_missing.length) {
          if (currentCart.total_cart_price < bestCart.total_cart_price) {
            bestCart = currentCart;
          }
        }
      }
    } // end combinations loop

    return bestCart;
  };


  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    // Parse items
    const searchTerms = searchTerm.split(';')
      .map(term => term.trim())
      .filter(term => term.length > 0);

    // Validation
    if (searchTerms.length === 0) {
      setError('Please enter at least one item name.');
      setLoading(false);
      return;
    }
    if (!/^\d{5}$/.test(zipcode)) {
      setError('Please enter a valid 5-digit zip code.');
      setLoading(false);
      return;
    }
    const radiusNum = parseInt(radius, 10);
    const meters = Math.round(radiusNum * 1609.34);
    const retailerLimit = parseInt(retailerCountLimit, 10);

    try {
      // --- ⬇️ Call the NEW v1 menu function ---
      const { data: dealMenu, error: rpcError } = await supabase
        .rpc('get_deal_menu_v1', { 
          user_zip: zipcode, 
          search_terms: searchTerms, 
          radius_meters: meters
        });

      if (rpcError) throw rpcError;

      if (dealMenu && dealMenu.length > 0) {
        // --- ⬇️ Run the Optimizer ---
        const bestCart = findBestCart(
          dealMenu as DealMenuItem[], 
          searchTerms, 
          retailerLimit
        );
        setResult(bestCart);
      } else {
        setResult(null); // No deals found at all
      }

    } catch (err: any) {
      console.error('Error fetching cheapest cart:', err);
      setError(err.message || 'Failed to fetch cart.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Cart Optimizer</h1>
      <p className="mb-4 text-gray-600">
        Find the cheapest combination of stores for your whole cart.
      </p>

      {/* --- Search Form --- */}
      <form onSubmit={handleSearch} className="flex flex-col gap-4 mb-4">
        {/* Item Input */}
        <div className="flex-grow">
          <Label htmlFor="items" className="text-base font-semibold">Items</Label>
          <input
            id="items"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g., milk; chicken; eggs"
            className="border p-2 rounded-md w-full" 
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Separate items with a semicolon ( ; ).
          </p>
        </div>

        {/* Zip, Radius, and Retailer Count */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="zip" className="text-base font-semibold">Zip Code</Label>
            <input
              id="zip"
              type="text" 
              maxLength={5} 
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              placeholder="5-digit zip"
              className="border p-2 rounded-md w-full" 
              required
            />
          </div>
          <div>
            <Label htmlFor="radius" className="text-base font-semibold">Radius</Label>
            <div className="flex items-center border p-2 rounded-md">
              <input
                id="radius"
                type="number" 
                min="1"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                placeholder="e.g., 10"
                className="border-none p-0 w-full focus:outline-none focus:ring-0"
                required
              />
              <span className="text-sm text-gray-500 ml-1">miles</span>
            </div>
          </div>
          {/* ⬇️ MODIFIED: Retailer Count Select ⬇️ */}
          <div>
            <Label htmlFor="retailer-count" className="text-base font-semibold">Max Stores</Label>
            <Select 
              value={retailerCountLimit} 
              onValueChange={setRetailerCountLimit}
            >
              <SelectTrigger id="retailer-count" className="w-full">
                <SelectValue placeholder="Select max stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Retailer</SelectItem>
                <SelectItem value="2">2 Retailers</SelectItem>
                <SelectItem value="3">3 Retailers</SelectItem>
                <SelectItem value="4">4 Retailers</SelectItem>
                <SelectItem value="5">5 Retailers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Search Button */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full text-lg p-6"
        >
          {loading ? 'Finding Best Cart...' : 'Find Cheapest Combination'}
        </Button>
      </form>
      
      {/* Error Message */}
      {error && <div className="text-red-500">{error}</div>}

      {/* --- Results Display --- */}
      {result && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Cheapest Combination Found!</h2>
          
          <div className="mt-2 border p-4 rounded-lg bg-green-50/50">
            <h3 className="text-2xl font-bold text-green-700">
              Total Price: ${result.total_cart_price.toFixed(2)}
            </h3>
            <p className="text-lg font-semibold">
              Using {result.retailers.length} store(s): {result.retailers.join(', ')}
            </p>
            
            <hr className="my-3" />

            <h4 className="font-semibold mb-2">Cart Details:</h4>
            <ul className="list-disc list-inside space-y-1">
              {result.items_found.map(item => (
                <li key={`${item.retailer}-${item.product_name}`}>
                  {item.product_name} (${item.product_price.toFixed(2)})
                  <span className="text-xs text-gray-500">
                    (from {item.retailer} @ {item.zip_code})
                  </span>
                </li>
              ))}
            </ul>

            {result.items_missing.length > 0 && (
              <>
                <h4 className="font-semibold mb-2 mt-3 text-red-600">Missing Items:</h4>
                <p className="text-sm text-gray-600">
                  Could not find these items from your selected stores: {result.items_missing.join(', ')}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* No results (and not loading/error) */}
      {!result && !loading && !error && (
        <div className="mt-6">
          <p>Your optimized cart will appear here.</p>
        </div>
      )}
    </div>
  );
}