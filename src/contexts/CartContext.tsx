// src/contexts/CartContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// --- Types ---

// 1. A single item added manually from DealSearch
export type CartItem = {
  id: string;
  name: string;
  brand?: string;
  size?: string;
  details?: string;
  price?: number;      
  retailer?: string;   
  logo?: string | null;
};

// 2. A whole optimized cart saved from CartFinder
export type SavedOptimizedCart = {
  id: string;
  date: string;
  total_price: number;
  store_count: number;
  stores: string[]; // Store IDs
  items: any[];     // The items inside this cart
};

type CartContextType = {
  // Manual Items State
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  clearManualCart: () => void;
  
  // Saved Optimized Carts State
  savedCarts: SavedOptimizedCart[];
  saveOptimizedCart: (cart: Omit<SavedOptimizedCart, 'id' | 'date'>) => void;
  removeSavedCart: (id: string) => void;
  
  // Counts
  itemCount: number;
  savedCartCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [savedCarts, setSavedCarts] = useState<SavedOptimizedCart[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  // --- 1. Fetch Data on Load (Sync from DB) ---
  useEffect(() => {
    // If not logged in, we could load from localStorage if you wanted to keep Guest support,
    // but typically we clear or keep empty for auth-based sync.
    if (!user) {
      setItems([]);
      setSavedCarts([]);
      return;
    }

    const fetchUserData = async () => {
      // A. Fetch Manual Cart Items
      const { data: cartData, error: cartError } = await supabase
        .from('shopping_cart_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (cartData) {
        const mappedItems: CartItem[] = cartData.map((row: any) => ({
          id: row.id,
          name: row.product_name,
          brand: row.brand,
          size: row.product_size,
          details: row.details,
          price: row.product_price,
          retailer: row.retailer,
          logo: row.image_url,
        }));
        setItems(mappedItems);
      }

      // B. Fetch Saved Optimized Carts
      const { data: savedData, error: savedError } = await supabase
        .from('saved_carts')
        .select('*')
        .order('created_at', { ascending: false });

      if (savedData) {
        const mappedSaved: SavedOptimizedCart[] = savedData.map((row: any) => ({
          id: row.id,
          date: row.created_at,
          total_price: row.total_price,
          store_count: row.store_count,
          stores: row.stores, // Supabase JSONB -> JS Array
          items: row.cart_items, // Supabase JSONB -> JS Array/Object
        }));
        setSavedCarts(mappedSaved);
      }
    };

    fetchUserData();
  }, [user]);

  // --- Actions ---

  const addToCart = async (newItem: Omit<CartItem, 'id'>) => {
    // 1. Optimistic Update (Local)
    const tempId = Math.random().toString(36).substr(2, 9);
    const itemWithId: CartItem = { ...newItem, id: tempId };
    setItems((prev) => [itemWithId, ...prev]);

    if (user) {
      // 2. Sync to DB
      const { data, error } = await supabase
        .from('shopping_cart_items')
        .insert({
          user_id: user.id,
          product_name: newItem.name,
          brand: newItem.brand,
          product_size: newItem.size,
          details: newItem.details,
          product_price: newItem.price,
          retailer: newItem.retailer,
          image_url: newItem.logo,
        })
        .select()
        .single();

      if (error) {
        console.error("CartContext: Error adding manual item", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save item.' });
        setItems((prev) => prev.filter((i) => i.id !== tempId)); // Revert
      } else if (data) {
        // Replace temp ID with real DB ID
        setItems((prev) => prev.map((i) => (i.id === tempId ? { ...i, id: data.id } : i)));
      }
    }
  };

  const removeFromCart = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));

    if (user) {
      const { error } = await supabase.from('shopping_cart_items').delete().eq('id', id);
      if (error) {
        console.error("CartContext: Error removing manual item", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not remove item.' });
      }
    }
  };

  const clearManualCart = async () => {
    setItems([]);
    if (user) {
      const { error } = await supabase.from('shopping_cart_items').delete().eq('user_id', user.id);
      if (error) console.error("CartContext: Error clearing cart", error);
    }
  };

  const saveOptimizedCart = async (newCart: Omit<SavedOptimizedCart, 'id' | 'date'>) => {
    // 1. Optimistic Update
    const tempId = Math.random().toString(36).substr(2, 9);
    const cart: SavedOptimizedCart = { 
      ...newCart, 
      id: tempId,
      date: new Date().toISOString()
    };
    setSavedCarts((prev) => [cart, ...prev]);

    if (user) {
      // 2. Sync to DB
      const { data, error } = await supabase
        .from('saved_carts')
        .insert({
          user_id: user.id,
          total_price: newCart.total_price,
          store_count: newCart.store_count,
          stores: newCart.stores,
          cart_items: newCart.items,
        })
        .select()
        .single();

      if (error) {
        console.error("CartContext: Error saving optimized cart", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save cart.' });
        setSavedCarts((prev) => prev.filter((c) => c.id !== tempId)); // Revert
      } else if (data) {
        // Replace temp ID with DB ID
        setSavedCarts((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: data.id } : c)));
      }
    }
  };

  const removeSavedCart = async (id: string) => {
    setSavedCarts((prev) => prev.filter((c) => c.id !== id));

    if (user) {
      const { error } = await supabase.from('saved_carts').delete().eq('id', id);
      if (error) {
        console.error("CartContext: Error removing saved cart", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete cart.' });
      }
    }
  };
  
  return (
    <CartContext.Provider value={{ 
      items, addToCart, removeFromCart, clearManualCart, itemCount: items.length,
      savedCarts, saveOptimizedCart, removeSavedCart, savedCartCount: savedCarts.length
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}