import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Upload, X, Check, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ScanReceiptProps {
  onBack: () => void;
  onSuccess: (items: any[]) => void;
}

interface ReceiptItem {
  name: string;
  category: string;
  price?: string;
  quantity?: string;
  confirmed: boolean;
}

export function ScanReceipt({ onBack, onSuccess }: ScanReceiptProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ReceiptItem[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleImageSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setImage(imageData);
      processReceiptImage(imageData);
    };
    reader.readAsDataURL(file);
  };

  const processReceiptImage = async (imageData: string) => {
    setIsProcessing(true);
    try {
      console.log('Starting receipt scan process...');

      // Use the Supabase function endpoint from environment variable
      const scanReceiptFunctionUrl = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/super-service";
      if (!scanReceiptFunctionUrl) {
        throw new Error('Scan receipt function URL is not set in environment variables (VITE_SUPABASE_SCAN_RECEIPT_FUNCTION_URL)');
      }

      const response = await fetch(scanReceiptFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZWxmb2ZuZXN0emJ0emlhZ2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjA4NjUsImV4cCI6MjA3MDY5Njg2NX0.OXpV8sA9sBgm5iUKd19p5uprlyWc4CLYM_Nk1O1VpW4',
        },
        body: JSON.stringify({ image: imageData })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Function error:', errorText);
        throw new Error(`Function returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Received data:', data);

      if (!data || !data.items) {
        throw new Error('No items found in the receipt');
      }

      // Convert API response to our component format
      const items: ReceiptItem[] = data.items.map((item: any) => ({
        name: item.name,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
        confirmed: true, // Default to confirmed
      }));

      setExtractedItems(items);
      setIsConfirming(true);

      toast({
        title: "Receipt scanned!",
        description: `Found ${items.length} items. Review and confirm below.`,
      });
    } catch (error) {
      console.error('Receipt scanning error:', error);
      toast({
        title: "Scanning failed",
        description: error instanceof Error ? error.message : "Could not process the receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItemConfirmation = (index: number) => {
    setExtractedItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, confirmed: !item.confirmed } : item
      )
    );
  };

  const updateItemName = (index: number, newName: string) => {
    setExtractedItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, name: newName } : item
      )
    );
  };

  const handleConfirmItems = async () => {
    const confirmedItems = extractedItems.filter(item => item.confirmed);

    if (confirmedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please confirm at least one item to add.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Import the estimation service dynamically
      const { estimateDates } = await import('@/services/dateEstimation');

      const today = new Date().toISOString().split('T')[0];
      const itemsWithEstimates = await Promise.all(
        confirmedItems.map(async (item) => {
          const estimates = await estimateDates({
            name: item.name,
            category: item.category,
            purchasedAt: today,
          });

          return {
            name: item.name,
            category: item.category,
            purchased_at: today,
            estimated_expiration_at: estimates.estimatedExpirationAt,
            estimated_restock_at: estimates.estimatedRestockAt,
            estimate_source: estimates.source,
          };
        })
      );

      toast({
        title: "Items added!",
        description: `${confirmedItems.length} items added from receipt.`,
      });

      onSuccess(itemsWithEstimates);
    } catch (error) {
      console.error('Error adding items:', error);
      toast({
        title: "Error",
        description: "Failed to add items. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetUpload = () => {
    setImage(null);
    setExtractedItems([]);
    setIsConfirming(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
              <h1 className="text-xl font-semibold text-foreground font-primary">Scan Receipt</h1>
              <p className="text-sm text-muted-foreground font-secondary">
                {isConfirming ? 'Review detected items' : 'Take or upload a photo of your receipt'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {!image ? (
          /* Upload Section */
          <ProxCard>
            <ProxCardContent className="text-center py-12">
              <div className="w-20 h-20 bg-accent/10 rounded-prox mx-auto mb-6 flex items-center justify-center">
                <Receipt className="h-10 w-10 text-accent" />
              </div>
              <h3 className="text-lg font-medium mb-2 font-primary">Scan Your Receipt</h3>
              <p className="text-muted-foreground mb-6 font-secondary">
                Take a photo of your grocery receipt to automatically extract items
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                }}
                className="hidden"
              />

              <div className="space-y-3">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-12 bg-accent hover:bg-accent/90 font-secondary"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Take Photo
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full h-12 font-secondary"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  Upload from Gallery
                </Button>
              </div>
            </ProxCardContent>
          </ProxCard>
        ) : isProcessing ? (
          /* Processing Section */
          <ProxCard>
            <ProxCardContent className="text-center py-12">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2 font-primary">Scanning Receipt</h3>
              <p className="text-muted-foreground font-secondary">
                Analyzing your receipt and extracting grocery items...
              </p>
            </ProxCardContent>
          </ProxCard>
        ) : (
          /* Confirmation Section */
          <div className="space-y-6">
            {/* Image Preview */}
            <ProxCard>
              <ProxCardContent className="p-4">
                <div className="relative">
                  <img
                    src={image}
                    alt="Uploaded receipt photo"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetUpload}
                    className="absolute top-2 right-2 bg-card/80 hover:bg-card rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </ProxCardContent>
            </ProxCard>

            {/* Items List */}
            <ProxCard>
              <ProxCardHeader>
                <ProxCardTitle className="font-primary">Extracted Items ({extractedItems.filter(item => item.confirmed).length} selected)</ProxCardTitle>
              </ProxCardHeader>
              <ProxCardContent className="space-y-3">
                {extractedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No items were detected in the receipt. Please try with a clearer image.
                  </div>
                ) : (
                  extractedItems.map((item, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center space-x-3 p-3 rounded-lg border transition-all",
                        item.confirmed
                          ? "bg-accent/5 border-accent/20"
                          : "bg-muted/30 border-border"
                      )}
                    >
                      <button
                        onClick={() => toggleItemConfirmation(index)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                          item.confirmed
                            ? "bg-accent border-accent text-white"
                            : "border-muted-foreground hover:border-accent"
                        )}
                      >
                        {item.confirmed && <Check className="h-3 w-3" />}
                      </button>

                      <div className="flex-1">
                        <Input
                          value={item.name}
                          onChange={(e) => updateItemName(index, e.target.value)}
                          className="mb-1 h-8 text-sm"
                          disabled={!item.confirmed}
                        />
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                          {(item.price || item.quantity) && (
                            <p className="text-xs text-muted-foreground">
                              {item.quantity && `${item.quantity} `}
                              {item.price && `$${item.price}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </ProxCardContent>
            </ProxCard>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={resetUpload}
                className="flex-1 h-12 font-secondary"
              >
                Try Again
              </Button>
              <Button
                onClick={handleConfirmItems}
                className="flex-1 h-12 bg-accent hover:bg-accent/90 font-secondary"
                disabled={extractedItems.filter(item => item.confirmed).length === 0}
              >
                Add {extractedItems.filter(item => item.confirmed).length} Items
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}