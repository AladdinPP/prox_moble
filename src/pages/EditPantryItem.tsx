import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, CalendarIcon } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUi } from "@/contexts/UiContext";
import { useGuestStore } from "@/stores/guestStore";

const sizeOptions = [
  { value: "count", label: "Count" },
  { value: "oz", label: "Ounces (oz)" },
  { value: "lb", label: "Pounds (lb)" },
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "l", label: "Liters (L)" },
  { value: "pack", label: "Pack" },
  { value: "gal", label: "Gallon (gal)" },
] as const;

const schema = z.object({
  name: z.string().min(1, "Item name is required"),
  brand: z.string().min(1, "Brand is required"),
  category: z.string().min(1, "Category is required"),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, "Quantity must be a number greater than 0"),
  unit: z.string().min(1, "Size is required"),
  purchasedAt: z.date({ message: "Purchase date is required" }),
});

type FormValues = z.infer<typeof schema>;

type OriginalSnapshot = {
  name: string;
  brand: string;
  quantity: number;
  unit: string;
};

export function EditPantryItem() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { allCategories } = useUi();
  const { isGuest, items: guestItems } = useGuestStore();

  const categoryOptions = useMemo(() => allCategories.filter((c) => c !== "All"), [allCategories]);

  const [loading, setLoading] = useState(true);
  const [original, setOriginal] = useState<OriginalSnapshot | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      brand: "",
      category: "",
      quantity: "",
      unit: "",
      purchasedAt: new Date(),
    },
  });

  const selectedCategory = watch("category") ?? "";
  const selectedUnit = watch("unit") ?? "";
  const selectedDate = watch("purchasedAt");

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      setLoading(true);
      try {
        if (isGuest) {
          const item = (guestItems as any[])?.find((x) => x.id === id);
          if (!item) {
            toast({ title: "Not found", description: "Item not found.", variant: "destructive" });
            navigate("/pantry-tracker");
            return;
          }

          reset({
            name: item.name ?? "",
            brand: item.brand ?? "",
            category: item.category ?? "",
            quantity: item.quantity != null ? String(item.quantity) : "",
            unit: item.unit ?? "",
            purchasedAt: item.purchased_at ? new Date(item.purchased_at) : new Date(),
          });

          setOriginal({
            name: item.name ?? "",
            brand: item.brand ?? "",
            quantity: Number(item.quantity ?? 0),
            unit: item.unit ?? "",
          });

          return;
        }

        const { data, error } = await supabase
          // @ts-expect-error
          .from("pantry_tracker")
          .select("id, name, brand, category, quantity, unit, purchased_at, user_id")
          .eq("id", id)
          .single();

        if (error) throw error;

        if (user && data?.user_id && data.user_id !== user.id) {
          toast({ title: "Not allowed", description: "You can only edit your own items.", variant: "destructive" });
          navigate("/pantry-tracker");
          return;
        }

        reset({
          name: data?.name ?? "",
          brand: data?.brand ?? "",
          category: data?.category ?? "",
          quantity: data?.quantity != null ? String(data.quantity) : "",
          unit: data?.unit ?? "",
          purchasedAt: data?.purchased_at ? new Date(data.purchased_at) : new Date(),
        });

        setOriginal({
          name: data?.name ?? "",
          brand: data?.brand ?? "",
          quantity: Number(data?.quantity ?? 0),
          unit: data?.unit ?? "",
        });
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to load item.", variant: "destructive" });
        navigate("/pantry-tracker");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, isGuest, guestItems, navigate, reset, toast, user]);

  const invalidateImageCacheIfNeeded = async (next: OriginalSnapshot) => {
    if (!id) return;
    if (!original) return;

    const changed =
      original.name.trim() !== next.name.trim() ||
      original.brand.trim() !== next.brand.trim() ||
      original.quantity !== next.quantity ||
      original.unit !== next.unit;

    if (!changed) return;

    // Delete cache row so pantry view will re-resolve on next load
    try {
      await supabase
        // @ts-expect-error
        .from("pantry_item_images")
        .delete()
        .eq("pantry_item_id", id);
    } catch (e) {
      // ignore; fallback is placeholder
      console.warn("Failed to invalidate pantry_item_images cache:", e);
    }

    // Optional: immediately resolve image for this item (nice UX)
    try {
      await supabase.functions.invoke("resolve-pantry-images", {
        body: { itemIds: [id] },
      });
    } catch {
      // ignore
    }
  };

  const onSave = async (values: FormValues) => {
    if (!id) return;

    const nextSnap: OriginalSnapshot = {
      name: values.name,
      brand: values.brand,
      quantity: Number(values.quantity),
      unit: values.unit,
    };

    try {
      if (isGuest) {
        useGuestStore.getState().updateItem(id, {
          name: values.name,
          brand: values.brand,
          category: values.category,
          quantity: Number(values.quantity),
          unit: values.unit,
          purchased_at: values.purchasedAt.toISOString(),
          updated_at: new Date().toISOString(),
        } as any);

        await invalidateImageCacheIfNeeded(nextSnap);

        toast({ title: "Saved", description: "Changes saved." });
        navigate("/pantry-tracker");
        return;
      }

      const { error } = await supabase
        // @ts-expect-error
        .from("pantry_tracker")
        .update({
          name: values.name,
          brand: values.brand,
          category: values.category,
          quantity: Number(values.quantity),
          unit: values.unit,
          purchased_at: values.purchasedAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      await invalidateImageCacheIfNeeded(nextSnap);

      toast({ title: "Saved", description: "Changes saved." });
      navigate("/pantry-tracker");
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
  };

  const onDelete = async () => {
    if (!id) return;

    try {
      if (isGuest) {
        useGuestStore.getState().deleteItem(id);
        toast({ title: "Deleted", description: "Item removed." });
        navigate("/pantry-tracker");
        return;
      }

      const { error } = await supabase
        // @ts-expect-error
        .from("pantry_tracker")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Deleted", description: "Item removed." });
      navigate("/pantry-tracker");
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to delete item.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/pantry-tracker")} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground font-primary">Edit Item</h1>
          </div>

          <Button variant="ghost" size="icon" onClick={onDelete} className="rounded-full text-muted-foreground hover:text-destructive">
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit(onSave)} className="space-y-6">
          <div className="space-y-2">
            <Label className="font-secondary">Item Name</Label>
            <Input className="h-12" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="font-secondary">Brand</Label>
            <Input className="h-12" {...register("brand")} />
            {errors.brand && <p className="text-sm text-destructive">{errors.brand.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="font-secondary">Category</Label>
            <Select value={selectedCategory} onValueChange={(v) => setValue("category", v, { shouldDirty: true, shouldValidate: true })}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-secondary">Quantity</Label>
              <Input className="h-12" inputMode="decimal" {...register("quantity")} />
              {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="font-secondary">Size</Label>
              <Select value={selectedUnit} onValueChange={(v) => setValue("unit", v, { shouldDirty: true, shouldValidate: true })}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {sizeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unit && <p className="text-sm text-destructive">{errors.unit.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-secondary">Purchase Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full h-12 justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setValue("purchasedAt", date, { shouldDirty: true, shouldValidate: true })}
                  disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {errors.purchasedAt && <p className="text-sm text-destructive">{errors.purchasedAt.message}</p>}
          </div>

          <Button type="submit" className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-secondary">
            Save Changes
          </Button>
        </form>
      </div>
    </div>
  );
}
