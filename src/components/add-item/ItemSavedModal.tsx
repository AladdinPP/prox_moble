import React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProxCard, ProxCardContent } from "@/components/ProxCard";

interface ItemSavedModalProps {
  open: boolean;
  onClose: () => void;
  onViewPantry: () => void;
}

export function ItemSavedModal({ open, onClose, onViewPantry }: ItemSavedModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <ProxCard className="w-full max-w-sm">
          <ProxCardContent className="p-6 relative text-center">
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>

            {/* Icon */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">
                <Check className="h-5 w-5 text-white" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-foreground font-primary mb-2">
              Item Saved
            </h2>
            <p className="text-sm text-muted-foreground font-secondary mb-6">
              This item has been added to your pantry tracker.
            </p>

            <Button
              onClick={onViewPantry}
              className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-secondary"
            >
              View Pantry Tracker
            </Button>
          </ProxCardContent>
        </ProxCard>
      </div>
    </div>
  );
}
