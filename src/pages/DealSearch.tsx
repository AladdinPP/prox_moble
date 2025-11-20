// src/pages/DealSearch.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DealResult = {
  id: number;
  product_name: string;
  product_price: number;
  retailer: string;
  zip_code: string;
  distance_m?: number;
  image_link: string | null;
  product_size: string | null;
};

const ITEMS_PER_PAGE = 10;
const PLACEHOLDER_IMG =
  "https://via.placeholder.com/100x100.png?text=No+Image";

/**
 * Match SQL-style AND logic: product must contain *all* keywords
 */
const productMatchesFilter = (
  productName: string,
  filterTerm: string
): boolean => {
  const lowerProductName = productName.toLowerCase();
  const keywords = filterTerm.trim().toLowerCase().split(/\s+/);
  return keywords.every((keyword) => lowerProductName.includes(keyword));
};

export function DealSearch() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [radius, setRadius] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [results, setResults] = useState<DealResult[]>([]);
  const [processedResults, setProcessedResults] = useState<DealResult[]>([]);

  const [searchedItems, setSearchedItems] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // ---------- Search ----------

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setProcessedResults([]);
    setSearchedItems([]);
    setActiveFilters([]);
    setCurrentPage(1);

    const searchTerms = searchTerm
      .split(";")
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    const radiusNum = parseInt(radius, 10);

    if (searchTerms.length === 0) {
      setError("Please enter at least one item name.");
      setLoading(false);
      return;
    }
    if (!/^\d{5}$/.test(zipcode)) {
      setError("Please enter a valid 5-digit zip code.");
      setLoading(false);
      return;
    }
    if (isNaN(radiusNum) || radiusNum <= 0) {
      setError("Please enter a search radius greater than 0.");
      setLoading(false);
      return;
    }

    try {
      const meters = Math.round(radiusNum * 1609.34);

      const { data, error: e2 } = await supabase.rpc("find_all_deals_v2", {
        user_zip: zipcode,
        search_terms: searchTerms,
        radius_meters: meters,
        max_rows: 500,
      });

      if (e2) throw e2;

      if (!data || !Array.isArray(data) || data.length === 0) {
        setError(
          "No deals found for this search. Try another product, zip code, or radius."
        );
        setLoading(false);
        return;
      }

      const mappedResults: DealResult[] = data.map((row: any) => ({
        id: row.id,
        product_name: row.product_name,
        product_price: row.product_price,
        retailer: row.retailer,
        zip_code: row.zip_code,
        distance_m: row.distance_m ?? undefined,
        image_link: row.image_link ?? null,
        product_size: row.product_size ?? null,
      }));

      // We keep all rows; filtering is done client-side
      setProcessedResults(mappedResults);
      setSearchedItems(searchTerms);
      setActiveFilters(searchTerms); // start with all filters on
    } catch (err: any) {
      console.error("Error fetching deals:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Filtering + Pagination ----------

  useEffect(() => {
    if (processedResults.length === 0) {
      setResults([]);
      return;
    }

    const filteredDeals =
      activeFilters.length === 0
        ? processedResults
        : processedResults.filter((deal) =>
            activeFilters.some((filter) =>
              productMatchesFilter(deal.product_name, filter)
            )
          );

    const totalPages = Math.ceil(filteredDeals.length / ITEMS_PER_PAGE);
    const newCurrentPage = Math.min(currentPage, totalPages) || 1;
    setCurrentPage(newCurrentPage);

    const startIndex = (newCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setResults(filteredDeals.slice(startIndex, endIndex));
  }, [processedResults, activeFilters, currentPage]);

  const handleFilterChange = (checked: boolean, item: string) => {
    setActiveFilters((prevFilters) => {
      if (checked) {
        return [...prevFilters, item];
      } else {
        return prevFilters.filter((f) => f !== item);
      }
    });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(
    (activeFilters.length === 0
      ? processedResults
      : processedResults.filter((deal) =>
          activeFilters.some((filter) =>
            productMatchesFilter(deal.product_name, filter)
          )
        )
    ).length / ITEMS_PER_PAGE
  );

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  // ---------- UI ----------

  return (
    <div className="min-h-screen bg-gradient-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Hero */}
        <div className="rounded-3xl border border-border/60 bg-card shadow-soft px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_theme(colors.accent.DEFAULT)]" />
                Weekly deals · Prox
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Grocery deal finder
              </h1>
              <p className="text-sm text-muted-foreground">
                Search for a product and instantly see who has the best price
                around you.
              </p>
            </div>

            <div className="mt-2 sm:mt-0">
              <Button
                size="sm"
                className="rounded-full bg-accent px-4 text-xs font-semibold text-accent-foreground shadow-glow hover:bg-accent/90"
                onClick={() => navigate("/cart-finder")}
              >
                Optimize whole cart
              </Button>
            </div>
          </div>
        </div>

        {/* Search + filters card */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5 space-y-5">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
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
                  You can search multiple items at once by separating them with a
                  semicolon <span className="font-mono">;</span>.
                </p>
              </div>

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
                className="w-full rounded-full py-2.5 text-sm font-semibold bg-accent text-accent-foreground shadow-glow hover:bg-accent/90 sm:w-auto"
              >
                {loading ? "Searching deals..." : "Search deals"}
              </Button>

              {error && (
                <span className="text-xs font-medium text-red-600 sm:text-right">
                  {error}
                </span>
              )}
            </div>
          </form>

          {/* Filters */}
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
                    className="text-[11px] font-medium text-accent hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {searchedItems.map((item) => (
                  <label
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs"
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
              {searchedItems.length > 1 && activeFilters.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Tip: check one or more items above to see the best price by
                  search term.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Results</h2>
            {processedResults.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Showing {results.length} of {processedResults.length} matching
                deals
              </span>
            )}
          </div>

          {results.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              No deals found yet. Try a different product, radius, or zip code.
            </p>
          )}

          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((deal) => (
              <li
                key={deal.id}
                className="flex flex-col rounded-xl border border-border/60 bg-background/50 p-3"
              >
                <img
                  src={deal.image_link || PLACEHOLDER_IMG}
                  alt={deal.product_name}
                  className="h-32 w-full flex-shrink-0 rounded-md border bg-gray-50 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER_IMG;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
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
                  <p className="text-xs text-muted-foreground">
                    {deal.retailer} · Zip {deal.zip_code}
                  </p>
                  {deal.distance_m != null && (
                    <p className="text-[11px] text-muted-foreground">
                      ~{(deal.distance_m / 1609.34).toFixed(1)} miles away
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-center gap-3 text-xs">
              <Button
                variant="outline"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="rounded-full px-3 py-1 text-xs disabled:opacity-60"
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
                className="rounded-full px-3 py-1 text-xs disabled:opacity-60"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
