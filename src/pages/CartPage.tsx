import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Trash2, ShoppingBag } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BottomNav } from "@/components/BottomNav";

export function CartPage() {
  const navigate = useNavigate();
  const { items, removeFromCart, savedCarts, removeSavedCart } = useCart();

  const manualTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);

  const cartTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price || 0), 0);
  }, [items]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background text-foreground">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="container mx-auto p-4 pb-32 max-w-4xl">
          {/* Header */}
          <div className="rounded-3xl border border-border/60 bg-card shadow-soft px-5 py-4 mb-6">
            <div className="flex items-center justify-between">
              {/* Left: Logo */}
              <div className="w-12 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 p-0"
                  onClick={() => navigate('/cart-finder')}
                >
                  <img
                    src="/Icon-01.png"
                    alt="Prox Logo"
                    className="h-12 w-auto object-contain"
                  />
                </Button>
              </div>

              {/* Center: Title and subtitle */}
              <div className="flex-1 text-center px-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  My Shopping Carts
                </h1>
                <p className="text-sm text-gray-600">
                  Manage your saved deals and optimized carts.
                </p>
              </div>

              {/* Right: Cart icon with count */}
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

          <div className="grid md:grid-cols-2 gap-8">
            {/* --- LEFT COLUMN: Manual Cart --- */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Build-a-Cart
                </h2>
                <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-100">
                  {items.length} Items
                </span>
              </div>

              {items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-white/50">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100/60">
                    <img
                      src="/cart_finder.png"
                      alt="Manual cart"
                      className="h-8 w-8 opacity-50"
                    />
                  </div>
                  <p className="text-base font-semibold text-gray-900 mb-4">Your manual cart is empty</p>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">Add items to compare prices across stores and find the best deals!</p>
                  <Button
                    className="w-full rounded-full py-2.5 text-sm font-semibold bg-prox text-white hover:bg-prox-hover shadow-sm sm:w-auto"
                    onClick={() => navigate('/deals')}>
                    Browse Deals
                  </Button>
                </div>
              ) : (
                // ✅ Manual cart now uses the same Accordion capability as Saved Carts
                <Accordion type="single" collapsible className="w-full min-w-0 space-y-3">
                  <AccordionItem
                    value="manual-cart"
                    className="w-full min-w-0 border rounded-xl shadow-sm px-0 bg-white overflow-hidden">
                    <AccordionTrigger className="hover:no-underline py-3 px-4 bg-gray-50/80 data-[state=open]:bg-gray-50 transition-colors min-w-0 overflow-hidden">
                      <div className="flex justify-between items-center w-full pr-2 min-w-0">
                        <div className="text-left min-w-0">
                          <p className="font-semibold text-sm truncate">Manual Cart</p>
                          <p className="text-[11px] text-gray-500 truncate">{items.length} Item{items.length > 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-lg font-bold text-green-700">${manualTotal.toFixed(2)}</span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-0 pb-0">
                      <div className="border-t border-gray-100">
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
                                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
                                    Img
                                  </div>
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
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>

            {/* --- RIGHT COLUMN: Optimized Carts --- */}
            <div className="space-y-4 min-w-0">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                  Optimized Carts
                </h2>
                <span className="bg-purple-50 text-purple-700 text-xs font-medium px-2.5 py-0.5 rounded-full border border-purple-100">
                  {savedCarts.length} Carts
                </span>
              </div>

              {savedCarts.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-white/50">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100/60">
                    <img
                      src="/save.png"
                      alt="Saved carts"
                      className="h-8 w-8 opacity-50"
                    />
                  </div>
                  <p className="text-base font-semibold text-gray-900 mb-4">No optimized carts saved yet</p>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">Save your best optimized carts for quick re-ordering later!</p>
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
                      <AccordionTrigger className="hover:no-underline py-3 px-4 bg-gray-50/50 data-[state=open]:bg-gray-50 transition-colors min-w-0 overflow-hidden">
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
                              STORES: {cart.stores.map((s) => s.replace('@', ' ')).join(', ')}
                            </p>
                          </div>

                          <ul className="divide-y divide-gray-100">
                            {cart.items.map((item, i) => (
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
                              onClick={() => removeSavedCart(cart.id)}>
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