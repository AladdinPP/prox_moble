// src/pages/DealSearch.tsx

import React, { useState } from 'react';
// ⬇️ Adjust this import path if needed
import { supabase } from '@/integrations/supabase/client'; 

// --- Define your data types ---
type Deal = {
  id: number;
  created_at: string;
  retailer: string;
  zip_code: number;
  product_name: string;
  product_price: number;
};

// This type selects the columns we need for the results
type DealResult = Pick<Deal, 'id' | 'product_name' | 'product_price' | 'retailer' | 'zip_code'>;


export function DealSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [results, setResults] = useState<DealResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    let numericZipcode: number | null = null;
    if (zipcode.trim()) {
      numericZipcode = parseInt(zipcode.trim(), 10);
      if (isNaN(numericZipcode)) {
        setError('Please enter a valid numeric zip code.');
        setLoading(false);
        return; // Stop the search
      }
    }

    try {
      // This prevents any chance of the queries interfering.
      const getBaseQuery = () => supabase
        .from('flyer_deals')
        .select('id, product_name, product_price, retailer, zip_code')
        .ilike('product_name', `%${searchTerm}%`);


      if (numericZipcode !== null) {
        // --- 1. Try 5-digit EXACT match ---
        let { data, error } = await getBaseQuery()
          .eq('zip_code', numericZipcode)
          .order('product_price', { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          setResults(data as DealResult[]); // Found results, stop here.
          setLoading(false);
          return; 
        }

        // --- 2. No exact match, try 4-digit prefix match ---
        // e.g., 90045 -> range [90040, 90049]
        const zipStart4 = Math.floor(numericZipcode / 10) * 10; 
        const zipEnd4 = zipStart4 + 10; 

        ({ data, error } = await getBaseQuery()
          .gte('zip_code', zipStart4)
          .lt('zip_code', zipEnd4)
          .order('product_price', { ascending: true }));

        if (error) throw error;
        if (data && data.length > 0) {
          setResults(data as DealResult[]); // Found 4-digit results, stop here.
          setLoading(false);
          return; 
        }

        // --- 3. No 4-digit match, try 3-digit prefix match ---
        // e.g., 90045 -> range [90000, 90099]
        const zipStart3 = Math.floor(numericZipcode / 100) * 100;
        const zipEnd3 = zipStart3 + 100;

        ({ data, error } = await getBaseQuery()
          .gte('zip_code', zipStart3)
          .lt('zip_code', zipEnd3)
          .order('product_price', { ascending: true }));
        
        if (error) throw error;
        setResults(data as DealResult[]); // Set whatever we find (even empty)

      } else {
        // --- No zip code provided: Just search for the item ---
        const { data, error } = await getBaseQuery()
          .order('product_price', { ascending: true });
        
        if (error) throw error;
        setResults(data as DealResult[]);
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
      
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="e.g., 'milk', 'eggs'"
          className="border p-2 rounded-md flex-grow" // Main search
        />
        <input
          type="text" // Use "text" for simple input, "tel" can also work
          pattern="[0-9]*" // Helps mobile users get a number pad
          inputMode="numeric"
          value={zipcode}
          onChange={(e) => setZipcode(e.target.value)}
          placeholder="Zip Code (Optional)"
          className="border p-2 rounded-md sm:w-32" // Zip code input
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Error Message */}
      {error && <div className="text-red-500">Error: {error}</div>}

      {/* Results List */}
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// export default DealSearchPage; // Use this if you prefer default exports