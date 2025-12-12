import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from "@/components/ProxCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

// Reuse the same retailer list as signup (you can import it from a shared file later)
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

const deviceOptions = ["web", "mobile", "both"] as const;

const accountSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
    email: z.string().email("Please enter a valid email address"),
    preferredRetailers: z
      .array(z.string())
      .min(1, "Please select at least 1 store")
      .max(3, "You can select up to 3 stores"),
    estimatedAddress: z.string().optional().or(z.literal("")),
    devicePreference: z.enum(deviceOptions, {
      required_error: "Please choose a device preference",
    }),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .optional()
      .or(z.literal("")),
    confirmPassword: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      !data.newPassword || // if no new password, ok
      data.newPassword === data.confirmPassword,
    {
      path: ["confirmPassword"],
      message: "Passwords don't match",
    }
  );

type AccountForm = z.infer<typeof accountSchema>;

export function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
      preferredRetailers: [],
      estimatedAddress: "",
      devicePreference: "mobile",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Fetch waitlist data for current user
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        // Try to find a waitlist row for this user
        const { data: waitlistRow, error: waitlistError } = await supabase
          .from("waitlist")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (waitlistError && waitlistError.code !== "PGRST116") {
          // 116 = no rows; anything else we log
          console.error("Error fetching waitlist:", waitlistError);
        }

        const wl = waitlistRow || {};

        const preferredRetailers =
          (wl.preferred_retailers as string[] | null) ?? [];

        reset({
          firstName:
            (wl.first_name as string) ||
            (user.user_metadata?.first_name as string) ||
            "",
          lastName:
            (wl.last_name as string) ||
            (user.user_metadata?.last_name as string) ||
            "",
          phoneNumber:
            (wl.phone_number as string) ||
            (user.user_metadata?.phone_number as string) ||
            "",
          email: (wl.email as string) || user.email || "",
          preferredRetailers,
          estimatedAddress: (wl.estimated_address as string) || "",
          devicePreference:
            ((wl.device_preference as string) as AccountForm["devicePreference"]) ||
            ((user.user_metadata?.app_preference as string) as AccountForm["devicePreference"]) ||
            "mobile",
          newPassword: "",
          confirmPassword: "",
        });
      } catch (e) {
        console.error("Unexpected error loading account:", e);
        toast({
          variant: "destructive",
          title: "Error loading account",
          description: "We couldn't load your account info. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, reset, toast]);

  const onSubmit = async (data: AccountForm) => {
    if (!user) return;

    setSaving(true);
    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim();

      // 1) Update public.waitlist
      const { error: waitlistError } = await supabase.from("waitlist").upsert(
        {
          user_id: user.id,
          email: data.email,
          name: fullName || data.email, // ✅ ensure NOT NULL for waitlist.name
          first_name: data.firstName,
          last_name: data.lastName,
          phone_number: data.phoneNumber,
          preferred_retailers:
            data.preferredRetailers && data.preferredRetailers.length
              ? data.preferredRetailers
              : null,
          estimated_address: data.estimatedAddress || null,
          device_preference: data.devicePreference,
        },
        {
          // use email as the conflict target (has a unique constraint)
          onConflict: "email",
        }
      );

      if (waitlistError) {
        console.error("Error updating waitlist:", waitlistError);
        throw new Error("Failed to update your waitlist data");
      }

      // 2) Update public.profiles with overlapping fields
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          phone_number: data.phoneNumber,
          email: data.email,
          preferred_retailers:
            data.preferredRetailers && data.preferredRetailers.length
              ? data.preferredRetailers
              : null,
          app_preference: data.devicePreference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
        // don't throw yet; we still want auth updates to run
      }

      // 3) Update auth user (email, password, metadata)
      const authUpdate: any = {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone_number: data.phoneNumber,
          preferred_retailers: data.preferredRetailers,
          app_preference: data.devicePreference,
        },
      };

      if (data.email !== user.email) {
        authUpdate.email = data.email;
      }

      if (data.newPassword) {
        authUpdate.password = data.newPassword;
      }

      const { error: authError } = await supabase.auth.updateUser(authUpdate);

      if (authError) {
        console.error("Error updating auth user:", authError);
        throw new Error(authError.message || "Failed to update your account");
      }

      toast({
        title: "Account updated",
        description: "Your account details have been saved.",
      });
    } catch (e: any) {
      console.error("Account update error:", e);
      toast({
        variant: "destructive",
        title: "Update failed",
        description:
          e.message || "We couldn't save your changes. Please try again.",
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
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <ProxCard className="w-full max-w-xl">
        <ProxCardHeader>
          <ProxCardTitle className="text-center text-2xl font-primary font-semibold text-black">
            My Account
          </ProxCardTitle>
        </ProxCardHeader>
        <ProxCardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...register("firstName")} />
                {errors.firstName && (
                  <p className="text-sm text-destructive">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...register("lastName")} />
                {errors.lastName && (
                  <p className="text-sm text-destructive">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Phone + Email */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                {...register("phoneNumber")}
                placeholder="(555) 123-4567"
              />
              {errors.phoneNumber && (
                <p className="text-sm text-destructive">
                  {errors.phoneNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password change */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password (optional)</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  {...register("newPassword")}
                  className="pr-10"
                  placeholder="Leave blank to keep current password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-destructive">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  {...register("confirmPassword")}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Preferred retailers */}
            <div className="space-y-2">
              <Label>Preferred Retailers (max 3)</Label>
              <Controller
                name="preferredRetailers"
                control={control}
                render={({ field }) => (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded-lg">
                      {GROCERY_STORES.map((store) => (
                        <button
                          key={store}
                          type="button"
                          onClick={() =>
                            toggleRetailer(field.value || [], store, field.onChange)
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

            {/* Estimated address */}
            <div className="space-y-2">
              <Label htmlFor="estimatedAddress">Estimated Address</Label>
              <Input
                id="estimatedAddress"
                {...register("estimatedAddress")}
                placeholder="Optional"
              />
              {errors.estimatedAddress && (
                <p className="text-sm text-destructive">
                  {errors.estimatedAddress.message}
                </p>
              )}
            </div>

            {/* Device preference */}
            <div className="space-y-2">
              <Label>Device Preference</Label>
              <Controller
                name="devicePreference"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-3 gap-2">
                    {deviceOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => field.onChange(opt)}
                        className={`p-2 text-sm rounded-lg border transition-all ${
                          field.value === opt
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-card text-card-foreground border-border hover:border-accent"
                        }`}
                      >
                        {opt === "web"
                          ? "Web"
                          : opt === "mobile"
                          ? "Mobile"
                          : "Both"}
                      </button>
                    ))}
                  </div>
                )}
              />
              {errors.devicePreference && (
                <p className="text-sm text-destructive">
                  {errors.devicePreference.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-accent hover:bg-accent/90 text-white font-primary font-medium"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </ProxCardContent>
      </ProxCard>
    </div>
  );
}
