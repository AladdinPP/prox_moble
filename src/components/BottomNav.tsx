import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// These keys are just for highlighting the active tab
export type BottomTabKey =
  | "CartFinder"
  | "DealSearch"
  | "CartPage"
  | "PantryTracker"
  | "Account";

interface BottomNavProps {
  current?: BottomTabKey; // which tab is currently active
}

const TABS: {
  key: BottomTabKey;
  label: string;
  emoji: string;
  path: string; // URL path in your router
}[] = [
  {
    key: "CartFinder",
    label: "Cart Optimizer",
    emoji: "🛒",
    path: "/cart-finder",
  },
  {
    key: "DealSearch",
    label: "Deal Finder",
    emoji: "💸",
    path: "/deal-search",
  },
  {
    key: "CartPage",
    label: "Cart Results",
    emoji: "📊",
    path: "/cart",
  },
  {
    key: "PantryTracker",
    label: "Pantry Tracker",
    emoji: "📦",
    path: "/pantry-tracker",
  },
  {
    key: "Account",
    label: "Account",
    emoji: "👤",
    path: "/account",
  },
];

export const BottomNav: React.FC<BottomNavProps> = ({ current }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); // if null => guest

  const handlePress = (tabKey: BottomTabKey, path: string) => {
    if (tabKey === "Account") {
      // Guest mode → go to /welcome, signed in → /account
      if (!user) {
        navigate("/welcome");
      } else {
        navigate("/account");
      }
      return;
    }

    navigate(path);
  };

  return (
    <nav className="border-t border-neutral-200 bg-white px-2 pt-2 pb-4 flex justify-between items-center">
      {TABS.map((tab) => {
        const isActive =
          current === tab.key || location.pathname === tab.path;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => handlePress(tab.key, tab.path)}
            className="flex-1 flex flex-col items-center justify-center"
          >
            <span className={`text-xl ${isActive ? "opacity-100" : "opacity-60"}`}>
              {tab.emoji}
            </span>
            <span
              className={`mt-1 text-xs ${
                isActive ? "text-black font-semibold" : "text-neutral-500"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
