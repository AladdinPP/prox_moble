import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Check,
  ShoppingBag,
  ChevronDown,
  ChevronRight,
  Search as SearchIcon,
} from "lucide-react";
import { getLatestRefreshDate, formatDistance } from "@/lib/dateUtils";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

type DealResult = {
  id: number;
  product_name: string;
  product_price: number; // keep as number for UI
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
const PLACEHOLDER_IMG =
  "https://via.placeholder.com/100x100.png?text=No+Image";

// Simple Levenshtein distance for fuzzy matching
const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
};

const fuzzyWordMatch = (productName: string, keyword: string): boolean => {
  const lowerProduct = productName.toLowerCase();
  const words = lowerProduct.split(/\s+/);

  return words.some((word) => {
    const maxLen = Math.max(word.length, keyword.length);
    const dist = levenshtein(word, keyword);
    const ratio = dist / maxLen;
    return dist <= 1 || ratio <= 0.34;
  });
};

const productMatchesFilter = (
  productName: string,
  filterTerm: string
): boolean => {
  const keywords = filterTerm.trim().toLowerCase().split(/\s+/);
  return keywords.every((keyword) => fuzzyWordMatch(productName, keyword));
};

const FEATURED_QUERIES: { label: string; terms: string[] }[] = [
  { label: "milk 1 gal", terms: ["milk", "1 gal"] },
  { label: "eggs", terms: ["egg", "12"] },
  { label: "soda", terms: ["coke"] },
  { label: "steak", terms: ["tri-tip"] },
  { label: "bacon", terms: ["thick cut bacon"] },
  { label: "cereal", terms: ["honey nut cheerios"] },
  { label: "bread", terms: ["wheat bread"] },
  { label: "chicken breast", terms: ["chicken breast"] },
  { label: "avocados", terms: ["hass avocado"] },
  { label: "yogurt", terms: ["greek yogurt"] },
  { label: "pasta", terms: ["spaghetti"] },
  { label: "potato chips", terms: ["doritos"] },
];

// Converts a flyer_deals row into the DealResult shape your UI expects
const flyerRowToDealResult = (r: any): DealResult => ({
  id: r.id,
  product_name: r.product_name,
  product_price: Number(r.product_price),
  retailer: r.retailer,
  zip_code: r.zip_code,
  distance_m: undefined,
  image_link: r.image_link ?? null,
  product_size: r.product_size ?? null,
  retailer_logo_url: null,
});

export function Deals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, items } = useCart();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [radius, setRadius] = useState("10");
  const [loading, setLoading] = useState(false);
  const [loadingFeatured, setLoadingFeatured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [processedResults, setProcessedResults] = useState<DealResult[]>([]);
  const [results, setResults] = useState<DealResult[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());

  const [sortOption, setSortOption] = useState<
    "none" | "price-asc" | "price-desc"
  >("none");
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [refineOpen, setRefineOpen] = useState(false);

  // Featured deals state
  const [featuredDeals, setFeaturedDeals] = useState<DealResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [resolvedDefaultZip, setResolvedDefaultZip] =
    useState<string>("90064");

  // New UI state: dropdown panel for zip/radius (Walmart-style)
  const [locationPanelOpen, setLocationPanelOpen] = useState(false);
  const locationPanelRef = useRef<HTMLDivElement | null>(null);

  const effectiveZip = useMemo(() => {
    const z = zipcode.trim();
    if (z) return z;
    return resolvedDefaultZip || "90064";
  }, [zipcode, resolvedDefaultZip]);

  const cartTotal = useMemo(() => {
    const total = items.reduce(
      (sum: number, it: any) => sum + (Number(it?.price) || 0),
      0
    );
    return total;
  }, [items]);

  const handleAdd = (e: React.MouseEvent, deal: DealResult) => {
    e.stopPropagation();

    addToCart({
      name: deal.product_name,
      size: deal.product_size || "",
      brand: deal.retailer,
      details: "",
      price: deal.product_price,
      retailer: deal.retailer,
      logo: deal.retailer_logo_url,
    });

    toast({
      title: "Added to Cart",
      description: `${deal.product_name} is in your basket.`,
      duration: 2000,
    });

    setAddedItems((prev) => {
      const next = new Set(prev);
      next.add(deal.id);
      return next;
    });

    setTimeout(() => {
      setAddedItems((prev) => {
        const next = new Set(prev);
        next.delete(deal.id);
        return next;
      });
    }, 2000);
  };

  // Close dropdown when clicking outside + Escape
  useEffect(() => {
    if (!locationPanelOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const el = locationPanelRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setLocationPanelOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLocationPanelOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown as any);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [locationPanelOpen]);

  // 1) Resolve default zip:
  // - guest => 90064
  // - signed in => from public.waitlist.zip_code (fallback to 90064)
  useEffect(() => {
    const resolveZip = async () => {
      if (!user) {
        setResolvedDefaultZip("90064");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("waitlist")
          .select("zip_code")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        const wlZip = (data?.zip_code as string | null) ?? null;
        setResolvedDefaultZip(
          wlZip && /^\d{5}$/.test(wlZip) ? wlZip : "90064"
        );
      } catch {
        setResolvedDefaultZip("90064");
      }
    };

    resolveZip();
  }, [user]);

  // 2) Load Featured Deals from public.flyer_deals using effectiveZip (only before search)
  useEffect(() => {
    const fetchFeaturedDeals = async () => {
      if (hasSearched) return;

      setLoadingFeatured(true);
      try {
        const promises = FEATURED_QUERIES.map(async (q) => {
          let query = supabase
            .from("flyer_deals")
            .select(
              "id, retailer, zip_code, product_name, product_price, image_link, product_size, retailer_address"
            )
            .eq("zip_code", effectiveZip)
            .not("product_price", "is", null)
            .not("product_name", "is", null);

          for (const term of q.terms) {
            query = query.ilike("product_name", `%${term}%`);
          }

          const { data, error } = await query
            .order("product_price", { ascending: true })
            .limit(1);

          if (error) {
            console.error(`Featured query failed (${q.label}):`, error);
            return null;
          }

          const row = data?.[0];
          if (!row) return null;

          return flyerRowToDealResult(row);
        });

        const resolved = await Promise.all(promises);
        const featured = resolved.filter(Boolean) as DealResult[];
        setFeaturedDeals(featured);
      } catch (e) {
        console.error("Error fetching featured deals:", e);
        setFeaturedDeals([]);
      } finally {
        setLoadingFeatured(false);
      }
    };

    fetchFeaturedDeals();
  }, [effectiveZip, hasSearched]);

  // Shared search executor used by initial search and refine search
  const executeSearch = async (searchTerms: string[]) => {
    setError(null);

    const validSearchTerms = searchTerms
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (validSearchTerms.length === 0) {
      setError("Please enter at least one item name.");
      return;
    }

    const radiusNum = parseInt(radius, 10);
    if (!/^\d{5}$/.test(effectiveZip)) {
      setError("Please enter a valid 5-digit zip code.");
      return;
    }
    if (isNaN(radiusNum) || radiusNum <= 0) {
      setError("Please enter a search radius greater than 0.");
      return;
    }

    setLoading(true);
    setResults([]);
    setProcessedResults([]);
    setActiveFilters([]);
    setCurrentPage(1);

    try {
      const minDate = getLatestRefreshDate();
      const radiusMeters = Math.round(radiusNum * 1609.34);

      const { data, error } = await supabase.rpc("search_deals_fuzzy", {
        search_terms: validSearchTerms,
        user_zip: effectiveZip,
        max_distance_meters: radiusMeters,
        radius_meters: radiusMeters,
        min_date: minDate,
        max_rows: 500,
      });

      if (error) throw error;

      const rawData: any[] = (data as any[]) || [];

      // ✅ Fix: remove rows with null/undefined price and normalize to number
      const normalized: DealResult[] = rawData
        .filter((d) => d?.product_name != null)
        .filter((d) => d?.product_price != null && !Number.isNaN(Number(d.product_price)))
        .map((d) => ({
          ...d,
          product_price: Number(d.product_price),
          image_link: d.image_link ?? null,
          product_size: d.product_size ?? null,
          retailer_logo_url: d.retailer_logo_url ?? null,
        }));

      if (normalized.length > 0) {
        setProcessedResults(normalized);
        setActiveFilters(searchTerms); // keep your existing behavior
      } else {
        setError("No recent deals found for this search.");
        setResults([]);
      }
    } catch (err: any) {
      console.error("Error fetching deals:", err);
      setError(err.message || "Failed to fetch deals.");
    } finally {
      setLoading(false);
    }
  };

  const submitSearch = async () => {
    const hasTyped = searchTerm.trim().length > 0;

    if (!hasTyped && !hasSearched) {
      setLocationPanelOpen(false);
      return;
    }

    setHasSearched(true);

    const searchTerms = searchTerm
      .split(";")
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    setEditableItems(
      searchTerms.map((term) => ({
        name: term,
        brand: "",
        size: "",
        details: "",
      }))
    );

    await executeSearch(searchTerms);
    setLocationPanelOpen(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitSearch();
  };

  const handleEditRefineItem = (
    idx: number,
    field: keyof EditableItem,
    value: string
  ) => {
    setEditableItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleRefineSearch = async () => {
    const refinedTerms = editableItems
      .map((item) =>
        `${item.name} ${item.brand} ${item.size} ${item.details}`.trim()
      )
      .filter((term) => term.length > 0);

    await executeSearch(refinedTerms);
  };

  useEffect(() => {
    if (processedResults.length === 0) {
      setResults([]);
      return;
    }

    let filteredDeals = processedResults.filter((deal) =>
      activeFilters.some((filter) =>
        productMatchesFilter(deal.product_name, filter)
      )
    );

    if (sortOption === "price-asc") {
      filteredDeals = [...filteredDeals].sort(
        (a, b) => a.product_price - b.product_price
      );
    } else if (sortOption === "price-desc") {
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

  const totalPages = Math.ceil(
    processedResults.filter((deal) =>
      activeFilters.some((filter) =>
        productMatchesFilter(deal.product_name, filter)
      )
    ).length / ITEMS_PER_PAGE
  );

  const handleNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const handlePrevPage = () =>
    setCurrentPage((prev) => Math.max(prev - 1, 1));

  const showingFeatured = !hasSearched;
  const displayDeals = showingFeatured ? featuredDeals : results;

  const openLocationPanel = () => setLocationPanelOpen(true);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background text-foreground">
      {/* WALMART-STYLE TOP AREA (PROX GREEN BACKGROUND) */}
      <div className="sticky top-0 z-20 bg-prox">
        <div
          ref={locationPanelRef}
          className="mx-auto max-w-3xl px-4 py-3 space-y-3"
        >
          {/* Row 1: Search bar + Cart */}
          <div className="flex items-start gap-3">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/50" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for groceries…"
                  className="pl-9 h-10 rounded-full bg-white/95 text-black placeholder:text-black/50 border-0 focus-visible:ring-2 focus-visible:ring-white"
                />
              </div>
            </form>

            {/* Cart icon + count + total below */}
            <button
              type="button"
              onClick={() => navigate("/cart")}
              className="relative flex flex-col items-end"
              aria-label="Cart"
            >
              <div className="relative inline-flex items-center justify-center rounded-full bg-white/95 h-10 w-10 hover:bg-white transition">
                <ShoppingBag className="h-5 w-5 text-black" />
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                  {items.length}
                </span>
              </div>
              <div className="mt-1 text-[11px] font-semibold text-white tabular-nums">
                ${cartTotal.toFixed(2)}
              </div>
            </button>
          </div>

          {/* Row 2: Zip (left) + Radius (right) with dropdown trigger */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={openLocationPanel}
              className="flex items-center gap-2 text-sm font-medium text-white hover:opacity-90"
            >
              <span className="text-white/80">Zip:</span>
              <span className="tabular-nums">{effectiveZip}</span>
            </button>

            <button
              type="button"
              onClick={openLocationPanel}
              className="flex items-center gap-2 text-sm font-medium text-white hover:opacity-90"
            >
              <span className="text-white/80">Search Radius:</span>
              <span className="tabular-nums">{radius} miles</span>
              <ChevronDown
                className={`h-4 w-4 text-white/80 transition-transform ${
                  locationPanelOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Drop-down panel */}
          {locationPanelOpen && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-soft p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Update search area</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocationPanelOpen(false)}
                >
                  Close
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="zip-panel"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Zip code
                  </Label>
                  <Input
                    id="zip-panel"
                    type="text"
                    value={zipcode}
                    onChange={(e) => setZipcode(e.target.value)}
                    placeholder={effectiveZip}
                    className="text-sm"
                    maxLength={5}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="radius-panel"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Radius (miles)
                  </Label>
                  <Input
                    id="radius-panel"
                    type="number"
                    min="1"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <Button
                onClick={submitSearch}
                disabled={loading}
                className="mt-4 w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm"
              >
                {loading ? "Searching..." : "Search deals"}
              </Button>

              {error && (
                <div className="mt-2 text-xs font-medium text-red-600">
                  {error}
                </div>
              )}

              <p className="mt-2 text-[10px] text-gray-400 text-right">
                Prices reflect the most recent weekly update.
              </p>
            </div>
          )}

          {/* Refine Search moved INTO the sticky top area (only after search) */}
          {!showingFeatured &&
            processedResults.length > 0 &&
            editableItems.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-white shadow-soft px-4 py-4">
                <button
                  type="button"
                  onClick={() => setRefineOpen((v) => !v)}
                  className="w-full flex items-center justify-between"
                >
                  <h2 className="text-lg font-semibold text-foreground">
                    Refine search
                  </h2>
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    {refineOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="text-xs">
                      {refineOpen ? "Hide" : "Show"}
                    </span>
                  </span>
                </button>

                {refineOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-col gap-2">
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
                            onChange={(e) =>
                              handleEditRefineItem(idx, "name", e.target.value)
                            }
                            className="text-xs px-2 h-8"
                          />
                          <Input
                            value={item.brand}
                            onChange={(e) =>
                              handleEditRefineItem(idx, "brand", e.target.value)
                            }
                            className="text-xs px-2 h-8"
                          />
                          <Input
                            value={item.size}
                            onChange={(e) =>
                              handleEditRefineItem(idx, "size", e.target.value)
                            }
                            className="text-xs px-2 h-8"
                          />
                          <Input
                            value={item.details}
                            onChange={(e) =>
                              handleEditRefineItem(
                                idx,
                                "details",
                                e.target.value
                              )
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
                      {loading ? "Refining…" : "Re-run search"}
                    </Button>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 pb-24">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
          {/* Results / Featured Deals */}
          <div className="space-y-4 rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">
                  {showingFeatured ? "This Week’s Featured Deals" : "Results"}
                </h2>

                {!showingFeatured && processedResults.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Showing {results.length} of {processedResults.length} matching
                    deals
                  </span>
                )}

                {showingFeatured && (
                  <span className="text-xs text-muted-foreground">
                    Near {effectiveZip} · {radius} miles
                  </span>
                )}
              </div>

              {!showingFeatured && processedResults.length > 0 && (
                <Select
                  value={sortOption}
                  onValueChange={(value) =>
                    setSortOption(value as "none" | "price-asc" | "price-desc")
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

            {/* Empty states */}
            {showingFeatured && loadingFeatured && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Loading featured deals…
              </p>
            )}

            {!showingFeatured && results.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No deals found yet. Try a different product, radius, or zip code.
              </p>
            )}

            {showingFeatured && !loadingFeatured && displayDeals.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No featured deals found for {effectiveZip}. Try another zip code.
              </p>
            )}

            {/* Grid: 2 per row on mobile */}
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {displayDeals.map((deal) => {
                const isAdded = addedItems.has(deal.id);
                const priceNum = Number(deal.product_price); // extra safety

                return (
                  <li
                    key={deal.id}
                    className="flex flex-col rounded-xl border border-border/60 bg-background/50 p-3 relative transition-shadow hover:shadow-md"
                  >
                    <img
                      src={deal.image_link || PLACEHOLDER_IMG}
                      alt={deal.product_name}
                      className="h-28 w-full flex-shrink-0 rounded-md border bg-gray-50 object-cover"
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
                        ${Number.isFinite(priceNum) ? priceNum.toFixed(2) : "—"}
                      </p>

                      <div className="flex items-center gap-2 mt-1">
                        {deal.retailer_logo_url && (
                          <img
                            src={deal.retailer_logo_url}
                            alt="logo"
                            className="h-4 w-auto object-contain"
                          />
                        )}
                        <p className="text-xs text-muted-foreground truncate">
                          {deal.retailer}
                        </p>
                      </div>

                      {deal.distance_m != null && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatDistance(deal.distance_m)}
                        </p>
                      )}
                    </div>

                    {/* Add to Cart */}
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

            {/* Pagination (only for search results) */}
            {!showingFeatured && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3 text-xs border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="rounded-full px-3 py-1 text-xs h-8"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav current="Deals" />
    </div>
  );
}
