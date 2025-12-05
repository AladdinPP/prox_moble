import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GuestItem {
  id: string;
  name: string;
  category: string;
  purchased_at: string;
  estimated_expiration_at?: string;
  estimated_restock_at?: string;
  estimate_source?: 'heuristic' | 'llm';
  store_name?: string;
  created_at: string;
  updated_at: string;
}

interface GuestStore {
  items: GuestItem[];
  isGuest: boolean;
  setIsGuest: (isGuest: boolean) => void;
  addItem: (item: Omit<GuestItem, 'id' | 'created_at' | 'updated_at'>) => void;
  updateItem: (id: string, updates: Partial<GuestItem>) => void;
  deleteItem: (id: string) => void;
  clearItems: () => void;
}

export const useGuestStore = create<GuestStore>()(
  persist(
    (set, get) => ({
      items: [],
      isGuest: false,
      setIsGuest: (isGuest) => set({ isGuest }),
      addItem: (item) => {
        const newItem: GuestItem = {
          ...item,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({ items: [...state.items, newItem] }));
      },
      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, ...updates, updated_at: new Date().toISOString() }
              : item
          ),
        }));
      },
      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },
      clearItems: () => set({ items: [] }),
    }),
    {
      name: 'prox-guest-storage',
    }
  )
);