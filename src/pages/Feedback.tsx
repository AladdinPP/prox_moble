import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from "@/components/ProxCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { X, Star } from "lucide-react";

const FEEDBACK_CATEGORIES = [
  "Cart Optimization",
  "Deal Page",
  "Cart Results",
  "Pantry Tracker",
  "Notifications",
  "AI Chatbot",
  "Search Functionality",
  "Receipt Scanner",
  "Other",
] as const;

const RATING_LABELS: Record<number, string> = {
  1: "Bad",
  2: "Meh",
  3: "Okay",
  4: "Good",
  5: "Great",
};

const MAX_FEEDBACK_LENGTH = 500;

export function Feedback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [starRating, setStarRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not authenticated",
        description: "You must be logged in to submit feedback.",
      });
      return;
    }

    if (starRating === 0) {
      toast({
        variant: "destructive",
        title: "Rating required",
        description: "Please select a star rating before submitting.",
      });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Fetch the waitlist.id for the current user
      const { data: waitlistData, error: waitlistError } = await supabase
        .from("waitlist")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (waitlistError || !waitlistData) {
        console.error("Error fetching waitlist:", waitlistError);
        throw new Error("Could not find your account in our waitlist.");
      }

      // 2. Format feedback string
      const formattedFeedback = selectedCategories.length > 0
        ? `[tags] ${selectedCategories.join(", ")}\n\n[details]\n${feedbackText}`
        : feedbackText;

      // 3. Insert feedback
      const { error: insertError } = await supabase
        .from("user_feedback")
        .insert({
          waitlist_id: waitlistData.id,
          star_rating: starRating,
          feedback: formattedFeedback,
          page: "account_feedback",
          source: "app",
          metadata: {
            tags: selectedCategories,
            rating_label: RATING_LABELS[starRating],
          },
        });

      if (insertError) {
        console.error("Error inserting feedback:", insertError);
        throw new Error("Failed to submit your feedback.");
      }

      // Navigate to thank you page after successful submission
      navigate("/feedback/thank-you");
    } catch (e: any) {
      console.error("Feedback submission error:", e);
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: e.message || "We couldn't submit your feedback. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabel = starRating > 0 ? RATING_LABELS[starRating] : "";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <ProxCard className="w-full max-w-xl">
          {/* Header with close button */}
          <ProxCardHeader>
            <div className="flex items-center justify-between">
              <ProxCardTitle className="text-2xl font-primary font-semibold text-black">
                Feedback
              </ProxCardTitle>
              <button
                type="button"
                onClick={() => navigate("/account")}
                className="p-1 rounded-full hover:bg-accent transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </ProxCardHeader>

          <ProxCardContent>
            <div className="space-y-6">
              {/* Star Rating */}
              <div className="space-y-3">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setStarRating(rating)}
                      onMouseEnter={() => setHoveredStar(rating)}
                      onMouseLeave={() => setHoveredStar(0)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                      aria-label={`Rate ${rating} stars`}
                    >
                      <Star
                        className={`h-10 w-10 transition-colors ${
                          rating <= (hoveredStar || starRating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Rating Label */}
                {ratingLabel && (
                  <p className="text-center text-xl font-semibold font-primary text-black">
                    {ratingLabel}
                  </p>
                )}
              </div>

              {/* Subtitle */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground font-secondary">
                  Glad to hear it. What could we improve?
                </p>
              </div>

              {/* Category chips */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 justify-center">
                  {FEEDBACK_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all font-secondary ${
                        selectedCategories.includes(category)
                          ? "bg-prox text-white border-prox"
                          : "bg-card text-card-foreground border-border hover:border-prox"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Please tell us more"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  maxLength={MAX_FEEDBACK_LENGTH}
                  rows={5}
                  className="resize-none font-secondary"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {feedbackText.length}/{MAX_FEEDBACK_LENGTH}
                </p>
              </div>

              {/* Submit button */}
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || starRating === 0}
                className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary"
              >
                {submitting ? "Submitting..." : "Share with Prox"}
              </Button>
            </div>
          </ProxCardContent>
        </ProxCard>
      </div>
    </div>
  );
}
