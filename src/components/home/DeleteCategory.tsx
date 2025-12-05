import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function DeleteCategory({setCategoriesChangeTracker,categoriesChangeTracker}) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [userCategories, setUserCategories] = useState<string[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && user) {
      fetchUserCategories();
    }
  }, [open, user]);

  const fetchUserCategories = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('other_categories')
        .select('name')
        .eq('user_id', user.id);

      if (error) throw error;
      setUserCategories(data?.map(category => category.name) || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCategory) {
      toast({
        title: "Error",
        description: "Please select a category to delete",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be signed in to delete a category",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('other_categories')
        .delete()
        .eq('name', selectedCategory)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Category "${selectedCategory}" has been deleted`,
      });

      setSelectedCategory('');
      setOpen(false);
      setCategoriesChangeTracker(!categoriesChangeTracker);
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: "Failed to delete category. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="whitespace-nowrap ml-2"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete Category
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            Select the category you want to delete from your pantry.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="category-select" className="text-right text-sm font-medium">
                Category
              </label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                disabled={userCategories.length === 0}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={userCategories.length === 0 ? "No categories available" : "Select a category"} />
                </SelectTrigger>
                <SelectContent>
                  {userCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedCategory}
              variant="destructive"
            >
              {loading ? "Deleting..." : "Delete Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
