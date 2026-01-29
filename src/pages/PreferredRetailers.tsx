import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from "@/components/ProxCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const GROCERY_STORES = [
  "Albertsons",
  "Aldi",
  "Amazon Fresh",
  "Food Lion",
  "H-E-B",
  "Kroger",
  "Meijer",
  "Northgate",
  "Publix",
  "Ralphs",
  "Safeway",
  "El Super",
  "Superior Grocers",
  "Smart & Final",
  "Sprouts Market",
  "Target",
  "Trader Joe's",
  "Vallarta",
  "Vons",
  "Wegmans",
  "Walmart",
  "Whole Foods",
  "Other",
] as const;

const preferredRetailersSchema = z.object({
  preferredRetailers: z
    .array(z.string())
    .min(1, "Please select at least 1 store")
    .max(3, "You can select up to 3 stores"),
});

type PreferredRetailersForm = z.infer<typeof preferredRetailersSchema>;

export function PreferredRetailers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PreferredRetailersForm>({
    resolver: zodResolver(preferredRetailersSchema),
    defaultValues: {
      preferredRetailers: [],
    },
  });

  // Fetch user data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const { data: waitlistRow, error: waitlistError } = await supabase
          .from("waitlist")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (waitlistError && waitlistError.code !== "PGRST116") {
          console.error("Error fetching waitlist:", waitlistError);
        }

        const wl = waitlistRow || {};

        const preferredRetailers =
          (wl.preferred_retailers as string[] | null) ?? [];

        reset({
          preferredRetailers,
        });
      } catch (e) {
        console.error("Unexpected error loading preferences:", e);
        toast({
          variant: "destructive",
          title: "Error loading data",
          description: "We couldn't load your preferences. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, reset, toast]);

  const onSubmit = async (data: PreferredRetailersForm) => {
    if (!user) return;

    setSaving(true);
    try {
      // 1) Update public.waitlist
      const { error: waitlistError } = await supabase.from("waitlist").upsert(
        {
          user_id: user.id,
          preferred_retailers:
            data.preferredRetailers && data.preferredRetailers.length
              ? data.preferredRetailers
              : null,
        },
        {
          onConflict: "user_id",
        }
      );

      if (waitlistError) {
        console.error("Error updating waitlist:", waitlistError);
        throw new Error("Failed to update your preferences");
      }

      // 2) Update public.profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          preferred_retailers:
            data.preferredRetailers && data.preferredRetailers.length
              ? data.preferredRetailers
              : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }

      // 3) Update auth user metadata
      const authUpdate: any = {
        data: {
          preferred_retailers: data.preferredRetailers,
        },
      };

      const { error: authError } = await supabase.auth.updateUser(authUpdate);

      if (authError) {
        console.error("Error updating auth user:", authError);
        throw new Error(authError.message || "Failed to update your preferences");
      }

      toast({
        title: "Preferences updated",
        description: "Your preferred retailers have been saved successfully.",
      });

      // Navigate back to account page
      navigate("/account");
    } catch (e: any) {
      console.error("Preferences update error:", e);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: e.message || "We couldn't save your changes. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleRetailer = (
    current: string[],
    retailer: string,
    onChange: (v: string[]) => void
  ) => {
    if (current.includes(retailer)) {
      onChange(current.filter((r) => r !== retailer));
    } else if (current.length < 3) {
      onChange([...current, retailer]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background">
      <div className="flex-1 p-4">
        <ProxCard className="w-full max-w-xl mx-auto">
          <ProxCardHeader>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/account")}
                className="p-1 rounded-full hover:bg-accent transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="h-6 w-6 text-muted-foreground" />
              </button>
              <ProxCardTitle className="text-2xl font-primary font-semibold text-black">
                Preferred Retailers
              </ProxCardTitle>
            </div>
          </ProxCardHeader>
          <ProxCardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Preferred retailers */}
              <div className="space-y-2">
                <Label>Select up to 3 stores</Label>
                <Controller
                  name="preferredRetailers"
                  control={control}
                  render={({ field }) => (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto p-2 border border-border rounded-lg">
                        {GROCERY_STORES.map((store) => (
                          <button
                            key={store}
                            type="button"
                            onClick={() =>
                              toggleRetailer(
                                field.value || [],
                                store,
                                field.onChange
                              )
                            }
                            className={`px-2 py-2 text-xs rounded-lg border transition-all ${
                              field.value?.includes(store)
                                ? "bg-accent text-accent-foreground border-accent"
                                : "bg-card text-card-foreground border-border hover:border-accent"
                            }`}
                          >
                            {store}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Selected: {field.value?.length || 0}/3
                      </p>
                    </>
                  )}
                />
                {errors.preferredRetailers && (
                  <p className="text-sm text-destructive">
                    {errors.preferredRetailers.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </ProxCardContent>
        </ProxCard>
      </div>
    </div>
  );
}
