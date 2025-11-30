// src/pages/CartPage.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Home, Search, Trash2, ShoppingBag } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function CartPage() {
  const navigate = useNavigate();
  const { items, removeFromCart, savedCarts, removeSavedCart } = useCart();

  // Calculate total for manual cart
  const manualTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <Home className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">My Shopping Carts</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/deal-search')}>
            <Search className="h-4 w-4 mr-2" /> Find Deals
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/cart-finder')}>
            <ShoppingBag className="h-4 w-4 mr-2" /> Optimizer
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        
        {/* --- LEFT COLUMN: Manual Cart (From DealSearch) --- */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-blue-700">Manual Deal Cart</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {items.length} Items
            </span>
          </div>

          {items.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <p>No individual deals added yet.</p>
              <Button variant="link" onClick={() => navigate('/deal-search')}>Go to Deal Finder</Button>
            </div>
          ) : (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <span className="font-medium">Total Est. Cost:</span>
                <span className="text-xl font-bold text-green-700">${manualTotal.toFixed(2)}</span>
              </div>
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id} className="p-4 flex justify-between items-start hover:bg-gray-50 transition">
                    <div className="flex gap-3">
                      {item.logo && <img src={item.logo} alt="logo" className="w-8 h-8 object-contain" />}
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.retailer} • {item.size}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-green-600">
                        {item.price ? `$${item.price.toFixed(2)}` : '-'}
                      </span>
                      <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* --- RIGHT COLUMN: Optimized Carts (From CartFinder) --- */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-purple-700">Saved Optimized Carts</h2>
            <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {savedCarts.length} Saved
            </span>
          </div>

          {savedCarts.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <p>No optimized combinations saved.</p>
              <Button variant="link" onClick={() => navigate('/cart-finder')}>Go to Cart Optimizer</Button>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-4">
              {savedCarts.map((cart, idx) => (
                <AccordionItem key={cart.id} value={cart.id} className="border rounded-lg shadow-sm px-4 bg-white">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex justify-between items-center w-full pr-2">
                      <div className="text-left">
                        <p className="font-semibold">Combination #{savedCarts.length - idx}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(cart.date).toLocaleDateString()} • {cart.store_count} Store{cart.store_count > 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-xl font-bold text-green-700">${cart.total_price.toFixed(2)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2 pb-4 space-y-3">
                      {/* Render simple list of found items */}
                      <ul className="space-y-2 bg-gray-50 p-3 rounded-md">
                        {cart.items.map((item: any, i: number) => (
                          <li key={i} className="flex justify-between text-sm">
                            <span>{item.product_name} <span className="text-gray-400">({item.retailer})</span></span>
                            <span className="font-medium">${item.product_price.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => removeSavedCart(cart.id)}
                      >
                        Delete This Cart
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

      </div>
    </div>
  );
}