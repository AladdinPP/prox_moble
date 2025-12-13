import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Search, Trash2, ShoppingBag } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BottomNav } from "@/components/BottomNav";

export function CartPage() {
  const navigate = useNavigate();
  const { items, removeFromCart, savedCarts, removeSavedCart } = useCart();

  const manualTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background text-foreground">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="container mx-auto p-4 pb-32 max-w-4xl">
          {/* Header */}
          <div className="rounded-3xl border border-border/60 bg-card shadow-soft px-5 py-4 mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              
              {/* LEFT SIDE */}
              <div className="space-y-2">

                {/* Logo Button + Title */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="-ml-2 h-8 w-8" 
                    onClick={() => navigate('/cart-finder')}
                  >
                    <img 
                      src="/Icon-01.png" 
                      alt="Prox Logo" 
                      className="h-5 w-5 object-contain opacity-80"
                    />
                  </Button>

                  <h1 className="text-2xl font-semibold tracking-tight">
                    My Shopping Carts
                  </h1>
                </div>

                {/* Subtitle */}
                <p className="text-sm text-muted-foreground">
                  Manage your saved deals and optimized baskets.
                </p>
              </div>

              {/* RIGHT SIDE BUTTONS */}
              <div className="mt-2 sm:mt-0 flex flex-wrap gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto" 
                  onClick={() => navigate('/deal-search')}
                >
                  <Search className="h-4 w-4 mr-2" /> Single Deal Search
                </Button>

                <Button 
                  size="sm"
                  className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto" 
                  onClick={() => navigate('/cart-finder')}
                >
                  <ShoppingBag className="h-4 w-4 mr-2" /> Cart Optimizer →
                </Button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* --- LEFT COLUMN: Manual Cart --- */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Manual Cart
                </h2>
                <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-100">
                  {items.length} Items
                </span>
              </div>

              {items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-white/50">
                  <p className="text-gray-500 text-sm mb-4">Your manual cart is empty.</p>
                  <Button
                    className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
                    onClick={() => navigate('/deal-search')}>
                    Browse Deals
                  </Button>
                </div>
              ) : (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 bg-gray-50/80 border-b flex justify-between items-center">
                    <span className="font-medium text-sm text-gray-600">Est. Total</span>
                    <span className="text-xl font-bold text-green-700">${manualTotal.toFixed(2)}</span>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <li key={item.id} className="p-4 flex justify-between items-start hover:bg-gray-50 transition-colors">
                        <div className="flex gap-3 overflow-hidden">
                          {item.logo ? (
                            <img src={item.logo} alt="logo" className="w-8 h-8 object-contain flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">Img</div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {item.retailer} {item.size ? `• ${item.size}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 pl-2">
                          <span className="font-bold text-sm text-green-700">
                            {item.price ? `$${item.price.toFixed(2)}` : '-'}
                          </span>
                          <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* --- RIGHT COLUMN: Optimized Carts --- */}
            <div className="space-y-4 min-w-0">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                  Saved Carts
                </h2>
                <span className="bg-purple-50 text-purple-700 text-xs font-medium px-2.5 py-0.5 rounded-full border border-purple-100">
                  {savedCarts.length} Saved
                </span>
              </div>

              {savedCarts.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-white/50">
                  <p className="text-gray-500 text-sm mb-4">No optimized carts saved yet.</p>
                  <Button
                    variant="outline"
                    className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
                    onClick={() => navigate('/cart-finder')}>
                    Create Optimized Cart
                  </Button>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full min-w-0 space-y-3">
                  {savedCarts.map((cart, idx) => (
                    <AccordionItem
                      key={cart.id}
                      value={cart.id}
                      className="w-full min-w-0 border rounded-xl shadow-sm px-0 bg-white overflow-hidden">
                      <AccordionTrigger
                        className="hover:no-underline py-3 px-4 bg-gray-50/50 data-[state=open]:bg-gray-50 transition-colors min-w-0 overflow-hidden">
                        <div className="flex justify-between items-center w-full pr-2 min-w-0">
                          <div className="text-left min-w-0">
                            <p className="font-semibold text-sm truncate">Cart #{savedCarts.length - idx}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {new Date(cart.date).toLocaleDateString()} • {cart.store_count} Store{cart.store_count > 1 ? 's' : ''}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-green-700">${cart.total_price.toFixed(2)}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-0 pb-0">
                        <div className="border-t border-gray-100">
                          <div className="px-4 py-2 bg-purple-50/30 border-b border-purple-100">
                            <p className="text-xs font-medium text-purple-800 min-w-0 truncate">
                              STORES: {cart.stores.map((s: string) => s.replace('@', ' ')).join(', ')}
                            </p>
                          </div>
                          
                          <ul className="divide-y divide-gray-100">
                            {cart.items.map((item: any, i: number) => (
                              <li key={i} className="flex justify-between items-center p-3 text-sm hover:bg-gray-50">
                                <div className="min-w-0 pr-3">
                                  <span className="truncate block font-medium text-gray-700">{item.product_name}</span>
                                  <span className="text-xs text-gray-400">{item.retailer}</span>
                                </div>
                                <span className="font-bold text-green-700 whitespace-nowrap">${item.product_price.toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                          
                          <div className="p-3 bg-gray-50 border-t border-gray-100">
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="w-full h-8 text-xs"
                              onClick={() => removeSavedCart(cart.id)}
                            >
                              Delete Cart
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </div>
        </div>
      </div>

      <BottomNav current="CartPage" />
    </div>
  );
}