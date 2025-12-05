import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUi } from '@/contexts/UiContext';



const manualEntrySchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  category: z.string().min(1, 'Please select a category'),
  purchasedAt: z.date({
    message: 'Purchase date is required',
  }),
});

type ManualEntryForm = z.infer<typeof manualEntrySchema>;

interface ManualEntryProps {
  onBack: () => void;
  onSuccess: (item: any) => void;
}

export function ManualEntry({ onBack, onSuccess }: ManualEntryProps) {
  const { toast } = useToast();
  const { allCategories } = useUi();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<ManualEntryForm>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      purchasedAt: new Date(),
    }
  });

  const selectedDate = watch('purchasedAt');
  const selectedCategory = watch('category');

  const onSubmit = async (data: ManualEntryForm) => {
    setIsLoading(true);
    try {
      // Import the estimation service dynamically to avoid build issues
      const { estimateDates } = await import('@/services/dateEstimation');
      
      const estimates = await estimateDates({
        name: data.name,
        category: data.category,
        purchasedAt: data.purchasedAt.toISOString().split('T')[0],
      });

      const newItem = {
        name: data.name,
        category: data.category,
        purchased_at: data.purchasedAt.toISOString().split('T')[0],
        estimated_expiration_at: estimates.estimatedExpirationAt,
        estimated_restock_at: estimates.estimatedRestockAt,
        estimate_source: estimates.source,
      };

      toast({
        title: "Item added!",
        description: `${data.name} has been added to your pantry.`,
      });

      reset();
      onSuccess(newItem);
    } catch (error) {
      console.error('Error adding item:', error);
      toast({
        title: "Error",
        description: "Failed to add item. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground font-primary">Add Item Manually</h1>
              <p className="text-sm text-muted-foreground font-secondary">Enter item details</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <ProxCard>
          <ProxCardHeader>
            <ProxCardTitle className="font-primary">Item Details</ProxCardTitle>
          </ProxCardHeader>
          <ProxCardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-secondary">Item Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  className="h-12"
                  placeholder="e.g., Organic Bananas"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="font-secondary">Category *</Label>
                <Select onValueChange={(value) => setValue('category', value)} value={selectedCategory}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="font-secondary">Purchase Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-12 justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setValue('purchasedAt', date)}
                      disabled={(date) =>
                        date > new Date() || date < new Date("2020-01-01")
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {errors.purchasedAt && (
                  <p className="text-sm text-destructive">{errors.purchasedAt.message}</p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="flex-1 h-12"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-secondary"
                  disabled={isLoading}
                >
                  {isLoading ? "Adding Item..." : "Add Item"}
                </Button>
              </div>
            </form>
          </ProxCardContent>
        </ProxCard>

        {/* Estimation Info */}
        <ProxCard className="mt-4 bg-gradient-to-r from-accent/5 to-highlight/5 border-accent/20">
          <ProxCardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-accent font-primary mb-1">Smart Estimation</p>
                <p className="text-xs text-muted-foreground font-secondary">
                  Prox will automatically estimate expiration and restock dates based on the item type and category.
                </p>
              </div>
            </div>
          </ProxCardContent>
        </ProxCard>
      </div>
    </div>
  );
}