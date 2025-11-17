// src/pages/DealSearch.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
// Import Checkbox components
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// --- Updated data types ---
// Note: distance_m is optional, as the exact-zip RPC doesn't return it.
type DealResult = {
  id: number;
  product_name: string;
  product_price: number;
  retailer: string;
  zip_code: string; // Zip code is now TEXT
  distance_m?: number;
  image_link: string | null;
};

const ITEMS_PER_PAGE = 10;

// Placeholder image URL
const PLACEHOLDER_IMG = "https://via.placeholder.com/100x100.png?text=No+Image";

/**
 * Helper function to match the SQL "AND" logic
 * This checks if a product name contains ALL keywords from a filter term.
 */
const productMatchesFilter = (productName: string, filterTerm: string): boolean => {
  const lowerProductName = productName.toLowerCase();
  // Split "vitamin d milk" into ['vitamin', 'd', 'milk']
  const keywords = filterTerm.trim().toLowerCase().split(/\s+/);
  
  // Check if the product name includes EVERY keyword
  return keywords.every(keyword => lowerProductName.includes(keyword));
};

export function DealSearch() {
  // --- MODIFIED: State updates ---
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [zipcode, setZipcode] = useState(''); // Zip code is now a string
  const [radius, setRadius] = useState('10'); // New state for radius
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [results, setResults] = useState<DealResult[]>([]); // This holds the *current page* of results
  const [processedResults, setProcessedResults] = useState<DealResult[]>([]); // This holds *all* results
  // --- State for filtering ---
  // Holds the items from the search (e.g., ['milk', 'chicken'])
  const [searchedItems, setSearchedItems] = useState<string[]>([]);
  // Holds the *currently checked* filters (e.g., ['milk'])
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  /**
   * --- Filters RPC results ---
   * This function implements the "one result per retailer" logic.
   * Both RPC functions sort results (by price or distance),
   * so we just need to take the *first* one we see for each retailer.
   */
  // --- The search handler logic ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setProcessedResults([]); // Clear old results
    setSearchedItems([]);
    setActiveFilters([]);
    setCurrentPage(1); // Reset to page 1

    // --- Parse multi-item search term ---
    const searchTerms = searchTerm.split(';')
      .map(term => term.trim()) // Remove whitespace
      .filter(term => term.length > 0); // Remove empty strings

    if (searchTerms.length === 0) {
      setError('Please enter at least one item name.');
      setLoading(false);
      return;
    }

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
      // --- Call new RPCs with the array ---
      let rawData: DealResult[] = [];
      const meters = Math.round(radiusNum * 1609.34);

      const { data, error: e2 } = await supabase
        .rpc('find_all_deals_v2', { 
          user_zip: zipcode, 
          search_terms: searchTerms, // Pass the array
          radius_meters: meters, 
          max_rows: 500 
        });

      if (e2) throw e2;
      
      if (data && data.length > 0) {
        rawData = data as DealResult[];
      }
      if (rawData.length > 0) {
        // const allFilteredDeals = processResults(rawData);
        setProcessedResults(rawData); // Store all deals
        // Set up filters
        setSearchedItems(searchTerms); // For building the UI
        setActiveFilters(searchTerms); // For filtering (default all)
      } else {
        setError('No deals found for the given search criteria.');
        setResults([]); 
      }

    } catch (err: any) {
      console.error('Error fetching deals:', err);
      setError(err.message || 'Failed to fetch deals.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * --- Effect to filter and paginate results ---
   * This effect runs whenever the "master list" or "active filters" change.
   */
  useEffect(() => {
    if (processedResults.length === 0) {
      setResults([]);
      return;
    }

    // 1. Filter the master list
    const filteredDeals = processedResults.filter(deal => {
      // Check if the deal's product name contains ANY of the *active* filters
      return activeFilters.some(filter => 
        productMatchesFilter(deal.product_name, filter)
      );
    });

    // 2. Paginate the filtered list
    const totalPages = Math.ceil(filteredDeals.length / ITEMS_PER_PAGE);
    const newCurrentPage = Math.min(currentPage, totalPages) || 1;
    setCurrentPage(newCurrentPage);
    
    const startIndex = (newCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    
    setResults(filteredDeals.slice(startIndex, endIndex));

  }, [processedResults, activeFilters, currentPage]); // Re-run when these change


  // --- Handler for changing filters ---
  const handleFilterChange = (checked: boolean, item: string) => {
    setActiveFilters(prevFilters => {
      if (checked) {
        // Add item to filter
        return [...prevFilters, item];
      } else {
        // Remove item from filter
        return prevFilters.filter(f => f !== item);
      }
    });
    // Reset to page 1 when filters change
    setCurrentPage(1); 
  };
  
  // --- Pagination handlers ---
  const totalPages = Math.ceil(
    processedResults.filter(deal => 
      activeFilters.some(filter => 
        productMatchesFilter(deal.product_name, filter)
      )
    ).length / ITEMS_PER_PAGE
  );

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  return (
    <div className="container mx-auto p-4">
      {/* ⬇️ NEW: Button to link to the new page ⬇️ */}
      <div className="mb-4 p-4 border rounded-lg bg-gray-50/50">
        <h2 className="text-xl font-semibold">Want to optimize your whole cart?</h2>
        <p className="text-gray-600 mb-2">Find the single cheapest store for all your items.</p>
        <button onClick={() => navigate('/cart-finder')}>
          Use Cart Optimizer
        </button>
      </div>
      <h1 className="text-2xl font-bold mb-4">Grocery Deal Finder</h1>
      
      {/* --- The search form --- */}
      <form onSubmit={handleSearch} className="flex flex-col gap-1 mb-4">
        
        {/* --- 1. The Row of Inputs & Buttons --- */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Item Search Input */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g., milk; chicken"
            className="border p-2 rounded-md flex-grow" // flex-grow
            required
          />

          {/* Zip Code Input */}
          <input
            type="text" 
            maxLength={5} 
            value={zipcode}
            onChange={(e) => setZipcode(e.target.value)}
            placeholder="Zip Code"
            className="border p-2 rounded-md sm:w-32" 
            required
          />
          
          {/* Radius Input */}
          <div className="flex items-center border p-2 rounded-md sm:w-32">
            <input
              type="number" 
              min="1"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="Radius"
              className="border-none p-0 w-full focus:outline-none focus:ring-0"
              required
            />
            <span className="text-sm text-gray-500 ml-1">miles</span>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* --- 2. The Instruction Text (now outside the row) --- */}
        <p className="text-xs text-gray-500 mt-1">
          To search multiple items, separate them with a semicolon ( ; ).
        </p>
      
      </form>

      {/* Error Message */}
      {error && <div className="text-red-500">{error}</div>}

      {/* --- Filter UI --- */}
      {searchedItems.length > 0 && (
        <div className="mb-4 p-4 border rounded-lg">
          <h3 className="font-semibold mb-2">Filter Results</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {searchedItems.map(item => (
              <div key={item} className="flex items-center space-x-2">
                <Checkbox
                  id={`filter-${item}`}
                  checked={activeFilters.includes(item)}
                  onCheckedChange={(checked) => {
                    handleFilterChange(checked as boolean, item);
                  }}
                />
                <Label
                  htmlFor={`filter-${item}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {item}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- The results list --- */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold">Results</h2>
        {results.length === 0 && !loading && (
          <p>No deals found. Try another search.</p>
        )}
        <ul className="space-y-2">
          {results.map((deal) => (
            <li key={deal.id} className="border p-3 rounded-lg flex items-center gap-4">
              <img src={deal.image_link || PLACEHOLDER_IMG} alt={deal.product_name} 
              className="w-20 h-20 object-cover rounded-md border bg-gray-50"
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER_IMG;
              }} />
              <div>
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
              </div>
            </li>
          ))}
        </ul>

        {/* --- Pagination Controls --- */}
        {processedResults.length > ITEMS_PER_PAGE && (
          <div className="flex justify-between items-center mt-4">
            <button
              variant="outline"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              variant="outline"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}