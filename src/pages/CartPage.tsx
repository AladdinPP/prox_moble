// // src/pages/CartPage.tsx

// import React from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useCart } from '@/contexts/CartContext';
// import { Button } from '@/components/ui/button';
// import { Home, Search, Trash2, ShoppingBag } from 'lucide-react';
// import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// export function CartPage() {
//   const navigate = useNavigate();
//   const { items, removeFromCart, savedCarts, removeSavedCart } = useCart();

//   // Calculate total for manual cart
//   const manualTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);

//   return (
//     <div className="container mx-auto p-4 max-w-4xl">
      
//       {/* Header */}
//       <div className="flex justify-between items-center mb-8 border-b pb-4">
//         <div className="flex items-center gap-2">
//           <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
//             <Home className="h-5 w-5" />
//           </Button>
//           <h1 className="text-2xl font-bold">My Shopping Carts</h1>
//         </div>
//         <div className="flex gap-2">
//           <Button variant="outline" size="sm" onClick={() => navigate('/deal-search')}>
//             <Search className="h-4 w-4 mr-2" /> Find Deals
//           </Button>
//           <Button variant="outline" size="sm" onClick={() => navigate('/cart-finder')}>
//             <ShoppingBag className="h-4 w-4 mr-2" /> Optimizer
//           </Button>
//         </div>
//       </div>

//       <div className="grid md:grid-cols-2 gap-8">
        
//         {/* --- LEFT COLUMN: Manual Cart (From DealSearch) --- */}
//         <div className="space-y-4">
//           <div className="flex justify-between items-center">
//             <h2 className="text-xl font-semibold text-blue-700">Manual Deal Cart</h2>
//             <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
//               {items.length} Items
//             </span>
//           </div>

//           {items.length === 0 ? (
//             <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
//               <p>No individual deals added yet.</p>
//               <Button variant="link" onClick={() => navigate('/deal-search')}>Go to Deal Finder</Button>
//             </div>
//           ) : (
//             <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
//               <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
//                 <span className="font-medium">Total Est. Cost:</span>
//                 <span className="text-xl font-bold text-green-700">${manualTotal.toFixed(2)}</span>
//               </div>
//               <ul className="divide-y">
//                 {items.map((item) => (
//                   <li key={item.id} className="p-4 flex justify-between items-start hover:bg-gray-50 transition">
//                     <div className="flex gap-3">
//                       {item.logo && <img src={item.logo} alt="logo" className="w-8 h-8 object-contain" />}
//                       <div>
//                         <p className="font-medium">{item.name}</p>
//                         <p className="text-xs text-gray-500">{item.retailer} • {item.size}</p>
//                       </div>
//                     </div>
//                     <div className="flex flex-col items-end gap-1">
//                       <span className="font-bold text-green-600">
//                         {item.price ? `$${item.price.toFixed(2)}` : '-'}
//                       </span>
//                       <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500">
//                         <Trash2 className="h-4 w-4" />
//                       </button>
//                     </div>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>

//         {/* --- RIGHT COLUMN: Optimized Carts (From CartFinder) --- */}
//         <div className="space-y-4">
//           <div className="flex justify-between items-center">
//             <h2 className="text-xl font-semibold text-purple-700">Saved Optimized Carts</h2>
//             <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
//               {savedCarts.length} Saved
//             </span>
//           </div>

//           {savedCarts.length === 0 ? (
//             <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
//               <p>No optimized combinations saved.</p>
//               <Button variant="link" onClick={() => navigate('/cart-finder')}>Go to Cart Optimizer</Button>
//             </div>
//           ) : (
//             <Accordion type="single" collapsible className="w-full space-y-4">
//               {savedCarts.map((cart, idx) => (
//                 <AccordionItem key={cart.id} value={cart.id} className="border rounded-lg shadow-sm px-4 bg-white">
//                   <AccordionTrigger className="hover:no-underline py-4">
//                     <div className="flex justify-between items-center w-full pr-2">
//                       <div className="text-left">
//                         <p className="font-semibold">Combination #{savedCarts.length - idx}</p>
//                         <p className="text-xs text-gray-500">
//                           {new Date(cart.date).toLocaleDateString()} • {cart.store_count} Store{cart.store_count > 1 ? 's' : ''}
//                         </p>
//                       </div>
//                       <span className="text-xl font-bold text-green-700">${cart.total_price.toFixed(2)}</span>
//                     </div>
//                   </AccordionTrigger>
//                   <AccordionContent>
//                     <div className="pt-2 pb-4 space-y-3">
//                       {/* Render simple list of found items */}
//                       <ul className="space-y-2 bg-gray-50 p-3 rounded-md">
//                         {cart.items.map((item: any, i: number) => (
//                           <li key={i} className="flex justify-between text-sm">
//                             <span>{item.product_name} <span className="text-gray-400">({item.retailer})</span></span>
//                             <span className="font-medium">${item.product_price.toFixed(2)}</span>
//                           </li>
//                         ))}
//                       </ul>
//                       <Button 
//                         variant="destructive" 
//                         size="sm" 
//                         className="w-full mt-2"
//                         onClick={() => removeSavedCart(cart.id)}
//                       >
//                         Delete This Cart
//                       </Button>
//                     </div>
//                   </AccordionContent>
//                 </AccordionItem>
//               ))}
//             </Accordion>
//           )}
//         </div>

//       </div>
//     </div>
//   );
// }

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Home, Search, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function CartPage() {
  const navigate = useNavigate();
  const { items, removeFromCart, savedCarts, removeSavedCart } = useCart();

  const manualTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-background text-foreground pb-12">
      <div className="container mx-auto p-4 max-w-4xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border/60 pb-6">
          <div className="flex items-center gap-3">
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
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My Shopping Carts</h1>
              <p className="text-sm text-muted-foreground">Manage your saved deals and optimized baskets.</p>
            </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" size="sm" className="bg-prox text-white hover:bg-prox-hover" onClick={() => navigate('/deal-search')}>
              <Search className="h-4 w-4 mr-2" /> Single Deal Search
            </Button>
            <Button variant="outline" size="sm" className="bg-prox text-white hover:bg-prox-hover" onClick={() => navigate('/cart-finder')}>
              <ShoppingBag className="h-4 w-4 mr-2" /> Cart Optimizer →
            </Button>
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
                <Button className="bg-prox hover:bg-prox-hover text-white" onClick={() => navigate('/deal-search')}>
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
                        <span className="font-bold text-sm text-green-600">
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
          <div className="space-y-4">
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
                <Button variant="outline" className="bg-prox hover:bg-prox-hover text-white" onClick={() => navigate('/cart-finder')}>
                  Create Optimized Cart
                </Button>
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full space-y-3">
                {savedCarts.map((cart, idx) => (
                  <AccordionItem key={cart.id} value={cart.id} className="border rounded-xl shadow-sm px-0 bg-white overflow-hidden">
                    <AccordionTrigger className="hover:no-underline py-3 px-4 bg-gray-50/50 data-[state=open]:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-center w-full pr-2">
                        <div className="text-left">
                          <p className="font-semibold text-sm">Cart #{savedCarts.length - idx}</p>
                          <p className="text-[11px] text-gray-500">
                            {new Date(cart.date).toLocaleDateString()} • {cart.store_count} Store{cart.store_count > 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className="text-lg font-bold text-green-700">${cart.total_price.toFixed(2)}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="border-t border-gray-100">
                        <div className="px-4 py-2 bg-purple-50/30 border-b border-purple-100">
                          <p className="text-xs font-medium text-purple-800">
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
                              <span className="font-bold text-green-600 whitespace-nowrap">${item.product_price.toFixed(2)}</span>
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
  );
}