import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useGuestStore } from '@/stores/guestStore';

export interface WaitlistCheckResult {
  status: 'legacy_waitlist' | 'has_account' | 'new_user';
  message: string;
  existing_data?: {
    first_name?: string;
    last_name?: string;
    zip_code?: string;
    phone_number?: string;
    preferred_retailers?: string[];
    date_of_birth?: string;
  };
}

export interface ForgotPasswordResult {
  error: unknown;
  /** If the email belongs to a waitlist-only user (no auth account) */
  isWaitlistOnly?: boolean;
}

interface SignUpUserData {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  zip_code?: string;
  birthday?: string;
  gender_identity?: string;
  household_size?: number;
  grocer_1?: string;
  grocer_2?: string;
  grocer_3?: string;
}

type CheckWaitlistEmailRpcClient = {
  rpc: (
    fn: "check_waitlist_email",
    args: { lookup_email: string }
  ) => Promise<{ data: WaitlistCheckResult | null; error: unknown }>;
};

type ProfilesUpdateClient = {
  from: (table: "profiles") => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: unknown }>;
    };
  };
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: SignUpUserData) => Promise<{ error: unknown }>;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
  checkWaitlistEmail: (email: string) => Promise<WaitlistCheckResult>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResult>;
  resetPassword: (newPassword: string) => Promise<{ error: unknown }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { setIsGuest } = useGuestStore();

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Clear guest mode when user becomes authenticated
        if (session?.user) {
          setIsGuest(false);
        }

        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Clear guest mode if there's an existing authenticated session
      if (session?.user) {
        setIsGuest(false);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setIsGuest]);

  /**
   * Check whether an email belongs to a legacy waitlist user, an existing
   * auth user, or is completely new.
   */
  const checkWaitlistEmail = async (email: string): Promise<WaitlistCheckResult> => {
    try {
      const rpcClient = supabase as unknown as CheckWaitlistEmailRpcClient;
      const { data, error } = await rpcClient.rpc('check_waitlist_email', {
        lookup_email: email,
      });

      if (error || !data) {
        console.error('Error checking waitlist email:', error);
        return { status: 'new_user', message: 'Ready to create account.' };
      }

      return data;
    } catch (e) {
      console.error('Unexpected error checking waitlist:', e);
      return { status: 'new_user', message: 'Ready to create account.' };
    }
  };

  /**
   * Send a password reset email.
   * 
   * First checks if the email actually has an auth account:
   * - has_account  → sends reset email via edge function
   * - legacy_waitlist → returns isWaitlistOnly=true (caller should redirect to signup)
   * - new_user → returns isWaitlistOnly=true (no account at all)
   */
  const forgotPassword = async (email: string): Promise<ForgotPasswordResult> => {
    try {
      // Step 1: Check if this email actually has an auth account
      const status = await checkWaitlistEmail(email);

      if (status.status !== 'has_account') {
        // No auth account — can't reset a password that doesn't exist
        return { error: null, isWaitlistOnly: true };
      }

      // Step 2: Email has an auth account — send the reset email
      // Try the edge function first (same as web app), fall back to native Supabase
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;

      try {
        const { error } = await supabase.functions.invoke("send-password-reset", {
          body: { email, redirectTo },
        });

        if (error) {
          console.warn("Edge function failed, falling back to native reset:", error);
          // Fall back to Supabase native reset
          const { error: nativeError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
          });
          if (nativeError) return { error: nativeError };
        }
      } catch (edgeFnError) {
        console.warn("Edge function unavailable, using native reset:", edgeFnError);
        const { error: nativeError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (nativeError) return { error: nativeError };
      }

      return { error: null };
    } catch (e: unknown) {
      console.error("Unexpected forgot password error:", e);
      return { error: e };
    }
  };

  /**
   * Set a new password (called from the ResetPassword page after
   * the user clicks the link in their email).
   */
  const resetPassword = async (newPassword: string): Promise<{ error: unknown }> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error };
    } catch (e: unknown) {
      return { error: e };
    }
  };

  const signUp = async (email: string, password: string, userData: SignUpUserData) => {
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/confirm-email`
        : undefined;

    // Build preferred_retailers array from grocer_1/2/3
    const preferredRetailers = [
      userData.grocer_1,
      userData.grocer_2,
      userData.grocer_3,
    ].filter(Boolean) as string[];

    const displayName = `${userData.first_name ?? ""} ${
      userData.last_name ?? ""
    }`.trim();

    const finalMeta = {
      email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      date_of_birth: userData.birthday,
      gender_identity: userData.gender_identity,
      zip_code: userData.zip_code,
      preferred_retailers: preferredRetailers,
      app_preference: "mobile",
      display_name: displayName,
    };

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(redirectUrl ? { emailRedirectTo: redirectUrl } : {}),
          data: finalMeta,
        },
      });

      if (error) {
        console.error("Auth signUp error:", error);
        return { error };
      }

      // Detect "empty identities" — email already has an auth account
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return {
          error: {
            message: 'This email is already registered. Please sign in instead, or use "Forgot Password" if you need to set up your password.',
          },
        };
      }

      const userId = data.user?.id ?? null;

      // Upsert into waitlist
      try {
        const { error: waitlistError } = await supabase
          .from("waitlist")
          .upsert(
            {
              email,
              name: displayName || email,
              user_id: userId,
              zip_code: userData.zip_code ?? null,
              preferred_retailers:
                preferredRetailers.length > 0 ? preferredRetailers : null,
              device_preference: "mobile",
              date_of_birth: userData.birthday ?? null,
              first_name: userData.first_name ?? null,
              last_name: userData.last_name ?? null,
              phone_number: userData.phone_number ?? null,
              metadata: {
                source: "mobile-app",
                household_size: userData.household_size ?? null,
                created_from: "mobile-signup",
              },
            },
            { onConflict: "email" }
          );

        if (waitlistError) {
          console.error("Error upserting into waitlist:", waitlistError);
        }
      } catch (waitlistException) {
        console.error("Unexpected waitlist error:", waitlistException);
      }

      // Hydrate profile
      try {
        if (userId) {
          const profilesClient = supabase as unknown as ProfilesUpdateClient;
          const profileUpdates: Record<string, unknown> = {
              first_name: finalMeta.first_name,
              last_name: finalMeta.last_name,
              display_name: finalMeta.display_name,
              date_of_birth: finalMeta.date_of_birth,
              gender_identity: finalMeta.gender_identity,
              zip_code: finalMeta.zip_code,
              preferred_retailers: finalMeta.preferred_retailers,
              app_preference: finalMeta.app_preference,
              phone_number: finalMeta.phone_number,
              email,
            };

          const { error: profileError } = await profilesClient
            .from("profiles")
            .update(profileUpdates)
            .eq("user_id", userId);

          if (profileError) {
            console.error("Error updating profile:", profileError);
          }
        }
      } catch (profileException) {
        console.error("Unexpected profile update error:", profileException);
      }

      // Send emails
      try {
        await supabase.functions.invoke("send-welcome-email", {
          body: {
            name: displayName || userData.first_name || email,
            email,
          },
        });

        await supabase.functions.invoke("notify-admin-signup", {
          body: {
            firstName: userData.first_name,
            lastName: userData.last_name,
            email,
            dateOfBirth: finalMeta.date_of_birth,
            genderIdentity: finalMeta.gender_identity,
            zipCode: finalMeta.zip_code,
            preferredRetailers,
            appPreference: "mobile",
          },
        });
      } catch (emailError) {
        console.error("Failed to send signup-related emails:", emailError);
      }

      return { error: null };
    } catch (e: unknown) {
      console.error("Unexpected signup error:", e);
      return { error: e };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error) {
      setIsGuest(false);
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    checkWaitlistEmail,
    forgotPassword,
    resetPassword,
  };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
