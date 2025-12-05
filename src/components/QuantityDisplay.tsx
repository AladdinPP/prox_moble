import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGuestStore } from '@/stores/guestStore';

interface QuantityDisplayProps {
  itemId: string;
  quantity?: number;
  unit?: string;
  isGuest: boolean;
  onUpdate: (itemId: string, quantity: number | null, unit: string | null) => void;
}

const UNIT_OPTIONS = [
  'grams',
  'kilograms', 
  'milliliters',
  'liters',
  'count',
  'oz',
  'pounds'
];

export function QuantityDisplay({ itemId, quantity, unit, isGuest, onUpdate }: QuantityDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editQuantity, setEditQuantity] = useState(quantity?.toString() || '');
  const [editUnit, setEditUnit] = useState(unit || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      const quantityValue = editQuantity ? parseFloat(editQuantity) : null;
      const unitValue = editUnit || null;

      if (isGuest) {
        // For guest users, update local store
        useGuestStore.getState().updateItem(itemId, {
          quantity: quantityValue,
          unit: unitValue,
          updated_at: new Date().toISOString()
        });
      } else {
        // For authenticated users, update database
        const { error } = await supabase
          .from('items')
          .update({
            quantity: quantityValue,
            unit: unitValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId);

        if (error) throw error;
      }

      // Update parent component
      onUpdate(itemId, quantityValue, unitValue);

      toast({
        title: "Quantity updated",
        description: "The item's quantity and unit have been updated successfully.",
      });

      setIsOpen(false);
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({
        title: "Error",
        description: "Failed to update the quantity. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setEditQuantity(quantity?.toString() || '');
      setEditUnit(unit || '');
    }
    setIsOpen(open);
  };

  const displayText = () => {
    if (quantity && unit) {
      return `${quantity} ${unit}`;
    } else if (quantity) {
      return `${quantity}`;
    } else if (unit) {
      return unit;
    }
    return 'Set quantity';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-sm text-muted-foreground hover:text-accent transition-colors"
        >
          {displayText()}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Quantity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="quantity" className="text-sm font-medium">
              Quantity
            </label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              placeholder="Enter quantity"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="unit" className="text-sm font-medium">
              Unit
            </label>
            <Select value={editUnit} onValueChange={setEditUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isUpdating}
            >
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
