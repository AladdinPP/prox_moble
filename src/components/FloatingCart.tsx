// src/components/FloatingCart.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";

export function FloatingCart() {
  const { items, removeFromCart, itemCount } = useCart();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOptimize = () => {
    setIsOpen(false);
    navigate('/cart-finder');
  };

  if (itemCount === 0) return null; // Don't show if empty

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button size="lg" className="rounded-full h-14 w-14 shadow-xl bg-blue-600 hover:bg-blue-700 relative">
            <ShoppingCart className="h-6 w-6 text-white" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-white">
              {itemCount}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Your Cart ({itemCount} items)</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 flex-1 overflow-y-auto max-h-[70vh] space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-start border-b pb-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  {(item.brand || item.size) && (
                    <p className="text-sm text-gray-500">
                      {item.brand} {item.size}
                    </p>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-gray-400 hover:text-red-500"
                  onClick={() => removeFromCart(item.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <SheetFooter className="mt-6">
            <Button onClick={handleOptimize} className="w-full bg-green-600 hover:bg-green-700">
              Optimize My Cart <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}