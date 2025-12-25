import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getLatestRefreshDate, formatDistance } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import {
  Search as SearchIcon,
  ShoppingBag,
  ChevronDown,
  Plus,
  Check,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

// --- Types ---
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
  product_size: string | null;
  image_link: string | null;
  retailer_logo_url: string | null;
};

type OptimizedCartItem = {
  searched_item: string;
  product_name: string;
  product_price: number;
  retailer: string;
  zip_code: string;
  distance_m: number;
  product_size: string | null;
  image_link: string | null;
  retailer_logo_url: string | null;
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
  retailer_logo_url: string | null;
};

const MAX_CANDIDATE_STORES = 30;
const PLACEHOLDER_IMG =
  "https://via.placeholder.com/100x100.png?text=No+Image";

const SINGLE_ITEM_DEALS_LIMIT = 12;

export function CartFinder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { saveOptimizedCart, addToCart, items } = useCart();
  const { toast } = useToast();

  // --- State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [radius, setRadius] = useState("10");
  const [retailerCountLimit, setRetailerCountLimit] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initialSearchDone, setInitialSearchDone] = useState(false);
  const [editableCartItems, setEditableCartItems] = useState<EditableCartItem[]>(
    []
  );

  const [result, setResult] = useState<OptimizedCart | null>(null);
  const [singleStoreResults, setSingleStoreResults] = useState<
    SingleStoreResult[]
  >([]);

  const [singleItemDeals, setSingleItemDeals] = useState<OptimizedCartItem[]>(
    []
  );

  const [refineOpen, setRefineOpen] = useState(false);

  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  // --- Default zip logic (guest: 90046, signed-in: waitlist.zip_code) ---
  const [resolvedDefaultZip, setResolvedDefaultZip] = useState<string>("90046");

  useEffect(() => {
    const resolveZip = async () => {
      if (!user) {
        setResolvedDefaultZip("90046");
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
        setResolvedDefaultZip(wlZip && /^\d{5}$/.test(wlZip) ? wlZip : "90046");
      } catch {
        setResolvedDefaultZip("90046");
      }
    };

    resolveZip();
  }, [user]);

  const effectiveZip = useMemo(() => {
    const z = zipcode.trim();
    if (z) return z;
    return resolvedDefaultZip || "90046";
  }, [zipcode, resolvedDefaultZip]);

  const cartTotal = useMemo(() => {
    const total = items.reduce(
      (sum: number, it: any) => sum + (Number(it?.price) || 0),
      0
    );
    return total;
  }, [items]);

  // --- Sticky dropdown panel (Deals-style) ---
  const [locationPanelOpen, setLocationPanelOpen] = useState(false);
  const locationPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!locationPanelOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // ✅ FIX: Radix Select renders in a portal outside the ref.
      // If click is inside any Radix popper/portal wrapper, DO NOT close.
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      if (target.closest("[data-radix-portal]")) return;

      const el = locationPanelRef.current;
      if (!el) return;
      if (!el.contains(target)) {
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

  const openLocationPanel = () => setLocationPanelOpen(true);

  // --- Logic Helpers ---
  const handleSaveCart = (cart: OptimizedCart) => {
    saveOptimizedCart({
      total_price: cart.total_cart_price,
      store_count: cart.stores.length,
      stores: cart.stores,
      items: cart.items_found,
    });

    toast({
      title: "Cart Saved",
      description: "This combination has been saved to your carts page.",
      duration: 2000,
    });
  };

  const handleSaveSingleStoreCart = (store: SingleStoreResult) => {
    const storeId: StoreID = `${store.retailer}@${store.zip_code}`;
    const cart: OptimizedCart = {
      stores: [storeId],
      total_cart_price: store.total_cart_price,
      items_found: store.items_found,
      items_missing: [],
    };
    handleSaveCart(cart);
  };

  const handleAddDealToCart = (deal: OptimizedCartItem) => {
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
      duration: 1500,
    });

    const key = `${deal.product_name}-${deal.retailer}-${deal.zip_code}-${deal.product_price}`;
    setAddedItems((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setAddedItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 1500);
  };

  // --- Optimizer Logic (UNCHANGED) ---
  const findBestCart = (
    dealMenu: DealMenuItem[],
    searchTerms: string[],
    storeLimit: number
  ): { bestCart: OptimizedCart | null; allStoreCarts: SingleStoreResult[] } => {
    const topK = 5;
    const candidateStoreIds = new Set<StoreID>();
    const storeMap = new Map<
      StoreID,
      { retailer: string; zip_code: string; distance_m: number; logo: string | null }
    >();
    const priceMenu = new Map<string, Map<StoreID, DealMenuItem>>();

    for (const deal of dealMenu) {
      const storeId: StoreID = `${deal.retailer}@${deal.zip_code}`;
      if (!storeMap.has(storeId)) {
        storeMap.set(storeId, {
          retailer: deal.retailer,
          zip_code: deal.zip_code,
          distance_m: deal.distance_m,
          logo: deal.retailer_logo_url,
        });
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
        if (a.product_price !== b.product_price) return a.product_price - b.product_price;
        return a.distance_m - b.distance_m;
      });
      const topKDeals = itemDeals.slice(0, topK);
      for (const deal of topKDeals) candidateStoreIds.add(`${deal.retailer}@${deal.zip_code}`);
    }

    if (candidateStoreIds.size > MAX_CANDIDATE_STORES) {
      throw new Error(
        `Too many stores (${candidateStoreIds.size}) to optimize. Please reduce your radius.`
      );
    }

    const uniqueStoreIds = Array.from(candidateStoreIds);
    let bestCart: OptimizedCart | null = null;
    const allStoreCarts: SingleStoreResult[] = [];
    const allCombos: StoreID[][] = [];

    for (let k = 1; k <= storeLimit; k++) {
      const stack: { index: number; currentCombo: StoreID[] }[] = [];
      for (let i = 0; i <= uniqueStoreIds.length - k; i++) {
        stack.push({ index: i + 1, currentCombo: [uniqueStoreIds[i]] });
      }
      while (stack.length > 0) {
        const { index, currentCombo } = stack.pop()!;
        if (currentCombo.length === k) {
          const brandsInCombo = currentCombo.map((id) => storeMap.get(id)!.retailer);
          if (new Set(brandsInCombo).size === brandsInCombo.length) {
            allCombos.push(currentCombo);
          }
          continue;
        }
        for (let j = index; j <= uniqueStoreIds.length - (k - currentCombo.length); j++) {
          stack.push({
            index: j + 1,
            currentCombo: [...currentCombo, uniqueStoreIds[j]],
          });
        }
      }
    }

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
                (deal.product_price === cheapestDeal.product_price &&
                  deal.distance_m < cheapestDeal.distance_m)
              ) {
                cheapestDeal = {
                  searched_item: item,
                  product_name: deal.product_name,
                  product_price: deal.product_price,
                  retailer: deal.retailer,
                  zip_code: deal.zip_code,
                  distance_m: deal.distance_m,
                  product_size: deal.product_size,
                  image_link: deal.image_link,
                  retailer_logo_url: deal.retailer_logo_url,
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
          retailer_logo_url: storeInfo.logo,
        });
      }

      if (
        !bestCart ||
        currentCart.items_missing.length < bestCart.items_missing.length ||
        (currentCart.items_missing.length === bestCart.items_missing.length &&
          currentCart.total_cart_price < bestCart.total_cart_price)
      ) {
        bestCart = currentCart;
      }
    }

    return { bestCart, allStoreCarts };
  };

  const handleRunOptimizer = async (itemsToFind: EditableCartItem[]) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSingleStoreResults([]);
    setSingleItemDeals([]);

    const searchTerms = itemsToFind.map((item) => item.name).filter(Boolean);

    if (searchTerms.length === 0) {
      setError("Your item list is empty.");
      setLoading(false);
      return;
    }
    if (!/^\d{5}$/.test(effectiveZip)) {
      setError("Invalid zip code.");
      setLoading(false);
      return;
    }

    const radiusNum = parseInt(radius, 10);
    const meters = Math.round(radiusNum * 1609.34);
    const retailerLimit = parseInt(retailerCountLimit, 10);

    try {
      const minDate = getLatestRefreshDate();
      const { data: rawData, error: rpcError } = await supabase.rpc(
        "get_deal_menu_v8",
        {
          user_zip: effectiveZip,
          items_to_find: itemsToFind,
          radius_meters: meters,
          min_date: minDate,
        }
      );

      if (rpcError) throw rpcError;

      const dealMenu = (rawData as DealMenuItem[]) || [];
      if (!dealMenu || dealMenu.length === 0) {
        setError("No recent deals found for this combination. Try broadening your search.");
        return;
      }

      if (searchTerms.length === 1) {
        const one = searchTerms[0];
        const normalized: OptimizedCartItem[] = dealMenu
          .filter((d) => d?.searched_item_name === one)
          .filter((d) => d?.product_name != null)
          .filter((d) => d?.product_price != null && Number.isFinite(Number(d.product_price)))
          .map((d) => ({
            searched_item: one,
            product_name: d.product_name,
            product_price: Number(d.product_price),
            retailer: d.retailer,
            zip_code: d.zip_code,
            distance_m: d.distance_m,
            product_size: d.product_size ?? null,
            image_link: d.image_link ?? null,
            retailer_logo_url: d.retailer_logo_url ?? null,
          }))
          .sort((a, b) => {
            if (a.product_price !== b.product_price) return a.product_price - b.product_price;
            return a.distance_m - b.distance_m;
          })
          .slice(0, SINGLE_ITEM_DEALS_LIMIT);

        setSingleItemDeals(normalized);
        return;
      }

      const { bestCart, allStoreCarts } = findBestCart(dealMenu, searchTerms, retailerLimit);

      if (retailerLimit === 1) {
        const completeStoreCarts = allStoreCarts.filter(
          (cart) => cart.items_found_count === searchTerms.length
        );

        const bestByBrand = new Map<string, SingleStoreResult>();
        for (const storeCart of completeStoreCarts) {
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
          Array.from(bestByBrand.values()).sort(
            (a, b) => a.total_cart_price - b.total_cart_price
          )
        );
      } else {
        setResult(bestCart);
      }
    } catch (err: any) {
      console.error("Optimizer Error:", err);
      setError(err.message || "Failed to fetch cart.");
    } finally {
      setLoading(false);
    }
  };

  const parseSearchTerms = (q: string) =>
    q
      .split(";")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

  const submitSearch = async () => {
    const searchTerms = parseSearchTerms(searchQuery);

    if (searchTerms.length === 0) {
      setError("Please enter at least one item.");
      setLocationPanelOpen(false);
      return;
    }

    const initialItems: EditableCartItem[] = searchTerms.map((name) => ({
      name,
      brand: "",
      size: "",
      details: "",
    }));

    setEditableCartItems(initialItems);
    setInitialSearchDone(true);

    await handleRunOptimizer(initialItems);
    setLocationPanelOpen(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitSearch();
  };

  const handleReRunSearch = async () => {
    await handleRunOptimizer(editableCartItems);
  };

  const handleEditCartItem = (
    index: number,
    field: keyof EditableCartItem,
    value: string
  ) => {
    const newItems = [...editableCartItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditableCartItems(newItems);
  };

  // ✅ FIX #1: grid is 2-cols on mobile/half screen, 3-cols on full screen (lg)
  const renderItemsGrid = (itemsToRender: OptimizedCartItem[]) => (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {itemsToRender.map((item, idx) => {
        const key = `${item.product_name}-${item.retailer}-${item.zip_code}-${item.product_price}-${idx}`;
        const isAdded = addedItems.has(key);

        return (
          <li
            key={key}
            className="flex flex-col rounded-xl border border-border/60 bg-background/50 p-3 relative transition-shadow hover:shadow-md"
          >
            <img
              src={item.image_link || PLACEHOLDER_IMG}
              alt={item.product_name}
              className="h-28 w-full flex-shrink-0 rounded-md border bg-gray-50 object-cover"
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER_IMG;
              }}
            />

            <div className="min-w-0 flex-1 pt-2 pb-8">
              <p className="truncate text-sm font-semibold text-foreground">
                {item.product_name}
              </p>

              {item.product_size && (
                <p className="text-xs text-muted-foreground">Size: {item.product_size}</p>
              )}

              <p className="mt-1 text-lg font-bold text-green-600">
                ${Number(item.product_price).toFixed(2)}
              </p>

              <div className="flex items-center gap-2 mt-1">
                {item.retailer_logo_url && (
                  <img
                    src={item.retailer_logo_url}
                    alt="logo"
                    className="h-4 w-auto object-contain"
                  />
                )}
                <p className="text-xs text-muted-foreground truncate">{item.retailer}</p>
              </div>

              {item.distance_m != null && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDistance(item.distance_m)}
                </p>
              )}
            </div>

            <div className="absolute bottom-3 right-3">
              <Button
                size="icon"
                className={`h-8 w-8 rounded-full shadow-md transition-all ${
                  isAdded
                    ? "bg-prox text-white hover:bg-prox-hover"
                    : "bg-white text-green-600 border border-green-200 hover:bg-green-50"
                }`}
                onClick={() => handleAddDealToCart(item)}
              >
                {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background text-foreground">
      {/* DEALS-STYLE STICKY TOP AREA */}
      <div className="sticky top-0 z-20 bg-prox">
        <div ref={locationPanelRef} className="mx-auto max-w-3xl px-4 py-3 space-y-3">
          {/* Row 1: Search + Cart */}
          <div className="flex items-start gap-3">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/50" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items (use ; to separate)…"
                  className="pl-9 h-10 rounded-full bg-white/95 text-black placeholder:text-black/50 border-0 focus-visible:ring-2 focus-visible:ring-white"
                />
              </div>
            </form>

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

          {/* Row 2: Zip + Radius + Stores */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={openLocationPanel}
              className="flex items-center gap-2 text-sm font-medium text-white hover:opacity-90"
            >
              <img
                src="/location 2_white.png"
                alt=""
                aria-hidden="true"
                className="h-4 w-4 object-contain"
              />
              <span className="text-white/80">Zip:</span>
              <span className="tabular-nums">{effectiveZip}</span>
            </button>

            <button
              type="button"
              onClick={openLocationPanel}
              className="flex items-center gap-2 text-sm font-medium text-white hover:opacity-90"
            >
              <img
                src="/radius_white.png"
                alt=""
                aria-hidden="true"
                className="h-4 w-4 object-contain"
              />
              <span className="text-white/80">Radius:</span>
              <span className="tabular-nums">{radius} mi</span>
            </button>

            <button
              type="button"
              onClick={openLocationPanel}
              className="flex items-center gap-2 text-sm font-medium text-white hover:opacity-90"
            >
              <img
                src="/store_white.png"
                alt=""
                aria-hidden="true"
                className="h-4 w-4 object-contain"
              />
              <span className="text-white/80">Stores:</span>
              <span className="tabular-nums">{retailerCountLimit}</span>
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
                <p className="text-sm font-semibold">Update optimization settings</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocationPanelOpen(false)}
                >
                  Close
                </Button>
              </div>

              {/* ✅ FIX #2: Zip/Radius/Stores all on ONE ROW */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="zip-panel"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Zip
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
                    Miles
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

                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Stores
                  </Label>
                  <Select value={retailerCountLimit} onValueChange={setRetailerCountLimit}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Stores" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={initialSearchDone ? handleReRunSearch : submitSearch}
                disabled={loading}
                className="mt-4 w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm"
              >
                {loading ? "Optimizing..." : "Optimize cart"}
              </Button>

              {error && (
                <div className="mt-2 text-xs font-medium text-red-600">{error}</div>
              )}

              <p className="mt-2 text-[10px] text-gray-400 text-right">
                Prices reflect the most recent weekly update.
              </p>
            </div>
          )}

          {/* Refine Search (only after initial search, multi-item mode) */}
          {initialSearchDone && editableCartItems.length > 1 && (
            <div className="rounded-2xl border border-border/60 bg-white shadow-soft px-4 py-4">
              <button
                type="button"
                onClick={() => setRefineOpen((v) => !v)}
                className="w-full flex items-center justify-between"
              >
                <h2 className="text-lg font-semibold text-foreground">Refine search</h2>
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs">{refineOpen ? "Hide" : "Show"}</span>
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

                    {editableCartItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-2">
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            handleEditCartItem(idx, "name", e.target.value)
                          }
                          className="text-xs px-2 h-8"
                        />
                        <Input
                          value={item.brand}
                          onChange={(e) =>
                            handleEditCartItem(idx, "brand", e.target.value)
                          }
                          className="text-xs px-2 h-8"
                        />
                        <Input
                          value={item.size}
                          onChange={(e) =>
                            handleEditCartItem(idx, "size", e.target.value)
                          }
                          className="text-xs px-2 h-8"
                        />
                        <Input
                          value={item.details}
                          onChange={(e) =>
                            handleEditCartItem(idx, "details", e.target.value)
                          }
                          className="text-xs px-2 h-8"
                        />
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleReRunSearch}
                    disabled={loading}
                    className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm"
                  >
                    {loading ? "Optimizing…" : "Re-run search"}
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
          {/* Single item mode */}
          {initialSearchDone && editableCartItems.length === 1 && (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Results</h2>
                  <p className="text-xs text-muted-foreground">
                    Showing {singleItemDeals.length} deals · Near {effectiveZip} ·{" "}
                    {radius} miles
                  </p>
                </div>
              </div>

              {loading && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Loading deals…
                </p>
              )}

              {!loading && singleItemDeals.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No deals found. Try a different radius or zip code.
                </p>
              )}

              {!loading && singleItemDeals.length > 0 && renderItemsGrid(singleItemDeals)}
            </div>
          )}

          {/* Multi-item mode */}
          {initialSearchDone && editableCartItems.length > 1 && (
            <div className="space-y-6">
              {singleStoreResults.length > 0 && !loading && (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Best Single-Store Carts</h2>
                    <span className="text-sm text-muted-foreground">
                      {singleStoreResults.length} options
                    </span>
                  </div>

                  <Accordion type="multiple" className="w-full space-y-2">
                    {singleStoreResults.map((store) => {
                      const storeId = `${store.retailer}@${store.zip_code}`;
                      return (
                        <AccordionItem
                          value={storeId}
                          key={storeId}
                          className="border rounded-lg px-2 bg-white shadow-sm"
                        >
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center justify-between w-full pr-2">
                              <div className="flex items-center gap-2 text-left">
                                {store.retailer_logo_url && (
                                  <img
                                    src={store.retailer_logo_url}
                                    className="h-5 w-auto object-contain"
                                  />
                                )}
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {store.retailer}
                                  </p>
                                  <p className="text-xs text-gray-500 font-normal">
                                    ({formatDistance(store.distance_m)})
                                  </p>
                                </div>
                              </div>

                              <span className="text-lg font-bold text-green-700">
                                ${store.total_cart_price.toFixed(2)}
                              </span>
                            </div>
                          </AccordionTrigger>

                          <AccordionContent>
                            <div className="flex justify-end pb-3">
                              <Button
                                size="sm"
                                className="rounded-full bg-prox text-white hover:bg-prox-hover"
                                onClick={() => handleSaveSingleStoreCart(store)}
                              >
                                Save Cart
                              </Button>
                            </div>
                            {renderItemsGrid(store.items_found)}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-blue-900">
                        Cheapest Multi-Store Combo
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Using {result.stores.length} stores
                      </p>
                    </div>

                    <Button
                      onClick={() => handleSaveCart(result)}
                      size="sm"
                      className="rounded-full bg-prox text-white hover:bg-prox-hover"
                    >
                      Save Cart
                    </Button>
                  </div>

                  <div className="border-2 border-blue-100 rounded-xl p-4 bg-blue-50/30">
                    <div className="flex justify-between items-center mb-4 border-b border-blue-100 pb-4">
                      <div>
                        <p className="text-2xl font-bold text-green-700">
                          ${result.total_cart_price.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Missing {result.items_missing.length} items
                        </p>
                      </div>
                    </div>

                    <Accordion type="multiple" className="w-full space-y-2">
                      {Array.from(
                        result.items_found.reduce((acc, item) => {
                          const key: StoreID = `${item.retailer}@${item.zip_code}`;
                          if (!acc.has(key)) acc.set(key, []);
                          acc.get(key)!.push(item);
                          return acc;
                        }, new Map<StoreID, OptimizedCartItem[]>())
                      ).map(([storeId, storeItems]) => {
                        const firstItem = storeItems[0];
                        return (
                          <AccordionItem
                            value={storeId}
                            key={storeId}
                            className="border rounded-lg px-2 bg-white"
                          >
                            <AccordionTrigger className="hover:no-underline py-2">
                              <div className="flex items-center gap-2">
                                {firstItem.retailer_logo_url && (
                                  <img
                                    src={firstItem.retailer_logo_url}
                                    className="h-5 w-auto object-contain"
                                  />
                                )}
                                <div className="text-left">
                                  <p className="font-semibold text-sm">
                                    {firstItem.retailer}
                                  </p>
                                  <p className="text-xs text-gray-500 font-normal">
                                    ({formatDistance(firstItem.distance_m)})
                                  </p>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>{renderItemsGrid(storeItems)}</AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                    {result.items_missing.length > 0 && (
                      <div className="mt-4 p-3 bg-red-50 rounded-md border border-red-100">
                        <p className="text-sm font-semibold text-red-800">
                          Missing Items:
                        </p>
                        <p className="text-sm text-red-600">
                          {result.items_missing.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!result && singleStoreResults.length === 0 && !loading && error && (
                <p className="text-red-600 font-semibold">{error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav current="CartFinder" />
    </div>
  );
}
