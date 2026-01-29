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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const deviceOptions = ["web", "mobile", "both"] as const;

const personalInfoSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
    estimatedAddress: z.string().optional().or(z.literal("")),
    email: z.string().email("Please enter a valid email address"),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .optional()
      .or(z.literal("")),
    confirmPassword: z.string().optional().or(z.literal("")),
    devicePreference: z.enum(deviceOptions, {
      required_error: "Please choose a device preference",
    }),
  })
  .refine((data) => !data.newPassword || data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

type PersonalInfoForm = z.infer<typeof personalInfoSchema>;

export function PersonalInfo() {
  const navigate = useNavigate();
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
  } = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      estimatedAddress: "",
      email: "",
      newPassword: "",
      confirmPassword: "",
      devicePreference: "mobile",
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
          estimatedAddress: (wl.estimated_address as string) || "",
          email: (wl.email as string) || user.email || "",
          newPassword: "",
          confirmPassword: "",
          devicePreference:
            ((wl.device_preference as string) as PersonalInfoForm["devicePreference"]) ||
            ((user.user_metadata?.app_preference as string) as PersonalInfoForm["devicePreference"]) ||
            "mobile",
        });
      } catch (e) {
        console.error("Unexpected error loading personal info:", e);
        toast({
          variant: "destructive",
          title: "Error loading data",
          description: "We couldn't load your information. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, reset, toast]);

  const onSubmit = async (data: PersonalInfoForm) => {
    if (!user) return;

    setSaving(true);
    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim();

      // 1) Update public.waitlist
      const { error: waitlistError } = await supabase.from("waitlist").upsert(
        {
          user_id: user.id,
          email: data.email,
          name: fullName || data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          phone_number: data.phoneNumber,
          estimated_address: data.estimatedAddress || null,
          device_preference: data.devicePreference,
        },
        {
          onConflict: "email",
        }
      );

      if (waitlistError) {
        console.error("Error updating waitlist:", waitlistError);
        throw new Error("Failed to update your waitlist data");
      }

      // 2) Update public.profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          phone_number: data.phoneNumber,
          email: data.email,
          app_preference: data.devicePreference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }

      // 3) Update auth user (email, password, metadata)
      const authUpdate: any = {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone_number: data.phoneNumber,
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
        title: "Personal info updated",
        description: "Your information has been saved successfully.",
      });

      // Navigate back to account page
      navigate("/account");
    } catch (e: any) {
      console.error("Personal info update error:", e);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: e.message || "We couldn't save your changes. Please try again.",
      });
    } finally {
      setSaving(false);
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
                Personal Info
              </ProxCardTitle>
            </div>
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

              {/* Phone */}
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

              {/* Estimated Address */}
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

              {/* Email */}
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
