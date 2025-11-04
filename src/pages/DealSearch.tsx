// src/pages/DealSearch.tsx

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client'; 

// --- 1. MODIFIED: Updated data types ---
// Note: distance_m is optional, as the exact-zip RPC doesn't return it.
type DealResult = {
  id: number;
  product_name: string;
  product_price: number;
  retailer: string;
  zip_code: string; // Zip code is now TEXT
  distance_m?: number;
};


export function DealSearch() {
  // --- 2. MODIFIED: State updates ---
  const [searchTerm, setSearchTerm] = useState('');
  const [zipcode, setZipcode] = useState(''); // Zip code is now a string
  const [radius, setRadius] = useState('10'); // New state for radius
  
  const [results, setResults] = useState<DealResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * --- 5. NEW: Filters RPC results ---
   * This function implements the "one result per retailer" logic.
   * Both RPC functions sort results (by price or distance),
   * so we just need to take the *first* one we see for each retailer.
   */
  const processResults = (data: DealResult[]) => {
    const closestByRetailer = new Map<string, DealResult>();
    for (const deal of data) {
      if (!closestByRetailer.has(deal.retailer)) {
        closestByRetailer.set(deal.retailer, deal);
      }
    }
    setResults(Array.from(closestByRetailer.values()));
  };

  // --- 4. MODIFIED: The search handler logic ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);

    // --- Validation ---
    const radiusNum = parseInt(radius, 10);
    if (!searchTerm.trim()) {
      setError('Please enter an item name.');
      setLoading(false);
      return;
    }
    if (!/^\d{5}$/.test(zipcode)) {
      setError('Please enter a valid 5-digit zip code.');
      setLoading(false);
      return;
    }
    if (isNaN(radiusNum) || radiusNum <= 0) {
      setError('Please enter a search radius greater than 0.');
      setLoading(false);
      return;
    }

    try {
      // --- RPC Call 1: Try for an EXACT zip code match first ---
      const { data: exact, error: e1 } = await supabase
        .rpc('find_deals_in_zip', { 
          user_zip: zipcode, 
          q: searchTerm, 
          max_rows: 100 
        });

      if (e1) throw e1;
      
      if (exact && exact.length > 0) {
        processResults(exact as DealResult[]);
        setLoading(false);
        return; // Found results, stop here.
      }

      // --- RPC Call 2: No exact match, try radius search ---
      const meters = Math.round(radiusNum * 1609.34);
      const { data: near, error: e2 } = await supabase
        .rpc('find_deals_near_zip', { 
          user_zip: zipcode, 
          q: searchTerm, 
          radius_meters: meters, 
          max_rows: 100 
        });

      if (e2) throw e2;
      
      if (near && near.length > 0) {
        processResults(near as DealResult[]);
      } else {
        setResults([]); // Nothing found
      }

    } catch (err: any) {
      console.error('Error fetching deals:', err);
      setError(err.message || 'Failed to fetch deals.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Grocery Deal Finder</h1>
      
      {/* --- 3. MODIFIED: The search form --- */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="e.g., 'milk', 'eggs'"
          className="border p-2 rounded-md flex-grow" 
          required
        />
        <input
          type="text" 
          maxLength={5} // Max 5 digits
          value={zipcode}
          onChange={(e) => setZipcode(e.target.value)}
          placeholder="Zip Code"
          className="border p-2 rounded-md sm:w-32" 
          required
        />
        <div className="flex items-center border p-2 rounded-md sm:w-32">
          <input
            type="number" 
            min="1"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="Radius"
            // Use border-none and focus:ring-0 to remove default input styling
            className="border-none p-0 w-full focus:outline-none focus:ring-0"
            required
          />
          <span className="text-sm text-gray-500 ml-1">miles</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Error Message */}
      {error && <div className="text-red-500">{error}</div>}

      {/* --- 6. MODIFIED: The results list --- */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold">Results</h2>
        {results.length === 0 && !loading && (
          <p>No deals found. Try another search.</p>
        )}
        <ul className="space-y-2">
          {results.map((deal) => (
            <li key={deal.id} className="border p-3 rounded-lg">
              <p className="text-lg font-medium">{deal.product_name}</p>
              <p className="text-xl font-bold text-green-600">
                ${deal.product_price.toFixed(2)}
              </p>
              <p className="text-gray-600">{deal.retailer}</p>
              <p className="text-sm text-gray-500">Zip: {deal.zip_code}</p>
              
              {/* Display distance in miles or "In your zip" */}
              {deal.distance_m != null ? (
                <p className="text-sm text-gray-500">
                  {(deal.distance_m / 1609.34).toFixed(1)} miles away
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  In your zip code
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}