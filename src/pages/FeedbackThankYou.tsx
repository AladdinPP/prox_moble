import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2 } from "lucide-react";

export function FeedbackThankYou() {
  const navigate = useNavigate();

  const handleDone = () => {
    navigate("/account");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="w-10" /> {/* Spacer for centering */}
        <h1 className="text-lg font-primary font-semibold text-black">
          Feedback
        </h1>
        <button
          type="button"
          onClick={handleDone}
          className="p-1 rounded-full hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Center Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-8">
        {/* Green Check Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
          <div className="relative bg-green-500/10 rounded-full p-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" strokeWidth={2} />
          </div>
        </div>

        {/* Thank You Text */}
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-3xl font-primary font-bold text-black">
            Thank You!
          </h2>
          <p className="text-base text-muted-foreground font-secondary leading-relaxed">
            We've received your feedback. Your input helps us make Prox better for everyone.
          </p>
        </div>

        {/* Done Button */}
        <div className="w-full max-w-xs px-4">
          <Button
            type="button"
            onClick={handleDone}
            className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
