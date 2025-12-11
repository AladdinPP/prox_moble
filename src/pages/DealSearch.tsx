// import React, { useState, useEffect } from 'react';
// import { supabase } from '@/integrations/supabase/client'; 
// import { Button } from '@/components/ui/button'; 
// import { Checkbox } from "@/components/ui/checkbox";
// import { Label } from "@/components/ui/label";
// import { Input } from '@/components/ui/input'; 
// import { useNavigate } from 'react-router-dom';
// import { Plus, Check, Home, ShoppingBag } from 'lucide-react'; // Added ShoppingBag icon
// import { getLatestRefreshDate, formatDistance } from '@/lib/dateUtils';
// import { useCart } from '@/contexts/CartContext';
// import { FloatingCart } from '@/components/FloatingCart';
// import { useToast } from '@/hooks/use-toast';

// type DealResult = {
//   id: number;
//   product_name: string;
//   product_price: number;
//   retailer: string;
//   zip_code: string; 
//   distance_m?: number;
//   image_link: string | null;
//   product_size: string | null;
//   retailer_logo_url: string | null;
// };

// const ITEMS_PER_PAGE = 10;
// const PLACEHOLDER_IMG = "https://via.placeholder.com/100x100.png?text=No+Image";

// const productMatchesFilter = (productName: string, filterTerm: string): boolean => {
//   const lowerProductName = productName.toLowerCase();
//   const keywords = filterTerm.trim().toLowerCase().split(/\s+/);
//   return keywords.every(keyword => lowerProductName.includes(keyword));
// };

// export function DealSearch() {
//   const navigate = useNavigate();
//   const { addToCart, items } = useCart(); // Get items for count
//   const { toast } = useToast();

//   const [searchTerm, setSearchTerm] = useState(''); 
//   const [zipcode, setZipcode] = useState(''); 
//   const [radius, setRadius] = useState('10'); 
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [processedResults, setProcessedResults] = useState<DealResult[]>([]);
//   const [results, setResults] = useState<DealResult[]>([]); 
//   const [searchedItems, setSearchedItems] = useState<string[]>([]);
//   const [activeFilters, setActiveFilters] = useState<string[]>([]);
//   const [currentPage, setCurrentPage] = useState(1);
//   const [addedItems, setAddedItems] = useState<Set<number>>(new Set());

//   const handleAdd = (e: React.MouseEvent, deal: DealResult) => {
//     e.stopPropagation(); 
    
//     addToCart({
//       name: deal.product_name,
//       size: deal.product_size || '',
//       brand: deal.retailer, 
//       details: '',
//       price: deal.product_price,
//       retailer: deal.retailer,
//       logo: deal.retailer_logo_url
//     });

//     toast({
//       title: "Added to Cart",
//       description: `${deal.product_name} is in your basket.`,
//       duration: 2000,
//     });

//     setAddedItems(prev => new Set(prev).add(deal.id));
//     setTimeout(() => {
//       setAddedItems(prev => {
//         const next = new Set(prev);
//         next.delete(deal.id);
//         return next;
//       });
//     }, 2000);
//   };

//   const handleSearch = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);
//     setResults([]);
//     setProcessedResults([]); 
//     setSearchedItems([]);
//     setActiveFilters([]);
//     setCurrentPage(1); 

//     const searchTerms = searchTerm.split(';')
//       .map(term => term.trim()) 
//       .filter(term => term.length > 0); 

//     if (searchTerms.length === 0) {
//       setError('Please enter at least one item name.');
//       setLoading(false);
//       return;
//     }
//     const radiusNum = parseInt(radius, 10);
//     if (!/^\d{5}$/.test(zipcode)) {
//       setError('Please enter a valid 5-digit zip code.');
//       setLoading(false);
//       return;
//     }
//     if (isNaN(radiusNum) || radiusNum <= 0) {
//       setError('Please enter a search radius greater than 0.');
//       setLoading(false);
//       return;
//     }

//     try {
//       const minDate = getLatestRefreshDate();

//       const { data, error } = await supabase
//         .rpc('find_all_deals_v3', { 
//           user_zip: zipcode, 
//           search_terms: searchTerms, 
//           radius_meters: Math.round(radiusNum * 1609.34), 
//           min_date: minDate,
//           max_rows: 500
//         });

//       if (error) throw error;
      
//       let rawData: DealResult[] = [];
//       if (data && data.length > 0) {
//         rawData = data as DealResult[];
//       }
      
//       if (rawData.length > 0) {
//         setProcessedResults(rawData); 
//         setSearchedItems(searchTerms); 
//         setActiveFilters(searchTerms); 
//       } else {
//         setError("No recent deals found for this search.");
//         setResults([]); 
//       }

//     } catch (err: any) {
//       console.error('Error fetching deals:', err);
//       setError(err.message || 'Failed to fetch deals.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (processedResults.length === 0) {
//       setResults([]);
//       return;
//     }
//     const filteredDeals = processedResults.filter(deal => {
//       return activeFilters.some(filter => 
//         productMatchesFilter(deal.product_name, filter)
//       );
//     });
//     const totalPages = Math.ceil(filteredDeals.length / ITEMS_PER_PAGE);
//     const newCurrentPage = Math.min(currentPage, totalPages) || 1;
//     setCurrentPage(newCurrentPage);
//     const startIndex = (newCurrentPage - 1) * ITEMS_PER_PAGE;
//     const endIndex = startIndex + ITEMS_PER_PAGE;
//     setResults(filteredDeals.slice(startIndex, endIndex));
//   }, [processedResults, activeFilters, currentPage]); 

//   const handleFilterChange = (checked: boolean, item: string) => {
//     setActiveFilters(prevFilters => {
//       if (checked) {
//         return [...prevFilters, item];
//       } else {
//         return prevFilters.filter(f => f !== item);
//       }
//     });
//     setCurrentPage(1); 
//   };
  
//   const totalPages = Math.ceil(
//     processedResults.filter(deal => 
//       activeFilters.some(filter => 
//         productMatchesFilter(deal.product_name, filter)
//       )
//     ).length / ITEMS_PER_PAGE
//   );

//   const handleNextPage = () => {
//     setCurrentPage(prev => Math.min(prev + 1, totalPages));
//   };

//   const handlePrevPage = () => {
//     setCurrentPage(prev => Math.max(prev - 1, 1));
//   };

//   return (
//     <div className="min-h-screen bg-gradient-background text-foreground pb-24">
//       <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        
//         {/* --- HERO CARD --- */}
//         <div className="rounded-3xl border border-border/60 bg-card shadow-soft px-5 py-4">
//           <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//             <div className="space-y-2">
//               <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
//                 <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_theme(colors.accent.DEFAULT)]" />
//                 Weekly deals · Prox
//               </div>

//               <div className="flex items-center gap-2">
//                               <Button 
//                                 variant="ghost" 
//                                 size="icon" 
//                                 className="-ml-2 h-8 w-8" 
//                                 onClick={() => navigate('/cart-finder')}
//                               >
//                                 <img 
//                                   src="/Icon-01.png" 
//                                   alt="Prox Logo" 
//                                   className="h-5 w-5 object-contain opacity-80"
//                                 />
//                               </Button>
//                 <h1 className="text-2xl font-semibold tracking-tight">
//                   Grocery deal finder
//                 </h1>
//               </div>

//               <p className="text-sm text-muted-foreground">
//                 Search for a product and instantly see who has the best price around you.
//               </p>
//             </div>

//             {/* ⬇️ UPDATED: Buttons for Optimizer and Cart */}
//             <div className="mt-2 sm:mt-0 flex flex-wrap gap-2">
//               <Button
//                 size="sm"
//                 variant="outline"
//                 onClick={() => navigate("/cart-finder")}
//                 className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
//               >
//                 Cart Optimizer →
//               </Button>
//               <Button 
//                 size="sm" 
//                 variant="outline"
//                 onClick={() => navigate('/cart')}
//                 className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
//               >
//                 <ShoppingBag className="h-4 w-4" />
//                 Cart Result ({items.length})
//               </Button>
//             </div>
//           </div>
//         </div>

//         {/* ... (Rest of the file remains the same: Search Card, Results, Floating Cart) ... */}
        
//         {/* --- SEARCH + FILTERS CARD --- */}
//         <div className="rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5 space-y-5">
//           <form onSubmit={handleSearch} className="space-y-4">
//             <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              
//               {/* Product Input */}
//               <div className="flex flex-col gap-1.5">
//                 <Label htmlFor="searchTerm" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
//                   Product
//                 </Label>
//                 <Input
//                   id="searchTerm"
//                   type="text"
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   placeholder="e.g., orange juice; chicken thighs; cereal"
//                   className="text-sm"
//                 />
//                 <p className="mt-1 text-[11px] text-muted-foreground">
//                   You can search multiple items at once by separating them with a semicolon <span className="font-mono">;</span>.
//                 </p>
//               </div>

//               {/* Zip Input */}
//               <div className="flex flex-col gap-1.5">
//                 <Label htmlFor="zipcode" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
//                   Zip code
//                 </Label>
//                 <Input
//                   id="zipcode"
//                   type="text"
//                   value={zipcode}
//                   onChange={(e) => setZipcode(e.target.value)}
//                   placeholder="e.g., 90025"
//                   className="text-sm"
//                 />
//               </div>

//               {/* Radius Input */}
//               <div className="flex flex-col gap-1.5">
//                 <Label htmlFor="radius" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
//                   Radius (miles)
//                 </Label>
//                 <Input
//                   id="radius"
//                   type="number"
//                   min="1"
//                   value={radius}
//                   onChange={(e) => setRadius(e.target.value)}
//                   placeholder="10"
//                   className="text-sm"
//                 />
//               </div>
//             </div>

//             <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
//               <Button
//                 type="submit"
//                 disabled={loading}
//                 className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
//               >
//                 {loading ? "Searching..." : "Search deals"}
//               </Button>

//               {error && (
//                 <span className="text-xs font-medium text-red-600 sm:text-right">
//                   {error}
//                 </span>
//               )}
//             </div>
            
//             <p className="text-[10px] text-gray-400 text-right pt-1">Prices reflect the most recent weekly update.</p>
//           </form>

//           {/* Filters (Pills) */}
//           {searchedItems.length > 0 && (
//             <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
//               <div className="flex items-center justify-between gap-2">
//                 <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
//                   Filter by search term
//                 </p>
//                 {activeFilters.length > 0 && (
//                   <button
//                     type="button"
//                     onClick={() => setActiveFilters([])}
//                     className="text-[11px] font-medium text-green-600 hover:underline"
//                   >
//                     Clear filters
//                   </button>
//                 )}
//               </div>
//               <div className="flex flex-wrap gap-3">
//                 {searchedItems.map((item) => (
//                   <label
//                     key={item}
//                     className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs cursor-pointer hover:bg-card"
//                   >
//                     <Checkbox
//                       checked={activeFilters.includes(item)}
//                       onCheckedChange={(checked) =>
//                         handleFilterChange(checked === true, item)
//                       }
//                     />
//                     <span className="truncate">{item}</span>
//                   </label>
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* --- RESULTS CARD --- */}
//         <div className="space-y-4 rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5">
//           <div className="flex items-center justify-between gap-2">
//             <h2 className="text-base font-semibold">Results</h2>
//             {processedResults.length > 0 && (
//               <span className="text-xs text-muted-foreground">
//                 Showing {results.length} of {processedResults.length} matching deals
//               </span>
//             )}
//           </div>

//           {results.length === 0 && !loading && (
//             <p className="text-sm text-muted-foreground py-8 text-center">
//               No deals found yet. Try a different product, radius, or zip code.
//             </p>
//           )}

//           <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
//             {results.map((deal) => {
//               const isAdded = addedItems.has(deal.id);
//               return (
//                 <li
//                   key={deal.id}
//                   className="flex flex-col rounded-xl border border-border/60 bg-background/50 p-3 relative transition-shadow hover:shadow-md"
//                 >
//                   <img
//                     src={deal.image_link || PLACEHOLDER_IMG}
//                     alt={deal.product_name}
//                     className="h-32 w-full flex-shrink-0 rounded-md border bg-gray-50 object-cover"
//                     onError={(e) => {
//                       e.currentTarget.src = PLACEHOLDER_IMG;
//                     }}
//                   />
//                   <div className="min-w-0 flex-1 pt-2 pb-8"> 
//                     <p className="truncate text-sm font-semibold text-foreground">
//                       {deal.product_name}
//                     </p>
//                     {deal.product_size && (
//                       <p className="text-xs text-muted-foreground">
//                         Size: {deal.product_size}
//                       </p>
//                     )}
//                     <p className="mt-1 text-lg font-bold text-green-600">
//                       ${deal.product_price.toFixed(2)}
//                     </p>
                    
//                     <div className="flex items-center gap-2 mt-1">
//                       {deal.retailer_logo_url && (
//                         <img src={deal.retailer_logo_url} alt="logo" className="h-4 w-auto object-contain" />
//                       )}
//                       <p className="text-xs text-muted-foreground">
//                         {deal.retailer}
//                       </p>
//                     </div>
                    
//                     {deal.distance_m != null && (
//                       <p className="text-[11px] text-muted-foreground mt-0.5">
//                         {formatDistance(deal.distance_m)}
//                       </p>
//                     )}
//                   </div>

//                   {/* Add to Cart Button */}
//                   <div className="absolute bottom-3 right-3">
//                     <Button 
//                       size="icon" 
//                       className={`h-8 w-8 rounded-full shadow-md transition-all ${isAdded ? "bg-prox text-white hover:bg-prox-hover" : "bg-white text-green-600 border border-green-200 hover:bg-green-50"}`}
//                       onClick={(e) => handleAdd(e, deal)}
//                     >
//                       {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
//                     </Button>
//                   </div>
//                 </li>
//               );
//             })}
//           </ul>

//           {/* Pagination */}
//           {totalPages > 1 && (
//             <div className="mt-4 flex items-center justify-center gap-3 text-xs border-t pt-4">
//               <Button
//                 variant="outline"
//                 onClick={handlePrevPage}
//                 disabled={currentPage === 1}
//                 className="rounded-full px-3 py-1 text-xs h-8"
//               >
//                 Previous
//               </Button>
//               <span className="text-muted-foreground">
//                 Page {currentPage} of {totalPages}
//               </span>
//               <Button
//                 variant="outline"
//                 onClick={handleNextPage}
//                 disabled={currentPage === totalPages}
//                 className="rounded-full px-3 py-1 text-xs h-8"
//               >
//                 Next
//               </Button>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Floating Cart Widget */}
//       <FloatingCart />
//     </div>
//   );
// }

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useNavigate } from 'react-router-dom';
import { Plus, Check, ShoppingBag } from 'lucide-react';
import { getLatestRefreshDate, formatDistance } from '@/lib/dateUtils';
import { useCart } from '@/contexts/CartContext';
import { FloatingCart } from '@/components/FloatingCart';
import { useToast } from '@/hooks/use-toast';

type DealResult = {
  id: number;
  product_name: string;
  product_price: number;
  retailer: string;
  zip_code: string;
  distance_m?: number;
  image_link: string | null;
  product_size: string | null;
  retailer_logo_url: string | null;
};

type EditableItem = {
  name: string;
  brand: string;
  size: string;
  details: string;
};

const ITEMS_PER_PAGE = 10;
const PLACEHOLDER_IMG = "https://via.placeholder.com/100x100.png?text=No+Image";

const productMatchesFilter = (productName: string, filterTerm: string): boolean => {
  const lowerProductName = productName.toLowerCase();
  const keywords = filterTerm.trim().toLowerCase().split(/\s+/);
  return keywords.every(keyword => lowerProductName.includes(keyword));
};

export function DealSearch() {
  const navigate = useNavigate();
  const { addToCart, items } = useCart();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [radius, setRadius] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [processedResults, setProcessedResults] = useState<DealResult[]>([]);
  const [results, setResults] = useState<DealResult[]>([]);
  const [searchedItems, setSearchedItems] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());

  const [sortOption, setSortOption] = useState<'none' | 'price-asc' | 'price-desc'>('none');
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);

  const handleAdd = (e: React.MouseEvent, deal: DealResult) => {
    e.stopPropagation();

    addToCart({
      name: deal.product_name,
      size: deal.product_size || '',
      brand: deal.retailer,
      details: '',
      price: deal.product_price,
      retailer: deal.retailer,
      logo: deal.retailer_logo_url
    });

    toast({
      title: "Added to Cart",
      description: `${deal.product_name} is in your basket.`,
      duration: 2000,
    });

    setAddedItems(prev => {
      const next = new Set(prev);
      next.add(deal.id);
      return next;
    });

    setTimeout(() => {
      setAddedItems(prev => {
        const next = new Set(prev);
        next.delete(deal.id);
        return next;
      });
    }, 2000);
  };

  // Shared search executor used by initial search and refine search
  const executeSearch = async (searchTerms: string[]) => {
    setError(null);

    if (searchTerms.length === 0) {
      setError('Please enter at least one item name.');
      return;
    }

    const radiusNum = parseInt(radius, 10);
    if (!/^\d{5}$/.test(zipcode)) {
      setError('Please enter a valid 5-digit zip code.');
      return;
    }
    if (isNaN(radiusNum) || radiusNum <= 0) {
      setError('Please enter a search radius greater than 0.');
      return;
    }

    setLoading(true);
    setResults([]);
    setProcessedResults([]);
    setSearchedItems([]);
    setActiveFilters([]);
    setCurrentPage(1);

    try {
      const minDate = getLatestRefreshDate();

      const { data, error } = await supabase
        .rpc('find_all_deals_v3', {
          user_zip: zipcode,
          search_terms: searchTerms,
          radius_meters: Math.round(radiusNum * 1609.34),
          min_date: minDate,
          max_rows: 500
        });

      if (error) throw error;

      let rawData: DealResult[] = [];
      if (data && data.length > 0) {
        rawData = data as DealResult[];
      }

      if (rawData.length > 0) {
        setProcessedResults(rawData);
        setSearchedItems(searchTerms);
        setActiveFilters(searchTerms);
      } else {
        setError("No recent deals found for this search.");
        setResults([]);
      }

    } catch (err: any) {
      console.error('Error fetching deals:', err);
      setError(err.message || 'Failed to fetch deals.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    const searchTerms = searchTerm.split(';')
      .map(term => term.trim())
      .filter(term => term.length > 0);

    // initialize editable items for refine UI (name = original term)
    setEditableItems(
      searchTerms.map(term => ({
        name: term,
        brand: '',
        size: '',
        details: ''
      }))
    );

    await executeSearch(searchTerms);
  };

  const handleEditRefineItem = (
    idx: number,
    field: keyof EditableItem,
    value: string
  ) => {
    setEditableItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleRefineSearch = async () => {
    const refinedTerms = editableItems
      .map(item =>
        `${item.name} ${item.brand} ${item.size} ${item.details}`.trim()
      )
      .filter(term => term.length > 0);

    await executeSearch(refinedTerms);
  };

  useEffect(() => {
    if (processedResults.length === 0) {
      setResults([]);
      return;
    }

    // Apply filters
    let filteredDeals = processedResults.filter(deal =>
      activeFilters.some(filter =>
        productMatchesFilter(deal.product_name, filter)
      )
    );

    // Apply sorting
    if (sortOption === 'price-asc') {
      filteredDeals = [...filteredDeals].sort(
        (a, b) => a.product_price - b.product_price
      );
    } else if (sortOption === 'price-desc') {
      filteredDeals = [...filteredDeals].sort(
        (a, b) => b.product_price - a.product_price
      );
    }

    const totalPages = Math.ceil(filteredDeals.length / ITEMS_PER_PAGE);
    const newCurrentPage = Math.min(currentPage, totalPages) || 1;
    setCurrentPage(newCurrentPage);

    const startIndex = (newCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setResults(filteredDeals.slice(startIndex, endIndex));
  }, [processedResults, activeFilters, currentPage, sortOption]);

  const handleFilterChange = (checked: boolean, item: string) => {
    setActiveFilters(prevFilters => {
      if (checked) {
        return [...prevFilters, item];
      } else {
        return prevFilters.filter(f => f !== item);
      }
    });
    setCurrentPage(1);
  };

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
    <div className="min-h-screen bg-gradient-background text-foreground pb-24">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">

        {/* --- HERO CARD --- */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-soft px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_theme(colors.accent.DEFAULT)]" />
                Weekly deals · Prox
              </div>

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
                  Grocery deal finder
                </h1>
              </div>

              <p className="text-sm text-muted-foreground">
                Search for a product and instantly see who has the best price around you.
              </p>
            </div>

            {/* Buttons for Optimizer and Cart */}
            <div className="mt-2 sm:mt-0 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/cart-finder")}
                className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
              >
                Cart Optimizer →
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/cart')}
                className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
              >
                <ShoppingBag className="h-4 w-4" />
                Cart Result ({items.length})
              </Button>
            </div>
          </div>
        </div>

        {/* --- SEARCH + FILTERS CARD --- */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5 space-y-5">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">

              {/* Product Input */}
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="searchTerm"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Product
                </Label>
                <Input
                  id="searchTerm"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g., orange juice; chicken thighs; cereal"
                  className="text-sm"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  You can search multiple items at once by separating them with a semicolon <span className="font-mono">;</span>.
                </p>
              </div>

              {/* Zip Input */}
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
                  value={zipcode}
                  onChange={(e) => setZipcode(e.target.value)}
                  placeholder="e.g., 90025"
                  className="text-sm"
                />
              </div>

              {/* Radius Input */}
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
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
              >
                {loading ? "Searching..." : "Search deals"}
              </Button>

              {error && (
                <span className="text-xs font-medium text-red-600 sm:text-right">
                  {error}
                </span>
              )}
            </div>

            <p className="text-[10px] text-gray-400 text-right pt-1">
              Prices reflect the most recent weekly update.
            </p>
          </form>

          {/* Filters (Pills) */}
          {searchedItems.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Filter by search term
                </p>
                {activeFilters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveFilters([])}
                    className="text-[11px] font-medium text-green-600 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {searchedItems.map((item) => (
                  <label
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs cursor-pointer hover:bg-card"
                  >
                    <Checkbox
                      checked={activeFilters.includes(item)}
                      onCheckedChange={(checked) =>
                        handleFilterChange(checked === true, item)
                      }
                    />
                    <span className="truncate">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* --- REFINE SEARCH CARD (single-item style) --- */}
        {processedResults.length > 0 && editableItems.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5 space-y-3">
            <h2 className="text-lg font-semibold">2. Refine search</h2>

            <div className="flex flex-col gap-2 mb-2">
              <div className="grid grid-cols-4 gap-2 text-sm font-semibold text-gray-600">
                <span>Name</span>
                <span>Brand</span>
                <span>Size</span>
                <span>Details</span>
              </div>

              {editableItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2">
                  <Input
                    value={item.name}
                    onChange={e =>
                      handleEditRefineItem(idx, 'name', e.target.value)
                    }
                    className="text-xs px-2 h-8"
                  />
                  <Input
                    value={item.brand}
                    onChange={e =>
                      handleEditRefineItem(idx, 'brand', e.target.value)
                    }
                    className="text-xs px-2 h-8"
                  />
                  <Input
                    value={item.size}
                    onChange={e =>
                      handleEditRefineItem(idx, 'size', e.target.value)
                    }
                    className="text-xs px-2 h-8"
                  />
                  <Input
                    value={item.details}
                    onChange={e =>
                      handleEditRefineItem(idx, 'details', e.target.value)
                    }
                    className="text-xs px-2 h-8"
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={handleRefineSearch}
              disabled={loading}
              className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm"
            >
              {loading ? 'Refining…' : 'Re-run search'}
            </Button>
          </div>
        )}

        {/* --- RESULTS CARD --- */}
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Results</h2>
              {processedResults.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Showing {results.length} of {processedResults.length} matching deals
                </span>
              )}
            </div>

            {processedResults.length > 0 && (
              <Select
                value={sortOption}
                onValueChange={(value) =>
                  setSortOption(value as 'none' | 'price-asc' | 'price-desc')
                }
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default order</SelectItem>
                  <SelectItem value="price-asc">Price: Low to High</SelectItem>
                  <SelectItem value="price-desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {results.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No deals found yet. Try a different product, radius, or zip code.
            </p>
          )}

          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((deal) => {
              const isAdded = addedItems.has(deal.id);
              return (
                <li
                  key={deal.id}
                  className="flex flex-col rounded-xl border border-border/60 bg-background/50 p-3 relative transition-shadow hover:shadow-md"
                >
                  <img
                    src={deal.image_link || PLACEHOLDER_IMG}
                    alt={deal.product_name}
                    className="h-32 w-full flex-shrink-0 rounded-md border bg-gray-50 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMG;
                    }}
                  />
                  <div className="min-w-0 flex-1 pt-2 pb-8">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {deal.product_name}
                    </p>
                    {deal.product_size && (
                      <p className="text-xs text-muted-foreground">
                        Size: {deal.product_size}
                      </p>
                    )}
                    <p className="mt-1 text-lg font-bold text-green-600">
                      ${deal.product_price.toFixed(2)}
                    </p>

                    <div className="flex items-center gap-2 mt-1">
                      {deal.retailer_logo_url && (
                        <img
                          src={deal.retailer_logo_url}
                          alt="logo"
                          className="h-4 w-auto object-contain"
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        {deal.retailer}
                      </p>
                    </div>

                    {deal.distance_m != null && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistance(deal.distance_m)}
                      </p>
                    )}
                  </div>

                  {/* Add to Cart Button */}
                  <div className="absolute bottom-3 right-3">
                    <Button
                      size="icon"
                      className={`h-8 w-8 rounded-full shadow-md transition-all ${
                        isAdded
                          ? "bg-prox text-white hover:bg-prox-hover"
                          : "bg-white text-green-600 border border-green-200 hover:bg-green-50"
                      }`}
                      onClick={(e) => handleAdd(e, deal)}
                    >
                      {isAdded ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-xs border-t pt-4">
              <Button
                variant="outline"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="rounded-full px-3 py-1 text-xs h-8"
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="rounded-full px-3 py-1 text-xs h-8"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Cart Widget */}
      <FloatingCart />
    </div>
  );
}
