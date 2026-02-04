import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
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
  Upload,
  Camera,
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

// Map marker data for the store map visualization
type MapStorePoint = {
  idx: number;                // 0..4
  labelNumber: number;        // 1..5
  retailer: string;
  zip_code: string;
  total: number;
  distance_m: number;
  retailer_logo_url: string | null;
  lat?: number;               // Not available yet - see TODO below
  lng?: number;               // Not available yet - see TODO below
};

const MAX_CANDIDATE_STORES = 30;
const PLACEHOLDER_IMG = "https://via.placeholder.com/100x100.png?text=No+Image";

// --- Zip Centroid Lookup with Nominatim (cached) ---
type ZipCentroid = { lat: number; lng: number } | null;
const zipCentroidCache = new Map<string, ZipCentroid>();

async function getZipCentroid(zip: string): Promise<ZipCentroid> {
  if (!/^\d{5}$/.test(zip)) return null;

  // Check cache first
  if (zipCentroidCache.has(zip)) {
    return zipCentroidCache.get(zip)!;
  }

  try {
    // Use OpenStreetMap Nominatim (free, no API key required)
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ProxApp/1.0 (grocery price comparison)",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      const result: ZipCentroid = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
      zipCentroidCache.set(zip, result);
      return result;
    }

    // No results found
    zipCentroidCache.set(zip, null);
    return null;
  } catch (error) {
    console.warn("Failed to fetch zip centroid:", error);
    zipCentroidCache.set(zip, null);
    return null;
  }
}

// --- Deterministic Jitter for Map Markers ---
// Simple string hash function for deterministic results
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Convert hash to float between 0 and 1
function hashToFloat(seed: string, idx: number): number {
  const combined = `${seed}-${idx}`;
  const hash = hashString(combined);
  return (hash % 10000) / 10000;
}

// Generate jittered coordinates around a centroid
const JITTER_RANGE = 0.005; // ~0.5km / 0.3 miles

function getJitteredCoordinates(
  centroid: { lat: number; lng: number },
  seed: string,
  idx: number
): { lat: number; lng: number } {
  // Use different seeds for lat and lng to avoid diagonal patterns
  const latOffset = (hashToFloat(seed + "lat", idx) - 0.5) * JITTER_RANGE * 2;
  const lngOffset = (hashToFloat(seed + "lng", idx) - 0.5) * JITTER_RANGE * 2;

  return {
    lat: centroid.lat + latOffset,
    lng: centroid.lng + lngOffset,
  };
}

// --- Custom Leaflet Marker Icon ---
function createStoreMarkerIcon(
  labelNumber: number,
  price: number,
  isSelected: boolean
): L.DivIcon {
  const bgColor = isSelected ? "#10B981" : "#6366F1"; // green if selected, indigo otherwise
  const priceText = `$${price.toFixed(2)}`;

  return L.divIcon({
    className: "custom-store-marker",
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
      ">
        <div style="
          background: white;
          border: 2px solid ${bgColor};
          border-radius: 8px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 700;
          color: #059669;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        ">${priceText}</div>
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${bgColor};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          margin-top: 2px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">${labelNumber}</div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid ${bgColor};
          margin-top: -2px;
        "></div>
      </div>
    `,
    iconSize: [60, 70],
    iconAnchor: [30, 70],
  });
}

// --- Map Bounds Fitter Component ---
function FitBoundsToMarkers({ points }: { points: Array<{ lat: number; lng: number }> }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [map, points]);

  return null;
}

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
 * ✅ Retailers dropdown:
 * - Does NOT close on each click (stays open until click outside or press X)
 * - Checkbox rows styled more like your screenshot
 * - Works in BOTH the sticky row and the panel (two independent open states)
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
 * ✅ Generic multi-select dropdown (Retailers-style)
 * - Select All
 * - De-select All
 * - Checkbox rows
 * - Stays open while toggling
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

  // Selected store index for map marker interaction
  const [selectedStoreIndex, setSelectedStoreIndex] = useState(0);

  // Zip centroid for map positioning
  const [zipCentroid, setZipCentroid] = useState<ZipCentroid>(null);
  const [zipCentroidLoading, setZipCentroidLoading] = useState(false);
  const [zipCentroidError, setZipCentroidError] = useState(false);

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

  // ✅ keep last menu so refine dropdowns can be populated
  const [dealMenuCache, setDealMenuCache] = useState<DealMenuItem[]>([]);

  // ✅ independent open states so the menu doesn't remount/reset on selection
  const [retailersOpenRow, setRetailersOpenRow] = useState(false);
  const [retailersOpenPanel, setRetailersOpenPanel] = useState(false);

  // ✅ per-item refine selections (multi-select) for Brand/Size/Details
  const [refineSelected, setRefineSelected] = useState<
    Array<{ brands: Set<string>; sizes: Set<string>; details: Set<string> }>
  >([]);

  // ✅ per-item open states for the refine dropdown menus
  const [refineDropdownOpen, setRefineDropdownOpen] = useState<
    Record<string, boolean>
  >({});

  const setRefineOpenKey = (key: string, v: boolean) =>
    setRefineDropdownOpen((prev) => ({ ...prev, [key]: v }));

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

  // Fetch zip centroid when effectiveZip changes (for map positioning)
  useEffect(() => {
    const fetchCentroid = async () => {
      const zip = effectiveZip;
      if (!zip || !/^\d{5}$/.test(zip)) {
        setZipCentroid(null);
        setZipCentroidError(true);
        return;
      }

      setZipCentroidLoading(true);
      setZipCentroidError(false);

      const result = await getZipCentroid(zip);
      setZipCentroid(result);
      setZipCentroidError(result === null);
      setZipCentroidLoading(false);
    };

    fetchCentroid();
  }, [effectiveZip]);

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

  // --- Sticky dropdown panel (Deals-style) ---
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
        if (a.product_price !== b.product_price)
          return a.product_price - b.product_price;
        return a.distance_m - b.distance_m;
      });
      const topKDeals = itemDeals.slice(0, topK);
      for (const deal of topKDeals)
        candidateStoreIds.add(`${deal.retailer}@${deal.zip_code}`);
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
        for (
          let j = index;
          j <= uniqueStoreIds.length - (k - currentCombo.length);
          j++
        ) {
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

  // ✅ Build dropdown options for Refine Search from the cached deal menu
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

      // NOTE: You currently treat Brand as product_name. Keeping consistent with your current behavior.
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

  // ✅ Keep refineSelected in sync with the current item list + current options:
  // - if empty, default to "all selected"
  // - if options shrink, intersect
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

  // ✅ Apply refine filters to dealMenu based on refineSelected
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

      // ✅ Treat empty set as "all selected" (no filtering)
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

  const handleRunOptimizer = async (itemsToFind: EditableCartItem[]) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSingleStoreResults([]);
    setSingleItemDeals([]);
    setSingleItemPage(1); // Reset pagination
    setSortOption("none"); // Reset sort to default

    const searchTerms = itemsToFind.map((item) => item.name).filter(Boolean);

    if (searchTerms.length === 0) {
      setError("Your item list is empty.");
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
    const retailerLimit = parseInt(retailerCountLimit, 10);

    try {
      const minDate = getLatestRefreshDate();

      // ✅ Single item: use search_deals_fuzzy (like Deals.tsx)
      if (searchTerms.length === 1) {
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

        // ✅ Filter out null prices and normalize
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

        // ✅ Apply Refine Search filters
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

        // ✅ Apply fuzzy filter to match only relevant products (like Deals.tsx)
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
        return;
      }

      // ✅ Multi-item: use get_deal_menu_v8 (for optimizer)
      const { data: rawData, error: rpcError } = await supabase.rpc(
        "get_deal_menu_v8",
        {
          user_zip: zipForRpc,
          items_to_find: itemsToFind,
          radius_meters: meters,
          min_date: minDate,
        }
      );

      if (rpcError) throw rpcError;

      const rawDeals = (rawData as DealMenuItem[]) || [];

      // ✅ Filter out null prices and normalize
      const dealMenu: DealMenuItem[] = rawDeals
        .filter((d) => d?.product_name != null)
        .filter(
          (d) =>
            d?.product_price != null && !Number.isNaN(Number(d.product_price))
        )
        .map((d) => ({
          ...d,
          product_price: Number(d.product_price),
        }));

      setDealMenuCache(dealMenu);

      if (!dealMenu || dealMenu.length === 0) {
        setError(
          "No recent deals found for this combination. Try broadening your search."
        );
        return;
      }

      const uniqueRetailers = getUniqueRetailersFromMenu(dealMenu);
      const effectiveSelected = getEffectiveSelectedRetailersForRun(uniqueRetailers);

      const filteredByRetailers = applyRetailerFilterWithSet(dealMenu, effectiveSelected);

      if (!filteredByRetailers || filteredByRetailers.length === 0) {
        setError(
          "No deals remain after applying your retailer filter. Re-enable at least one retailer."
        );
        return;
      }

      // ✅ Apply Refine Search filters (brand/size/details multi-select)
      const filteredDealMenu = applyRefineFilters(filteredByRetailers);

      if (!filteredDealMenu || filteredDealMenu.length === 0) {
        setError("No deals remain after applying your refine filters.");
        return;
      }

      const { bestCart, allStoreCarts } = findBestCart(
        filteredDealMenu,
        searchTerms,
        retailerLimit
      );

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
          Array.from(bestByBrand.values())
            .sort((a, b) => a.total_cart_price - b.total_cart_price)
            .slice(0, 5)
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

    // ✅ Refine should exist for single item too; keep collapsed initially
    setRefineOpen(false);

    // init refineSelected shape (actual sets get defaulted to all once options arrive)
    setRefineSelected(
      initialItems.map(() => ({
        brands: new Set<string>(),
        sizes: new Set<string>(),
        details: new Set<string>(),
      }))
    );

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
      {/* DEALS-STYLE STICKY TOP AREA - Only show after initial search */}
      {initialSearchDone && (
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

          {/* Row 2: Zip + Radius + Retailers + Stores */}
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

              <div className="mt-3 grid grid-cols-4 gap-3">
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

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Stores
                  </Label>
                  <Select
                    value={retailerCountLimit}
                    onValueChange={setRetailerCountLimit}
                  >
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

          {/* ✅ Refine Search now shows for single item too */}
          {initialSearchDone && editableCartItems.length >= 1 && (
            <div className="relative z-20 rounded-2xl border border-border/60 bg-white shadow-soft px-4 py-4">
              <button
                type="button"
                onClick={() => setRefineOpen((v) => !v)}
                className="w-full flex items-center justify-between"
              >
                <h2 className="text-lg font-semibold text-foreground">Edit Ingredients</h2>
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
                    {loading ? "Optimizing…" : "Re-run search"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 pb-24">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">

          {/* ============================================================
              LANDING SCREEN (Pre-search)
          ============================================================ */}
          {!initialSearchDone && (
            <div className="space-y-4">
              {/* Card A: Header only */}
              <div className="rounded-2xl border border-border/60 bg-white shadow-soft px-5 py-4">
                {/* Standardized header: Logo (left) | Title (center) | Cart (right) */}
                <div className="flex items-center justify-between">
                  {/* Left: Logo */}
                  <div className="w-12 flex-shrink-0">
                    <img
                      src="/Icon-01.png"
                      alt="Prox"
                      className="h-12 w-auto object-contain"
                    />
                  </div>

                  {/* Center: Title and subtitle */}
                  <div className="flex-1 text-center px-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      Cart Optimizer
                    </h1>
                    <p className="text-sm text-gray-600">
                      Find the cheapest combination of stores for your whole cart.
                    </p>
                  </div>

                  {/* Right: Cart button */}
                  <div className="w-12 flex-shrink-0 flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigate("/cart")}
                      className="relative flex flex-col items-end"
                      aria-label="Cart"
                    >
                      <div className="relative inline-flex items-center justify-center rounded-full bg-prox h-10 w-10 hover:opacity-90 transition">
                        <ShoppingBag className="h-5 w-5 text-white" />
                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                          {items.length}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-foreground tabular-nums">
                        ${cartTotal.toFixed(2)}
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Card B: Content only */}
              <div className="rounded-2xl border border-border/60 bg-white shadow-soft px-6 py-6">
                <div className="space-y-6">

                  {/* Form */}
                  <div className="space-y-4">
                    {/* Items input */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="items-input"
                        className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        1. ENTER ITEMS
                      </Label>
                      <Input
                        id="items-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="e.g., milk; chicken"
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 text-xs"
                          onClick={() => toast({ title: "Coming soon", description: "Upload feature coming soon!", duration: 2000 })}
                        >
                          <Upload className="h-3 w-3" />
                          Upload
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 text-xs"
                          onClick={() => toast({ title: "Coming soon", description: "Scan feature coming soon!", duration: 2000 })}
                        >
                          <Camera className="h-3 w-3" />
                          Scan
                        </Button>
                      </div>
                    </div>

                    {/* Location inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="zip-landing"
                          className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                        >
                          Zip Code
                        </Label>
                        <Input
                          id="zip-landing"
                          type="text"
                          value={zipcode}
                          onChange={(e) => setZipcode(e.target.value)}
                          placeholder={effectiveZip}
                          className="text-sm"
                          maxLength={5}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="radius-landing"
                          className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                        >
                          Radius (Miles)
                        </Label>
                        <Input
                          id="radius-landing"
                          type="number"
                          min="1"
                          value={radius}
                          onChange={(e) => setRadius(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {/* Stores dropdown */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Stores
                      </Label>
                      <Select
                        value={retailerCountLimit}
                        onValueChange={setRetailerCountLimit}
                      >
                        <SelectTrigger className="h-10 text-sm">
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

                    {/* Submit button */}
                    <Button
                      onClick={submitSearch}
                      disabled={loading}
                      className="w-full rounded-full py-3 text-base font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm"
                    >
                      {loading ? "Finding..." : "Find the cheapest cart!"}
                    </Button>

                    {error && (
                      <div className="text-sm font-medium text-red-600 text-center">
                        {error}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <p className="text-[10px] text-gray-400 text-center">
                    Prices reflect the most recent weekly update.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Single item mode */}
          {initialSearchDone && editableCartItems.length === 1 && (
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
                      setSingleItemPage(1); // Reset to page 1 when sorting changes
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
                  No deals found. Try a different radius or zip code.
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

          {/* Multi-item mode */}
          {initialSearchDone && editableCartItems.length > 1 && (
            <div className="space-y-6">
              {/* Store Map - Only show when Stores=1 and we have results */}
              {singleStoreResults.length > 0 && retailerCountLimit === "1" && !loading && (
                (() => {
                  // Derive top 5 stores for map markers
                  const topStores = singleStoreResults.slice(0, 5);

                  // Create map marker data with jittered coordinates
                  const mapPoints: MapStorePoint[] = topStores.map((store, idx) => {
                    // Generate jittered coordinates if we have a centroid
                    let lat: number | undefined;
                    let lng: number | undefined;

                    if (zipCentroid) {
                      // Use retailer + zip as seed for deterministic jitter
                      const seed = `${store.retailer}@${store.zip_code}`;
                      const jittered = getJitteredCoordinates(zipCentroid, seed, idx);
                      lat = jittered.lat;
                      lng = jittered.lng;
                    }

                    return {
                      idx,
                      labelNumber: idx + 1,
                      retailer: store.retailer,
                      zip_code: store.zip_code,
                      total: store.total_cart_price,
                      distance_m: store.distance_m,
                      retailer_logo_url: store.retailer_logo_url,
                      lat,
                      lng,
                    };
                  });

                  const handleMarkerClick = (idx: number) => {
                    setSelectedStoreIndex(idx);
                    // Scroll to the corresponding store row
                    const rowEl = document.getElementById(`single-store-row-${idx}`);
                    if (rowEl) {
                      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  };

                  // Check if we have coordinates for markers
                  const hasCoordinates = zipCentroid !== null && !zipCentroidError;
                  const markerPoints = mapPoints
                    .filter(p => p.lat != null && p.lng != null)
                    .map(p => ({ lat: p.lat!, lng: p.lng! }));

                  return (
                    <div className="relative z-0 rounded-2xl border border-border/60 bg-card shadow-soft overflow-hidden">
                      {/* Real Leaflet Map */}
                      {hasCoordinates && zipCentroid ? (
                        <div className="relative z-0">
                          <MapContainer
                            center={[zipCentroid.lat, zipCentroid.lng]}
                            zoom={13}
                            style={{ height: "220px", width: "100%" }}
                            scrollWheelZoom={false}
                            zoomControl={true}
                          >
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <FitBoundsToMarkers points={markerPoints} />
                            {mapPoints.map((point) => {
                              if (point.lat == null || point.lng == null) return null;
                              return (
                                <Marker
                                  key={point.idx}
                                  position={[point.lat, point.lng]}
                                  icon={createStoreMarkerIcon(
                                    point.labelNumber,
                                    point.total,
                                    selectedStoreIndex === point.idx
                                  )}
                                  eventHandlers={{
                                    click: () => handleMarkerClick(point.idx),
                                  }}
                                />
                              );
                            })}
                          </MapContainer>
                          {/* Caption below map */}
                          <div className="bg-white/95 px-3 py-2 border-t border-border/60">
                            <p className="text-xs text-muted-foreground text-center">
                              {topStores.length} stores nearby · Tap a marker to see details
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* Fallback when zip centroid unavailable */
                        <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 p-4" style={{ minHeight: "180px" }}>
                          {zipCentroidLoading ? (
                            <div className="flex flex-col items-center justify-center h-full py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-prox mb-3"></div>
                              <p className="text-sm text-muted-foreground">Loading map...</p>
                            </div>
                          ) : (
                            <>
                              {/* Error message */}
                              <div className="text-center mb-4">
                                <p className="text-sm text-muted-foreground">
                                  Map unavailable — couldn't resolve zip location.
                                </p>
                              </div>
                              {/* Fallback: Simple marker summary row */}
                              <div className="flex items-stretch justify-between gap-2">
                                {mapPoints.map((point) => (
                                  <button
                                    key={point.idx}
                                    type="button"
                                    onClick={() => handleMarkerClick(point.idx)}
                                    className={`
                                      flex-1 flex flex-col items-center p-3 rounded-xl transition-all
                                      ${selectedStoreIndex === point.idx
                                        ? "bg-prox text-white shadow-lg scale-105 ring-2 ring-prox ring-offset-2"
                                        : "bg-white/90 hover:bg-white hover:shadow-md text-gray-800"
                                      }
                                    `}
                                  >
                                    <div
                                      className={`
                                        h-7 w-7 rounded-full flex items-center justify-center font-bold text-sm mb-1
                                        ${selectedStoreIndex === point.idx ? "bg-white text-prox" : "bg-prox text-white"}
                                      `}
                                    >
                                      {point.labelNumber}
                                    </div>
                                    <div
                                      className={`text-sm font-bold ${selectedStoreIndex === point.idx ? "text-white" : "text-green-600"}`}
                                    >
                                      ${point.total.toFixed(2)}
                                    </div>
                                    <span
                                      className={`text-[9px] ${selectedStoreIndex === point.idx ? "text-white/70" : "text-gray-400"}`}
                                    >
                                      {formatDistance(point.distance_m)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {singleStoreResults.length > 0 && !loading && (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Best Single-Store Carts</h2>
                    <span className="text-sm text-muted-foreground">
                      {singleStoreResults.length} options
                    </span>
                  </div>

                  <Accordion type="multiple" className="w-full space-y-2">
                    {singleStoreResults.map((store, idx) => {
                      const storeId = `${store.retailer}@${store.zip_code}`;
                      const isSelected = retailerCountLimit === "1" && idx === selectedStoreIndex;
                      return (
                        <AccordionItem
                          value={storeId}
                          key={storeId}
                          id={`single-store-row-${idx}`}
                          className={`
                            border rounded-lg px-2 bg-white shadow-sm transition-all
                            ${isSelected
                              ? "ring-2 ring-prox ring-offset-1 bg-prox/5"
                              : ""
                            }
                          `}
                        >
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center justify-between w-full pr-2">
                              <div className="flex items-center gap-2 text-left">
                                {/* Show number badge when in single-store mode */}
                                {retailerCountLimit === "1" && (
                                  <div
                                    className={`
                                      h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                                      ${isSelected
                                        ? "bg-prox text-white"
                                        : "bg-gray-200 text-gray-600"
                                      }
                                    `}
                                  >
                                    {idx + 1}
                                  </div>
                                )}
                                {store.retailer_logo_url && (
                                  <img
                                    src={store.retailer_logo_url}
                                    className="h-5 w-auto object-contain"
                                    alt=""
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
                      onClick={() => result && handleSaveCart(result)}
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
                                    alt=""
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
                            <AccordionContent>
                              {renderItemsGrid(storeItems)}
                            </AccordionContent>
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
