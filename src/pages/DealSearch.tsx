// src/pages/DealSearch.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getLatestRefreshDate, formatDistance } from '@/lib/dateUtils';
import { useCart } from '@/contexts/CartContext';
import { FloatingCart } from '@/components/FloatingCart';
import { Home, Plus, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  product_size: string | null;
  retailer_logo_url: string | null;
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
  const { addToCart, items } = useCart();
  const { toast } = useToast();
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const handleAdd = (deal: DealResult) => {
    alert(`Added ${deal.product_name}`);
    addToCart({
      name: deal.product_name,
      size: deal.product_size || '',
      brand: '',
      details: '',
      price: deal.product_price,
      retailer: deal.retailer,
      logo: deal.retailer_logo_url,
    });
    // 1. Show Toast Notification
    toast({
      title: "Added to Cart",
      description: `${deal.product_name} is in your basket.`,
      duration: 2000,
    });

    // 2. Show Checkmark on Button
    setAddedItems(prev => new Set(prev).add(deal.id));
    
    // Revert checkmark after 2 seconds
    setTimeout(() => {
      setAddedItems(prev => {
        const next = new Set(prev);
        next.delete(deal.id);
        return next;
      });
    }, 2000);
  }

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
      // ⬇️ NEW: Calculate minDate
      const minDate = getLatestRefreshDate();

      // --- Call new RPCs with the array ---
      let rawData: DealResult[] = [];
      const meters = Math.round(radiusNum * 1609.34);

      const { data, error: e2 } = await supabase
        .rpc('find_all_deals_v3', { 
          user_zip: zipcode, 
          search_terms: searchTerms, // Pass the array
          radius_meters: meters, 
          min_date: minDate,
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
    <div className="container mx-auto p-4 max-w-2xl pb-24"> {/* Limit width for better mobile view */}
      
      {/* New Header with Link */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <Home className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Deal Finder</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/cart-finder')}>
          Cart Optimizer →
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/cart')}>
          View Cart ({items.length}) {/* Show count */}
        </Button>
      </div>
      
      <form onSubmit={handleSearch} className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g., milk; chicken"
            className="border p-2 rounded-md flex-grow shadow-sm" 
            required
          />
          <div className="flex gap-2">
            <input
              type="text" 
              maxLength={5} 
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              placeholder="Zip Code"
              className="border p-2 rounded-md w-24 shadow-sm" 
              required
            />
            <div className="flex items-center border p-2 rounded-md w-24 bg-white shadow-sm">
              <input
                type="number" 
                min="1"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                placeholder="10"
                className="border-none p-0 w-full focus:outline-none focus:ring-0 text-center"
                required
              />
              <span className="text-sm text-gray-500 ml-1">mi</span>
            </div>
          </div>
        </div>
        
        <Button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md w-full shadow-sm"
        >
          {loading ? 'Searching...' : 'Find Deals'}
        </Button>
        
        <div className="flex justify-between text-xs text-gray-500 px-1">
          <p>Separate multiple items with a semicolon ( ; ).</p>
          <p>Prices reflect the most recent weekly update.</p> {/* ⬅️ Note Added */}
        </div>
      </form>
      
      {error && <div className="text-red-500 bg-red-50 p-3 rounded-md mb-4 text-sm font-medium">{error}</div>}

      {searchedItems.length > 0 && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-gray-700">Filter Results</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
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
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  {item}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        {results.length === 0 && !loading && processedResults.length === 0 && (
           <p className="text-center text-gray-500 mt-8">No recent deals found. Try adjusting your search.</p>
        )}
        <ul className="space-y-3">
          {results.map((deal) => {
            const isAdded = addedItems.has(deal.id);

            return (
              <li 
                key={deal.id} 
                className="border p-3 rounded-lg flex gap-4 bg-white shadow-sm relative"
              >
                {/* Product Image */}
                <div className="w-20 h-20 flex-shrink-0 bg-white rounded-md overflow-hidden border">
                  <img
                    src={deal.image_link || PLACEHOLDER_IMG}
                    alt={deal.product_name}
                    className="w-full h-full object-contain"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                  />
                </div>
                
                {/* Content */}
                <div className="flex-grow min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-gray-900 truncate pr-2">{deal.product_name}</p>
                    <p className="text-lg font-bold text-green-700 whitespace-nowrap">${deal.product_price.toFixed(2)}</p>
                  </div>
                  
                  {deal.product_size && (
                    <p className="text-sm text-gray-500 mb-1">{deal.product_size}</p>
                  )}

                  {/* ⬇️ NEW: Retailer Row with Logo & Distance */}
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-700">
                    {deal.retailer_logo_url && (
                      <img src={deal.retailer_logo_url} alt="logo" className="h-4 w-auto object-contain" />
                    )}
                    <span className="font-medium">
                      {deal.retailer} 
                      <span className="text-gray-500 font-normal ml-1">
                        ({formatDistance(deal.distance_m)})
                      </span>
                    </span>
                  </div>
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Button 
                    size="icon" 
                    variant={isAdded ? "default" : "secondary"} // Change style on click
                    className={`h-10 w-10 rounded-full transition-all ${isAdded ? "bg-green-600 text-white" : "bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"}`}
                    onClick={() => handleAdd(deal)}
                  >
                    {/* Swap icon on click */}
                    {isAdded ? <Check className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
              Previous
            </Button>
            <span className="text-xs text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
              Next
            </Button>
          </div>
        )}
      </div>
      <FloatingCart />
    </div>
  );
}