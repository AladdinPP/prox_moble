import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, Camera, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProxCard, ProxCardContent } from '@/components/ProxCard';
import { ManualEntry } from '@/components/add-item/ManualEntry';
import { PhotoUpload } from '@/components/add-item/PhotoUpload';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStore } from '@/stores/guestStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScanReceipt } from '@/components/add-item/ScanReceipt';
type AddItemMode = 'select' | 'manual' | 'photo' | 'receipt';

export function AddItem() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, isGuest } = useGuestStore();
  const { toast } = useToast();
  const [mode, setMode] = useState<AddItemMode>('select');

  const handleBack = () => {
    if (mode === 'select') {
      
      navigate('/home');
      
    } else {
      setMode('select');
    }
  };

  const handleItemSuccess = async (items: any | any[]) => {
    const itemsArray = Array.isArray(items) ? items : [items];
    
    try {
      if (isGuest) {
        // Add to local storage for guest users
        itemsArray.forEach(item => addItem(item));
      } else if (user) {
        // Add to Supabase for authenticated users
        const itemsWithUserId = itemsArray.map(item => ({
          ...item,
          user_id: user.id,
        }));

        const { error } = await supabase
          .from('items')
          .insert(itemsWithUserId);

        if (error) throw error;
      }

      // Log analytics event
      if (user || isGuest) {
        try {
          await supabase.from('events').insert({
            user_id: user?.id || null,
            name: 'items_added',
            payload: {
              count: itemsArray.length,
              method: mode,
              categories: [...new Set(itemsArray.map(item => item.category))],
            },
          });
        } catch (analyticsError) {
          console.warn('Analytics logging failed:', analyticsError);
        }
      }

      navigate('/home');
    } catch (error) {
      console.error('Error saving items:', error);
      toast({
        title: "Error",
        description: "Failed to save items. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (mode === 'manual') {
    return (
      <ManualEntry
        onBack={handleBack}
        onSuccess={handleItemSuccess}
      />
    );
  }

  if (mode === 'photo') {
    return (
      <PhotoUpload
        onBack={handleBack}
        onSuccess={handleItemSuccess}
      />
    );
  }

  if (mode === 'receipt') {
    // Placeholder for receipt scanning - will implement later
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <ProxCard className="max-w-md mx-4">
          <ProxCardContent className="text-center py-12">
          <ScanReceipt onBack={handleBack} onSuccess={handleItemSuccess} />
          </ProxCardContent>
        </ProxCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground font-primary">Add Items</h1>
              <p className="text-sm text-muted-foreground font-secondary">Choose how to add your groceries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Options */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Manual Entry */}
        <ProxCard className="hover:shadow-medium transition-all cursor-pointer" onClick={() => setMode('manual')}>
          <ProxCardContent className="flex items-center p-6">
            <div className="w-12 h-12 bg-accent/10 rounded-prox flex items-center justify-center mr-4">
              <Edit3 className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground font-primary mb-1">Manual Entry</h3>
              <p className="text-sm text-muted-foreground font-secondary">
                Enter item details by hand - quick and precise
              </p>
            </div>
          </ProxCardContent>
        </ProxCard>

        {/* Photo Upload */}
        <ProxCard className="hover:shadow-medium transition-all cursor-pointer" onClick={() => setMode('photo')}>
          <ProxCardContent className="flex items-center p-6">
            <div className="w-12 h-12 bg-highlight/10 rounded-prox flex items-center justify-center mr-4">
              <Camera className="h-6 w-6 text-highlight" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground font-primary mb-1">Upload Photo</h3>
              <p className="text-sm text-muted-foreground font-secondary">
                Take a photo of your groceries to add multiple items
              </p>
            </div>
          </ProxCardContent>
        </ProxCard>

        {/* Receipt Scanning */}
        <ProxCard className="hover:shadow-medium transition-all cursor-pointer" onClick={() => setMode('receipt')}>
          <ProxCardContent className="flex items-center p-6">

            <div className="w-12 h-12 bg-highlight/10 rounded-prox flex items-center justify-center mr-4">
              <Receipt className="h-6 w-6 text-highlight" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground font-primary mb-1">
                Scan Receipt
              </h3>
              <p className="text-sm text-muted-foreground font-secondary">
                Scan your grocery receipt to automatically add items
              </p>
            </div>
          </ProxCardContent>
        </ProxCard>

        {/* Tips Card */}
        <ProxCard className="bg-gradient-to-r from-accent/5 to-highlight/5 border-accent/20 mt-8">
          <ProxCardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-accent font-primary mb-1">Pro Tips</p>
                <ul className="text-xs text-muted-foreground font-secondary space-y-1">
                  <li>• Manual entry is fastest for single items</li>
                  <li>• Photo upload works great for multiple items</li>
                  <li>• Expiration dates are estimated automatically</li>
                </ul>
              </div>
            </div>
          </ProxCardContent>
        </ProxCard>
      </div>
    </div>
  );
}