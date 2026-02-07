import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// --- Constants ---
const SLIDER_MIN = 100;
const SLIDER_MAX = 600;
const SLIDER_STEP = 50;
const SLIDER_DEFAULT = 200;
const SAVINGS_RATE = 0.25; // 25% savings

// Prox green color
const PROX_GREEN = "#0FB872";
const PROX_GREEN_HOVER = "#0ea968";

// --- Product Dataset ---
type Product = {
  name: string;
  highestPrice: number;
  lowestPrice: number;
  savingsPercent: number;
};

const PRODUCTS: Product[] = [
  { name: "Graza Olive Oil", highestPrice: 19.99, lowestPrice: 9.99, savingsPercent: 50 },
  { name: "Dave's Killer Bread", highestPrice: 8.50, lowestPrice: 4.25, savingsPercent: 50 },
  { name: "Rao's Pasta Sauce", highestPrice: 9.99, lowestPrice: 5.99, savingsPercent: 40 },
  { name: "Tide Laundry Detergent", highestPrice: 17.99, lowestPrice: 9.99, savingsPercent: 44 },
  { name: "Sirloin Steak (per lb)", highestPrice: 15.99, lowestPrice: 6.99, savingsPercent: 56 },
  { name: "Chicken Breast (per lb)", highestPrice: 6.99, lowestPrice: 1.99, savingsPercent: 72 },
  { name: "12 ct. Eggs", highestPrice: 5.99, lowestPrice: 1.49, savingsPercent: 75 },
];

// --- Helper Functions ---
function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyWhole(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getRandomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function pickRandomDistinct<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

type GenderRule = "male" | "female" | "neutral";

function selectProductsByGender(gender: GenderRule): Product[] {
  if (gender === "male") {
    // Always include Sirloin Steak, then pick one random from remaining
    const sirloin = PRODUCTS.find((p) => p.name === "Sirloin Steak (per lb)")!;
    const remaining = PRODUCTS.filter((p) => p.name !== "Sirloin Steak (per lb)");
    const randomPick = remaining[getRandomInt(remaining.length)];
    return [sirloin, randomPick];
  } else if (gender === "female") {
    // Always include Tide Laundry Detergent, then pick one random from remaining
    const tide = PRODUCTS.find((p) => p.name === "Tide Laundry Detergent")!;
    const remaining = PRODUCTS.filter((p) => p.name !== "Tide Laundry Detergent");
    const randomPick = remaining[getRandomInt(remaining.length)];
    return [tide, randomPick];
  } else {
    // Neutral: pick any 2 random distinct items
    return pickRandomDistinct(PRODUCTS, 2);
  }
}

function normalizeGender(genderIdentity: string | null | undefined): GenderRule {
  if (genderIdentity === "male") return "male";
  if (genderIdentity === "female") return "female";
  return "neutral";
}

// Mapping for "What You Could've Had Instead" based on weekly spend
const SPEND_TO_REWARD: Record<number, string> = {
  100: "Brand-new MacBook Air",
  150: "Brand-new MacBook Air",
  200: "5-night Miami luxury for 2",
  250: "All-inclusive Mexico trip for 2",
  300: "London escape for 2",
  350: "Santorini vacation for 2",
  400: "Paris vacation for 2",
  450: "Luxury Caribbean Cruise for 2",
  500: "10-day Thailand trip for 2",
  550: "Disney World for 4",
  600: "Hawaii vacation for 4",
};

function getRewardForSpend(spend: number): string {
  const tiers = Object.keys(SPEND_TO_REWARD)
    .map(Number)
    .sort((a, b) => a - b);
  let selectedTier = tiers[0];
  for (const tier of tiers) {
    if (tier <= spend) {
      selectedTier = tier;
    } else {
      break;
    }
  }
  return SPEND_TO_REWARD[selectedTier];
}

// --- Step 1: Intro / Explainer ---
function Step1Intro({ onNext }: { onNext: () => void }) {
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      // Skip animation, show all cards immediately
      setRevealedCount(5);
      return;
    }

    // Staggered reveal: increment every 800ms until we reach 5 (~4000ms total)
    const interval = setInterval(() => {
      setRevealedCount((prev) => {
        if (prev >= 5) {
          clearInterval(interval);
          return 5;
        }
        return prev + 1;
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Icon */}
        <div className="w-20 h-20 flex items-center justify-center mb-6">
          <img src="/Icon-01.png" alt="Prox" className="h-20 w-20 object-contain" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          <span className="block">Save Money on Groceries</span>
          <span className="block">Without Coupons!</span>
        </h1>

        {/* Feature Cards */}
        <div className="w-full max-w-md space-y-4">
          {/* Card 1: Cart Optimizer */}
          {revealedCount >= 1 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-in fade-in duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <img src="/cart_finder.png" alt="Cart Optimizer" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">
                    Cart Optimizer
                  </h3>
                  <p className="text-sm font-bold text-gray-900 mb-1">Find the cheapest way to shop your entire list.</p>
                  <p className="text-sm text-gray-500">Add the items you need and Prox calculates the lowest-cost store combination.</p>
                </div>
              </div>
            </div>
          )}

          {/* Card 2: Deals */}
          {revealedCount >= 2 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-in fade-in duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <img src="/flame.png" alt="Deals" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">
                    Deals
                  </h3>
                  <p className="text-sm font-bold text-gray-900 mb-1">See the best grocery deals near you.</p>
                  <p className="text-sm text-gray-500">Browse weekly sales and price drops across your local stores.</p>
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Cart Results */}
          {revealedCount >= 3 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-in fade-in duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <img src="/cart_result.png" alt="Cart Results" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">
                    Cart Results
                  </h3>
                  <p className="text-sm font-bold text-gray-900 mb-1">Compare store totals before you shop.</p>
                  <p className="text-sm text-gray-500">View your full cart price at each store and pick the cheapest option.</p>
                </div>
              </div>
            </div>
          )}

          {/* Card 4: Pantry Tracker */}
          {revealedCount >= 4 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-in fade-in duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <img src="/pantry.png" alt="Pantry Tracker" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">
                    Pantry Tracker
                  </h3>
                  <p className="text-sm font-bold text-gray-900 mb-1">Stop buying what you already have.</p>
                  <p className="text-sm text-gray-500">Add pantry items so Prox avoids duplicates and shops smarter.</p>
                </div>
              </div>
            </div>
          )}

          {/* Card 5: Account */}
          {revealedCount >= 5 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-in fade-in duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <img src="/user.png" alt="Account" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">
                    Account
                  </h3>
                  <p className="text-sm font-bold text-gray-900 mb-1">Personalize Prox to how you shop.</p>
                  <p className="text-sm text-gray-500">Set your location, stores, and preferences for better savings.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA - Prox Green */}
      <div className="px-6 pb-10 pt-4">
        <div className="mx-auto w-full max-w-md">
          <button
            onClick={onNext}
            className="w-full h-14 text-white font-semibold rounded-full transition-colors bg-prox hover:bg-prox/90"
          >
            See How Much You'll Save!!!
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Product Block Component ---
function ProductBlock({ product }: { product: Product }) {
  return (
    <div className="flex items-start justify-between py-3">
      <div>
        <p className="font-bold text-gray-900 mb-2">{product.name}.</p>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-500">Highest Price.</p>
            <p className="text-lg font-bold text-red-500">
              {formatMoney(product.highestPrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Lowest Price.</p>
            <p className="text-lg font-bold text-green-500">
              {formatMoney(product.lowestPrice)}
            </p>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0">
        <span className="inline-block bg-green-100 text-prox text-xs font-semibold px-3 py-1 rounded-full">
          Save {product.savingsPercent}%
        </span>
      </div>
    </div>
  );
}

// --- Product Skeleton ---
function ProductSkeleton() {
  return (
    <div className="animate-pulse py-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="h-5 w-40 bg-gray-200 rounded mb-2" />
          <div className="flex gap-6">
            <div>
              <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
              <div className="h-6 w-14 bg-gray-200 rounded" />
            </div>
            <div>
              <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
              <div className="h-6 w-14 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>
    </div>
  );
}

// --- Step 2: Potential Savings ---
function Step2Savings({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [weeklySpend, setWeeklySpend] = useState(SLIDER_DEFAULT);
  const [genderLoading, setGenderLoading] = useState(true);
  const [genderRule, setGenderRule] = useState<GenderRule>("neutral");

  // Use ref to store selected products (only set once)
  const selectedProductsRef = useRef<Product[] | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Product[] | null>(null);

  // Fetch gender for authenticated users
  // Note: gender_identity column may not exist in all deployments - fallback to neutral
  useEffect(() => {
    async function fetchGender() {
      if (!user) {
        // Guest user - use neutral rule
        setGenderRule("neutral");
        setGenderLoading(false);
        return;
      }

      try {
        // Query profiles for gender_identity (column may not exist in all schemas)
        // Using raw query to handle potentially missing column gracefully
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.warn("Error fetching profile:", error);
          setGenderRule("neutral");
        } else if (data) {
          // Check if gender_identity exists on the returned data
          const genderValue = (data as Record<string, unknown>)?.gender_identity;
          const gender = normalizeGender(genderValue as string | null | undefined);
          setGenderRule(gender);
        } else {
          setGenderRule("neutral");
        }
      } catch (err) {
        console.warn("Failed to fetch gender:", err);
        setGenderRule("neutral");
      } finally {
        setGenderLoading(false);
      }
    }

    fetchGender();
  }, [user]);

  // Select products once gender is loaded (and only once)
  useEffect(() => {
    if (!genderLoading && selectedProductsRef.current === null) {
      const products = selectProductsByGender(genderRule);
      selectedProductsRef.current = products;
      setSelectedProducts(products);
    }
  }, [genderLoading, genderRule]);

  const annualSavings = useMemo(() => {
    return Math.round(weeklySpend * 52 * SAVINGS_RATE);
  }, [weeklySpend]);

  const rewardText = useMemo(() => {
    return getRewardForSpend(weeklySpend);
  }, [weeklySpend]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Centered container with max-width */}
        <div className="mx-auto w-full max-w-xl px-6 py-10">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-10 h-10 text-prox" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Your Potential Savings.
          </h1>

          {/* Prox Green Annual Savings Card */}
          <div
            className="rounded-3xl p-6 mb-6 bg-prox"
            // style={{ backgroundColor: PROX_GREEN }}
          >
            <p className="text-white/80 text-center text-sm mb-2">
              Your Annual Savings:
            </p>
            <p className="text-white text-center text-5xl font-bold mb-2">
              {formatCurrencyWhole(annualSavings)}+
            </p>
            <p className="text-white/60 text-center text-sm">
              Estimated annual savings based on 25% average savings across all
              purchases.
            </p>
          </div>

          {/* Slider Section */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
            <p className="text-sm text-gray-600 mb-4 text-center">
              How much do you typically spend on groceries weekly?
            </p>

            {/* Slider Value Display */}
            <div className="flex justify-center items-center mb-4">
              <div className="text-center">
                {/* <p className="text-xs text-gray-500 mb-1">Weekly Spend</p> */}
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrencyWhole(weeklySpend)}
                </p>
              </div>
              {/* <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Est. Annual Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrencyWhole(annualSavings)}
                </p>
              </div> */}
            </div>

            {/* Slider */}
            <div className="px-2">
              <Slider
                value={[weeklySpend]}
                onValueChange={(value) => setWeeklySpend(value[0])}
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                className="w-full"
              />
              <div className="flex justify-between mt-2">
                <span className="text-xs text-gray-400">$100</span>
                <span className="text-xs text-gray-400">$600</span>
              </div>
            </div>

            {/* What You Could've Had Instead */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center mb-2">
                What You Could've Had Instead
              </p>
              <p className="text-lg font-bold text-gray-900 text-center">
                {rewardText}
              </p>
            </div>
          </div>

          {/* Based on People's Searches Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
            <p className="text-sm text-gray-500 mb-3">Based on People's Searches:</p>

            {/* Loading state */}
            {(genderLoading || !selectedProducts) ? (
              <>
                <ProductSkeleton />
                <div className="border-t border-gray-100" />
                <ProductSkeleton />
              </>
            ) : (
              <>
                {/* Product 1 */}
                <ProductBlock product={selectedProducts[0]} />

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Product 2 */}
                <ProductBlock product={selectedProducts[1]} />
              </>
            )}

            {/* Footer text - only once */}
            <p className="text-xs text-gray-400 mt-3 italic">
              Tap to see your other items.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA - Prox Green */}
      <div className="px-6 pb-10 pt-4 bg-gray-50">
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={onComplete}
            className="w-full h-14 text-white font-semibold rounded-full transition-colors bg-prox hover:bg-prox/90"
          >
            Start Saving!
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---
export function SavingsOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  const handleStep1Complete = () => {
    setStep(2);
  };

  const handleStep2Complete = () => {
    navigate("/home");
  };

  return step === 1 ? (
    <Step1Intro onNext={handleStep1Complete} />
  ) : (
    <Step2Savings onComplete={handleStep2Complete} />
  );
}
