import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Upload, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { selectImageWithCapacitor } from '@/utils/capacitorCamera';

interface PhotoUploadProps {
  onBack: () => void;
  onSuccess: (items: any[]) => void;
}

interface ParsedItem {
  name: string;
  category: string;
  confirmed: boolean;
}

export function PhotoUpload({ onBack, onSuccess }: PhotoUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleImageSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setImage(imageData);
      processImage(imageData);
    };
    reader.readAsDataURL(file);
  };

  // Hybrid image selection - works on web and mobile
  const selectImage = async () => {
    try {
      // Try Capacitor camera first
      const imageData = await selectImageWithCapacitor();
      
      if (imageData) {
        setImage(imageData);
        processImage(imageData);
        return;
      }

      // Fallback to web file input
      fileInputRef.current?.click();
    } catch (error) {
      console.error('Error selecting image:', error);
      toast({
        title: "Error",
        description: "Failed to select image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const processImage = async (imageData: string) => {
    setIsProcessing(true);
    try {
      console.log('Starting photo identification process...');

      // Call the correct Supabase function endpoint
      const response = await fetch(
        import.meta.env.VITE_SUPABASE_URL + "/functions/v1/dynamic-handler",
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZWxmb2ZuZXN0emJ0emlhZ2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjA4NjUsImV4cCI6MjA3MDY5Njg2NX0.OXpV8sA9sBgm5iUKd19p5uprlyWc4CLYM_Nk1O1VpW4',
          },
          body: JSON.stringify({ image: imageData })
        }
      );

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Function error:', errorText);
        throw new Error(`Function returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Received data:', data);

      if (!data || !data.items) {
        throw new Error('No items found in the image');
      }

      // Convert API response to our component format
      const items: ParsedItem[] = data.items.map((item: any) => ({
        name: item.name,
        category: item.category,
        confirmed: true, // Default to confirmed
      }));

      setParsedItems(items);
      setIsConfirming(true);

      toast({
        title: "Photo processed!",
        description: `Found ${items.length} items. Review and confirm below.`,
      });
    } catch (error) {
      console.error('Photo processing error:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Could not process the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItemConfirmation = (index: number) => {
    setParsedItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, confirmed: !item.confirmed } : item
      )
    );
  };

  const updateItemName = (index: number, newName: string) => {
    setParsedItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, name: newName } : item
      )
    );
  };

  const handleConfirmItems = async () => {
    const confirmedItems = parsedItems.filter(item => item.confirmed);
    
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
        description: `${confirmedItems.length} items added from photo.`,
      });
      onSuccess(itemsWithEstimates);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add items. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetUpload = () => {
    setImage(null);
    setParsedItems([]);
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
              <h1 className="text-xl font-semibold text-foreground font-primary">Upload Photo</h1>
              <p className="text-sm text-muted-foreground font-secondary">
                {isConfirming ? 'Review detected items' : 'Take or upload a photo of your groceries'}
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
                <Camera className="h-10 w-10 text-accent" />
              </div>
              <h3 className="text-lg font-medium mb-2 font-primary">Upload Grocery Photo</h3>
              <p className="text-muted-foreground mb-6 font-secondary">
                Take a photo of your groceries or upload from your gallery
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
                {/* Single unified button that works on all platforms */}
                <Button
                  onClick={selectImage}
                  className="w-full h-12 bg-accent hover:bg-accent/90 font-secondary"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Take Photo or Select from Gallery
                </Button>
                
                {/* Separate gallery button for web */}
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
              <h3 className="text-lg font-medium mb-2 font-primary">Processing Photo</h3>
              <p className="text-muted-foreground font-secondary">
                Analyzing your image and detecting grocery items...
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
                    alt="Uploaded grocery photo"
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
                <ProxCardTitle className="font-primary">Detected Items ({parsedItems.filter(item => item.confirmed).length} selected)</ProxCardTitle>
              </ProxCardHeader>
              <ProxCardContent className="space-y-3">
                {parsedItems.map((item, index) => (
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
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                  </div>
                ))}
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
                disabled={parsedItems.filter(item => item.confirmed).length === 0}
              >
                Add {parsedItems.filter(item => item.confirmed).length} Items
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}