import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const CATEGORIES = [
  'All',
  'Produce',
  'Dairy',
  'Meat',
  'Pantry',
  'Frozen',
  'Beverages'
  
];

interface UiContextType {
  categories: string[];
  dynamicCategories: string[];
  allCategories: string[];
  categoriesChangeTracker: number;
  setCategoriesChangeTracker: (value: number | ((prev: number) => number)) => void;
}

const UiContext = createContext<UiContextType | undefined>(undefined);

export const UiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [categoriesChangeTracker, setCategoriesChangeTracker] = useState(0);

  const fetchOtherCategories = async () => {
    if (!user) {
      setDynamicCategories([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('other_categories' as any)
        .select('name')
        .eq('user_id', user.id);

      if (error) throw error;
      setDynamicCategories((data as any)?.map((category: any) => category.name) || []);
    } catch (error) {
      console.error('Error fetching other categories:', error);
      // Don't show toast for categories fetch error as it's not critical
    }
  };

  useEffect(() => {
    fetchOtherCategories();
  }, [user, categoriesChangeTracker]);

  // Combine static and dynamic categories
  const allCategories = [...CATEGORIES, ...dynamicCategories];

  return (
    <UiContext.Provider value={{
      categories: CATEGORIES,
      dynamicCategories,
      allCategories,
      categoriesChangeTracker,
      setCategoriesChangeTracker
    }}>
      {children}
    </UiContext.Provider>
  );
};

export const useUi = () => {
  const context = useContext(UiContext);
  if (!context) {
    throw new Error('useUi must be used within a UiProvider');
  }
  return context;
};
