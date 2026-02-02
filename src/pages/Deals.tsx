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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { getLatestRefreshDate, formatDistance } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import {
  Search as SearchIcon,
  ShoppingBag,
  ChevronDown,
  Plus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
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

const PLACEHOLDER_IMG = "https://via.placeholder.com/100x100.png?text=No+Image";

const normalizeImageUrl = (url: string | null): string => {
  if (!url) return PLACEHOLDER_IMG;

  const trimmed = String(url).trim();

  // If it's already a full URL, use it
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // If it looks like an Instacart image-server path fragment, try to rebuild it
  // e.g. "filters:fill(FFFFFF)/some/path.jpg"
  if (trimmed.startsWith("filters:") || trimmed.startsWith("/filters:")) {
    return `https://www.instacart.com/image-server/788x788/${trimmed.replace(/^\//, "")}`;
  }

  // If it's some other relative path, fall back
  return PLACEHOLDER_IMG;
};

const ITEMS_PER_PAGE = 12;

/* ============================================================
   FEATURED MODE (pre-search) — category carousels (Option A)
   ============================================================ */
const FEATURED_LIMIT = 15;

type FeaturedCategory = {
  key: string;
  label: string;
  keywords: string[];
};

const FEATURED_CATEGORIES: FeaturedCategory[] = [
  { key: "dairy", label: "Dairy", keywords: ["milk", "cheese", "butter", "yogurt"] },
  { key: "produce", label: "Produce", keywords: ["apples", "bananas", "oranges", "tomatoes"] },
  { key: "meat", label: "Meat & Seafood", keywords: ["chicken", "beef", "pork", "fish", "salmon"] },
  { key: "pantry", label: "Pantry Staples", keywords: ["rice", "pasta", "bread", "cereal", "flour"] },
  { key: "beverages", label: "Beverages", keywords: ["soda", "juice", "water", "coffee", "tea"] },
  { key: "frozen", label: "Frozen", keywords: ["ice cream", "pizza", "frozen vegetables"] },
];

// Helper: parse a product size string to a numeric "unit amount" (for value calculation)
function parseUnitAmount(size: string | null): number | null {
  if (!size) return null;
  const trimmed = size.trim().toLowerCase();

  // Match patterns like "64 oz", "1 gal", "12 ct", etc.
  const match = trimmed.match(/(\d+(?:\.\d+)?)\s*(oz|lb|g|kg|ml|l|gal|ct|count)/);
  if (!match) return null;

  let amount = parseFloat(match[1]);
  const unit = match[2];

  // Normalize to oz equivalent for comparison
  if (unit === 'lb') amount *= 16;
  else if (unit === 'g') amount *= 0.035274;
  else if (unit === 'kg') amount *= 35.274;
  else if (unit === 'ml') amount *= 0.033814;
  else if (unit === 'l') amount *= 33.814;
  else if (unit === 'gal') amount *= 128;

  return amount;
}

// Helper: calculate "value score" (lower = better value per unit)
function valueScore(price: number, size: string | null): number {
  const unitAmount = parseUnitAmount(size);
  if (!unitAmount || unitAmount <= 0) return price; // fallback to raw price
  return price / unitAmount;
}

// Helper: does product name match any of the keywords?
function matchesAny(productName: string, keywords: string[]): boolean {
  const lower = productName.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// Helper: does deal match a specific category?
function matchesCategory(deal: { product_name?: string | null }, category: FeaturedCategory): boolean {
  const name = (deal?.product_name || "").toLowerCase();
  return category.keywords.some((kw) => name.includes(kw.toLowerCase()));
}

// Fuzzy matching functions
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

/**
 * Retailers dropdown component
 */
function RetailersDropdown({
  align = "end",
  compact = false,
  title = "Choose Stores.",
  availableRetailers,
  selectedRetailers,
  setSelectedRetailers,
  open,
  setOpen,
}: {
  align?: "start" | "center" | "end";
  compact?: boolean;
  title?: string;
  availableRetailers: string[];
  selectedRetailers: Set<string>;
  setSelectedRetailers: React.Dispatch<React.SetStateAction<Set<string>>>;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const allSelected =
    availableRetailers.length > 0 &&
    selectedRetailers.size === availableRetailers.length;

  const label =
    availableRetailers.length === 0
      ? "—"
      : allSelected
      ? "All"
      : `${selectedRetailers.size}/${availableRetailers.length}`;

  const toggleRetailer = (r: string) => {
    setSelectedRetailers((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

    requestAnimationFrame(() => setOpen(true));
  };

  const setAll = (checked: boolean) => {
    setSelectedRetailers(checked ? new Set(availableRetailers) : new Set());
    requestAnimationFrame(() => setOpen(true));
  };

  const CheckboxRow = ({
    checked,
    label: rowLabel,
    onToggle,
    isHeaderRow = false,
  }: {
    checked: boolean;
    label: string;
    onToggle: () => void;
    isHeaderRow?: boolean;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={[
        "w-full flex items-center gap-3 px-3 py-3 text-left",
        "hover:bg-muted/40 active:bg-muted/50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "border-b border-border/60",
        isHeaderRow ? "font-medium" : "",
      ].join(" ")}
    >
      <span
        className="h-5 w-5 rounded border border-border flex items-center justify-center bg-background"
        aria-hidden="true"
      >
        {checked ? <Check className="h-4 w-4" /> : null}
      </span>
      <span className="text-sm">{rowLabel}</span>
    </button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between h-9 text-sm"
            disabled={availableRetailers.length === 0}
            onClick={() => setOpen(!open)}
          >
            <span>Retailers</span>
            <span className="text-muted-foreground">{label}</span>
          </Button>
        ) : (
          <button
            type="button"
            className={`flex items-center gap-2 text-sm font-medium text-white hover:opacity-90 ${
              availableRetailers.length === 0 ? "opacity-60" : ""
            }`}
            disabled={availableRetailers.length === 0}
            onClick={() => setOpen(!open)}
          >
            <span className="text-white/80">Retailers:</span>
            <span className="tabular-nums">{label}</span>
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-72 p-0 overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-border/60">
          <div className="text-sm font-semibold">{title}</div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="rounded-md p-1 hover:bg-muted/40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CheckboxRow
          checked={allSelected}
          label="All Stores"
          onToggle={() => setAll(!allSelected)}
          isHeaderRow
        />

        <div className="max-h-72 overflow-auto">
          {availableRetailers.map((r) => (
            <CheckboxRow
              key={r}
              checked={selectedRetailers.has(r)}
              label={r}
              onToggle={() => toggleRetailer(r)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Generic multi-select dropdown
 */
function MultiSelectDropdown({
  align = "start",
  compact = true,
  title,
  buttonLabel,
  options,
  selected,
  setSelected,
  open,
  setOpen,
}: {
  align?: "start" | "center" | "end";
  compact?: boolean;
  title: string;
  buttonLabel: string;
  options: string[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const allSelected = options.length > 0 && selected.size === options.length;
  const noneSelected = selected.size === 0;

  const label =
    options.length === 0
      ? "—"
      : allSelected
      ? "All"
      : `${selected.size}/${options.length}`;

  const toggleOne = (v: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
    requestAnimationFrame(() => setOpen(true));
  };

  const selectAll = () => {
    setSelected(new Set(options));
    requestAnimationFrame(() => setOpen(true));
  };

  const deselectAll = () => {
    setSelected(new Set());
    requestAnimationFrame(() => setOpen(true));
  };

  const CheckboxRow = ({
    checked,
    label: rowLabel,
    onToggle,
    isHeaderRow = false,
  }: {
    checked: boolean;
    label: string;
    onToggle: () => void;
    isHeaderRow?: boolean;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={[
        "w-full flex items-center gap-3 px-3 py-3 text-left",
        "hover:bg-muted/40 active:bg-muted/50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "border-b border-border/60",
        isHeaderRow ? "font-medium" : "",
      ].join(" ")}
    >
      <span
        className="h-5 w-5 rounded border border-border flex items-center justify-center bg-background"
        aria-hidden="true"
      >
        {checked ? <Check className="h-4 w-4" /> : null}
      </span>
      <span className="text-sm">{rowLabel}</span>
    </button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between h-8 text-xs"
            disabled={options.length === 0}
            onClick={() => setOpen(!open)}
          >
            <span className="truncate">{buttonLabel}</span>
            <span className="text-muted-foreground tabular-nums">{label}</span>
          </Button>
        ) : (
          <button
            type="button"
            className={`flex items-center gap-2 text-sm font-medium hover:opacity-90 ${
              options.length === 0 ? "opacity-60" : ""
            }`}
            disabled={options.length === 0}
            onClick={() => setOpen(!open)}
          >
            <span className="opacity-80">{buttonLabel}:</span>
            <span className="tabular-nums">{label}</span>
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-80 p-0 overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-border/60">
          <div className="text-sm font-semibold">{title}</div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="rounded-md p-1 hover:bg-muted/40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CheckboxRow
          checked={allSelected}
          label="Select All"
          onToggle={() => (allSelected ? deselectAll() : selectAll())}
          isHeaderRow
        />
        <CheckboxRow
          checked={noneSelected}
          label="De-select All"
          onToggle={deselectAll}
          isHeaderRow
        />

        <div className="max-h-72 overflow-auto">
          {options.map((opt) => (
            <CheckboxRow
              key={opt}
              checked={selected.has(opt)}
              label={opt}
              onToggle={() => toggleOne(opt)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Deals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, items } = useCart();
  const { toast } = useToast();

  // --- State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [radius, setRadius] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initialSearchDone, setInitialSearchDone] = useState(false);
  const [editableCartItems, setEditableCartItems] = useState<EditableCartItem[]>(
    []
  );

  const [singleItemDeals, setSingleItemDeals] = useState<OptimizedCartItem[]>(
    []
  );

  const [refineOpen, setRefineOpen] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  // Pagination for single-item results
  const [singleItemPage, setSingleItemPage] = useState(1);

  // Sort option for single-item results
  const [sortOption, setSortOption] = useState<
    "none" | "price-asc" | "price-desc"
  >("none");

  // --- Retailer filter state ---
  const [availableRetailers, setAvailableRetailers] = useState<string[]>([]);
  const [selectedRetailers, setSelectedRetailers] = useState<Set<string>>(
    new Set()
  );

  // keep last menu so refine dropdowns can be populated
  const [dealMenuCache, setDealMenuCache] = useState<DealMenuItem[]>([]);

  // independent open states so the menu doesn't remount/reset on selection
  const [retailersOpenRow, setRetailersOpenRow] = useState(false);
  const [retailersOpenPanel, setRetailersOpenPanel] = useState(false);

  // per-item refine selections (multi-select) for Brand/Size/Details
  const [refineSelected, setRefineSelected] = useState<
    Array<{ brands: Set<string>; sizes: Set<string>; details: Set<string> }>
  >([]);

  // per-item open states for the refine dropdown menus
  const [refineDropdownOpen, setRefineDropdownOpen] = useState<
    Record<string, boolean>
  >({});

  const setRefineOpenKey = (key: string, v: boolean) =>
    setRefineDropdownOpen((prev) => ({ ...prev, [key]: v }));

  // --- Featured Mode States (pre-search) ---
  const [featuredByCategory, setFeaturedByCategory] = useState<
    Record<string, OptimizedCartItem[]>
  >({});
  const [loadingFeatured, setLoadingFeatured] = useState(false);
  const [carouselScrollStates, setCarouselScrollStates] = useState<
    Record<string, { atStart: boolean; atEnd: boolean }>
  >({});
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // --- Default zip logic (guest: 90064, signed-in: waitlist.zip_code) ---
  const [resolvedDefaultZip, setResolvedDefaultZip] = useState<string>("90064");
  const effectiveZip = useMemo(() => {
    const z = zipcode.trim();
    if (z) return z;
    return resolvedDefaultZip || "90064";
  }, [zipcode, resolvedDefaultZip]);

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
        setResolvedDefaultZip(wlZip && /^\d{5}$/.test(wlZip) ? wlZip : "90064");
      } catch {
        setResolvedDefaultZip("90064");
      }
    };

    resolveZip();
  }, [user]);

  const cartTotal = useMemo(() => {
    const total = items.reduce(
      (sum: number, it: any) => sum + (Number(it?.price) || 0),
      0
    );
    return total;
  }, [items]);

  // Paginated single-item results (with sorting applied)
  const paginatedSingleItemDeals = useMemo(() => {
    let sortedDeals = [...singleItemDeals];

    if (sortOption === "price-asc") {
      sortedDeals = sortedDeals.sort(
        (a, b) => a.product_price - b.product_price
      );
    } else if (sortOption === "price-desc") {
      sortedDeals = sortedDeals.sort(
        (a, b) => b.product_price - a.product_price
      );
    }

    const startIndex = (singleItemPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedDeals.slice(startIndex, endIndex);
  }, [singleItemDeals, singleItemPage, sortOption]);

  const singleItemTotalPages = Math.ceil(singleItemDeals.length / ITEMS_PER_PAGE);

  // --- Sticky dropdown panel ---
  const [locationPanelOpen, setLocationPanelOpen] = useState(false);
  const locationPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!locationPanelOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      if (target.closest("[data-radix-portal]")) return;

      const el = locationPanelRef.current;
      if (!el) return;

      if (!el.contains(target)) {
        if (retailersOpenPanel) return;
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
  }, [locationPanelOpen, retailersOpenPanel]);

  const openLocationPanel = () => setLocationPanelOpen(true);

  // --- Featured Mode: Fetch deals on initial load ---
  useEffect(() => {
    if (initialSearchDone) return; // only fetch when in browse mode

    const fetchFeatured = async () => {
      setLoadingFeatured(true);
      try {
        // Query flyer_deals for featured items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rawDeals, error } = await (supabase as any)
          .from("flyer_deals")
          .select("*")
          .eq("zip_code", effectiveZip)
          .neq("retailer", "Dollar Tree") // exclude Dollar Tree
          .not("product_price", "is", null)
          .order("product_price", { ascending: true })
          .limit(500);

        if (error) throw error;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deals = (rawDeals || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((d: any) => d?.product_name && d?.product_price != null)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((d: any) => ({
            searched_item: "",
            product_name: d.product_name,
            product_price: Number(d.product_price),
            retailer: d.retailer || "",
            zip_code: d.zip_code || effectiveZip,
            distance_m: 0,
            product_size: d.product_size ?? null,
            image_link: d.image_link ?? null,
            retailer_logo_url: d.retailer_logo_url ?? null,
          }));

        // Group by category
        const grouped: Record<string, OptimizedCartItem[]> = {};

        for (const cat of FEATURED_CATEGORIES) {
          const matching = deals.filter((d: OptimizedCartItem) => matchesCategory(d, cat));

          // Anchor picks: cheapest deal for each keyword
          const anchorPicks: OptimizedCartItem[] = [];
          for (const kw of cat.keywords) {
            const kwMatches = matching.filter((d: OptimizedCartItem) =>
              d.product_name.toLowerCase().includes(kw.toLowerCase())
            );
            if (kwMatches.length > 0) {
              kwMatches.sort((a: OptimizedCartItem, b: OptimizedCartItem) => a.product_price - b.product_price);
              anchorPicks.push(kwMatches[0]);
            }
          }

          // Fill picks: best value score
          const fillPicks = matching
            .filter((d: OptimizedCartItem) => !anchorPicks.some((a: OptimizedCartItem) => a.product_name === d.product_name))
            .sort((a: OptimizedCartItem, b: OptimizedCartItem) => valueScore(a.product_price, a.product_size) - valueScore(b.product_price, b.product_size));

          const combined = [...anchorPicks, ...fillPicks].slice(0, FEATURED_LIMIT);
          grouped[cat.key] = combined;
        }

        setFeaturedByCategory(grouped);
      } catch (err) {
        console.error("Failed to fetch featured deals:", err);
      } finally {
        setLoadingFeatured(false);
      }
    };

    fetchFeatured();
  }, [initialSearchDone, effectiveZip]);

  // --- Carousel scroll helpers ---
  const checkScrollPosition = (key: string) => {
    const el = carouselRefs.current[key];
    if (!el) return;

    const atStart = el.scrollLeft <= 0;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;

    setCarouselScrollStates((prev) => ({
      ...prev,
      [key]: { atStart, atEnd },
    }));
  };

  const handleCarouselScroll = (key: string, direction: "left" | "right") => {
    const el = carouselRefs.current[key];
    if (!el) return;

    const scrollAmount = 300;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });

    setTimeout(() => checkScrollPosition(key), 300);
  };

  // Initialize carousel scroll states
  useEffect(() => {
    for (const cat of FEATURED_CATEGORIES) {
      checkScrollPosition(cat.key);
    }
  }, [featuredByCategory]);

  // Refresh featured deals (for browse mode)
  const refreshFeatured = async () => {
    setLoadingFeatured(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawDeals, error } = await (supabase as any)
        .from("flyer_deals")
        .select("*")
        .eq("zip_code", effectiveZip)
        .neq("retailer", "Dollar Tree")
        .not("product_price", "is", null)
        .order("product_price", { ascending: true })
        .limit(500);

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deals = (rawDeals || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((d: any) => d?.product_name && d?.product_price != null)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((d: any) => ({
          searched_item: "",
          product_name: d.product_name,
          product_price: Number(d.product_price),
          retailer: d.retailer || "",
          zip_code: d.zip_code || effectiveZip,
          distance_m: 0,
          product_size: d.product_size ?? null,
          image_link: d.image_link ?? null,
          retailer_logo_url: d.retailer_logo_url ?? null,
        }));

      const grouped: Record<string, OptimizedCartItem[]> = {};

      for (const cat of FEATURED_CATEGORIES) {
        const matching = deals.filter((d: OptimizedCartItem) => matchesCategory(d, cat));

        const anchorPicks: OptimizedCartItem[] = [];
        for (const kw of cat.keywords) {
          const kwMatches = matching.filter((d: OptimizedCartItem) =>
            d.product_name.toLowerCase().includes(kw.toLowerCase())
          );
          if (kwMatches.length > 0) {
            kwMatches.sort((a: OptimizedCartItem, b: OptimizedCartItem) => a.product_price - b.product_price);
            anchorPicks.push(kwMatches[0]);
          }
        }

        const fillPicks = matching
          .filter((d: OptimizedCartItem) => !anchorPicks.some((a: OptimizedCartItem) => a.product_name === d.product_name))
          .sort((a: OptimizedCartItem, b: OptimizedCartItem) => valueScore(a.product_price, a.product_size) - valueScore(b.product_price, b.product_size));

        const combined = [...anchorPicks, ...fillPicks].slice(0, FEATURED_LIMIT);
        grouped[cat.key] = combined;
      }

      setFeaturedByCategory(grouped);
    } catch (err) {
      console.error("Failed to refresh featured deals:", err);
    } finally {
      setLoadingFeatured(false);
    }
  };

  // --- Logic Helpers ---
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

  // --- Retailer helpers ---
  const getUniqueRetailersFromMenu = (dealMenu: DealMenuItem[]) => {
    return Array.from(
      new Set((dealMenu || []).map((d) => d.retailer).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  };

  const getEffectiveSelectedRetailersForRun = (unique: string[]) => {
    setAvailableRetailers(unique);

    if (selectedRetailers.size === 0) {
      const all = new Set(unique);
      setSelectedRetailers(all);
      return all;
    }

    const next = new Set<string>();
    for (const r of unique) if (selectedRetailers.has(r)) next.add(r);
    setSelectedRetailers(next);
    return next;
  };

  const applyRetailerFilterWithSet = (
    dealMenu: DealMenuItem[],
    allowed: Set<string>
  ) => {
    if (allowed.size === 0) return [];
    return dealMenu.filter((d) => allowed.has(d.retailer));
  };

  // Build dropdown options for Refine Search from the cached deal menu
  const refineOptionsByName = useMemo(() => {
    const map = new Map<
      string,
      { brands: string[]; sizes: string[]; details: string[] }
    >();

    for (const d of dealMenuCache || []) {
      const key = (d?.searched_item_name || "").trim();
      if (!key) continue;

      if (!map.has(key)) map.set(key, { brands: [], sizes: [], details: [] });
      const bucket = map.get(key)!;

      if (d?.product_name) bucket.brands.push(String(d.product_name));

      if (d?.product_size) bucket.sizes.push(String(d.product_size));
      if (d?.product_name) bucket.details.push(String(d.product_name));
    }

    const uniq = (arr: string[]) =>
      Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      );

    for (const [k, v] of map.entries()) {
      map.set(k, {
        brands: uniq(v.brands).slice(0, 80),
        sizes: uniq(v.sizes).slice(0, 80),
        details: uniq(v.details).slice(0, 80),
      });
    }

    return map;
  }, [dealMenuCache]);

  // Keep refineSelected in sync with the current item list + current options
  useEffect(() => {
    if (!initialSearchDone) return;
    if (editableCartItems.length === 0) return;

    setRefineSelected((prev) => {
      const next: Array<{
        brands: Set<string>;
        sizes: Set<string>;
        details: Set<string>;
      }> = [];

      for (let i = 0; i < editableCartItems.length; i++) {
        const item = editableCartItems[i];
        const opts =
          refineOptionsByName.get(item.name) || { brands: [], sizes: [], details: [] };

        const prevEntry = prev[i] || {
          brands: new Set<string>(),
          sizes: new Set<string>(),
          details: new Set<string>(),
        };

        const normalize = (selected: Set<string>, options: string[]) => {
          const optSet = new Set(options);
          // default empty -> all
          if (selected.size === 0) return new Set(options);
          // intersect with current options
          const intersect = new Set<string>();
          for (const v of selected) if (optSet.has(v)) intersect.add(v);
          // if everything got removed (e.g., name changed), default to all
          return intersect.size === 0 ? new Set(options) : intersect;
        };

        next.push({
          brands: normalize(prevEntry.brands, opts.brands),
          sizes: normalize(prevEntry.sizes, opts.sizes),
          details: normalize(prevEntry.details, opts.details),
        });
      }

      return next;
    });
  }, [initialSearchDone, editableCartItems, refineOptionsByName]);

  // Apply refine filters to dealMenu based on refineSelected
  const applyRefineFilters = (dealMenu: DealMenuItem[]) => {
    if (!dealMenu || dealMenu.length === 0) return [];

    // map item name -> selection sets
    const selectionByName = new Map<
      string,
      { brands: Set<string>; sizes: Set<string>; details: Set<string> }
    >();

    editableCartItems.forEach((it, idx) => {
      const sel = refineSelected[idx];
      if (!sel) return;
      selectionByName.set(it.name, sel);
    });

    return dealMenu.filter((d) => {
      const name = (d.searched_item_name || "").trim();
      const sel = selectionByName.get(name);
      if (!sel) return true;

      const opts =
        refineOptionsByName.get(name) || { brands: [], sizes: [], details: [] };

      // Treat empty set as "all selected" (no filtering)
      const isAll = (selected: Set<string>, options: string[]) =>
        selected.size === 0 || (options.length > 0 && selected.size === options.length);

      // Brand filter (exact match on candidate string)
      if (opts.brands.length > 0 && !isAll(sel.brands, opts.brands)) {
        const val = d.product_name || "";
        if (!sel.brands.has(val)) return false;
      }

      // Size filter
      if (opts.sizes.length > 0 && !isAll(sel.sizes, opts.sizes)) {
        const val = d.product_size || "";
        if (!sel.sizes.has(val)) return false;
      }

      // Details filter
      if (opts.details.length > 0 && !isAll(sel.details, opts.details)) {
        const val = d.product_name || "";
        if (!sel.details.has(val)) return false;
      }

      return true;
    });
  };

  const handleRunSearch = async (itemsToFind: EditableCartItem[]) => {
    setLoading(true);
    setError(null);
    setSingleItemDeals([]);
    setSingleItemPage(1);
    setSortOption("none");

    const searchTerms = itemsToFind.map((item) => item.name).filter(Boolean);

    if (searchTerms.length === 0) {
      setError("Please enter an item to search.");
      setLoading(false);
      return;
    }

    // Only allow ONE item - strip semicolons and show error if multiple items detected
    if (searchTerms.length > 1) {
      setError("Only one product search is allowed. Please remove semicolons and search for a single item.");
      setLoading(false);
      return;
    }

    const zipForRpc = (effectiveZip || "").trim();
    if (!/^\d{5}$/.test(zipForRpc)) {
      setError("Invalid zip code.");
      setLoading(false);
      return;
    }

    const radiusNum = parseInt(radius, 10);
    const meters = Math.round(radiusNum * 1609.34);

    try {
      const minDate = getLatestRefreshDate();

      // Single item: use search_deals_fuzzy
      const { data: rawData, error: rpcError } = await supabase.rpc(
        "search_deals_fuzzy",
        {
          search_terms: searchTerms,
          user_zip: zipForRpc,
          max_distance_meters: meters,
          radius_meters: meters,
          min_date: minDate,
          max_rows: 500,
        }
      );

      if (rpcError) throw rpcError;

      const rawDeals = (rawData as any[]) || [];

      // Filter out null prices and normalize
      const normalizedDeals: DealMenuItem[] = rawDeals
        .filter((d) => d?.product_name != null)
        .filter(
          (d) =>
            d?.product_price != null &&
            !Number.isNaN(Number(d.product_price))
        )
        .map((d) => ({
          retailer: d.retailer,
          zip_code: d.zip_code,
          searched_item_name: searchTerms[0],
          product_name: d.product_name,
          product_price: Number(d.product_price),
          distance_m: d.distance_m ?? 0,
          product_size: d.product_size ?? null,
          image_link: d.image_link ?? null,
          retailer_logo_url: d.retailer_logo_url ?? null,
        }));

      setDealMenuCache(normalizedDeals);

      if (!normalizedDeals || normalizedDeals.length === 0) {
        setError(
          "No recent deals found for this combination. Try broadening your search."
        );
        return;
      }

      const uniqueRetailers = getUniqueRetailersFromMenu(normalizedDeals);
      const effectiveSelected =
        getEffectiveSelectedRetailersForRun(uniqueRetailers);

      const filteredByRetailers = applyRetailerFilterWithSet(
        normalizedDeals,
        effectiveSelected
      );

      if (!filteredByRetailers || filteredByRetailers.length === 0) {
        setError(
          "No deals remain after applying your retailer filter. Re-enable at least one retailer."
        );
        return;
      }

      // Apply Refine Search filters
      const filteredDealMenu = applyRefineFilters(filteredByRetailers);

      if (!filteredDealMenu || filteredDealMenu.length === 0) {
        setError("No deals remain after applying your refine filters.");
        return;
      }

      // Map to OptimizedCartItem format
      const allResults: OptimizedCartItem[] = filteredDealMenu.map((d) => ({
        searched_item: searchTerms[0],
        product_name: d.product_name,
        product_price: Number(d.product_price),
        retailer: d.retailer,
        zip_code: d.zip_code,
        distance_m: d.distance_m,
        product_size: d.product_size ?? null,
        image_link: d.image_link ?? null,
        retailer_logo_url: d.retailer_logo_url ?? null,
      }));

      // Apply fuzzy filter to match only relevant products
      const fuzzyFiltered = allResults.filter((item) =>
        productMatchesFilter(item.product_name, searchTerms[0])
      );

      // Sort by price, then distance
      const normalized = fuzzyFiltered.sort((a, b) => {
        if (a.product_price !== b.product_price)
          return a.product_price - b.product_price;
        return a.distance_m - b.distance_m;
      });

      setSingleItemDeals(normalized);
    } catch (err: any) {
      console.error("Search Error:", err);
      setError(err.message || "Failed to search deals.");
    } finally {
      setLoading(false);
    }
  };

  const parseSearchTerms = (q: string) => {
    // Strip semicolons from input
    const cleaned = q.replace(/;/g, " ").trim();
    return cleaned.length > 0 ? [cleaned] : [];
  };

  const submitSearch = async () => {
    const searchTerms = parseSearchTerms(searchQuery);

    if (searchTerms.length === 0) {
      setError("Please enter an item to search.");
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

    setRefineOpen(false);

    // init refineSelected shape (actual sets get defaulted to all once options arrive)
    setRefineSelected(
      initialItems.map(() => ({
        brands: new Set<string>(),
        sizes: new Set<string>(),
        details: new Set<string>(),
      }))
    );

    await handleRunSearch(initialItems);
    setLocationPanelOpen(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitSearch();
  };

  const handleReRunSearch = async () => {
    await handleRunSearch(editableCartItems);
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

  // grid is 2-cols on mobile/half screen, 3-cols on full screen (lg)
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
              src={normalizeImageUrl(item.image_link)}
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
                <p className="text-xs text-muted-foreground">
                  Size: {item.product_size}
                </p>
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
                <p className="text-xs text-muted-foreground truncate">
                  {item.retailer}
                </p>
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
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background text-foreground">
      {/* STICKY TOP AREA */}
      <div className="sticky top-0 z-20 bg-prox">
        <div
          ref={locationPanelRef}
          className="mx-auto max-w-3xl px-4 py-3 space-y-3"
        >
          {/* Row 1: Search + Cart */}
          <div className="flex items-start gap-3">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/50" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a product..."
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

          {/* Row 2: Zip + Radius + Retailers */}
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
              <ChevronDown
                className={`h-4 w-4 text-white/80 transition-transform ${
                  locationPanelOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <RetailersDropdown
              align="end"
              compact={false}
              title="Choose Stores."
              availableRetailers={availableRetailers}
              selectedRetailers={selectedRetailers}
              setSelectedRetailers={setSelectedRetailers}
              open={retailersOpenRow}
              setOpen={setRetailersOpenRow}
            />
          </div>

          {/* Drop-down panel */}
          {locationPanelOpen && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-soft p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Update search settings</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocationPanelOpen(false)}
                >
                  Close
                </Button>
              </div>

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
                  <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Retailers
                  </Label>

                  <RetailersDropdown
                    align="start"
                    compact
                    title="Choose Stores."
                    availableRetailers={availableRetailers}
                    selectedRetailers={selectedRetailers}
                    setSelectedRetailers={setSelectedRetailers}
                    open={retailersOpenPanel}
                    setOpen={setRetailersOpenPanel}
                  />
                </div>
              </div>

              <Button
                onClick={initialSearchDone ? handleReRunSearch : refreshFeatured}
                disabled={loading || loadingFeatured}
                className="mt-4 w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm"
              >
                {loading || loadingFeatured ? "Searching..." : initialSearchDone ? "Search deals" : "Refresh deals"}
              </Button>

              {error && (
                <div className="mt-2 text-xs font-medium text-red-600">{error}</div>
              )}

              <p className="mt-2 text-[10px] text-gray-400 text-right">
                Prices reflect the most recent weekly update.
              </p>
            </div>
          )}

          {/* Refine Search */}
          {initialSearchDone && editableCartItems.length >= 1 && (
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

                    {editableCartItems.map((item, idx) => {
                      const opts =
                        refineOptionsByName.get(item.name) || {
                          brands: [],
                          sizes: [],
                          details: [],
                        };

                      const sel = refineSelected[idx] || {
                        brands: new Set<string>(),
                        sizes: new Set<string>(),
                        details: new Set<string>(),
                      };

                      const keyBrand = `refine-${idx}-brand`;
                      const keySize = `refine-${idx}-size`;
                      const keyDetails = `refine-${idx}-details`;

                      return (
                        <div key={idx} className="grid grid-cols-4 gap-2">
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              handleEditCartItem(idx, "name", e.target.value)
                            }
                            className="text-xs px-2 h-8"
                          />

                          <MultiSelectDropdown
                            title="Choose Brand(s)"
                            buttonLabel="Brand"
                            options={opts.brands}
                            selected={sel.brands}
                            setSelected={(updater) =>
                              setRefineSelected((prev) => {
                                const next = [...prev];
                                const curr = next[idx] || {
                                  brands: new Set<string>(),
                                  sizes: new Set<string>(),
                                  details: new Set<string>(),
                                };
                                const newBrands =
                                  typeof updater === "function"
                                    ? updater(curr.brands)
                                    : updater;
                                next[idx] = { ...curr, brands: newBrands };
                                return next;
                              })
                            }
                            open={!!refineDropdownOpen[keyBrand]}
                            setOpen={(v) => setRefineOpenKey(keyBrand, v)}
                            align="start"
                            compact
                          />

                          <MultiSelectDropdown
                            title="Choose Size(s)"
                            buttonLabel="Size"
                            options={opts.sizes}
                            selected={sel.sizes}
                            setSelected={(updater) =>
                              setRefineSelected((prev) => {
                                const next = [...prev];
                                const curr = next[idx] || {
                                  brands: new Set<string>(),
                                  sizes: new Set<string>(),
                                  details: new Set<string>(),
                                };
                                const newSizes =
                                  typeof updater === "function"
                                    ? updater(curr.sizes)
                                    : updater;
                                next[idx] = { ...curr, sizes: newSizes };
                                return next;
                              })
                            }
                            open={!!refineDropdownOpen[keySize]}
                            setOpen={(v) => setRefineOpenKey(keySize, v)}
                            align="start"
                            compact
                          />

                          <MultiSelectDropdown
                            title="Choose Detail(s)"
                            buttonLabel="Details"
                            options={opts.details}
                            selected={sel.details}
                            setSelected={(updater) =>
                              setRefineSelected((prev) => {
                                const next = [...prev];
                                const curr = next[idx] || {
                                  brands: new Set<string>(),
                                  sizes: new Set<string>(),
                                  details: new Set<string>(),
                                };
                                const newDetails =
                                  typeof updater === "function"
                                    ? updater(curr.details)
                                    : updater;
                                next[idx] = { ...curr, details: newDetails };
                                return next;
                              })
                            }
                            open={!!refineDropdownOpen[keyDetails]}
                            setOpen={(v) => setRefineOpenKey(keyDetails, v)}
                            align="start"
                            compact
                          />
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={handleReRunSearch}
                    disabled={loading}
                    className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm"
                  >
                    {loading ? "Searching…" : "Re-run search"}
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
          {/* Featured Deals - Browse Mode (before search) */}
          {!initialSearchDone && (
            <div className="space-y-6">
              {loadingFeatured && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Loading featured deals…
                </p>
              )}

              {!loadingFeatured &&
                FEATURED_CATEGORIES.map((cat) => {
                  const items = featuredByCategory[cat.key] || [];
                  if (items.length === 0) return null;

                  const scrollState = carouselScrollStates[cat.key] || {
                    atStart: true,
                    atEnd: false,
                  };

                  return (
                    <div
                      key={cat.key}
                      className="rounded-2xl border border-border/60 bg-card shadow-soft p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold">{cat.label}</h2>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCarouselScroll(cat.key, "left")}
                            disabled={scrollState.atStart}
                            className="h-8 w-8 rounded-full border border-border bg-background flex items-center justify-center disabled:opacity-30 hover:bg-muted transition"
                            aria-label="Scroll left"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCarouselScroll(cat.key, "right")}
                            disabled={scrollState.atEnd}
                            className="h-8 w-8 rounded-full border border-border bg-background flex items-center justify-center disabled:opacity-30 hover:bg-muted transition"
                            aria-label="Scroll right"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div
                        ref={(el) => {
                          carouselRefs.current[cat.key] = el;
                        }}
                        onScroll={() => checkScrollPosition(cat.key)}
                        className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
                      >
                        {items.map((item, idx) => {
                          const key = `${item.product_name}-${item.retailer}-${item.zip_code}-${item.product_price}-${idx}`;
                          const isAdded = addedItems.has(key);

                          return (
                            <div
                              key={key}
                              className="flex-shrink-0 w-[160px] rounded-xl border border-border/60 bg-background/50 p-3 relative transition-shadow hover:shadow-md"
                            >
                              <img
                                src={normalizeImageUrl(item.image_link)}
                                alt={item.product_name}
                                className="h-28 w-full rounded-md border bg-gray-50 object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = PLACEHOLDER_IMG;
                                }}
                              />

                              <div className="mt-2 pb-8">
                                <p className="text-sm font-semibold text-foreground line-clamp-2">
                                  {item.product_name}
                                </p>

                                {item.product_size && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {item.product_size}
                                  </p>
                                )}

                                <p className="mt-1 text-lg font-bold text-green-600">
                                  ${Number(item.product_price).toFixed(2)}
                                </p>

                                <div className="flex items-center gap-1 mt-1">
                                  {item.retailer_logo_url && (
                                    <img
                                      src={item.retailer_logo_url}
                                      alt="logo"
                                      className="h-4 w-auto object-contain"
                                    />
                                  )}
                                  <p className="text-xs text-muted-foreground truncate">
                                    {item.retailer}
                                  </p>
                                </div>
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
                                  {isAdded ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Plus className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Results section - Search Mode (after search) */}
          {initialSearchDone && (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Results</h2>
                  <p className="text-xs text-muted-foreground">
                    Showing {paginatedSingleItemDeals.length} of {singleItemDeals.length} deals · Near {effectiveZip} ·{" "}
                    {radius} miles
                  </p>
                </div>

                {!loading && singleItemDeals.length > 0 && (
                  <Select
                    value={sortOption}
                    onValueChange={(value) => {
                      setSortOption(value as "none" | "price-asc" | "price-desc");
                      setSingleItemPage(1);
                    }}
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

              {loading && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Loading deals…
                </p>
              )}

              {!loading && singleItemDeals.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {initialSearchDone
                    ? "No deals found. Try a different radius or zip code."
                    : "Search for a product above to see deals."}
                </p>
              )}

              {!loading && singleItemDeals.length > 0 && (
                <>
                  {renderItemsGrid(paginatedSingleItemDeals)}

                  {/* Pagination controls */}
                  {singleItemTotalPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-3 text-xs border-t pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setSingleItemPage((p) => Math.max(1, p - 1))}
                        disabled={singleItemPage === 1}
                        className="rounded-full px-3 py-1 text-xs h-8"
                      >
                        Previous
                      </Button>
                      <span className="text-muted-foreground">
                        Page {singleItemPage} of {singleItemTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setSingleItemPage((p) => Math.min(singleItemTotalPages, p + 1))}
                        disabled={singleItemPage === singleItemTotalPages}
                        className="rounded-full px-3 py-1 text-xs h-8"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav current="Deals" />
    </div>
  );
}
