// src/contexts/CartContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';

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
  // --- 1. Load Manual Items from LocalStorage ---
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('prox_manual_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load manual cart", e);
      return [];
    }
  });

  // --- 2. Load Saved Carts from LocalStorage ---
  const [savedCarts, setSavedCarts] = useState<SavedOptimizedCart[]>(() => {
    try {
      const saved = localStorage.getItem('prox_saved_carts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load saved carts", e);
      return [];
    }
  });

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('prox_manual_cart', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('prox_saved_carts', JSON.stringify(savedCarts));
  }, [savedCarts]);

  // --- Actions ---
  const addToCart = (newItem: Omit<CartItem, 'id'>) => {
    // Generate a random ID for the item
    const item: CartItem = { ...newItem, id: Math.random().toString(36).substr(2, 9) };
    setItems(prev => [...prev, item]);
    console.log("CartContext: Added manual item", item);
  };

  const removeFromCart = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const clearManualCart = () => {
    setItems([]);
  };

  const saveOptimizedCart = (newCart: Omit<SavedOptimizedCart, 'id' | 'date'>) => {
    const cart: SavedOptimizedCart = { 
      ...newCart, 
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString()
    };
    setSavedCarts(prev => [cart, ...prev]);
    console.log("CartContext: Saved optimized cart", cart);
  };

  const removeSavedCart = (id: string) => {
    setSavedCarts(prev => prev.filter(c => c.id !== id));
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