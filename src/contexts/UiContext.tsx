import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

export const CATEGORIES = [
  "All",
  "Produce",
  "Dairy",
  "Meat",
  "Pantry",
  "Frozen",
  "Beverages",
];

interface UiContextType {
  categories: string[];
  dynamicCategories: string[];
  allCategories: string[];
  categoriesChangeTracker: number;
  setCategoriesChangeTracker: (
    value: number | ((prev: number) => number)
  ) => void;
}

const UiContext = createContext<UiContextType | undefined>(undefined);

export const UiProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [categoriesChangeTracker, setCategoriesChangeTracker] = useState(0);

  // We used to load "other_categories" from Supabase, but that table no longer
  // exists. For now, we simply clear any dynamic categories and skip the call.
  const fetchOtherCategories = () => {
    // If you reintroduce custom categories in the future, you can add the
    // Supabase query back here.
    setDynamicCategories([]);
  };

  useEffect(() => {
    fetchOtherCategories();
    // We still depend on user + tracker so if you re-add per-user categories later,
    // this effect wiring is already in place.
  }, [user, categoriesChangeTracker]);

  // Combine static and dynamic categories
  const allCategories = [...CATEGORIES, ...dynamicCategories];

  return (
    <UiContext.Provider
      value={{
        categories: CATEGORIES,
        dynamicCategories,
        allCategories,
        categoriesChangeTracker,
        setCategoriesChangeTracker,
      }}
    >
      {children}
    </UiContext.Provider>
  );
};

export const useUi = () => {
  const context = useContext(UiContext);
  if (!context) {
    throw new Error("useUi must be used within a UiProvider");
  }
  return context;
};
